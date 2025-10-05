// src/middlewares/adminAuth.js
const crypto = require('crypto');

function getCookie(req, name) {
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

    // Opcional: expiração (ex.: 24h)
    const maxAgeMs = 24 * 60 * 60 * 1000;
    const iat = Number(iatStr);
    if (Date.now() - iat > maxAgeMs) return null;

    return { email };
}

function setAdminCookie(res, token) {
    const isProd = process.env.NODE_ENV === 'production';
    // 24h
    const maxAge = 24 * 60 * 60 * 1000;
    res.setHeader('Set-Cookie',
        `admin_token=${encodeURIComponent(token)}; Max-Age=${maxAge / 1000}; Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`
    );
}

function clearAdminCookie(res) {
    const isProd = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie',
        `admin_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`
    );
}

function requireAdmin(req, res, next) {
    const token = getCookie(req, 'admin_token');
    const secret = process.env.ADMIN_SECRET;
    const expectedEmail = process.env.SUPERADMIN_EMAIL;
    const auth = verify(token, secret, expectedEmail);
    if (!auth) {
        return res.status(401).json({ sucesso: false, mensagem: 'Não autorizado' });
    }
    req.admin = auth;
    next();
}

function createAdminToken(email) {
    const secret = process.env.ADMIN_SECRET;
    const iat = Date.now();
    return sign(email, iat, secret);
}

module.exports = {
    requireAdmin,
    setAdminCookie,
    clearAdminCookie,
    createAdminToken
};
