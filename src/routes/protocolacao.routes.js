/**
 * routes/protocolacao.routes.js
 * ----------------------------------------
 * Protocolação (pós-aprovação) — multi-tenant
 *
 * Base path (montada no app): /api/protocolacao
 *
 * ENDPOINTS
 * - GET    /                 → Listar ações aprovadas (com flag `protocolado`)
 * - PUT    /:id/protocolar   → Marcar ação como protocolada
 * - DELETE /:id/devolver     → Devolver ação (limpar `data_aprovado`)
 * - GET    /:id/arquivos     → Listar arquivos da ação
 * - GET    /:id/arquivo      → Baixar arquivo individual (?nome=)
 *
 * Regras SaaS:
 * - Exige identificação do tenant (cookie `tenant_id` ou header `x-tenant-id`) em todas as rotas
 */

const { Router } = require('express');
const c = require('../controllers/protocolacao.controller');

const router = Router();

/** Middleware local: exige tenant_id (cookie ou header) em todas as rotas abaixo */
function ensureTenant(req, res, next) {
    const fromCookie = req.cookies?.tenant_id;
    const fromHeader = req.headers['x-tenant-id'];
    const t = Number(fromCookie ?? fromHeader);
    if (!Number.isFinite(t) || t <= 0) {
        return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });
    }
    next();
}

router.use(ensureTenant);

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
