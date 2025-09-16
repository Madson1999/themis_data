/**
 * routes/protocolacao.routes.js
 * ----------------------------------------
 * Rotas de protocolação (após aprovação).
 * - GET  /api/protocolacao                 → lista ações aprovadas (inclui flag protocolado)
 * - PUT  /api/protocolacao/:id/protocolar  → marca como protocolado
 * - GET  /api/protocolacao/:id/arquivos    → lista arquivos (pasta da ação)
 * - GET  /api/protocolacao/:id/arquivo?nome= → download individual de arquivo
 */

const { Router } = require('express');
const c = require('../controllers/protocolacao.controller');

const router = Router();

router.get('/', c.listarAprovados);
router.put('/:id/protocolar', c.protocolar);
router.get('/:id/arquivos', c.listarArquivos);
router.get('/:id/arquivo', c.downloadIndividual);

module.exports = router;
