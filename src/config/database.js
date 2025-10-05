/**
 * config/database.js (SaaS multi-tenant)
 * ----------------------------------------
 * - Cria tabela `tenants`
 * - Garante `tenant_id` nas tabelas de negócio
 * - Cria FKs/índices
 * - Seed do tenant padrão (id=1) e admin
 * - Helper withTenant() para filtrar queries por tenant
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  connectTimeout: 60000
};

// Criar pool de conexões
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

// Execução de SELECTs
async function executeQuery(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Erro ao executar query:', error);
    throw error;
  }
}

// Execução de INSERT/UPDATE/DELETE
async function executeUpdate(sql, params = []) {
  try {
    const [result] = await pool.execute(sql, params);
    return result;
  } catch (error) {
    console.error('Erro ao executar update:', error);
    throw error;
  }
}

/**
 * Helper para anexar filtro de tenant em SQL arbitrário.
 * Uso:
 *   const { sql, params } = withTenant('SELECT * FROM cliente', req.user.tenant_id);
 *   const rows = await executeQuery(sql, params);
 */
function withTenant(sql, tenantId, params = []) {
  const hasWhere = /\bwhere\b/i.test(sql);
  const glued = `${sql} ${hasWhere ? 'AND' : 'WHERE'} tenant_id = ?`;
  return { sql: glued, params: [...params, tenantId] };
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

    // 2) Tabelas (novas instalações já sob multi-tenant)
    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        nivel_acesso ENUM('admin','usuario','editor') DEFAULT 'usuario',
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ultimo_acesso TIMESTAMP NULL,
        ativo BOOLEAN DEFAULT TRUE,
        CONSTRAINT fk_usuarios_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS logs_acesso (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        usuario_id INT,
        acao VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        data_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
          ON UPDATE CASCADE ON DELETE RESTRICT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        chave VARCHAR(100) UNIQUE NOT NULL,
        valor TEXT,
        descricao VARCHAR(255),
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_config_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS cliente (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        nome VARCHAR(100) NOT NULL,
        data_nasc DATE,
        cpf_cnpj VARCHAR(20) UNIQUE NOT NULL,
        rg VARCHAR(20),
        telefone1 VARCHAR(20),
        telefone2 VARCHAR(20),
        email VARCHAR(100),
        endereco VARCHAR(200),
        uf VARCHAR(2),
        cidade VARCHAR(100),
        CONSTRAINT fk_cliente_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS documentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        numero VARCHAR(50) NOT NULL,
        cliente_id INT NOT NULL,
        tipo_documento VARCHAR(100),
        valor DECIMAL(10,2),
        data_inicio DATE,
        data_fim DATE,
        condicoes TEXT,
        arquivo_path VARCHAR(500),
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_documentos_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
          ON UPDATE CASCADE ON DELETE RESTRICT,
        FOREIGN KEY (cliente_id) REFERENCES cliente(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await executeUpdate(`
      CREATE TABLE IF NOT EXISTS acoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        protocolado BOOLEAN,
        cliente_id INT,
        titulo VARCHAR(60),
        complexidade ENUM('Baixa','Média','Alta') DEFAULT 'Baixa',
        designado_id INT,
        criador_id INT,
        status ENUM('Não iniciado','Em andamento','Concluído','Aprovado','Devolvido','Protocolado') DEFAULT 'Não iniciado',
        data_concluido DATE,
        data_aprovado DATE,
        comentario VARCHAR(500),
        arquivo_path LONGTEXT,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_acoes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3) Ajustes idempotentes para bases já existentes (ADD COLUMN -> backfill -> NOT NULL -> índice -> FK)
    const businessTables = ['usuarios', 'logs_acesso', 'configuracoes', 'cliente', 'documentos', 'acoes'];

    for (const t of businessTables) {
      if (await tableExists(t)) {
        if (!(await columnExists(t, 'tenant_id'))) {
          await executeUpdate(`ALTER TABLE \`${t}\` ADD COLUMN tenant_id INT NULL`);
        }
        await executeUpdate(`UPDATE \`${t}\` SET tenant_id = COALESCE(tenant_id, 1)`);
        await executeUpdate(`ALTER TABLE \`${t}\` MODIFY COLUMN tenant_id INT NOT NULL`);
        if (!(await indexExists(t, `idx_${t}_tenant`))) {
          await executeUpdate(`CREATE INDEX \`idx_${t}_tenant\` ON \`${t}\` (tenant_id)`);
        }
        const fkName = `fk_${t}_tenant`;
        if (!(await fkExists(t, fkName))) {
          try {
            await executeUpdate(`
              ALTER TABLE \`${t}\`
              ADD CONSTRAINT \`${fkName}\` FOREIGN KEY (tenant_id) REFERENCES tenants(id)
              ON UPDATE CASCADE ON DELETE RESTRICT
            `);
          } catch (_) { /* ignora se já existir com outro nome */ }
        }
      }
    }

    // 4) Índices úteis
    if (await tableExists('documentos')) {
      if (!(await indexExists('documentos', 'idx_documentos_numero'))) {
        await executeUpdate(`CREATE INDEX idx_documentos_numero ON documentos (numero)`);
      }
      if (!(await indexExists('documentos', 'idx_documentos_cliente'))) {
        await executeUpdate(`CREATE INDEX idx_documentos_cliente ON documentos (cliente_id)`);
      }
    }
    if (await tableExists('acoes')) {
      if (!(await indexExists('acoes', 'idx_acoes_cliente'))) {
        await executeUpdate(`CREATE INDEX idx_acoes_cliente ON acoes (cliente_id)`);
      }
      if (!(await indexExists('acoes', 'idx_acoes_status'))) {
        await executeUpdate(`CREATE INDEX idx_acoes_status ON acoes (status)`);
      }
      if (!(await indexExists('acoes', 'idx_acoes_criacao'))) {
        await executeUpdate(`CREATE INDEX idx_acoes_criacao ON acoes (data_criacao)`);
      }
    }

    // 5) Seed: tenant padrão e admin
    const [{ c: tenantsCount }] = await executeQuery(`SELECT COUNT(*) AS c FROM tenants`);
    if (tenantsCount === 0) {
      await executeUpdate(
        `INSERT INTO tenants (nome_empresa, cnpj, email_admin, plano, licenca_ativa) VALUES (?,?,?,?,?)`,
        ['Default Tenant', null, process.env.ADMIN_EMAIL || 'admin@exemplo.com', 'basic', true]
      );
    }

    const admin = await executeQuery('SELECT id FROM usuarios WHERE email = ?', ['admin@exemplo.com']);
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
  executeQuery,
  executeUpdate,
  initializeDatabase,
  withTenant
};
