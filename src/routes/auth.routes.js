/**
 * routes/auth.routes.js
 * ----------------------------------------
 * Rotas de autenticação (multi-tenant).
 *
 * Endpoints:
 *  - POST /api/auth/login  → autentica usuário (exige tenant_id no body ou header x-tenant-id)
 *  - GET  /api/auth/me     → retorna usuário logado (escopado por tenant)
 *
 * Compat:
 *  - Você já mantém POST /login no app.js (fora de /api) para front antigo.
 *  - (Opcional) Alias abaixo para /api/auth/usuario-logado apontando para o mesmo handler de /me.
 */

const { Router } = require('express');
const c = require('../controllers/auth.controller');
const authCtrl = require('../controllers/auth.controller');
const router = Router();

// Novo caminho /api/auth/login (mantendo /login direto no app.js por compat)
router.post('/login', c.login);

// /api/auth/me (consulta do usuário logado)
router.get('/me', c.usuarioLogado);

// Alias opcional para compatibilidade
router.get('/usuario-logado', c.usuarioLogado);

// ... suas outras rotas (login, etc.)
router.get('/tenant-by-email', authCtrl.getTenantByEmail);

module.exports = router;
