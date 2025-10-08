/**
 * routes/admin.routes.js
 * ----------------------------------------
 * Rotas do painel do SUPERADMIN (/administrador).
 *
 * Páginas:
 *  - GET  /administrador           → tela de login do superadmin
 *  - GET  /administrador/painel    → painel (protegido por requireAdmin)
 *
 * API:
 *  - POST /api/admin/login
 *  - POST /api/admin/logout
 *  - GET  /api/admin/me
 *  - GET  /api/admin/tenants
 *  - GET  /api/admin/tenants/:id
 *  - POST /api/admin/tenants
 *  - PATCH /api/admin/tenants/:id
 *  - DELETE /api/admin/tenants/:id
 *  - POST /api/admin/tenants/:id/admin/ensure
 *  - POST /api/admin/tenants/:id/admin/reset-password
 *
 * Observações:
 * - Este módulo é global (sem filtro de tenant_id).
 * - Proteções de acesso feitas por requireAdmin (cookie HttpOnly "admin_token").
 */

const path = require('path');
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/admin.controller');
const { requireAdmin } = require('../middlewares/adminAuth');

// páginas
router.get('/administrador', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../public/administrador.html'));
});

router.get('/administrador/painel', requireAdmin, (_req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin.html'));
});

// API admin
router.post('/api/admin/login', ctrl.login);
router.post('/api/admin/logout', requireAdmin, ctrl.logout);
router.get('/api/admin/me', requireAdmin, ctrl.me);

// tenants CRUD
router.get('/api/admin/tenants', requireAdmin, ctrl.listTenants);
router.get('/api/admin/tenants/:id', requireAdmin, ctrl.getTenant);
router.post('/api/admin/tenants', requireAdmin, ctrl.createTenant);
router.patch('/api/admin/tenants/:id', requireAdmin, ctrl.updateTenant);
router.delete('/api/admin/tenants/:id', requireAdmin, ctrl.removeTenant);

// Geração/Reset de senha do admin do tenant
router.post('/api/admin/tenants/:id/admin/ensure', requireAdmin, ctrl.ensureTenantAdmin);
router.post('/api/admin/tenants/:id/admin/reset-password', requireAdmin, ctrl.resetTenantAdminPassword);

module.exports = router;
