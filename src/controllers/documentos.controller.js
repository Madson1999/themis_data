// controllers/documentos.controller.js
const asyncHandler = require('../utils/asyncHandler');
const { executeQuery } = require('../config/database'); // ajuste o path se necessário
const { gerarPacoteDocumentos } = require('../config/documentos'); // seu módulo gerador

/**
 * POST /api/documentos/gerar
 * Body aceito:
 *   { cliente_id, acao?, numero_documento? }
 *   ou { cliente: {...}, acao?, numero_documento? }
 */

// helper simples p/ data do input=date
function paraPtBr(iso) {
    if (!iso) return '';
    // iso: "2025-10-02"
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

exports.gerar = asyncHandler(async (req, res) => {
    const {
        cliente_id,
        cliente: clienteBody,
        objeto_acao = '',
        tipo_acao = '',
        numero_documento,
        requerido = '',
        atendido_por = '',
        data_atendimento = '', // vem "yyyy-mm-dd"
        indicador = '',
    } = req.body || {};

    // 1) Carrega cliente (por id ou payload)
    let cliente = null;

    if (cliente_id) {
        const rows = await executeQuery(`
      SELECT id, nome, cpf_cnpj, rg, nacionalidade, estado_civil, profissao,
             cidade, uf, endereco, bairro, cep, telefone1, email
      FROM cliente
      WHERE id = ?
      LIMIT 1;
    `, [cliente_id]);

        if (!rows.length) {
            return res.status(400).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
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
        cliente = clienteBody;
    } else {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Envie cliente_id ou cliente (com nome e cpf_cnpj).',
        });
    }

    // 2) Normaliza data de atendimento (se veio do input=date)
    const dataAtendimentoBR = paraPtBr(data_atendimento);

    // 3) Chama o gerador passando TUDO plano (sem objeto "extras")
    const resultado = await gerarPacoteDocumentos({
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
