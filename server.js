/**
 * server.js
 * ----------------------------------------
 * Entry point HTTP da aplicação.
 * - Cria o servidor HTTP e liga na porta (env PORT ou 3000)
 * - Importa e usa o app Express de src/app.js
 */

const http = require('http');
const app = require('./src/app');
const { testConnection, initializeDatabase } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    const ok = await testConnection();
    if (ok) await initializeDatabase();
    else console.log('⚠️  Servidor iniciando sem banco de dados...');
  } catch (e) {
    console.error('❌ Erro ao inicializar DB:', e);
  }

  http.createServer(app).listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  });
})();