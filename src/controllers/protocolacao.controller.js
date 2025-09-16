/**
 * controllers/protocolacao.controller.js
 * ----------------------------------------
 * Camada HTTP de protocolação.
 * - Lista aprovados, marca como protocolado
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

exports.listarArquivos = asyncHandler(async (req, res) => {
    const rows = await service.listarArquivos(req.params.id);
    res.json(rows);
});

exports.downloadIndividual = asyncHandler(async (req, res) => {
    const out = await service.getArquivo(req.params.id, req.query.nome);
    if (out.status) return res.status(out.status).send(out.body);
    res.download(out.abs, out.nome);
});
