/**
 * controllers/usuarios.controller.js
 * ----------------------------------------
 * Camada HTTP dos usuários.
 * - Criação (hash de senha feito no service ou aqui, conforme implementação)
 * - Atualização dinâmica por campos
 * - Listagens gerais e de designados
 */

const service = require('../services/usuarios.service');
const asyncHandler = require('../utils/asyncHandler');

exports.listar = asyncHandler(async (_req, res) => {
    const rows = await service.listar();
    res.json(rows);
});

exports.listarDesignados = asyncHandler(async (_req, res) => {
    const rows = await service.listarDesignados();
    res.json(rows);
});

exports.criar = asyncHandler(async (req, res) => {
    const r = await service.criar(req.body);
    if (r.status) return res.status(r.status).json(r.body);
    res.json(r);
});

exports.atualizar = asyncHandler(async (req, res) => {
    const r = await service.atualizar(req.params.id, req.body);
    if (r.status) return res.status(r.status).json(r.body);
    res.json({ sucesso: true, mensagem: 'Usuário atualizado com sucesso!' });
});
