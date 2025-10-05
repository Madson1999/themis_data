// src/routes/admin.routes.js
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
