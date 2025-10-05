// src/services/tenants.service.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { executeQuery, executeUpdate } = require('../config/database');

/* ------------------------- util ------------------------- */
function genPassword(len = 12) {
    // A-Z a-z 0-9 sem caracteres confusos
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let out = '';
    const bytes = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
}

/* ------------------------- tenants CRUD ------------------------- */
exports.list = async () => {
    return await executeQuery(`
    SELECT id, nome_empresa, cnpj, email_admin, plano, licenca_ativa, data_inicio, data_fim
    FROM tenants
    ORDER BY id DESC
  `);
};

exports.get = async (id) => {
    const rows = await executeQuery(`SELECT * FROM tenants WHERE id = ?`, [id]);
    return rows[0] || null;
};

exports.create = async ({ nome_empresa, cnpj, email_admin, plano = 'basic' }) => {
    const result = await executeUpdate(
        `INSERT INTO tenants (nome_empresa, cnpj, email_admin, plano, licenca_ativa)
     VALUES (?, ?, ?, ?, TRUE)`,
        [nome_empresa, cnpj || null, email_admin, plano]
    );
    const id = result.insertId;
    return await exports.get(id);
};

exports.update = async (id, fields = {}) => {
    const allowed = ['nome_empresa', 'cnpj', 'email_admin', 'plano', 'licenca_ativa', 'data_fim'];
    const sets = [];
    const params = [];
    for (const k of allowed) {
        if (Object.prototype.hasOwnProperty.call(fields, k)) {
            sets.push(`${k} = ?`);
            params.push(fields[k]);
        }
    }
    if (!sets.length) return await exports.get(id);
    params.push(id);
    await executeUpdate(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`, params);
    return await exports.get(id);
};

exports.remove = async (id) => {
    await executeUpdate(`UPDATE tenants SET licenca_ativa = FALSE, data_fim = NOW() WHERE id = ?`, [id]);
    return await exports.get(id);
};

/* ------------------------- admin do tenant ------------------------- */
/**
 * Garante que exista um usuário admin para o tenant (email = tenants.email_admin).
 * Se ainda não existir, cria com senha aleatória (retorna a senha em texto APENAS aqui).
 */
exports.ensureAdminUser = async (tenantId) => {
    const tenant = await exports.get(tenantId);
    if (!tenant) throw new Error('Tenant não encontrado');
    const email = tenant.email_admin;

    const users = await executeQuery(
        `SELECT id, nome, email FROM usuarios WHERE tenant_id = ? AND email = ? LIMIT 1`,
        [tenantId, email]
    );

    if (users.length) {
        return { created: false, email, userId: users[0].id };
    }

    const plain = genPassword(12);
    const hash = await bcrypt.hash(plain, 10);

    const name = `${tenant.nome_empresa}`.slice(0, 100);
    const result = await executeUpdate(
        `INSERT INTO usuarios (tenant_id, nome, email, senha, nivel_acesso, ativo)
     VALUES (?, ?, ?, ?, 'admin', TRUE)`,
        [tenantId, name, email, hash]
    );

    return { created: true, email, userId: result.insertId, password: plain };
};

/**
 * Redefine a senha do usuário admin (email = tenants.email_admin) e retorna a nova senha (texto) APENAS na resposta.
 * Se o usuário ainda não existir, cria um e também retorna a senha.
 */
exports.resetAdminPassword = async (tenantId) => {
    const tenant = await exports.get(tenantId);
    if (!tenant) throw new Error('Tenant não encontrado');
    const email = tenant.email_admin;

    const plain = genPassword(12);
    const hash = await bcrypt.hash(plain, 10);

    const users = await executeQuery(
        `SELECT id FROM usuarios WHERE tenant_id = ? AND email = ? LIMIT 1`,
        [tenantId, email]
    );

    if (users.length) {
        await executeUpdate(`UPDATE usuarios SET senha = ? WHERE id = ?`, [hash, users[0].id]);
        return { reset: true, email, userId: users[0].id, password: plain };
    } else {
        const name = `${tenant.nome_empresa}`.slice(0, 100);
        const result = await executeUpdate(
            `INSERT INTO usuarios (tenant_id, nome, email, senha, nivel_acesso, ativo)
       VALUES (?, ?, ?, ?, 'admin', TRUE)`,
            [tenantId, name, email, hash]
        );
        return { reset: false, created: true, email, userId: result.insertId, password: plain };
    }
};
