/**
 * routes/contratos.routes.js
 * ----------------------------------------
 * Rotas de contratos.
 * - POST /api/contratos/gerar   → gera e persiste contrato
 * - GET  /api/contratos         → lista últimos contratos
 * - GET  /api/contratos/:id/download → download do arquivo .docx
 */

const { Router } = require('express');
const c = require('../controllers/contratos.controller');
const router = Router();

router.post('/gerar', c.gerar);
router.get('/', c.listar);
router.get('/:id/download', c.download);

module.exports = router;
