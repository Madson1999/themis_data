/**
 * routes/clientes.routes.js
 * ----------------------------------------
 * Rotas de clientes.
 * - GET    /api/clientes              → lista/busca (nome e/ou CPF/CNPJ)
 * - GET    /api/clientes/documentos    → busca leve p/ autocomplete de documentos
 * - POST   /api/clientes              → criar cliente
 * - GET    /api/clientes/:id          → obter por id
 * - PUT    /api/clientes/:id          → atualizar
 * - DELETE /api/clientes/:id          → excluir
 */

const { Router } = require('express');
const c = require('../controllers/clientes.controller');

const router = Router();

router.get('/', c.listar);                     // /api/clientes?searchTerm=...
router.get('/documentos', c.buscarParaDocumento);// /api/clientes/documentos?q=...
router.post('/', c.criar);
router.get('/:id', c.obterPorId);
router.put('/:id', c.atualizar);
router.delete('/:id', c.excluir);

module.exports = router;
