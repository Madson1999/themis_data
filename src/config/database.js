/**
 * config/database.js
 * ----------------------------------------
 * Camada de acesso ao MySQL.
 * - testConnection(): testa conexão
 * - executeQuery(sql, params): executa consultas/prepared statements
 * - initializeDatabase(): cria/ajusta tabelas necessárias
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

// Função para testar a conexão
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexão com o banco de dados estabelecida com sucesso!');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com o banco de dados:', error.message);
    return false;
  }
}

// Função para executar queries
async function executeQuery(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Erro ao executar query:', error);
    throw error;
  }
}

// Função para executar queries de inserção/atualização
async function executeUpdate(sql, params = []) {
  try {
    const [result] = await pool.execute(sql, params);
    return result;
  } catch (error) {
    console.error('Erro ao executar update:', error);
    throw error;
  }
}

// Função para inicializar o banco de dados (criar tabelas se não existirem)
async function initializeDatabase() {
  try {
    // Tabela de usuários
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        nivel_acesso ENUM('admin', 'usuario', 'editor') DEFAULT 'usuario',
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ultimo_acesso TIMESTAMP NULL,
        ativo BOOLEAN DEFAULT TRUE
      )
    `;

    // Tabela de logs de acesso
    const createLogsTable = `
      CREATE TABLE IF NOT EXISTS logs_acesso (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT,
        acao VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        data_acesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      )
    `;

    // Tabela de configurações do sistema
    const createConfigTable = `
      CREATE TABLE IF NOT EXISTS configuracoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chave VARCHAR(100) UNIQUE NOT NULL,
        valor TEXT,
        descricao VARCHAR(255),
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;

    // Tabela de clientes
    const createClientesTable = `
      CREATE TABLE IF NOT EXISTS cliente (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        data_nasc DATE,
        cpf_cnpj VARCHAR(20) UNIQUE NOT NULL,
        rg VARCHAR(20),
        telefone VARCHAR(20),
        email VARCHAR(100),
        endereco VARCHAR(200),
        uf VARCHAR(2),
        cidade VARCHAR(100)
      )
    `;

    // Tabela de contratos
    const createContratosTable = `
      CREATE TABLE IF NOT EXISTS contratos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        numero VARCHAR(50) NOT NULL,
        cliente_id INT NOT NULL,
        tipo_contrato VARCHAR(100),
        valor DECIMAL(10,2),
        data_inicio DATE,
        data_fim DATE,
        condicoes TEXT,
        arquivo_path VARCHAR(500),
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES cliente(id)
      )
    `;

    //Tabela de Designar Ações
    const createAcoes = `
    CREATE TABLE IF NOT EXISTS acoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    protocolado BOOLEAN,
    cliente_id INT,
    titulo VARCHAR(60),
    designado_id INT,
    criador_id INT,
    status VARCHAR(20),
    data_concluido DATE,
    data_aprovado DATE,
    comentario VARCHAR(500),
    arquivo_path LONGTEXT,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;


    await executeQuery(createAcoes);
    await executeQuery(createUsersTable);
    await executeQuery(createLogsTable);
    await executeQuery(createConfigTable);
    await executeQuery(createClientesTable);
    await executeQuery(createContratosTable);

    // Inserir usuário admin padrão se não existir
    const checkAdmin = await executeQuery('SELECT id FROM usuarios WHERE email = ?', ['admin@exemplo.com']);
    if (checkAdmin.length === 0) {
      const bcrypt = require('bcryptjs');
      const senhaHash = await bcrypt.hash('123456', 10);
      await executeQuery(
        'INSERT INTO usuarios (nome, email, senha, nivel_acesso) VALUES (?, ?, ?, ?)',
        ['Administrador', 'admin@exemplo.com', senhaHash, 'admin']
      );
      console.log('👤 Usuário admin criado com sucesso!');
    }

    console.log('✅ Banco de dados inicializado com sucesso!');
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
  initializeDatabase
}; 