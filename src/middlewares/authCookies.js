/**
 * authCookies.js
 * ----------------------------------------
 * Middleware para autenticação via cookies de sessão.
 * - Lê cookies usuario_id, usuario_nome, usuario_email, usuario_nivel
 * - Popula req.user com os dados do usuário logado
 * - Retorna 401 se não houver cookie válido
 * Usado em rotas que exigem autenticação (ex.: ações/mine).
 */

exports.ensureAuthCookies = (req, res, next) => {
    const id = parseInt(req.cookies?.usuario_id, 10);
    if (!id) return res.status(401).json({ error: 'Não autenticado' });
    req.user = {
        id,
        nome: req.cookies?.usuario_nome || null,
        email: req.cookies?.usuario_email || null,
        nivel: req.cookies?.usuario_nivel || null,
    };
    next();
};
