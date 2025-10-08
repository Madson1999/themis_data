/**
 * controllers/stats.controller.js
 * ----------------------------------------
 * Camada HTTP de estatísticas (multi-tenant).
 * - Obtém tenant_id do cookie 'tenant_id', req.user.tenant_id ou header 'x-tenant-id'
 * - Retorna contagens do tenant atual:
 *    - usuários ativos
 *    - usuários criados hoje
 *    - acessos (logs) de hoje
 *    - total de logs
 */

const { executeQuery, withTenant } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');

// Helper: resolve tenant_id (cookie -> req.user -> header)
function getTenantId(req) {
    const fromCookie = req.cookies?.tenant_id;
    const fromUser = req.user?.tenant_id;
    const fromHeader = req.headers['x-tenant-id'];
    const t = Number(fromCookie ?? fromUser ?? fromHeader);
    return Number.isFinite(t) && t > 0 ? t : null;
}

exports.overview = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) {
        return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });
    }

    // Monta as 4 consultas com escopo de tenant usando withTenant()
    const q1 = withTenant(`SELECT COUNT(*) AS total FROM usuarios WHERE ativo = TRUE`, tenantId);
    const q2 = withTenant(`SELECT COUNT(*) AS total FROM usuarios WHERE DATE(data_criacao) = CURDATE()`, tenantId);
    const q3 = withTenant(`SELECT COUNT(*) AS total FROM logs_acesso WHERE DATE(data_acesso) = CURDATE()`, tenantId);
    const q4 = withTenant(`SELECT COUNT(*) AS total FROM logs_acesso`, tenantId);

    const [totalUsuariosRows, usuariosHojeRows, acessosHojeRows, totalLogsRows] = await Promise.all([
        executeQuery(q1.sql, q1.params),
        executeQuery(q2.sql, q2.params),
        executeQuery(q3.sql, q3.params),
        executeQuery(q4.sql, q4.params),
    ]);

    const totalUsuarios = totalUsuariosRows[0]?.total || 0;
    const usuariosHoje = usuariosHojeRows[0]?.total || 0;
    const acessosHoje = acessosHojeRows[0]?.total || 0;
    const totalLogs = totalLogsRows[0]?.total || 0;

    res.json({
        usuarios: totalUsuarios,
        novosHoje: usuariosHoje,
        acessosHoje,
        totalLogs
    });
});
