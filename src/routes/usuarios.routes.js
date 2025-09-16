/**
 * routes/usuarios.routes.js
 * ----------------------------------------
 * Rotas de usuários.
 * - GET  /api/usuarios            → listar
 * - POST /api/usuarios            → criar
 * - PUT  /api/usuarios/:id        → atualizar (dinâmico por campos)
 * - GET  /api/usuarios/designados → listar estagiários/adv ativos
 */

const { Router } = require('express');
const c = require('../controllers/usuarios.controller');

const router = Router();

router.get('/', c.listar);
router.get('/designados', c.listarDesignados);
router.post('/', c.criar);
router.put('/:id', c.atualizar);

module.exports = router;
