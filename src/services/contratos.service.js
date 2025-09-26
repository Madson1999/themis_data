/**
 * services/contratos.service.js
 * ----------------------------------------
 * Regras de contratos.
 * - Usa config/contratos para gerar preview/arquivo final
 * - Persiste metadados (número do contrato, caminho, cliente_id, ação, data)
 * - Consultas para listagem e recuperação de arquivo
 */

const path = require('path');
const fs = require('fs-extra');
const { executeQuery } = require('../config/database');
const { gerarContrato, previewContrato } = require('../config/contratos');

exports.gerar = async (cliente_id, acao) => {
    const clientes = await executeQuery('SELECT * FROM cliente WHERE id = ?', [cliente_id]);
    if (!clientes.length) return { status: 404, body: { sucesso: false, mensagem: 'Cliente não encontrado' } };
    const cliente = clientes[0];

    const data = new Date();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    const numero_contrato = `CON-${ano}${mes}${dia}-${hora}${minuto}`;

    const resultado = await gerarContrato({ cliente, numero_contrato, acao });

    await executeQuery(
        'INSERT INTO contratos (nome, cliente_id, contrato, acao, arquivo_path, data_geracao) VALUES (?, ?, ?, ?, ?, NOW())',
        [cliente.nome, cliente_id, numero_contrato, acao, resultado.caminho]
    );

    return {
        sucesso: true,
        mensagem: 'Contrato gerado com sucesso!',
        arquivo: resultado.url,
        nomeArquivo: resultado.nomeArquivo
    };
};

exports.listar = async () => {
    return executeQuery(`
    SELECT c.*, cl.nome AS cliente_nome
    FROM contratos c
    JOIN cliente cl ON c.cliente_id = cl.id
    ORDER BY c.data_geracao DESC
    LIMIT 20
  `);
};

exports.getArquivoPath = async (contratoId) => {
    const contratos = await executeQuery('SELECT * FROM contratos WHERE id = ?', [contratoId]);
    if (!contratos.length) return { status: 404, body: { sucesso: false, mensagem: 'Contrato não encontrado' } };

    const arquivoPath = contratos[0].arquivo_path;
    if (!await fs.pathExists(arquivoPath))
        return { status: 404, body: { sucesso: false, mensagem: 'Arquivo do contrato não encontrado' } };

    return { caminho: arquivoPath, nome: path.basename(arquivoPath) };
};
