// src/utils/tenant.js
function getTenantId(req) {
    const fromCookie = req.cookies?.tenant_id;
    const fromUser = req.user?.tenant_id;
    const fromHeader = req.headers['x-tenant-id'];
    const raw = fromCookie ?? fromUser ?? fromHeader;
    const t = Number(String(raw || '').trim());
    return Number.isFinite(t) && t > 0 ? t : null;
}
module.exports = { getTenantId };
