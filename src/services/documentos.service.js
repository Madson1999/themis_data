/**
 * services/documentos.service.js
 * ----------------------------------------
 * Regras de documentos.
 * - Usa config/documentos para gerar preview/arquivo final
 * - Persiste metadados (número do documento, caminho, cliente_id, ação, data)
 * - Consultas para listagem e recuperação de arquivo
 */

const path = require('path');
const fs = require('fs-extra');
const { executeQuery } = require('../config/database');
const { gerarDocumento, previewDocumento } = require('../config/documentos');

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
    const numero_documento = `CON-${ano}${mes}${dia}-${hora}${minuto}`;

    const resultado = await gerarDocumento({ cliente, numero_documento, acao });

    await executeQuery(
        'INSERT INTO documentos (nome, cliente_id, documento, acao, arquivo_path, data_geracao) VALUES (?, ?, ?, ?, ?, NOW())',
        [cliente.nome, cliente_id, numero_documento, acao, resultado.caminho]
    );

    return {
        sucesso: true,
        mensagem: 'Documento gerado com sucesso!',
        arquivo: resultado.url,
        nomeArquivo: resultado.nomeArquivo
    };
};

exports.listar = async () => {
    return executeQuery(`
    SELECT c.*, cl.nome AS cliente_nome
    FROM documentos c
    JOIN cliente cl ON c.cliente_id = cl.id
    ORDER BY c.data_geracao DESC
    LIMIT 20
  `);
};

exports.getArquivoPath = async (documentoId) => {
    const documentos = await executeQuery('SELECT * FROM documentos WHERE id = ?', [documentoId]);
    if (!documentos.length) return { status: 404, body: { sucesso: false, mensagem: 'Documento não encontrado' } };

    const arquivoPath = documentos[0].arquivo_path;
    if (!await fs.pathExists(arquivoPath))
        return { status: 404, body: { sucesso: false, mensagem: 'Arquivo dos documents não encontrados' } };

    return { caminho: arquivoPath, nome: path.basename(arquivoPath) };
};
