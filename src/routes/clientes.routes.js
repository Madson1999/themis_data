/**
 * routes/clientes.routes.js
 * ----------------------------------------
 * Rotas de clientes.
 * - GET    /api/clientes              → lista/busca (nome e/ou CPF/CNPJ)
 * - GET    /api/clientes/contratos    → busca leve p/ autocomplete de contratos
 * - POST   /api/clientes              → criar cliente
 * - GET    /api/clientes/:id          → obter por id
 * - PUT    /api/clientes/:id          → atualizar
 * - DELETE /api/clientes/:id          → excluir
 */

const { Router } = require('express');
const c = require('../controllers/clientes.controller');

const router = Router();

router.get('/', c.listar);                     // /api/clientes?searchTerm=...
router.get('/contratos', c.buscarParaContrato);// /api/clientes/contratos?q=...
router.post('/', c.criar);
router.get('/:id', c.obterPorId);
router.put('/:id', c.atualizar);
router.delete('/:id', c.excluir);

module.exports = router;
