/**
 * server.js
 * ----------------------------------------
 * Entry point HTTP da aplicação (SaaS multi-tenant).
 *
 * - Testa conexão e inicializa o banco (migrations idempotentes)
 * - Sobe o servidor HTTP usando o app Express (src/app.js)
 * - Logs úteis de inicialização (URLs base)
 * - Tratamento básico de erros e desligamento gracioso
 */

const http = require('http');
const app = require('./src/app');
const { testConnection, initializeDatabase } = require('./src/config/database');

const PORT = Number(process.env.PORT || 3000);

(async () => {
  try {
    const ok = await testConnection();
    if (ok) {
      await initializeDatabase();
    } else {
      console.log('⚠️  Servidor iniciando sem banco de dados (conexão indisponível)...');
    }
  } catch (e) {
    console.error('❌ Erro ao inicializar DB:', e);
  }

  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando:  http://localhost:${PORT}`);
    console.log(`🔐 Painel Superadmin: http://localhost:${PORT}/administrador`);
    console.log(`🧩 API base:          http://localhost:${PORT}/api\n`);
  });

  // Tratamento básico de erros não capturados
  process.on('unhandledRejection', (reason) => {
    console.error('🚨 Unhandled Rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('🚨 Uncaught Exception:', err);
  });

  // Desligamento gracioso
  const shutdown = (signal) => {
    console.log(`\n${signal} recebido. Encerrando servidor...`);
    server.close(() => {
      console.log('✅ Servidor encerrado com sucesso.');
      process.exit(0);
    });
    // Se não encerrar em 10s, força
    setTimeout(() => {
      console.warn('⏱️  Forçando encerramento.');
      process.exit(1);
    }, 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
})();
