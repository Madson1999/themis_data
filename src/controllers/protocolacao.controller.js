/**
 * controllers/protocolacao.controller.js
 * ----------------------------------------
 * Camada HTTP de protocolação.
 * - Lista aprovados
 * - Marca como protocolado
 * - Devolve ação (remove data_aprovado)
 * - Lista e baixa arquivos da pasta vinculada à ação
 */

const service = require('../services/protocolacao.service');
const asyncHandler = require('../utils/asyncHandler');

exports.listarAprovados = asyncHandler(async (_req, res) => {
    const rows = await service.listarAprovados();
    res.json(rows);
});

exports.protocolar = asyncHandler(async (req, res) => {
    await service.protocolar(req.params.id);
    res.json({ sucesso: true });
});

exports.devolver = asyncHandler(async (req, res) => {
    await service.devolverAcao(req.params.id);   // chama a função do service
    res.json({ sucesso: true, mensagem: 'Ação devolvida' });
});

exports.listarArquivos = asyncHandler(async (req, res) => {
    const rows = await service.listarArquivos(req.params.id);
    res.json(rows);
});

exports.downloadIndividual = asyncHandler(async (req, res) => {
    const out = await service.getArquivo(req.params.id, req.query.nome);
    if (out.status) return res.status(out.status).send(out.body);
    res.download(out.abs, out.nome);
});
