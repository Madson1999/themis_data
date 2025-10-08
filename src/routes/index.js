/**
 * routes/index.js
 * ----------------------------------------
 * Agregador das rotas da API (multi-tenant).
 * - Conecta sub-rotas: /auth, /clientes, /usuarios, /acoes, /documentos, /protocolacao, /stats
 * - NÃO monta as rotas do SUPERADMIN aqui para evitar prefixo duplicado (/api/api/admin).
 *   → Monte `admin.routes.js` diretamente no app.js (ex.: `app.use('/', require('./routes/admin.routes'))`)
 */

const { Router } = require('express');

const auth = require('./auth.routes');
const clientes = require('./clientes.routes');
const usuarios = require('./usuarios.routes');
const acoes = require('./acoes.routes');
const documentos = require('./documentos.routes');
const protocolacao = require('./protocolacao.routes');
const stats = require('./stats.routes');

const router = Router();

// Sub-rotas da API (todas multi-tenant via seus próprios middlewares)
router.use('/auth', auth);
router.use('/clientes', clientes);
router.use('/usuarios', usuarios);
router.use('/acoes', acoes);
router.use('/documentos', documentos);
router.use('/protocolacao', protocolacao);
router.use('/stats', stats);

// ⚠️ Importante: NÃO montar admin.routes aqui.
// Ele já define caminhos absolutos (/administrador e /api/admin/*).
// Monte em app.js, fora deste agregador, para evitar /api/api/*.

// Compat: manter endpoint original do usuário logado
router.get('/usuario-logado', require('../controllers/auth.controller').usuarioLogado);

module.exports = router;
