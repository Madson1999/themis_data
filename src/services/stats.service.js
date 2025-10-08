/**
 * services/stats.service.js
 * ----------------------------------------
 * Service de estatísticas do sistema — Multi-tenant.
 *
 * Métricas retornadas (somente do tenant atual):
 * - usuários: total de usuários ativos
 * - novosHoje: usuários criados hoje
 * - acessosHoje: logs de acesso de hoje
 * - totalLogs: total de logs de acesso
 */

const { executeQuery, withTenant } = require('../config/database');

function assertTenant(tenantId) {
    const t = Number(tenantId);
    if (!Number.isFinite(t) || t <= 0) {
        const err = new Error('Tenant não identificado');
        err.status = 401;
        throw err;
    }
    return t;
}

// Retorna o objeto usado no dashboard do menu
exports.getOverview = async (tenantId) => {
    const tId = assertTenant(tenantId);

    const q1 = withTenant(
        `SELECT COUNT(*) AS total FROM usuarios WHERE ativo = TRUE`,
        tId
    );
    const q2 = withTenant(
        `SELECT COUNT(*) AS total FROM usuarios WHERE DATE(data_criacao) = CURDATE()`,
        tId
    );
    const q3 = withTenant(
        `SELECT COUNT(*) AS total FROM logs_acesso WHERE DATE(data_acesso) = CURDATE()`,
        tId
    );
    const q4 = withTenant(
        `SELECT COUNT(*) AS total FROM logs_acesso`,
        tId
    );

    const [r1, r2, r3, r4] = await Promise.all([
        executeQuery(q1.sql, q1.params),
        executeQuery(q2.sql, q2.params),
        executeQuery(q3.sql, q3.params),
        executeQuery(q4.sql, q4.params),
    ]);

    return {
        usuarios: r1[0]?.total ?? 0,
        novosHoje: r2[0]?.total ?? 0,
        acessosHoje: r3[0]?.total ?? 0,
        totalLogs: r4[0]?.total ?? 0,
    };
};
