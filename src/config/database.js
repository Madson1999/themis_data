/**
 * config/database.js (SaaS multi-tenant)
 * ----------------------------------------
 * - Cria tabela `tenants`
 * - Padroniza `clientes` (plural) e migra da antiga `cliente`
 * - Garante `tenant_id` nas tabelas de negócio + FKs/índices
 * - Unicidade por tenant (usuarios.email, configuracoes.chave, clientes.cpf_cnpj)
 * - Seed do tenant padrão (id=1) e admin
 * - Helpers executeQuery/executeUpdate (prepared), query (não-prepared) e withTenant() (robusto)
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Config do banco
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  connectTimeout: 60000,
};

// Pool de conexões
const pool = mysql.createPool(dbConfig);

// Testar conexão
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    console.log('✅ Conexão com o banco de dados estabelecida com sucesso!');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com o banco de dados:', error.message);
    return false;
  }
}

/* ================== Core helpers ================== */

// SELECTs (prepared)
async function executeQuery(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Erro ao executar query:', error);
    throw error;
  }
}

// INSERT/UPDATE/DELETE (prepared)
async function executeUpdate(sql, params = []) {
  try {
    const [result] = await pool.execute(sql, params);
    return result;
  } catch (error) {
    console.error('Erro ao executar update:', error);
    throw error;
  }
}

// Consulta não-prepared (útil para SELECT com LIMIT/OFFSET numéricos já saneados)
async function query(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error('Erro ao executar query (não-prepared):', error);
    throw error;
  }
}

/**
 * Helper: injeta filtro de tenant ANTES de ORDER BY / GROUP BY / LIMIT.
 * Uso:
 *   const { sql, params } = withTenant('SELECT * FROM clientes ORDER BY nome', tenantId);
 *   const rows = await executeQuery(sql, params);
 */
function withTenant(sql, tenantId, params = []) {
  const clauses = [' order by ', ' group by ', ' limit '];
  const lower = sql.toLowerCase();
  let insertPos = sql.length;

  for (const c of clauses) {
    const idx = lower.indexOf(c);
    if (idx !== -1 && idx < insertPos) insertPos = idx;
  }

  const before = sql.slice(0, insertPos).trimEnd();
  const after = sql.slice(insertPos); // pode ser vazio

  const hasWhere = /\bwhere\b/i.test(before);
  const glue = hasWhere ? ' AND ' : ' WHERE ';
  const sqlWithTenant = `${before}${glue}tenant_id = ?${after}`;

  return { sql: sqlWithTenant, params: [...params, tenantId] };
}

/* ===== Helpers de introspecção (idempotência) ===== */
async function tableExists(table) {
  const rows = await executeQuery(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1`,
    [process.env.DB_NAME, table]
  );
  return rows.length > 0;
}
async function columnExists(table, column) {
  const rows = await executeQuery(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [process.env.DB_NAME, table, column]
  );
  return rows.length > 0;
}
async function indexExists(table, indexName) {
  const rows = await executeQuery(
    `SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
    [process.env.DB_NAME, table, indexName]
  );
  return rows.length > 0;
}
async function fkExists(table, constraintName) {
  const rows = await executeQuery(
    `SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE constraint_schema = ? AND table_name = ? AND constraint_name = ?`,
    [process.env.DB_NAME, table, constraintName]
  );
  return rows.length > 0;
}
// Drop todas as FKs de uma tabela que apontem para outra
async function dropFksReferencing(table, refTable) {
  const rows = await executeQuery(
    `SELECT CONSTRAINT_NAME
       FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME = ?`,
    [process.env.DB_NAME, table, refTable]
  );
  for (const r of rows) {
    await executeUpdate(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${r.CONSTRAINT_NAME}\``).catch(() => { });
  }
}

/* ===== Helpers idempotentes de migração ===== */
async function addColumnIfMissing(table, columnDef, columnNameOnly) {
  if (!(await columnExists(table, columnNameOnly))) {
    await executeUpdate(`ALTER TABLE \`${table}\` ADD COLUMN ${columnDef}`);
  }
}
async function dropIndexIfExists(table, indexName) {
  if (await indexExists(table, indexName)) {
    await executeUpdate(`ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``);
  }
}
async function ensureIndex(table, indexName, columnsExpr) {
  if (!(await indexExists(table, indexName))) {
    await executeUpdate(`CREATE INDEX \`${indexName}\` ON \`${table}\` ${columnsExpr}`);
  }
}
async function ensureUniqueIndex(table, indexName, columnsExpr) {
  if (!(await indexExists(table, indexName))) {
    await executeUpdate(`CREATE UNIQUE INDEX \`${indexName}\` ON \`${table}\` ${columnsExpr}`);
  }
}
async function getColumnType(table, column) {
  const rows = await executeQuery(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.DB_NAME, table, column]
  );
  return rows[0]?.COLUMN_TYPE || null;
}
async function ensureEnumValues(table, column, enumList, defaultVal) {
  const desired = `enum('${enumList.join("','")}')`;
  const current = (await getColumnType(table, column)) || '';

  if (current.toLowerCase() !== desired.toLowerCase()) {
    const safeDefault = enumList.includes(defaultVal) ? defaultVal : enumList[0];
    const esc = (s) => String(s).replace(/'/g, "\\'");
    const enumSql = enumList.map((v) => `'${esc(v)}'`).join(',');

    const sql = `
      ALTER TABLE \`${table}\`
      MODIFY COLUMN \`${column}\` ENUM(${enumSql}) DEFAULT '${esc(safeDefault)}'
    `;
    await executeUpdate(sql).catch(() => { });
  }
}

/* ===== Inicialização do schema (multi-tenant) ===== */
async function initializeDatabase() {
  try {
    // 1) Tabela Tenants
    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome_empresa VARCHAR(150) NOT NULL,
        cnpj VARCHAR(20) UNIQUE,
        email_admin VARCHAR(150) NOT NULL,
        plano ENUM('basic','plus','ultra') DEFAULT 'basic',
        licenca_ativa BOOLEAN DEFAULT TRUE,
        data_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_fim TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2) Tabelas base (já com multi-tenant)
    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS usuarios(
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        senha VARCHAR(255) NOT NULL,
        nivel_acesso ENUM('admin', 'usuario', 'editor') DEFAULT 'usuario',
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ultimo_acesso TIMESTAMP NULL,
        ativo BOOLEAN DEFAULT TRUE,
        CONSTRAINT fk_usuarios_tenant FOREIGN KEY(tenant_id) REFERENCES tenants(id)
          ON UPDATE CASCADE ON DELETE RESTRICT,
        UNIQUE KEY uniq_usuarios_tenant_email(tenant_id, email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ajuste opcional do ENUM (perfis do front)
    await ensureEnumValues(
      'usuarios',
      'nivel_acesso',
      ['admin', 'adv', 'gerente', 'estagiario', 'secretaria', 'usuario', 'editor'],
      'usuario'
    );

    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS logs_acesso(
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        usuario_id INT,
        acao VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        data_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_logs_tenant FOREIGN KEY(tenant_id) REFERENCES tenants(id)
          ON UPDATE CASCADE ON DELETE RESTRICT,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS configuracoes(
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        chave VARCHAR(100) NOT NULL,
        valor TEXT,
        descricao VARCHAR(255),
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_config_tenant FOREIGN KEY(tenant_id) REFERENCES tenants(id)
          ON UPDATE CASCADE ON DELETE RESTRICT,
        UNIQUE KEY uniq_config_tenant_chave(tenant_id, chave)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // === TABELA CLIENTES (plural, multi-tenant) ===
    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS clientes(
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        nome VARCHAR(100) NOT NULL,
        data_nasc DATE,
        cpf_cnpj VARCHAR(20) NOT NULL,
        rg VARCHAR(20),
        telefone1 VARCHAR(20),
        telefone2 VARCHAR(20),
        email VARCHAR(100),
        endereco VARCHAR(200),
        bairro VARCHAR(100),
        cep VARCHAR(10),
        uf VARCHAR(2),
        cidade VARCHAR(100),
        profissao VARCHAR(30),
        nacionalidade VARCHAR(20),
        estado_civil VARCHAR(20),
        CONSTRAINT fk_clientes_tenant FOREIGN KEY(tenant_id) REFERENCES tenants(id)
          ON UPDATE CASCADE ON DELETE RESTRICT,
        UNIQUE KEY uniq_clientes_tenant_cpf(tenant_id, cpf_cnpj),
        INDEX idx_clientes_tenant_nome(tenant_id, nome)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // === TABELA AÇÕES (referencia clientes) ===
    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS acoes(
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        protocolado BOOLEAN,
        cliente_id INT,
        titulo VARCHAR(60),
        complexidade ENUM('Baixa', 'Média', 'Alta') DEFAULT 'Baixa',
        designado_id INT,
        criador_id INT,
        status ENUM('Não iniciado', 'Em andamento', 'Concluído', 'Aprovado', 'Finalizado', 'Devolvido', 'Protocolado') DEFAULT 'Não iniciado',
        data_concluido DATE,
        data_aprovado DATE,
        comentario VARCHAR(500),
        arquivo_path LONGTEXT,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_acoes_tenant FOREIGN KEY(tenant_id) REFERENCES tenants(id)
          ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT fk_acoes_cliente FOREIGN KEY(cliente_id) REFERENCES clientes(id)
          ON UPDATE CASCADE ON DELETE RESTRICT,
        INDEX idx_acoes_cliente(cliente_id),
        INDEX idx_acoes_status(status),
        INDEX idx_acoes_criacao(data_criacao)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3) Ajustes idempotentes: tenant_id + índices/FKs nas tabelas de negócio
    // REMOVIDO 'documentos' desta lista
    const businessTables = ['usuarios', 'logs_acesso', 'configuracoes', 'clientes', 'acoes'];

    for (const t of businessTables) {
      if (await tableExists(t)) {
        if (!(await columnExists(t, 'tenant_id'))) {
          await executeUpdate(`ALTER TABLE \`${t}\` ADD COLUMN tenant_id INT NULL`);
        }
        await executeUpdate(`UPDATE \`${t}\` SET tenant_id = COALESCE(tenant_id, 1)`);
        await executeUpdate(`ALTER TABLE \`${t}\` MODIFY COLUMN tenant_id INT NOT NULL`).catch(() => { });
        if (!(await indexExists(t, `idx_${t}_tenant`))) {
          await executeUpdate(`CREATE INDEX \`idx_${t}_tenant\` ON \`${t}\` (tenant_id)`);
        }
        const fkName = `fk_${t}_tenant`;
        if (!(await fkExists(t, fkName))) {
          await executeUpdate(`
            ALTER TABLE \`${t}\`
            ADD CONSTRAINT \`${fkName}\` FOREIGN KEY (tenant_id) REFERENCES tenants(id)
            ON UPDATE CASCADE ON DELETE RESTRICT
          `).catch(() => { });
        }
      }
    }

    // 4) Unicidade por tenant
    await dropIndexIfExists('usuarios', 'email');
    await ensureUniqueIndex('usuarios', 'uniq_usuarios_tenant_email', '(tenant_id, email)');

    await dropIndexIfExists('configuracoes', 'chave');
    await ensureUniqueIndex('configuracoes', 'uniq_config_tenant_chave', '(tenant_id, chave)');

    await ensureUniqueIndex('clientes', 'uniq_clientes_tenant_cpf', '(tenant_id, cpf_cnpj)');
    await ensureIndex('clientes', 'idx_clientes_tenant_nome', '(tenant_id, nome)');

    // 5) Índices extras (REMOVIDOS os de `documentos`)
    await ensureIndex('acoes', 'idx_acoes_cliente', '(cliente_id)');
    await ensureIndex('acoes', 'idx_acoes_status', '(status)');
    await ensureIndex('acoes', 'idx_acoes_criacao', '(data_criacao)');

    // 6) Seed: tenant padrão e admin
    const [{ c: tenantsCount }] = await executeQuery(`SELECT COUNT(*) AS c FROM tenants`);
    if (tenantsCount === 0) {
      await executeUpdate(
        `INSERT INTO tenants (nome_empresa, cnpj, email_admin, plano, licenca_ativa) VALUES (?,?,?,?,?)`,
        ['Default Tenant', null, process.env.ADMIN_EMAIL || 'admin@exemplo.com', 'basic', true]
      );
    }

    const admin = await executeQuery('SELECT id FROM usuarios WHERE tenant_id = 1 AND email = ?', ['admin@exemplo.com']);
    if (admin.length === 0) {
      const bcrypt = require('bcryptjs');
      const senhaHash = await bcrypt.hash('123456', 10);
      await executeUpdate(
        'INSERT INTO usuarios (tenant_id, nome, email, senha, nivel_acesso) VALUES (?, ?, ?, ?, ?)',
        [1, 'Administrador', 'admin@exemplo.com', senhaHash, 'admin']
      );
      console.log('👤 Usuário admin criado com sucesso!');
    }

    console.log('✅ Banco de dados inicializado (multi-tenant) com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

module.exports = {
  pool,
  testConnection,
  executeQuery, // prepared
  executeUpdate, // prepared
  query,        // não-prepared (útil p/ LIMIT/OFFSET numérico)
  initializeDatabase,
  withTenant,
};
