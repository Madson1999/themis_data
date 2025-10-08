/**
 * admin.controller.js
 * ----------------------------------------
 * Controlador do SUPERADMIN do sistema (painel /administrador).
 *
 * Funcionalidades:
 * - Autenticação do superadmin (cookie admin_token)
 * - CRUD de tenants (licenças)
 * - Garantir/criar admin de tenant e resetar senha (retorna a senha apenas na resposta)
 *
 * Endpoints (ver routes/admin.routes.js):
 *  POST   /api/admin/login
 *  POST   /api/admin/logout
 *  GET    /api/admin/me
 *  GET    /api/admin/tenants
 *  GET    /api/admin/tenants/:id
 *  POST   /api/admin/tenants
 *  PATCH  /api/admin/tenants/:id
 *  DELETE /api/admin/tenants/:id
 *  POST   /api/admin/tenants/:id/admin/ensure
 *  POST   /api/admin/tenants/:id/admin/reset-password
 *
 * Observações:
 * - Este controller é global (não aplica filtro por tenant_id).
 * - Senhas dos usuários são armazenadas como hash (bcrypt) em `usuarios`.
 */

const bcrypt = require('bcryptjs');
const Tenants = require('../services/tenants.service');
const { createAdminToken, setAdminCookie, clearAdminCookie } = require('../middlewares/adminAuth');

exports.login = async (req, res) => {
    try {
        const email = (req.body?.email || '').trim();
        const senha = req.body?.senha || '';
        if (!email || !senha) {
            return res.status(400).json({ sucesso: false, mensagem: 'Email e senha são obrigatórios' });
        }

        const superEmail = (process.env.SUPERADMIN_EMAIL || '').trim();
        const plain = process.env.SUPERADMIN_PASSWORD || '';
        const hash = process.env.SUPERADMIN_PASSWORD_HASH || '';

        let ok = false;
        if (hash) {
            ok = email === superEmail && await bcrypt.compare(senha, hash);
        } else {
            ok = email === superEmail && senha === plain;
        }
        if (!ok) {
            return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas' });
        }

        const token = createAdminToken(email);
        setAdminCookie(res, token);
        return res.json({ sucesso: true, mensagem: 'Autenticado' });
    } catch (e) {
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao autenticar' });
    }
};

exports.logout = async (_req, res) => {
    clearAdminCookie(res);
    res.json({ sucesso: true });
};

exports.me = async (req, res) => {
    res.json({ sucesso: true, admin: { email: req.admin.email } });
};

// Tenants CRUD
exports.listTenants = async (_req, res) => {
    try {
        const rows = await Tenants.list();
        res.json({ sucesso: true, data: rows });
    } catch (e) {
        res.status(500).json({ sucesso: false, mensagem: 'Falha ao listar tenants' });
    }
};

exports.getTenant = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
        }
        const t = await Tenants.get(id);
        if (!t) return res.status(404).json({ sucesso: false, mensagem: 'Tenant não encontrado' });
        res.json({ sucesso: true, data: t });
    } catch (e) {
        res.status(500).json({ sucesso: false, mensagem: 'Falha ao buscar tenant' });
    }
};

exports.createTenant = async (req, res) => {
    try {
        const nome_empresa = (req.body?.nome_empresa || '').trim();
        const cnpj = (req.body?.cnpj || '').trim() || null;
        const email_admin = (req.body?.email_admin || '').trim();
        const plano = (req.body?.plano || 'basic').trim();

        if (!nome_empresa || !email_admin) {
            return res.status(400).json({ sucesso: false, mensagem: 'nome_empresa e email_admin são obrigatórios' });
        }
        const created = await Tenants.create({ nome_empresa, cnpj, email_admin, plano });
        res.status(201).json({ sucesso: true, data: created });
    } catch (e) {
        res.status(500).json({ sucesso: false, mensagem: 'Falha ao criar tenant' });
    }
};

exports.updateTenant = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
        }
        const updated = await Tenants.update(id, req.body || {});
        res.json({ sucesso: true, data: updated });
    } catch (e) {
        res.status(500).json({ sucesso: false, mensagem: 'Falha ao atualizar tenant' });
    }
};

exports.removeTenant = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
        }
        const removed = await Tenants.remove(id);
        res.json({ sucesso: true, data: removed });
    } catch (e) {
        res.status(500).json({ sucesso: false, mensagem: 'Falha ao desativar tenant' });
    }
};

// Garantir/criar admin do tenant (gera senha apenas nesta resposta se novo)
exports.ensureTenantAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
        }
        const out = await Tenants.ensureAdminUser(id);
        return res.json({ sucesso: true, data: out });
    } catch (e) {
        return res.status(400).json({ sucesso: false, mensagem: e.message || 'Falha ao garantir admin' });
    }
};

// Resetar senha do admin do tenant (retorna nova senha apenas aqui)
exports.resetTenantAdminPassword = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
        }
        const out = await Tenants.resetAdminPassword(id);
        return res.json({ sucesso: true, data: out });
    } catch (e) {
        return res.status(400).json({ sucesso: false, mensagem: e.message || 'Falha ao redefinir senha' });
    }
};
