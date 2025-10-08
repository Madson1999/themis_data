/**
 * routes/documentos.routes.js
 * ----------------------------------------
 * Rotas de geração de documentos (multi-tenant).
 * - Exige identificação do tenant (cookie `tenant_id` ou header `x-tenant-id`)
 *
 * Endpoints:
 *  - POST /api/documentos/gerar  → gera pacote de DOCX a partir dos templates
 */

const express = require('express');
const router = express.Router();
const documentosCtrl = require('../controllers/documentos.controller');

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

router.post('/gerar', documentosCtrl.gerar);

module.exports = router;
