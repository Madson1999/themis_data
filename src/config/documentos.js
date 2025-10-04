/**
 * config/documentos.js
 * ----------------------------------------
 * Geração de documentos .docx a partir de templates:
 * - gerarPacoteDocumentos(payload): gera DOCUMENTO/CONTRATO, DECLARAÇÃO, FICHA e PROCURAÇÃO de uma vez
 *
 * Delimitadores no .docx: [[CHAVE]]  (ajuste para {{CHAVE}} removendo a opção "delimiters" no Docxtemplater)
 * Tags suportadas:
 *  [[NOME_CLIENTE]], [[CPF_CNPJ]], [[ENDERECO_COMPLETO]], [[TELEFONE]], [[EMAIL]],
 *  [[DATA_ATUAL]], [[NUMERO_DOCUMENTO]], [[RG]], [[NACIONALIDADE]],
 *  [[ESTADO_CIVIL]], [[PROFISSAO]], [[CIDADE]], [[UF]], [[ENDERECO]], [[OBJETO_ACAO]], [[TIPO_ACAO]]
 *  [[REQUERIDO]], [[ATENDIDO_POR]], [[DATA_ATENDIMENTO]], [[INDICADOR]]
 */

const fs = require('fs-extra');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// --- utils ---

function isIsoDateLike(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function paraPtBr(isoOrBr) {
  if (!isoOrBr) return '';
  if (isIsoDateLike(isoOrBr)) {
    const d = new Date(`${isoOrBr}T00:00:00`);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  // se já vier "02 de outubro de 2025", mantém
  return isoOrBr;
}

/** Monta objeto de dados para o template */
function montarDadosTemplate({
  cliente = {},
  numero_documento,
  objeto_acao,
  tipo_acao,
  requerido,
  atendido_por,
  data_atendimento,
  indicador
}) {
  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const enderecoCompleto =
    `${cliente?.endereco || ''}${cliente?.endereco ? ', ' : ''}` +
    `Bairro: ${cliente?.bairro || ''}${cliente?.bairro ? ', ' : ''}` +
    `CEP: ${cliente?.cep || ''}${cliente?.cep ? ', ' : ''}` +
    `Cidade: ${cliente?.cidade || ''} - ${cliente?.uf || ''}`;

  return {
    NOME_CLIENTE: (cliente?.nome || '').toUpperCase(),
    CPF_CNPJ: cliente?.cpf_cnpj || '',
    ENDERECO_COMPLETO: enderecoCompleto,
    TELEFONE: cliente?.telefone1 || '',
    EMAIL: cliente?.email || '',
    DATA_ATUAL: dataAtual,
    NUMERO_DOCUMENTO: numero_documento || '',
    RG: cliente?.rg || '',
    NACIONALIDADE: cliente?.nacionalidade || '',
    ESTADO_CIVIL: cliente?.estado_civil || '',
    PROFISSAO: cliente?.profissao || '',
    CIDADE: cliente?.cidade || '',
    UF: cliente?.uf || '',
    ENDERECO: cliente?.endereco || '',
    OBJETO_ACAO: objeto_acao || '',
    REQUERIDO: requerido || '',
    ATENDIDO_POR: atendido_por || '',
    DATA_ATENDIMENTO: paraPtBr(data_atendimento) || '',
    INDICADOR: indicador || '',
    TIPO_ACAO: tipo_acao || ''
  };
}

/** Lê um template .docx e aplica os dados, retornando um Buffer do doc final */
async function renderizarDocx(templatePath, data) {
  if (!(await fs.pathExists(templatePath))) {
    throw new Error(`Template não encontrado em: ${templatePath}`);
  }

  const content = await fs.readFile(templatePath, 'binary');
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '[[', end: ']]' }, // use {{ }} removendo esta linha
  });

  try {
    doc.render(data);
  } catch (e) {
    const errs = e?.properties?.errors?.map(er => ({
      file: er.properties?.file,
      context: er.properties?.context,
      message: er.message,
    }));
    console.error('Erro ao renderizar DOCX:', errs || e);
    throw e;
  }

  return doc.getZip().generate({ type: 'nodebuffer' });
}

/** Garante pasta destino: /public/documentos/gerados/YYYY/MM */
async function prepararPastaDestino() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const pastaMes = path.join(
    __dirname,
    '../../public/documentos/gerados',
    String(ano),
    mes
  );
  await fs.ensureDir(pastaMes);
  return { ano, mes, pastaMes };
}

/**
 * Gera o PACOTE de documentos a partir do mesmo payload:
 * - DOCUMENTO/CONTRATO (DOCUMENTO.docx)
 * - DECLARAÇÃO (DECLARACAO.docx)
 * - FICHA (FICHA.docx)
 * - PROCURAÇÃO (PROCURACAO.docx)
 *
 * Espera no "dados":
 *  {
 *    cliente, objeto_acao, numero_documento?, requerido?, atendido_por?, data_atendimento?, indicador?
 *  }
 */
async function gerarPacoteDocumentos(dados) {
  try {
    const {
      cliente,
      objeto_acao,
      tipo_acao,
      numero_documento = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14),
      requerido = '',
      atendido_por = '',
      data_atendimento = '',
      indicador = '',
    } = dados;

    // monta todas as chaves pro template (inclui novos campos)
    const dataTemplate = montarDadosTemplate({
      cliente,
      numero_documento,
      objeto_acao,
      tipo_acao,
      requerido,
      atendido_por,
      data_atendimento,
      indicador,
    });

    // Ajuste esses nomes conforme seus arquivos reais na pasta "public/documentos/modelos"
    const modelos = [
      { modelo: 'CONTRATO.docx', rotulo: 'CONTRATO' },
      { modelo: 'DECLARACAO.docx', rotulo: 'DECLARACAO' },
      { modelo: 'FICHA.docx', rotulo: 'FICHA' },
      { modelo: 'PROCURACAO.docx', rotulo: 'PROCURACAO' },
    ];

    const { ano, mes, pastaMes } = await prepararPastaDestino();

    const resultados = [];
    for (const item of modelos) {
      const templatePath = path.join(
        __dirname,
        '../../public/documentos/modelos',
        item.modelo
      );

      const buf = await renderizarDocx(templatePath, dataTemplate);

      const nomeArquivo = `${item.rotulo} - ${numero_documento}.docx`;
      const caminhoArquivo = path.join(pastaMes, nomeArquivo);
      await fs.writeFile(caminhoArquivo, buf);

      resultados.push({
        tipo: item.rotulo,
        sucesso: true,
        caminho: caminhoArquivo,
        nomeArquivo,
        url: `/documentos/gerados/${ano}/${mes}/${nomeArquivo}`,
      });
    }

    return {
      sucesso: true,
      numero_documento,
      documentos: resultados,
    };
  } catch (error) {
    console.error('Erro ao gerar pacote de documentos:', error);
    throw error;
  }
}

module.exports = {
  gerarPacoteDocumentos,
  montarDadosTemplate,
};
