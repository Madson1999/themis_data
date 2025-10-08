/**
 * routes/acoes.routes.js
 * ----------------------------------------
 * Rotas de ações (processos) e Kanban — multi-tenant.
 *
 * - Exige identificação do tenant em todas as rotas (cookie `tenant_id` ou header `x-tenant-id`)
 * - Uploads usando multer.memoryStorage() (arquivos em memória → ideal para enviar ao S3/MinIO)
 * - Algumas rotas também exigem usuário autenticado via cookies (ensureAuthCookies)
 *
 * Endpoints:
 *  GET    /api/acoes?status=       → lista agrupando por designado
 *  POST   /api/acoes               → cria ação (uploads iniciais)
 *  POST   /api/acoes/upload-acao|upload-contrato|upload-procuracao|upload-declaracao|upload-ficha|upload-documentacao|upload-provas
 *  POST   /api/acoes/remover-arquivo
 *  POST   /api/acoes/aprovar/:id
 *  GET    /api/acoes/status/:id
 *  PUT    /api/acoes/status/:id
 *  GET    /api/acoes/arquivos/:id
 *  POST   /api/acoes/comentario/:acaoId
 *  GET    /api/acoes/comentario/:acaoId
 *  GET    /api/acoes/mine          (auth por cookie)
 *  PATCH  /api/acoes/:id/status    (somente do designado logado)
 */

const { Router } = require('express');
const multer = require('multer');
const c = require('../controllers/acoes.controller');
const { ensureAuthCookies } = require('../middlewares/authCookies');

const router = Router();

// ------ Multer em memória (nada em disco) ------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (ajuste se necessário)
});

/** Middleware local: exige tenant_id (cookie ou header) em todas as rotas abaixo */
function ensureTenant(req, res, next) {
    const fromCookie = req.cookies?.tenant_id;
    const fromHeader = req.headers['x-tenant-id'];
    const raw = (fromCookie ?? fromHeader ?? '').toString().trim();
    const t = Number(raw);
    if (!Number.isFinite(t) || t <= 0) {
        return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });
    }
    next();
}

// todas as rotas de ações exigem escopo de tenant
router.use(ensureTenant);

// LISTAGEM/CRUD BÁSICO
router.get('/', c.listar); // ?status=
router.post(
    '/',
    upload.fields([
        { name: 'contratoArquivo' },
        { name: 'procuracaoArquivo' },
        { name: 'declaracaoArquivo' },
        { name: 'fichaArquivo' },
        { name: 'documentacaoArquivo' },
        { name: 'provasArquivo' },
    ]),
    c.criar
);

// UPLOADS ADICIONAIS (mantendo rotas antigas)
// Observação: com memoryStorage, controllers devem ler req.file.buffer / req.files[field][0].buffer
router.post('/upload-acao', upload.single('arquivo'), c.uploadAcao);
router.post('/upload-contrato', upload.single('arquivo'), c.uploadContrato);
router.post('/upload-procuracao', upload.single('arquivo'), c.uploadProcuracao);
router.post('/upload-declaracao', upload.single('arquivo'), c.uploadDeclaracao);
router.post('/upload-ficha', upload.single('arquivo'), c.uploadFicha);
router.post('/upload-documentacao', upload.single('arquivo'), c.uploadDocumentacao);
router.post('/upload-provas', upload.single('arquivo'), c.uploadProvas);

// (Opcional) Novo endpoint para anexar direto ao S3:
// aponta para o handler que envia ao MinIO: c.uploadAnexoS3
router.post('/:id/anexos', upload.single('arquivo'), c.uploadAnexoS3);

// REMOVER ARQUIVO
router.post('/remover-arquivo', c.removerArquivo);

// STATUS / APROVAÇÃO
router.post('/aprovar/:id', c.aprovar);
router.get('/status/:id', c.getStatus);
router.put('/status/:id', c.updateStatus);

// ARQUIVOS DA AÇÃO (por tipo)
router.get('/arquivos/:id', c.listarArquivos);

// COMENTÁRIOS
router.post('/comentario/:acaoId', c.salvarComentario);
router.get('/comentario/:acaoId', c.obterComentario);

// “MINHAS AÇÕES” e PATCH de status do designado logado (exige usuário autenticado)
router.get('/mine', ensureAuthCookies, c.minhasAcoes);
router.patch('/:id/status', ensureAuthCookies, c.patchStatusMine);

module.exports = router;
