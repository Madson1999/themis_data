/**
 * auth.controller.js
 * ----------------------------------------
 * Controlador responsável pela autenticação de usuários.
 * - POST /login  → valida credenciais, gera cookies de sessão e atualiza ultimo_acesso
 * - GET /usuario-logado → retorna dados do usuário logado a partir dos cookies
 */

const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const { executeQuery } = require('../config/database');

// POST /login
exports.login = asyncHandler(async (req, res) => {
    const { email, senha } = req.body;

    // 1) Busca usuário ativo por e-mail
    const users = await executeQuery(
        'SELECT id, nome, email, senha, nivel_acesso FROM usuarios WHERE email = ? AND ativo = TRUE',
        [email]
    );

    if (!users.length) {
        return res.status(401).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });
    }

    const user = users[0];

    // 2) Valida senha
    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) {
        return res.status(401).json({ sucesso: false, mensagem: 'Senha incorreta.' });
    }

    // 3) Atualiza ultimo_acesso imediatamente após login bem-sucedido
    await executeQuery(
        'UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ?',
        [user.id]
    );

    // 4) Cookies de sessão (mantendo padrão do server.js original)
    res.cookie('usuario_nome', user.nome, { path: '/' });
    res.cookie('usuario_email', user.email, { path: '/' });
    res.cookie('usuario_nivel', user.nivel_acesso, { path: '/' });
    res.cookie('usuario_id', user.id, { path: '/' });

    // 5) Resposta
    res.json({
        sucesso: true,
        mensagem: 'Login realizado com sucesso!',
        redirect: '/menu',
        usuario: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            nivel_acesso: user.nivel_acesso
        }
    });
});

// GET /usuario-logado
exports.usuarioLogado = asyncHandler(async (req, res) => {
    const usuarioId = req.cookies?.usuario_id;
    if (!usuarioId) {
        return res.status(401).json({ erro: 'Não autenticado' });
    }

    const rows = await executeQuery(
        'SELECT id, nome, email, nivel_acesso FROM usuarios WHERE id = ?',
        [usuarioId]
    );

    if (!rows.length) {
        return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json(rows[0]);
});
