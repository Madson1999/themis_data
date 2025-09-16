/**
 * stats.service.js
 * ----------------------------------------
 * Service que centraliza consultas estatísticas do sistema.
 * - Conta total de usuários ativos
 * - Conta de novos usuários criados hoje
 * - Conta de acessos registrados hoje
 * - Conta total de logs de acesso
 * É utilizado pelo dashboard do menu para exibir métricas resumidas.
 */

const { executeQuery } = require('../config/database');

// Retorna o objeto usado no dashboard do menu
exports.getOverview = async () => {
    const [totalUsuarios] = await executeQuery(
        'SELECT COUNT(*) AS total FROM usuarios WHERE ativo = TRUE'
    );
    const [usuariosHoje] = await executeQuery(
        'SELECT COUNT(*) AS total FROM usuarios WHERE DATE(data_criacao) = CURDATE()'
    );
    const [acessosHoje] = await executeQuery(
        'SELECT COUNT(*) AS total FROM logs_acesso WHERE DATE(data_acesso) = CURDATE()'
    );
    const [totalLogs] = await executeQuery(
        'SELECT COUNT(*) AS total FROM logs_acesso'
    );

    return {
        usuarios: totalUsuarios.total,
        novosHoje: usuariosHoje.total,
        acessosHoje: acessosHoje.total,
        totalLogs: totalLogs.total
    };
};
