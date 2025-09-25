/**
 * routes/acoes.routes.js
 * ----------------------------------------
 * Rotas de ações (processos) e Kanban.
 * - GET  /api/acoes?status=       → lista agrupando por designado
 * - POST /api/acoes               → cria ação (uploads iniciais)
 * - POST /api/acoes/upload-acao|upload-contrato|upload-documentacao|upload-provas
 * - POST /api/acoes/remover-arquivo
 * - POST /api/acoes/aprovar/:id
 * - GET  /api/acoes/status/:id    | PUT /api/acoes/status/:id
 * - GET  /api/acoes/arquivos/:id
 * - POST/GET /api/acoes/comentario/:acaoId
 * - GET  /api/acoes/mine          (auth por cookie)
 * - PATCH /api/acoes/:id/status   (somente do designado logado)
 */


const { Router } = require('express');
const c = require('../controllers/acoes.controller');
const { upload } = require('../utils/uploads');         // multer centralizado
const { ensureAuthCookies } = require('../middlewares/authCookies'); // mesmo comportamento do server.js
const router = Router();

// LISTAGEM/CRUD BÁSICO
router.get('/', c.listar); // ?status=
router.post('/',
    upload.fields([{ name: 'contratoArquivo' }, { name: 'procuracaoArquivo' }, { name: 'declaracaoArquivo' }, { name: 'fichaArquivo' }, { name: 'documentacaoArquivo' }, { name: 'provasArquivo' }]),
    c.criar
);

// UPLOADS ADICIONAIS (mantendo rotas antigas)
router.post('/upload-acao', upload.single('arquivo'), c.uploadAcao);
router.post('/upload-contrato', upload.single('arquivo'), c.uploadContrato);
router.post('/upload-procuracao', upload.single('arquivo'), c.uploadProcuracao);
router.post('/upload-declaracao', upload.single('arquivo'), c.uploadDeclaracao);
router.post('/upload-ficha', upload.single('arquivo'), c.uploadFicha);
router.post('/upload-documentacao', upload.single('arquivo'), c.uploadDocumentacao);
router.post('/upload-provas', upload.single('arquivo'), c.uploadProvas);

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

// “MINHAS AÇÕES” e PATCH de status do designado logado
router.get('/mine', ensureAuthCookies, c.minhasAcoes);
router.patch('/:id/status', ensureAuthCookies, c.patchStatusMine);

module.exports = router;
