/**
 * controllers/clientes.controller.js
 * ----------------------------------------
 * Camada HTTP dos clientes.
 * - Chama o service p/ listar/buscar, criar, obter, atualizar e excluir
 * - Padroniza códigos de status e mensagens
 */

const service = require('../services/clientes.service');
const asyncHandler = require('../utils/asyncHandler');

exports.listar = asyncHandler(async (req, res) => {
    const data = await service.listar(req.query.searchTerm);
    res.json(data);
});

exports.buscarParaDocumento = asyncHandler(async (req, res) => {
    const data = await service.buscarParaDocumento(req.query.q);
    res.json(data);
});

exports.criar = asyncHandler(async (req, res) => {
    const result = await service.criar(req.body);
    if (result?.status === 400) return res.status(400).json(result.body);
    res.json(result);
});

exports.obterPorId = asyncHandler(async (req, res) => {
    const data = await service.obterPorId(req.params.id);
    if (!data) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(data);
});

exports.atualizar = asyncHandler(async (req, res) => {
    const ok = await service.atualizar(req.params.id, req.body);
    if (ok === 'NOT_FOUND') return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado' });
    if (ok === 'CPF_DUP') return res.status(400).json({ sucesso: false, mensagem: 'CPF/CNPJ já cadastrado para outro cliente' });
    res.json({ sucesso: true, mensagem: 'Cliente atualizado com sucesso!' });
});

exports.excluir = asyncHandler(async (req, res) => {
    const ok = await service.excluir(req.params.id);
    if (ok === 'NOT_FOUND') return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado' });
    res.json({ sucesso: true, mensagem: 'Cliente excluído com sucesso!' });
});
