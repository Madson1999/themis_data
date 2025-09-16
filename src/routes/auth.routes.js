/**
 * routes/auth.routes.js
 * ----------------------------------------
 * Rotas de autenticação.
 * - POST /api/auth/login  (ou /api/login, se mantido compat)
 * - GET  /api/auth/me     (ou /api/usuario-logado, se mantido compat)
 */

const { Router } = require('express');
const c = require('../controllers/auth.controller');

const router = Router();
// Novo caminho /api/auth/login (mantive /login direto no app.js por compat)
router.post('/login', c.login);
// Alternativo /api/auth/me (além do /api/usuario-logado)
router.get('/me', c.usuarioLogado);

module.exports = router;
