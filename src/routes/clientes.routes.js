/**
 * routes/clientes.routes.js
 * ----------------------------------------
 * Rotas de clientes (multi-tenant).
 * - Exige identificação do tenant (cookie `tenant_id` ou header `x-tenant-id`)
 *
 * Endpoints:
 *  - GET    /api/clientes               → lista/busca (nome e/ou CPF/CNPJ)
 *  - GET    /api/clientes/documentos    → busca leve p/ autocomplete de documentos
 *  - POST   /api/clientes               → criar cliente
 *  - GET    /api/clientes/:id           → obter por id
 *  - PUT    /api/clientes/:id           → atualizar
 *  - DELETE /api/clientes/:id           → excluir
 */

const { Router } = require('express');
const c = require('../controllers/clientes.controller');

const router = Router();

/** Middleware local: exige tenant_id (cookie ou header) em todas as rotas abaixo */
function ensureTenant(req, res, next) {
    const fromCookie = req.cookies?.tenant_id;
    const fromHeader = req.headers['x-tenant-id'];
    const t = Number(fromCookie ?? fromHeader);
    if (!Number.isFinite(t) || t <= 0) {
        return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });
    }
    next();
}

router.use(ensureTenant);

router.get('/', c.listar);                       // /api/clientes?searchTerm=...
router.get('/documentos', c.buscarParaDocumento);// /api/clientes/documentos?q=...
router.post('/', c.criar);
router.get('/:id', c.obterPorId);
router.put('/:id', c.atualizar);
router.delete('/:id', c.excluir);

module.exports = router;
