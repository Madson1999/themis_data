/**
 * services/usuarios.service.js
 * ----------------------------------------
 * Regras e consultas de usuários.
 * - Criação com validação/Hash de senha
 * - Atualização dinâmica por campos (com checagens de e-mail único)
 * - Listagens gerais e de designados (estagiário/adv ativos)
 */

const { executeQuery } = require('../config/database');
const bcrypt = require('bcryptjs');

exports.listar = () => executeQuery(
    'SELECT id, nome, email, nivel_acesso, data_criacao, ultimo_acesso, ativo FROM usuarios', []
);

exports.listarDesignados = () => executeQuery(
    "SELECT id, nome, nivel_acesso FROM usuarios WHERE (nivel_acesso = 'estagiario' OR nivel_acesso = 'adv') AND ativo = 1 ORDER BY nome", []
);

exports.criar = async ({ nome, email, senha, nivel_acesso, ativo }) => {
    if (!nome || !email || !senha || !nivel_acesso)
        return { status: 400, body: { sucesso: false, mensagem: 'Preencha todos os campos obrigatórios.' } };

    const existe = await executeQuery('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existe.length > 0)
        return { status: 400, body: { sucesso: false, mensagem: 'Email já cadastrado.' } };

    const senhaHash = await bcrypt.hash(senha, 10);
    const result = await executeQuery(
        'INSERT INTO usuarios (nome, email, senha, nivel_acesso, data_criacao, ativo) VALUES (?, ?, ?, ?, NOW(), ?)',
        [nome, email, senhaHash, nivel_acesso, ativo || 1]
    );
    return { sucesso: true, mensagem: 'Usuário cadastrado com sucesso!', id: result.insertId };
};

exports.atualizar = async (id, campos) => {
    if (!id || !Object.keys(campos).length)
        return { status: 400, body: { sucesso: false, mensagem: 'Nenhum dado para atualizar.' } };

    if (campos.email) {
        const emailExistente = await executeQuery('SELECT id FROM usuarios WHERE email = ? AND id != ?', [campos.email, id]);
        if (emailExistente.length > 0)
            return { status: 400, body: { sucesso: false, mensagem: 'Email já cadastrado para outro usuário.' } };
    }

    const setStr = Object.keys(campos).map(campo => `${campo} = ?`).join(', ');
    const valores = [...Object.values(campos), id];
    await executeQuery(`UPDATE usuarios SET ${setStr} WHERE id = ?`, valores);
    return { ok: true };
};
