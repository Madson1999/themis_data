/**
 * routes/index.js
 * ----------------------------------------
 * Agregador das rotas da API.
 * - Conecta sub-rotas: /auth, /clientes, /usuarios, /acoes, /documentos, /protocolacao, /stats
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

router.use('/auth', auth);
router.use('/clientes', clientes);
router.use('/usuarios', usuarios);
router.use('/acoes', acoes);
router.use('/documentos', documentos);
router.use('/protocolacao', protocolacao);
router.use('/stats', stats);
router.use(require('./admin.routes'));

// compat: manter o endpoint original do usuário logado
router.get('/usuario-logado', require('../controllers/auth.controller').usuarioLogado);

module.exports = router;
