/**
 * services/clientes.service.js
 * ----------------------------------------
 * Regras e consultas de clientes (MySQL) — Multi-tenant.
 *
 * - Tabela: `clientes` (plural)
 * - Todas as consultas são filtradas por `tenant_id`
 * - UNIQUE por tenant: (tenant_id, cpf_cnpj)
 *
 * Funcionalidades:
 *  - Listagem/busca por nome (com normalização) e CPF/CNPJ (somente dígitos)
 *  - Busca leve para documentos (autocomplete)
 *  - CRUD completo (verifica duplicidades de CPF/CNPJ por tenant)
 */

const { query, executeQuery, executeUpdate } = require('../config/database');

const ALLOWED_FIELDS = [
    'nome', 'data_nasc', 'cpf_cnpj', 'rg',
    'telefone1', 'telefone2', 'email',
    'endereco', 'bairro', 'cep', 'uf', 'cidade',
    'nacionalidade', 'estado_civil', 'profissao'
];

function digitsOnly(s) {
    return String(s || '').replace(/\D+/g, '');
}

function normalizeNameTokens(s) {
    return String(s || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim().split(/\s+/).filter(Boolean);
}

/**
 * Listar/buscar clientes do tenant.
 */
exports.listar = async ({ tenantId, limit, offset, searchTerm = '' }) => {
    const lim = Number.isFinite(Number(limit)) ? Number(limit) : 20;
    const off = Number.isFinite(Number(offset)) ? Number(offset) : 0;

    const where = ['tenant_id = ?'];
    const params = [Number(tenantId)];

    if (searchTerm) {
        const like = `%${searchTerm}%`;
        where.push(`(nome LIKE ? OR cpf_cnpj LIKE ? OR email LIKE ? OR telefone1 LIKE ? OR telefone2 LIKE ?)`);
        params.push(like, like, like, like, like);
    }

    const sql = `
    SELECT
      id, tenant_id, nome, data_nasc, cpf_cnpj, rg,
      telefone1, telefone2, email,
      endereco, bairro, cep, uf, cidade,
      nacionalidade, estado_civil, profissao
      FROM clientes
     WHERE ${where.join(' AND ')}
     ORDER BY nome
     LIMIT ${lim} OFFSET ${off}
  `;
    return query(sql, params); // LIMIT/OFFSET inline numérico
};

/**
 * Busca leve para autocomplete de documentos.
 */
exports.buscarParaDocumento = async (tenantId, qRaw = '') => {
    const q = (qRaw || '').trim();
    if (!q) return [];

    const qDigits = digitsOnly(q);

    if (qDigits.length >= 3) {
        return executeQuery(
            `
      SELECT id, nome, cpf_cnpj
        FROM clientes
       WHERE tenant_id = ?
         AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', ''), '\\\\', '') LIKE ?
       ORDER BY nome
       LIMIT 20
      `,
            [Number(tenantId), `%${qDigits}%`]
        );
    }

    const like = `%${q}%`;
    return executeQuery(
        `
    SELECT id, nome, cpf_cnpj
      FROM clientes
     WHERE tenant_id = ?
       AND nome COLLATE utf8mb4_general_ci LIKE ?
     ORDER BY nome
     LIMIT 20
    `,
        [Number(tenantId), like]
    );
};

/**
 * Criar cliente
 */
exports.criar = async (tenantId, payload = {}) => {
    const { nome, cpf_cnpj } = payload || {};
    if (!nome || !cpf_cnpj) {
        return { status: 400, body: { sucesso: false, mensagem: 'Nome e CPF/CNPJ são obrigatórios' } };
    }

    const existe = await executeQuery(
        `SELECT id FROM clientes WHERE tenant_id = ? AND cpf_cnpj = ? LIMIT 1`,
        [Number(tenantId), cpf_cnpj]
    );
    if (existe.length > 0) {
        return { status: 400, body: { sucesso: false, mensagem: 'CPF/CNPJ já cadastrado' } };
    }

    const data = {};
    for (const k of ALLOWED_FIELDS) data[k] = payload[k] ?? null;

    const sql = `
    INSERT INTO clientes
      (tenant_id, nome, data_nasc, cpf_cnpj, rg,
       telefone1, telefone2, email,
       endereco, bairro, cep, uf, cidade,
       nacionalidade, estado_civil, profissao)
    VALUES (?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?)
  `;
    const params = [
        Number(tenantId),
        data.nome, data.data_nasc, data.cpf_cnpj, data.rg,
        data.telefone1, data.telefone2, data.email,
        data.endereco, data.bairro, data.cep, data.uf, data.cidade,
        data.nacionalidade, data.estado_civil, data.profissao
    ];

    const result = await executeUpdate(sql, params);
    return { sucesso: true, mensagem: 'Cliente cadastrado com sucesso!', id: result.insertId };
};

/**
 * Obter por id
 */
exports.obterPorId = async (tenantId, id) => {
    const r = await executeQuery(
        `
    SELECT
      id, tenant_id, nome, data_nasc, cpf_cnpj, rg,
      telefone1, telefone2, email,
      endereco, bairro, cep, uf, cidade,
      nacionalidade, estado_civil, profissao
      FROM clientes
     WHERE tenant_id = ? AND id = ?
     LIMIT 1
    `,
        [Number(tenantId), Number(id)]
    );
    return r[0] || null;
};

/**
 * Atualizar cliente
 */
exports.atualizar = async (tenantId, id, payload = {}) => {
    const existe = await executeQuery(
        `SELECT id FROM clientes WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [Number(tenantId), Number(id)]
    );
    if (!existe.length) return 'NOT_FOUND';

    if (payload.cpf_cnpj) {
        const dup = await executeQuery(
            `SELECT id FROM clientes WHERE tenant_id = ? AND cpf_cnpj = ? AND id != ? LIMIT 1`,
            [Number(tenantId), payload.cpf_cnpj, Number(id)]
        );
        if (dup.length > 0) return 'CPF_DUP';
    }

    const update = {};
    for (const k of ALLOWED_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(payload, k)) {
            update[k] = payload[k];
        }
    }
    if (!Object.keys(update).length) return 'OK';

    const setStr = Object.keys(update).map((c) => `${c} = ?`).join(', ');
    const valores = [...Object.values(update), Number(tenantId), Number(id)];

    await executeUpdate(`UPDATE clientes SET ${setStr} WHERE tenant_id = ? AND id = ?`, valores);
    return 'OK';
};

/**
 * Excluir cliente
 */
exports.excluir = async (tenantId, id) => {
    const existe = await executeQuery(
        `SELECT id FROM clientes WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [Number(tenantId), Number(id)]
    );
    if (!existe.length) return 'NOT_FOUND';

    await executeUpdate(`DELETE FROM clientes WHERE tenant_id = ? AND id = ?`, [Number(tenantId), Number(id)]);
    return 'OK';
};