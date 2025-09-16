/**
 * routes/stats.routes.js
 * ----------------------------------------
 * Rotas de estatísticas do dashboard.
 * - GET /api/stats → métricas agregadas (usuários, novos hoje, acessos hoje, total logs)
 */

const { Router } = require('express');
const c = require('../controllers/stats.controller');
const router = Router();

router.get('/', c.overview);

module.exports = router;
