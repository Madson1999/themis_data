// src/controllers/admin.controller.js
const bcrypt = require('bcryptjs');
const Tenants = require('../services/tenants.service');
const { createAdminToken, setAdminCookie, clearAdminCookie } = require('../middlewares/adminAuth');

exports.login = async (req, res) => {
    const { email, senha } = req.body || {};
    if (!email || !senha) {
        return res.status(400).json({ sucesso: false, mensagem: 'Email e senha são obrigatórios' });
    }
    const superEmail = process.env.SUPERADMIN_EMAIL;
    const plain = process.env.SUPERADMIN_PASSWORD || '';
    const hash = process.env.SUPERADMIN_PASSWORD_HASH || '';

    let ok = false;
    if (hash) {
        ok = (email === superEmail) && await bcrypt.compare(senha, hash);
    } else {
        ok = (email === superEmail) && (senha === plain);
    }
    if (!ok) {
        return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas' });
    }
    const token = createAdminToken(email);
    setAdminCookie(res, token);
    return res.json({ sucesso: true, mensagem: 'Autenticado' });
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
    const rows = await Tenants.list();
    res.json({ sucesso: true, data: rows });
};

exports.getTenant = async (req, res) => {
    const id = Number(req.params.id);
    const t = await Tenants.get(id);
    if (!t) return res.status(404).json({ sucesso: false, mensagem: 'Tenant não encontrado' });
    res.json({ sucesso: true, data: t });
};

exports.createTenant = async (req, res) => {
    const { nome_empresa, cnpj, email_admin, plano } = req.body || {};
    if (!nome_empresa || !email_admin) {
        return res.status(400).json({ sucesso: false, mensagem: 'nome_empresa e email_admin são obrigatórios' });
    }
    const created = await Tenants.create({ nome_empresa, cnpj, email_admin, plano });
    res.status(201).json({ sucesso: true, data: created });
};

exports.updateTenant = async (req, res) => {
    const id = Number(req.params.id);
    const updated = await Tenants.update(id, req.body || {});
    res.json({ sucesso: true, data: updated });
};

exports.removeTenant = async (req, res) => {
    const id = Number(req.params.id);
    const removed = await Tenants.remove(id);
    res.json({ sucesso: true, data: removed });
};


// --- NO TOPO já existem estes requires ---
// const Tenants = require('../services/tenants.service');

exports.ensureTenantAdmin = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const out = await Tenants.ensureAdminUser(id);
        // Se recém-criado, retorna a senha visível apenas aqui
        return res.json({ sucesso: true, data: out });
    } catch (e) {
        return res.status(400).json({ sucesso: false, mensagem: e.message || 'Falha ao garantir admin' });
    }
};

exports.resetTenantAdminPassword = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const out = await Tenants.resetAdminPassword(id);
        // Retorna a nova senha em texto APENAS nesta resposta
        return res.json({ sucesso: true, data: out });
    } catch (e) {
        return res.status(400).json({ sucesso: false, mensagem: e.message || 'Falha ao redefinir senha' });
    }
};
