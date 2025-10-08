/**
 * services/tenants.service.js
 * ----------------------------------------
 * Regras de Tenants (licenças do SaaS).
 *
 * Funcionalidades:
 * - list()                  → lista tenants
 * - get(id)                 → obtém tenant por id
 * - create(data)            → cria tenant (licença ativa por padrão)
 * - update(id, fields)      → atualiza campos permitidos
 * - remove(id)              → desativa licença (soft delete)
 * - ensureAdminUser(id)     → garante usuário admin do tenant (retorna senha apenas na criação)
 * - resetAdminPassword(id)  → reseta senha do admin e retorna a nova senha (texto) APENAS nesta resposta
 *
 * Helpers adicionais:
 * - getNomeEmpresaByTenantId(tenantId) → retorna nome_empresa do tenant (com cache simples)
 * - getSlugEmpresaByTenantId(tenantId) → retorna slug seguro do nome_empresa (para S3/pastas)
 *
 * Observações:
 * - Usuário admin do tenant é criado com email = tenants.email_admin.
 * - A senha gerada só é exibida na resposta do endpoint correspondente.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { executeQuery, executeUpdate } = require('../config/database');

/* ------------------------- utils ------------------------- */
function genPassword(len = 12) {
    // A-Z a-z 0-9 sem caracteres confusos
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let out = '';
    const bytes = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
}

function sanitizeTenantInput({ nome_empresa, cnpj, email_admin, plano = 'basic', licenca_ativa, data_fim } = {}) {
    const allowedPlans = new Set(['basic', 'plus', 'ultra']);
    const safePlan = allowedPlans.has(String(plano)) ? String(plano) : 'basic';
    const safeNome = (nome_empresa || '').toString().trim();
    const safeCnpj = (cnpj ?? null) ? String(cnpj).replace(/\D+/g, '').trim() : null;
    const safeEmail = (email_admin || '').toString().trim().toLowerCase();
    const safeLicAtiva = (typeof licenca_ativa === 'boolean') ? licenca_ativa : undefined;
    const safeDataFim = (data_fim ?? undefined);

    return {
        nome_empresa: safeNome,
        cnpj: safeCnpj,
        email_admin: safeEmail,
        plano: safePlan,
        ...(safeLicAtiva !== undefined ? { licenca_ativa: safeLicAtiva } : {}),
        ...(safeDataFim !== undefined ? { data_fim: safeDataFim } : {}),
    };
}

function slugifyEmpresa(s) {
    return String(s || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^\w.-]+/g, '-')       // somente [a-zA-Z0-9_.-]
        .replace(/-+/g, '-')             // hifens repetidos
        .replace(/^[-.]+|[-.]+$/g, '')   // trim - e .
        .toLowerCase() || 'empresa';
}

/* cache simples em memória para leituras repetidas */
const _nomeCache = new Map(); // tenant_id -> nome_empresa (string)

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

exports.create = async (data) => {
    const { nome_empresa, cnpj, email_admin, plano } = sanitizeTenantInput(data);
    if (!nome_empresa || !email_admin) {
        const err = new Error('nome_empresa e email_admin são obrigatórios');
        err.status = 400;
        throw err;
    }

    const result = await executeUpdate(
        `
      INSERT INTO tenants (nome_empresa, cnpj, email_admin, plano, licenca_ativa)
      VALUES (?, ?, ?, ?, TRUE)
    `,
        [nome_empresa, cnpj, email_admin, plano]
    );

    const id = result.insertId;
    // limpa cache, por via das dúvidas
    _nomeCache.delete(id);
    return await exports.get(id);
};

exports.update = async (id, fields = {}) => {
    const cleaned = sanitizeTenantInput(fields);

    // Campos permitidos para update
    const allowed = ['nome_empresa', 'cnpj', 'email_admin', 'plano', 'licenca_ativa', 'data_fim'];

    const sets = [];
    const params = [];

    for (const k of allowed) {
        if (Object.prototype.hasOwnProperty.call(fields, k)) {
            // usa valor saneado quando existir em cleaned
            const value = Object.prototype.hasOwnProperty.call(cleaned, k) ? cleaned[k] : fields[k];
            sets.push(`${k} = ?`);
            params.push(value);
        }
    }

    if (!sets.length) return await exports.get(id);

    params.push(id);
    await executeUpdate(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`, params);

    // invalida cache de nome_empresa
    _nomeCache.delete(id);

    return await exports.get(id);
};

exports.remove = async (id) => {
    await executeUpdate(
        `UPDATE tenants SET licenca_ativa = FALSE, data_fim = NOW() WHERE id = ?`,
        [id]
    );

    // invalida cache
    _nomeCache.delete(id);

    return await exports.get(id);
};

/* ------------------------- helpers nome_empresa/slug ------------------------- */
/**
 * Retorna o nome_empresa do tenant (com cache).
 */
exports.getNomeEmpresaByTenantId = async (tenantId) => {
    if (!tenantId) {
        const err = new Error('tenant_id obrigatório');
        err.status = 400;
        throw err;
    }

    if (_nomeCache.has(tenantId)) return _nomeCache.get(tenantId);

    const rows = await executeQuery(`SELECT nome_empresa FROM tenants WHERE id = ? LIMIT 1`, [tenantId]);
    const nome = rows?.[0]?.nome_empresa;
    if (!nome) {
        const err = new Error(`Tenant ${tenantId} não encontrado ou sem nome_empresa`);
        err.status = 404;
        throw err;
    }
    _nomeCache.set(tenantId, nome);
    return nome;
};

/**
 * Retorna o slug seguro do nome_empresa do tenant.
 * Útil para montar prefixos/pastas no S3/MinIO: <slug-empresa>/uploads|documentos/...
 */
exports.getSlugEmpresaByTenantId = async (tenantId) => {
    const nome = await exports.getNomeEmpresaByTenantId(tenantId);
    return slugifyEmpresa(nome);
};

/* ------------------------- admin do tenant ------------------------- */
/**
 * Garante que exista um usuário admin para o tenant (email = tenants.email_admin).
 * Se ainda não existir, cria com senha aleatória (retorna a senha em texto APENAS aqui).
 */
exports.ensureAdminUser = async (tenantId) => {
    const tenant = await exports.get(tenantId);
    if (!tenant) {
        const err = new Error('Tenant não encontrado');
        err.status = 404;
        throw err;
    }

    const email = String(tenant.email_admin || '').toLowerCase().trim();
    if (!email) {
        const err = new Error('Tenant sem email_admin definido');
        err.status = 400;
        throw err;
    }

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
        `
      INSERT INTO usuarios (tenant_id, nome, email, senha, nivel_acesso, ativo)
      VALUES (?, ?, ?, ?, 'admin', TRUE)
    `,
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
    if (!tenant) {
        const err = new Error('Tenant não encontrado');
        err.status = 404;
        throw err;
    }

    const email = String(tenant.email_admin || '').toLowerCase().trim();
    if (!email) {
        const err = new Error('Tenant sem email_admin definido');
        err.status = 400;
        throw err;
    }

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
            `
        INSERT INTO usuarios (tenant_id, nome, email, senha, nivel_acesso, ativo)
        VALUES (?, ?, ?, ?, 'admin', TRUE)
      `,
            [tenantId, name, email, hash]
        );
        return { reset: false, created: true, email, userId: result.insertId, password: plain };
    }
};
