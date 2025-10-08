/**
 * services/usuarios.service.js
 * ----------------------------------------
 * Regras e consultas de usuários — Multi-tenant.
 *
 * - Todas as operações recebem `tenantId` e aplicam WHERE tenant_id = ?
 * - E-mail único por tenant: UNIQUE(tenant_id, email)
 * - Hash de senha com bcrypt
 *
 * Endpoints atendidos (via controllers/usuarios.controller.js):
 *  - listar(tenantId)
 *  - listarDesignados(tenantId)
 *  - criar(tenantId, payload)
 *  - atualizar(tenantId, id, payload)
 */

const bcrypt = require('bcryptjs');
const { executeQuery, executeUpdate } = require('../config/database');

const ALLOWED_UPDATE_FIELDS = new Set(['nome', 'email', 'senha', 'nivel_acesso', 'ativo']);
const ROLES = new Set(['admin', 'usuario', 'editor']);

/* Utils */
function sanitizeRole(v) {
    const role = String(v || '').toLowerCase();
    return ROLES.has(role) ? role : 'usuario';
}
function isNonEmptyString(s) {
    return typeof s === 'string' && s.trim().length > 0;
}

/* ===== Listagens ===== */

exports.listar = (tenantId) =>
    executeQuery(
        `
    SELECT id, tenant_id, nome, email, nivel_acesso, data_criacao, ultimo_acesso, ativo
      FROM usuarios
     WHERE tenant_id = ?
     ORDER BY nome
    `,
        [tenantId]
    );

// “Designados”: usuários ativos que podem receber ações.
// Como o enum é ('admin','usuario','editor'), vamos considerar por padrão 'usuario' e 'editor'.
exports.listarDesignados = (tenantId) =>
    executeQuery(
        `
    SELECT id, nome, nivel_acesso
      FROM usuarios
     WHERE tenant_id = ?
       AND ativo = 1
       AND nivel_acesso IN ('usuario','editor')
     ORDER BY nome
    `,
        [tenantId]
    );

/* ===== Criar ===== */

exports.criar = async (tenantId, { nome, email, senha, nivel_acesso, ativo }) => {
    if (!isNonEmptyString(nome) || !isNonEmptyString(email) || !isNonEmptyString(senha)) {
        return { status: 400, body: { sucesso: false, mensagem: 'Preencha nome, email e senha.' } };
    }

    // E-mail único por tenant
    const dup = await executeQuery(
        `SELECT id FROM usuarios WHERE tenant_id = ? AND email = ? LIMIT 1`,
        [tenantId, email]
    );
    if (dup.length > 0) {
        return { status: 400, body: { sucesso: false, mensagem: 'Email já cadastrado.' } };
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const role = sanitizeRole(nivel_acesso);

    const result = await executeUpdate(
        `
    INSERT INTO usuarios
      (tenant_id, nome, email, senha, nivel_acesso, data_criacao, ativo)
    VALUES
      (?, ?, ?, ?, ?, NOW(), ?)
    `,
        [tenantId, nome.trim(), email.trim().toLowerCase(), senhaHash, role, ativo ? 1 : 1]
    );

    return { sucesso: true, mensagem: 'Usuário cadastrado com sucesso!', id: result.insertId };
};

/* ===== Atualizar (dinâmico) ===== */

exports.atualizar = async (tenantId, id, payload = {}) => {
    if (!id || typeof payload !== 'object' || !Object.keys(payload).length) {
        return { status: 400, body: { sucesso: false, mensagem: 'Nenhum dado para atualizar.' } };
    }

    // Existe no tenant?
    const existe = await executeQuery(
        `SELECT id FROM usuarios WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [tenantId, id]
    );
    if (!existe.length) {
        return { status: 404, body: { sucesso: false, mensagem: 'Usuário não encontrado.' } };
    }

    // Se email mudar: checar duplicidade no tenant
    if (payload.email) {
        const email = String(payload.email).trim().toLowerCase();
        const e = await executeQuery(
            `SELECT id FROM usuarios WHERE tenant_id = ? AND email = ? AND id != ? LIMIT 1`,
            [tenantId, email, id]
        );
        if (e.length > 0) {
            return { status: 400, body: { sucesso: false, mensagem: 'Email já cadastrado para outro usuário.' } };
        }
        payload.email = email;
    }

    // Se nivel_acesso vier, sanitiza
    if (Object.prototype.hasOwnProperty.call(payload, 'nivel_acesso')) {
        payload.nivel_acesso = sanitizeRole(payload.nivel_acesso);
    }

    // Se senha vier e for string vazia, ignora; se vier válida, hash
    if (Object.prototype.hasOwnProperty.call(payload, 'senha')) {
        if (isNonEmptyString(payload.senha)) {
            payload.senha = await bcrypt.hash(payload.senha, 10);
        } else {
            delete payload.senha;
        }
    }

    // Monta SET dinâmico com campos permitidos
    const update = {};
    for (const k of Object.keys(payload)) {
        if (ALLOWED_UPDATE_FIELDS.has(k)) {
            update[k] = payload[k];
        }
    }
    if (!Object.keys(update).length) {
        return { ok: true };
    }

    const setStr = Object.keys(update).map((k) => `${k} = ?`).join(', ');
    const valores = [...Object.values(update), tenantId, id];

    await executeUpdate(
        `UPDATE usuarios SET ${setStr} WHERE tenant_id = ? AND id = ?`,
        valores
    );

    return { ok: true };
};
