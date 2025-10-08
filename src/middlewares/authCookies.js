/**
 * authCookies.js
 * ----------------------------------------
 * Middleware de autenticação via cookies de sessão (multi-tenant).
 *
 * - Lê cookies: usuario_id, usuario_nome, usuario_email, usuario_nivel, tenant_id
 * - Popula req.user com os dados do usuário logado (inclui req.user.tenant_id)
 * - Aceita fallback de tenant via header 'x-tenant-id' quando o cookie não existir
 * - Retorna 401 se não houver usuário/tenant válidos
 * - Retorna 403 se houver divergência entre cookie tenant_id e header x-tenant-id
 *
 * Uso:
 *   app.get('/rota-protegida', ensureAuthCookies, handler);
 */

exports.ensureAuthCookies = (req, res, next) => {
    const userId = Number(req.cookies?.usuario_id);
    const tenantCookie = req.cookies?.tenant_id;
    const tenantHeader = req.headers['x-tenant-id'];

    const tenantFromCookie = Number(tenantCookie);
    const tenantFromHeader = tenantHeader !== undefined ? Number(tenantHeader) : null;

    // precisa ter usuário logado
    if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    // resolve tenant_id: cookie -> header
    let tenantId = Number.isFinite(tenantFromCookie) && tenantFromCookie > 0
        ? tenantFromCookie
        : (Number.isFinite(tenantFromHeader) && tenantFromHeader > 0 ? tenantFromHeader : null);

    if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
    }

    // se ambos vierem e forem diferentes, bloquear (evita vazamento cross-tenant)
    if (Number.isFinite(tenantFromCookie) && Number.isFinite(tenantFromHeader)
        && tenantFromCookie > 0 && tenantFromHeader > 0
        && tenantFromCookie !== tenantFromHeader) {
        return res.status(403).json({ error: 'Conflito de tenant (cookie vs header)' });
    }

    const nome = (req.cookies?.usuario_nome || '').trim() || null;
    const email = (req.cookies?.usuario_email || '').trim() || null;
    const nivel = (req.cookies?.usuario_nivel || '').trim() || null;

    req.user = {
        id: userId,
        nome,
        email,
        nivel,             // compatibilidade com código legado
        nivel_acesso: nivel,
        tenant_id: tenantId
    };

    next();
};
