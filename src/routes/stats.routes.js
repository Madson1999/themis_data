/**
 * routes/stats.routes.js
 * ----------------------------------------
 * Rotas de estatísticas do dashboard (multi-tenant).
 * - Exige identificação do tenant (cookie `tenant_id` ou header `x-tenant-id`)
 * - GET /api/stats → métricas agregadas (usuários, novos hoje, acessos hoje, total logs)
 */

const { Router } = require('express');
const c = require('../controllers/stats.controller');

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

router.get('/', c.overview);

module.exports = router;
