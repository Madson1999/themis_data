/**
 * controllers/documentos.controller.js
 * ----------------------------------------
 * Geração de documentos (multi-tenant).
 * - POST /api/documentos/gerar
 *   Body:
 *     { cliente_id, objeto_acao?, tipo_acao?, numero_documento?, requerido?, atendido_por?, data_atendimento?, indicador? }
 *     ou
 *     { cliente: {...}, objeto_acao?, tipo_acao?, numero_documento?, requerido?, atendido_por?, data_atendimento?, indicador? }
 *
 * Regras SaaS:
 * - O tenant_id é obtido do cookie 'tenant_id', req.user.tenant_id ou header 'x-tenant-id'
 * - Quando buscar por ID, lê o cliente na tabela `clientes` com filtro WHERE tenant_id = ?
 * - Os arquivos gerados são salvos por tenant (ver config/documentos.js)
 */

const asyncHandler = require('../utils/asyncHandler');
const { executeQuery } = require('../config/database');
const { gerarPacoteDocumentos } = require('../config/documentos');

// helper: tenant_id (cookie -> req.user -> header)
function getTenantId(req) {
    const fromCookie = req.cookies?.tenant_id;
    const fromUser = req.user?.tenant_id;
    const fromHeader = req.headers['x-tenant-id'];
    const t = Number(fromCookie ?? fromUser ?? fromHeader);
    return Number.isFinite(t) && t > 0 ? t : null;
}

// helper simples p/ data do input=date
function paraPtBr(iso) {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

exports.gerar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) {
        return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });
    }

    const {
        cliente_id,
        cliente: clienteBody,
        objeto_acao = '',
        tipo_acao = '',
        numero_documento,
        requerido = '',
        atendido_por = '',
        data_atendimento = '', // "yyyy-mm-dd"
        indicador = '',
    } = req.body || {};

    // 1) Carrega cliente (por id ou payload)
    let cliente = null;

    if (cliente_id) {
        const rows = await executeQuery(
            `
        SELECT
          id, nome, cpf_cnpj, rg,
          cidade, bairro, cep, uf, endereco,
          telefone1, email, profissao, nacionalidade, estado_civil 
        FROM clientes
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
      `,
            [tenantId, cliente_id]
        );

        if (!rows.length) {
            return res.status(400).json({ sucesso: false, mensagem: 'Cliente não encontrado para este tenant.' });
        }

        const r = rows[0];
        cliente = {
            id: r.id,
            nome: r.nome,
            cpf_cnpj: r.cpf_cnpj,
            rg: r.rg || '',
            nacionalidade: r.nacionalidade || '',
            estado_civil: r.estado_civil || '',
            profissao: r.profissao || '',
            cidade: r.cidade || '',
            uf: r.uf || '',
            endereco: r.endereco || '',
            bairro: r.bairro || '',
            cep: r.cep || '',
            telefone1: r.telefone1 || '',
            email: r.email || '',
        };
    } else if (clienteBody) {
        if (!clienteBody.nome || !clienteBody.cpf_cnpj) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Informe ao menos cliente.nome e cliente.cpf_cnpj.',
            });
        }
        // Quando vem pelo body, apenas repassamos; geração vai usar esses campos
        cliente = clienteBody;
    } else {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Envie cliente_id ou cliente (com nome e cpf_cnpj).',
        });
    }

    // 2) Normaliza data de atendimento (se veio do input=date)
    const dataAtendimentoBR = paraPtBr(data_atendimento);

    // 3) Chama o gerador passando também o tenant_id (obrigatório no SaaS)
    const resultado = await gerarPacoteDocumentos({
        tenant_id: tenantId,
        cliente,
        objeto_acao,
        tipo_acao,
        numero_documento,
        requerido,
        atendido_por,
        data_atendimento: dataAtendimentoBR,
        indicador,
    });

    return res.status(201).json({
        sucesso: true,
        numero_documento: resultado.numero_documento,
        documentos: resultado.documentos,
    });
});
