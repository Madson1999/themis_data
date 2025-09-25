/**
 * acoes.controller.js
 * ----------------------------------------
 * Controlador que expõe endpoints HTTP relacionados às ações.
 * Orquestra as chamadas ao acoes.service e responde JSON.
 * Endpoints:
 * - POST /api/acoes → criar nova ação com uploads
 * - POST /api/acoes/upload-* → uploads adicionais
 * - POST /api/acoes/remover-arquivo → remove arquivo
 * - GET /api/acoes → lista ações (kanban, agrupadas por designado)
 * - POST /api/acoes/aprovar/:id → aprova ação
 * - GET /api/acoes/status/:id → consulta status
 * - PUT /api/acoes/status/:id → atualiza status/designado
 * - GET /api/acoes/arquivos/:id → lista arquivos por tipo
 * - POST/GET /api/acoes/comentario/:acaoId → salvar/obter comentário
 * - GET /api/acoes/mine → lista ações atribuídas ao usuário logado
 * - PATCH /api/acoes/:id/status → atualiza status apenas se pertence ao usuário logado
 */

const service = require('../services/acoes.service');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/acoes  (criar ação + uploads iniciais)
exports.criar = asyncHandler(async (req, res) => {
    const { cliente_id, designado_id, titulo } = req.body;

    // status vira opcional: se não vier, "Não iniciado"
    const status = (req.body.status && String(req.body.status).trim()) || 'Não iniciado';

    // complexidade é obrigatória e vem do select do form
    const complexidade = (req.body.complexidade && String(req.body.complexidade));

    const criador_id = req.cookies?.usuario_id || null;

    if (!cliente_id || !titulo || !complexidade) {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'cliente_id, titulo e complexidade são obrigatórios'
        });
    }

    // arquivos iniciais (multer.fields nas rotas)
    const arquivos = [
        ...(req.files?.contratoArquivo || []),
        ...(req.files?.procuracaoArquivo || []),
        ...(req.files?.declaracaoArquivo || []),
        ...(req.files?.fichaArquivo || []),
        ...(req.files?.documentacaoArquivo || []),
        ...(req.files?.provasArquivo || []),
    ];

    const result = await service.criar({
        cliente_id,
        designado_id,
        titulo,
        status,
        criador_id,
        arquivos,
        complexidade,
    });

    res.json({
        sucesso: true,
        mensagem: 'Ação criada com sucesso!',
        id: result.id,
        arquivos,
    });
});


// Uploads adicionais (um por rota, mantendo as rotas antigas)
exports.uploadAcao = asyncHandler(async (req, res) => {
    const { acao_id } = req.body;
    if (!acao_id || !req.file) {
        return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }
    await service.uploadArquivo({ acao_id, arquivo: req.file, prefixo: 'ACAO' });
    res.json({ sucesso: true, mensagem: 'Arquivo salvo com sucesso!' });
});

exports.uploadContrato = asyncHandler(async (req, res) => {
    const { acao_id } = req.body;
    if (!acao_id || !req.file) {
        return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }
    await service.uploadArquivo({ acao_id, arquivo: req.file, prefixo: 'CON' });
    res.json({ sucesso: true, mensagem: 'Arquivo salvo com sucesso!' });
});

exports.uploadProcuracao = asyncHandler(async (req, res) => {
    const { acao_id } = req.body;
    if (!acao_id || !req.file) {
        return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }
    await service.uploadArquivo({ acao_id, arquivo: req.file, prefixo: 'PRO' });
    res.json({ sucesso: true, mensagem: 'Arquivo salvo com sucesso!' });
});

exports.uploadDeclaracao = asyncHandler(async (req, res) => {
    const { acao_id } = req.body;
    if (!acao_id || !req.file) {
        return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }
    await service.uploadArquivo({ acao_id, arquivo: req.file, prefixo: 'DEC' });
    res.json({ sucesso: true, mensagem: 'Arquivo salvo com sucesso!' });
});

exports.uploadFicha = asyncHandler(async (req, res) => {
    const { acao_id } = req.body;
    if (!acao_id || !req.file) {
        return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }
    await service.uploadArquivo({ acao_id, arquivo: req.file, prefixo: 'FIC' });
    res.json({ sucesso: true, mensagem: 'Arquivo salvo com sucesso!' });
});

exports.uploadDocumentacao = asyncHandler(async (req, res) => {
    const { acao_id } = req.body;
    if (!acao_id || !req.file) {
        return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }
    await service.uploadArquivo({ acao_id, arquivo: req.file, prefixo: 'DOC' });
    res.json({ sucesso: true, mensagem: 'Arquivo salvo com sucesso!' });
});

exports.uploadProvas = asyncHandler(async (req, res) => {
    const { acao_id } = req.body;
    if (!acao_id || !req.file) {
        return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }
    await service.uploadArquivo({ acao_id, arquivo: req.file, prefixo: 'PROV' });
    res.json({ sucesso: true, mensagem: 'Arquivo salvo com sucesso!' });
});

// POST /api/acoes/remover-arquivo
exports.removerArquivo = asyncHandler(async (req, res) => {
    const { acaoId, nomeArquivo } = req.body;
    if (!acaoId || !nomeArquivo) return res.status(400).json({ erro: 'Dados obrigatórios não fornecidos' });
    await service.removerArquivo({ acaoId, nomeArquivo });
    res.json({ sucesso: true });
});

// GET /api/acoes  (kanban: agrupado por designado)
exports.listar = asyncHandler(async (req, res) => {
    const itens = await service.listar(req.query.status);
    const porDesignado = {};
    itens.forEach(acao => {
        const designado = acao.designado || 'Nenhum';
        if (!porDesignado[designado]) porDesignado[designado] = [];
        porDesignado[designado].push(acao);
    });
    res.json(porDesignado);
});

// POST /api/acoes/aprovar/:id
exports.aprovar = asyncHandler(async (req, res) => {
    await service.aprovar(req.params.id);
    res.json({ sucesso: true });
});

// GET /api/acoes/status/:id
exports.getStatus = asyncHandler(async (req, res) => {
    const dados = await service.getStatus(req.params.id);
    if (!dados) return res.status(404).json({ erro: 'Ação não encontrada' });
    // dados = { status, complexidade, designado }
    res.json(dados);
});

// PUT /api/acoes/status/:id
exports.updateStatus = asyncHandler(async (req, res) => {
    const { status, designado, complexidade } = req.body;

    await service.updateStatus(req.params.id, {
        status,
        designado,
        complexidade
    });

    res.json({ sucesso: true });
});

// GET /api/acoes/arquivos/:id
exports.listarArquivos = asyncHandler(async (req, res) => {
    const data = await service.listarArquivos(req.params.id);
    res.json(data);
});

// POST /api/acoes/comentario/:acaoId
exports.salvarComentario = asyncHandler(async (req, res) => {
    const { comentario } = req.body;
    if (!comentario) return res.status(400).json({ mensagem: 'Comentário inválido.' });
    await service.salvarComentario(req.params.acaoId, comentario);
    res.json({ mensagem: 'Comentário salvo com sucesso!' });
});

// GET /api/acoes/comentario/:acaoId
exports.obterComentario = asyncHandler(async (req, res) => {
    const c = await service.obterComentario(req.params.acaoId);
    res.json({ comentario: c });
});

// GET /api/acoes/mine
exports.minhasAcoes = asyncHandler(async (req, res) => {
    const rows = await service.listarMinhas(req.user.id);
    res.json(rows);
});

// PATCH /api/acoes/:id/status (restrito ao designado logado)
exports.patchStatusMine = asyncHandler(async (req, res) => {
    const acaoId = Number(req.params.id);
    const { status } = req.body;
    if (!acaoId || !status) return res.status(400).json({ error: 'ID e status são obrigatórios' });
    await service.atualizarStatusMine(acaoId, req.user.id, status);
    res.json({ ok: true });
});
