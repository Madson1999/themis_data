/**
 * routes/usuarios.routes.js
 * ----------------------------------------
 * Rotas de usuários (multi-tenant).
 * - Exige identificação do tenant (cookie `tenant_id` ou header `x-tenant-id`)
 *
 * Endpoints:
 *  - GET  /api/usuarios            → listar
 *  - POST /api/usuarios            → criar
 *  - PUT  /api/usuarios/:id        → atualizar (dinâmico por campos)
 *  - GET  /api/usuarios/designados → listar estagiários/adv ativos
 */

const { Router } = require('express');
const c = require('../controllers/usuarios.controller');

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

router.get('/', c.listar);
router.get('/designados', c.listarDesignados);
router.post('/', c.criar);
router.put('/:id', c.atualizar);

module.exports = router;
