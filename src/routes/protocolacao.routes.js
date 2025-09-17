/**
 * routes/protocolacao.routes.js
 * ----------------------------------------
 * Protocolação (pós-aprovação)
 *
 * Base path (montada no app): /api/protocolacao
 *
 * ENDPOINTS
 * - GET    /                 → Listar ações aprovadas (com flag `protocolado`)
 * - PUT    /:id/protocolar   → Marcar ação como protocolada
 * - DELETE /:id/devolver     → Devolver ação (limpar `data_aprovado`)
 * - GET    /:id/arquivos     → Listar arquivos da ação
 * - GET    /:id/arquivo      → Baixar arquivo individual (?nome=)
 */

const { Router } = require('express');
const c = require('../controllers/protocolacao.controller');

const router = Router();

/** Validação básica do :id (opcional, mas recomendado) */
router.param('id', (req, res, next, id) => {
    if (!/^\d+$/.test(String(id))) {
        return res.status(400).json({ sucesso: false, mensagem: 'Parâmetro :id inválido' });
    }
    next();
});

/** GET / → Lista aprovados */
router.get('/', c.listarAprovados);

/** PUT /:id/protocolar → Marca como protocolado */
router.put('/:id/protocolar', c.protocolar);

/** DELETE /:id/devolver → Devolve a ação (apaga data_aprovado) */
router.delete('/:id/devolver', c.devolver);

/** GET /:id/arquivos → Lista arquivos da ação */
router.get('/:id/arquivos', c.listarArquivos);

/** GET /:id/arquivo?nome= → Download individual de arquivo */
router.get('/:id/arquivo', c.downloadIndividual);

module.exports = router;
