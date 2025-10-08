/**
 * middlewares/adminAuth.js
 * ----------------------------------------
 * Autenticação do SUPERADMIN (painel /administrador).
 *
 * O token é um HMAC próprio (email|iat em base64 + assinatura sha256).
 * - createAdminToken(email) → gera o token com ADMIN_SECRET
 * - setAdminCookie(res, token) → grava cookie HttpOnly "admin_token" (24h)
 * - clearAdminCookie(res) → remove o cookie
 * - requireAdmin(req,res,next) → valida o cookie e autoriza
 *
 * Variáveis de ambiente:
 *  - ADMIN_SECRET         (obrigatório)
 *  - SUPERADMIN_EMAIL     (obrigatório)
 *  - NODE_ENV             (define flag Secure do cookie em produção)
 *
 * Observações:
 * - Este middleware é global (não usa tenant_id).
 * - Se ADMIN_SECRET / SUPERADMIN_EMAIL estiverem ausentes, bloqueia acesso.
 */

const crypto = require('crypto');

function getCookie(req, name) {
    // Prioriza cookies já parseados pelo cookie-parser
    if (req.cookies && Object.prototype.hasOwnProperty.call(req.cookies, name)) {
        return req.cookies[name];
    }
    // Fallback manual
    const raw = req.headers.cookie || '';
    const parts = raw.split(';').map(s => s.trim());
    for (const p of parts) {
        if (p.startsWith(name + '=')) {
            return decodeURIComponent(p.split('=')[1] || '');
        }
    }
    return null;
}

function sign(email, iatMs, secret) {
    const head = Buffer.from(`${email}|${iatMs}`).toString('base64');
    const mac = crypto.createHmac('sha256', secret).update(head).digest('hex');
    return `${head}.${mac}`;
}

function verify(token, secret, expectedEmail) {
    if (!token || !token.includes('.')) return null;
    const [head, mac] = token.split('.');
    const mac2 = crypto.createHmac('sha256', secret).update(head).digest('hex');
    if (mac !== mac2) return null;

    const decoded = Buffer.from(head, 'base64').toString('utf8'); // email|iat
    const [email, iatStr] = decoded.split('|');
    if (!email || !iatStr) return null;
    if (email !== expectedEmail) return null;

    // Expiração (24h)
    const maxAgeMs = 24 * 60 * 60 * 1000;
    const iat = Number(iatStr);
    if (!Number.isFinite(iat) || Date.now() - iat > maxAgeMs) return null;

    return { email, iat };
}

function setAdminCookie(res, token) {
    const isProd = process.env.NODE_ENV === 'production';
    // 24h
    const maxAge = 24 * 60 * 60 * 1000;
    res.setHeader(
        'Set-Cookie',
        `admin_token=${encodeURIComponent(token)}; Max-Age=${Math.floor(
            maxAge / 1000
        )}; Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`
    );
}

function clearAdminCookie(res) {
    const isProd = process.env.NODE_ENV === 'production';
    res.setHeader(
        'Set-Cookie',
        `admin_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`
    );
}

function requireAdmin(req, res, next) {
    const secret = process.env.ADMIN_SECRET;
    const expectedEmail = process.env.SUPERADMIN_EMAIL;

    if (!secret || !expectedEmail) {
        return res
            .status(500)
            .json({ sucesso: false, mensagem: 'Configuração de admin ausente (ADMIN_SECRET/SUPERADMIN_EMAIL).' });
    }

    const token = getCookie(req, 'admin_token');
    const auth = verify(token, secret, expectedEmail);
    if (!auth) {
        return res.status(401).json({ sucesso: false, mensagem: 'Não autorizado' });
    }
    req.admin = { email: auth.email, iat: auth.iat };
    next();
}

function createAdminToken(email) {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
        throw new Error('ADMIN_SECRET não configurado');
    }
    const iat = Date.now();
    return sign(email, iat, secret);
}

module.exports = {
    requireAdmin,
    setAdminCookie,
    clearAdminCookie,
    createAdminToken,
};
