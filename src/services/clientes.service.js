/**
 * services/clientes.service.js
 * ----------------------------------------
 * Regras e consultas de clientes (MySQL).
 * - Listagem/busca por nome (com normalização) e CPF/CNPJ (somente dígitos)
 * - Busca leve para contratos (autocomplete)
 * - CRUD completo (verifica duplicidades de CPF/CNPJ)
 */

const { executeQuery } = require('../config/database');

exports.listar = async (searchTermRaw = '') => {
    const termoBruto = (searchTermRaw || '').trim();
    if (!termoBruto) return executeQuery('SELECT * FROM cliente ORDER BY nome', []);

    const somenteDigitos = termoBruto.replace(/\D/g, '');
    const partesNome = termoBruto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim().split(/\s+/).filter(Boolean);

    const where = [];
    const params = [];

    if (partesNome.length) {
        partesNome.forEach(p => { where.push('LOWER(nome) LIKE ?'); params.push(`%${p.toLowerCase()}%`); });
    }
    if (somenteDigitos.length >= 3) {
        where.push("REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') LIKE ?");
        params.push(`%${somenteDigitos}%`);
    }
    if (!where.length) return [];

    const nomeConds = where.slice(0, partesNome.length);
    const cpfConds = where.slice(partesNome.length);
    const sql = `
    SELECT * FROM cliente
    WHERE ${[
            nomeConds.length ? `(${nomeConds.join(' AND ')})` : null,
            cpfConds.length ? `(${cpfConds.join(' AND ')})` : null
        ].filter(Boolean).join(' OR ')}
    ORDER BY nome
  `;
    return executeQuery(sql, params);
};

exports.buscarParaContrato = async (qRaw = '') => {
    const q = qRaw.trim();
    if (!q) return [];
    const qLike = `%${q}%`;
    const qDigits = q.replace(/\D+/g, '');

    if (qDigits.length > 0 && /^\d+$/.test(q)) {
        return executeQuery(`
      SELECT id, nome, cpf_cnpj
      FROM cliente
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', ''), '\\\\', '') LIKE ?
      ORDER BY nome
      LIMIT 20
    `, [`%${qDigits}%`]);
    }

    return executeQuery(`
    SELECT id, nome, cpf_cnpj
    FROM cliente
    WHERE nome COLLATE utf8mb4_general_ci LIKE ?
    ORDER BY nome
    LIMIT 20
  `, [qLike]);
};

exports.criar = async (payload) => {
    const { nome, data_nasc, cpf_cnpj, rg, telefone, email, endereco, bairro, cep, uf, cidade, profissao, nacionalidade, estado_civil } = payload;

    const existe = await executeQuery('SELECT id FROM cliente WHERE cpf_cnpj = ?', [cpf_cnpj]);
    if (existe.length > 0) {
        return { status: 400, body: { sucesso: false, mensagem: 'CPF/CNPJ já cadastrado' } };
    }

    const result = await executeQuery(
        'INSERT INTO cliente (nome, data_nasc, cpf_cnpj, rg, telefone, email, endereco, bairro, cep, uf, cidade, profissao, nacionalidade, estado_civil) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [nome || null, data_nasc || null, cpf_cnpj || null, rg || null, telefone || null, email, endereco || null, bairro || null, cep || null, uf || null, cidade || null, profissao || null, nacionalidade || null, estado_civil || null]
    );

    return { sucesso: true, mensagem: 'Cliente cadastrado com sucesso!', id: result.insertId };
};

exports.obterPorId = async (id) => {
    const r = await executeQuery('SELECT * FROM cliente WHERE id = ?', [id]);
    return r[0];
};

exports.atualizar = async (id, payload) => {
    const existe = await executeQuery('SELECT id FROM cliente WHERE id = ?', [id]);
    if (!existe.length) return 'NOT_FOUND';

    if (payload.cpf_cnpj) {
        const cpfExist = await executeQuery('SELECT id FROM cliente WHERE cpf_cnpj = ? AND id != ?', [payload.cpf_cnpj, id]);
        if (cpfExist.length > 0) return 'CPF_DUP';
    }

    const setStr = Object.keys(payload).map(c => `${c} = ?`).join(', ');
    const valores = [...Object.values(payload), id];
    await executeQuery(`UPDATE cliente SET ${setStr} WHERE id = ?`, valores);
    return 'OK';
};

exports.excluir = async (id) => {
    const existe = await executeQuery('SELECT id FROM cliente WHERE id = ?', [id]);
    if (!existe.length) return 'NOT_FOUND';
    await executeQuery('DELETE FROM cliente WHERE id = ?', [id]);
    return 'OK';
};
