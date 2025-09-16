/**
 * controllers/contratos.controller.js
 * ----------------------------------------
 * Camada HTTP de contratos.
 * - Preview e geração real (delegados p/ config/contratos + service)
 * - Listagem e download por id
 */

const service = require('../services/contratos.service');
const asyncHandler = require('../utils/asyncHandler');

exports.preview = asyncHandler(async (req, res) => {
    const { cliente_id, acao } = req.body;
    if (!cliente_id) return res.status(400).json({ sucesso: false, mensagem: 'ID do cliente é obrigatório' });
    const out = await service.preview(cliente_id, acao);
    if (out.status) return res.status(out.status).json(out.body);
    res.json(out);
});

exports.gerar = asyncHandler(async (req, res) => {
    const { cliente_id, acao } = req.body;
    if (!cliente_id) return res.status(400).json({ sucesso: false, mensagem: 'ID do cliente é obrigatório' });
    const r = await service.gerar(cliente_id, acao);
    if (r.status) return res.status(r.status).json(r.body);
    res.json(r);
});

exports.listar = asyncHandler(async (_req, res) => {
    const rows = await service.listar();
    res.json(rows);
});

exports.download = asyncHandler(async (req, res) => {
    const file = await service.getArquivoPath(req.params.id);
    if (file.status) return res.status(file.status).json(file.body);

    res.setHeader('Content-Disposition', `attachment; filename="${file.nome}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.sendFile(file.caminho);
});
