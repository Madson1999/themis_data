/**
 * controllers/stats.controller.js
 * ----------------------------------------
 * Camada HTTP de estatísticas.
 * - Chama stats.service.getOverview() e retorna JSON para o dashboard
 */

const { executeQuery } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');

exports.overview = asyncHandler(async (_req, res) => {
    const [totalUsuarios] = await executeQuery('SELECT COUNT(*) as total FROM usuarios WHERE ativo = TRUE');
    const [usuariosHoje] = await executeQuery('SELECT COUNT(*) as total FROM usuarios WHERE DATE(data_criacao) = CURDATE()');
    const [acessosHoje] = await executeQuery('SELECT COUNT(*) as total FROM logs_acesso WHERE DATE(data_acesso) = CURDATE()');
    const [totalLogs] = await executeQuery('SELECT COUNT(*) as total FROM logs_acesso');

    res.json({
        usuarios: totalUsuarios.total,
        novosHoje: usuariosHoje.total,
        acessosHoje: acessosHoje.total,
        totalLogs: totalLogs.total
    });
});
