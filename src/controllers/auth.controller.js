/**
 * auth.controller.js
 * ----------------------------------------
 * Controlador responsável pela autenticação de usuários (multi-tenant).
 * - POST /login  → valida credenciais (por tenant), gera cookies de sessão e atualiza ultimo_acesso
 * - GET  /usuario-logado → retorna dados do usuário logado (escopado por tenant)
 *
 * Observações:
 * - O login EXIGE um tenant_id (ou id_tenant / header x-tenant-id).
 * - Emails são únicos por (tenant_id, email).
 */

const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const { executeQuery } = require('../config/database');

// Helpers de tenant
function getTenantIdFromLogin(req) {
    const t = Number(
        req.body?.tenant_id ??
        req.body?.id_tenant ??
        req.headers['x-tenant-id']
    );
    return Number.isFinite(t) && t > 0 ? t : null;
}

function getTenantIdFromSession(req) {
    const t = Number(
        req.cookies?.tenant_id ??
        req.headers['x-tenant-id']
    );
    return Number.isFinite(t) && t > 0 ? t : null;
}

// POST /login
exports.login = asyncHandler(async (req, res) => {
    const email = (req.body?.email || '').trim();
    const senha = req.body?.senha || '';
    const tenantId = getTenantIdFromLogin(req);

    if (!tenantId) {
        return res.status(400).json({ sucesso: false, mensagem: 'tenant_id (ou id_tenant) é obrigatório.' });
    }
    if (!email || !senha) {
        return res.status(400).json({ sucesso: false, mensagem: 'Email e senha são obrigatórios.' });
    }

    // 1) Busca usuário ativo por (tenant_id, email)
    const users = await executeQuery(
        `SELECT id, tenant_id, nome, email, senha, nivel_acesso
       FROM usuarios
      WHERE tenant_id = ? AND email = ? AND ativo = TRUE
      LIMIT 1`,
        [tenantId, email]
    );

    if (!users.length) {
        return res.status(401).json({ sucesso: false, mensagem: 'Usuário não encontrado para este tenant.' });
    }

    const user = users[0];

    // 2) Valida senha
    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) {
        return res.status(401).json({ sucesso: false, mensagem: 'Senha incorreta.' });
    }

    // 3) Atualiza ultimo_acesso imediatamente após login bem-sucedido (escopo por tenant)
    await executeQuery(
        'UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ? AND tenant_id = ?',
        [user.id, tenantId]
    );

    // 4) Cookies de sessão
    res.cookie('usuario_nome', user.nome, { path: '/' });
    res.cookie('usuario_email', user.email, { path: '/' });
    res.cookie('usuario_nivel', user.nivel_acesso, { path: '/' });
    res.cookie('usuario_id', user.id, { path: '/' });
    res.cookie('tenant_id', user.tenant_id, { path: '/' }); // 👈 importante pro multi-tenant

    // 5) Resposta
    res.json({
        sucesso: true,
        mensagem: 'Login realizado com sucesso!',
        redirect: '/menu',
        usuario: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            nivel_acesso: user.nivel_acesso,
            tenant_id: user.tenant_id
        }
    });
});

// GET /usuario-logado
exports.usuarioLogado = asyncHandler(async (req, res) => {
    const usuarioId = Number(req.cookies?.usuario_id);
    const tenantId = getTenantIdFromSession(req);

    if (!usuarioId || !tenantId) {
        return res.status(401).json({ erro: 'Não autenticado' });
    }

    const rows = await executeQuery(
        `SELECT id, tenant_id, nome, email, nivel_acesso
       FROM usuarios
      WHERE id = ? AND tenant_id = ?
      LIMIT 1`,
        [usuarioId, tenantId]
    );

    if (!rows.length) {
        return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json(rows[0]);
});

// Validação de email no login
exports.getTenantByEmail = async (req, res, next) => {
    try {
        const email = String(req.query.email || '').trim();
        if (!email) return res.status(400).json({ mensagem: 'Email requerido' });

        const [u] = await executeQuery(
            'SELECT tenant_id FROM usuarios WHERE email = ? LIMIT 1',
            [email]
        );
        if (!u) return res.status(404).json({ mensagem: 'Usuário não encontrado' });

        res.json({ tenant_id: String(u.tenant_id) });
    } catch (e) {
        next(e);
    }
};