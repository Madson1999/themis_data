/**
 * config/contratos.js
 * ----------------------------------------
 * Geração de contratos.
 * - gerarContrato(payload): gera .docx final e retorna caminho/nome/URL
 * - Abstrai templates e formatação de documentos
 */

const fs = require('fs-extra');
const path = require('path');
const PizZip = require('pizzip');

async function gerarContrato(dados) {
  try {
    const { cliente, numero_contrato = 'CON-' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 14), acao } = dados;
    const templatePath = path.join(__dirname, '../../public/contratos/modelos/CONTRATO.docx');

    if (!await fs.pathExists(templatePath)) {
      throw new Error('Template de contrato não encontrado.');
    }

    const content = await fs.readFile(templatePath, 'binary');
    const zip = new PizZip(content);

    // Preparar dados para substituição
    const dataAtual = new Date().toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const enderecoCompleto = `${cliente?.endereco || ''}, Bairro: ${cliente?.cidade || ''}, CEP: ${cliente?.cep || ''}, Cidade: ${cliente?.cidade} - ${cliente?.uf || ''}`;

    // Mapeamento de marcadores para valores
    const substituicoes = {
      '{{NOME_CLIENTE}}': (cliente?.nome || '').toUpperCase(),
      '{{CPF_CNPJ}}': cliente?.cpf_cnpj || '',
      '{{ENDERECO_COMPLETO}}': enderecoCompleto,
      '{{TELEFONE}}': cliente?.telefone1 || '',
      '{{EMAIL}}': cliente?.email || '',
      '{{DATA_ATUAL}}': dataAtual,
      '{{NUMERO_CONTRATO}}': numero_contrato,
      '{{RG}}': cliente?.rg || '',
      '{{NACIONALIDADE}}': cliente?.nacionalidade || '',
      '{{ESTADO_CIVIL}}': cliente?.estado_civil || '',
      '{{PROFISSAO}}': cliente?.profissao || '',
      '{{CIDADE}}': cliente?.cidade || '',
      '{{UF}}': cliente?.uf || '',
      '{{ENDERECO}}': cliente?.endereco || '',
      '{{ACAO}}': acao || ''
    };

    // Substituir marcadores no XML do documento
    const docXml = zip.file('word/document.xml').asText();
    let novoXml = docXml;

    // Fazer todas as substituições
    Object.entries(substituicoes).forEach(([marcador, valor]) => {
      const regex = new RegExp(marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      novoXml = novoXml.replace(regex, valor);
    });

    zip.file('word/document.xml', novoXml);

    // Pasta de destino
    const ano = new Date().getFullYear();
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    const pastaAno = path.join(__dirname, '../../public/contratos/gerados', String(ano));
    const pastaMes = path.join(pastaAno, mes);
    await fs.ensureDir(pastaMes);

    const nomeArquivo = `contrato-${numero_contrato}.docx`;
    const caminhoArquivo = path.join(pastaMes, nomeArquivo);

    const buf = zip.generate({ type: 'nodebuffer' });
    await fs.writeFile(caminhoArquivo, buf);

    return {
      sucesso: true,
      caminho: caminhoArquivo,
      nomeArquivo: nomeArquivo,
      url: `/contratos/gerados/${ano}/${mes}/${nomeArquivo}`
    };

  } catch (error) {
    console.error('Erro ao gerar contrato:', error);
    throw error;
  }
}


module.exports = {
  gerarContrato
};