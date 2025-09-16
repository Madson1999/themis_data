/**
 * services/protocolacao.service.js
 * ----------------------------------------
 * Regras de protocolação pós-aprovação.
 * - Listar aprovados (com flag protocolado)
 * - Marcar “protocolado”
 * - Obter pasta da ação e ler/baixar arquivos
 */

const path = require('path');
const fs = require('fs-extra');
const { executeQuery } = require('../config/database');

exports.listarAprovados = async () => {
    return executeQuery(`
    SELECT id, cliente, titulo, designado, protocolado, data_aprovado
    FROM acoes
    WHERE data_aprovado IS NOT NULL
    ORDER BY data_aprovado DESC
  `, []);
};

exports.protocolar = (id) => executeQuery('UPDATE acoes SET protocolado = 1 WHERE id = ?', [id]);

exports.listarArquivos = async (id) => {
    const rows = await executeQuery('SELECT arquivo_path FROM acoes WHERE id = ?', [id]);
    if (!rows.length || !rows[0].arquivo_path) return [];
    const pasta = rows[0].arquivo_path;

    const existe = await fs.pathExists(pasta);
    if (!existe) return [];

    const nomes = await fs.readdir(pasta);
    const lista = [];
    for (const nome of nomes) {
        const abs = path.join(pasta, nome);
        const stat = await fs.stat(abs);
        if (stat.isFile()) {
            lista.push({
                nome,
                tamanho: stat.size,
                mtime: stat.mtime,
                url: `/api/protocolacao/${id}/arquivo?nome=${encodeURIComponent(nome)}`
            });
        }
    }
    return lista;
};

exports.getArquivo = async (id, nome) => {
    if (!nome) return { status: 400, body: 'Nome do arquivo é obrigatório' };
    const rows = await executeQuery('SELECT arquivo_path FROM acoes WHERE id = ?', [id]);
    if (!rows.length || !rows[0].arquivo_path) return { status: 404, body: 'Ação ou pasta não encontrada' };

    if (nome.includes('..') || nome.includes('/') || nome.includes('\\')) {
        return { status: 400, body: 'Nome de arquivo inválido' };
    }

    const pasta = rows[0].arquivo_path;
    const abs = path.join(pasta, nome);
    const existe = await fs.pathExists(abs);
    if (!existe) return { status: 404, body: 'Arquivo não encontrado' };

    return { abs, nome };
};
