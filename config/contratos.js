const fs = require('fs-extra');
const path = require('path');
const PizZip = require('pizzip');

async function gerarContrato(dados) {
  try {
    const { cliente, numero_contrato = 'CON-' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 14), acao } = dados;
    const templatePath = path.join(__dirname, '../public/contratos/modelos/CONTRATO.docx');

    if (!await fs.pathExists(templatePath)) {
      throw new Error('Template de contrato não encontrado.');
    }

    const content = await fs.readFile(templatePath, 'binary');
    const zip = new PizZip(content);

    // Preparar dados para substituição
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const enderecoCompleto = `${cliente?.endereco || ''}, Bairro: ${cliente?.cidade || ''}, CEP: ${cliente?.cep || ''}, Cidade: ${cliente?.cidade} - ${cliente?.uf || ''}`;

    // Mapeamento de marcadores para valores
    const substituicoes = {
      '{{NOME_CLIENTE}}': (cliente?.nome || '').toUpperCase(),
      '{{CPF_CNPJ}}': cliente?.cpf_cnpj || '',
      '{{ENDERECO_COMPLETO}}': enderecoCompleto,
      '{{TELEFONE}}': cliente?.telefone || '',
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
    const pastaAno = path.join(__dirname, '../public/contratos/gerados', String(ano));
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

// Função para gerar preview do contrato (apenas texto formatado)
function previewContrato(dados) {
  try {
    const { cliente, acao } = dados;

    // Preparar dados para substituição
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const enderecoCompleto = `${cliente?.endereco || ''}, Bairro: ${cliente?.cidade || ''}, CEP: ${cliente?.cep || ''}, Cidade: ${cliente?.cidade} - ${cliente?.uf || ''}`;

    // Mapeamento de marcadores para valores
    const substituicoes = {
      '{{NOME_CLIENTE}}': (cliente?.nome || '').toUpperCase(),
      '{{CPF_CNPJ}}': cliente?.cpf_cnpj || '',
      '{{ENDERECO_COMPLETO}}': enderecoCompleto,
      '{{TELEFONE}}': cliente?.telefone || '',
      '{{EMAIL}}': cliente?.email || '',
      '{{DATA_ATUAL}}': dataAtual,
      '{{NUMERO_CONTRATO}}': 'CON-' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 14),
      '{{RG}}': cliente?.rg || '',
      '{{NACIONALIDADE}}': cliente?.nacionalidade || 'brasileira',
      '{{ESTADO_CIVIL}}': cliente?.estado_civil || 'solteira',
      '{{PROFISSAO}}': cliente?.profissao || 'funcionária pública',
      '{{CIDADE}}': cliente?.cidade || '',
      '{{UF}}': cliente?.uf || '',
      '{{ENDERECO}}': cliente?.endereco || '',
      '{{ACAO}}': acao || ''
    };

    // Para o preview, vamos retornar um texto simples com as substituições
    // Você pode personalizar este texto conforme necessário
    let previewText = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS
CONTRATANTE: {{NOME_CLIENTE}}, {{NACIONALIDADE}}, {{ESTADO_CIVIL}}, {{PROFISSAO}}, portador(a) do RG: {{RG}} SSP/AM, CPF: {{CPF_CNPJ}}, com endereço eletrônico: {{EMAIL}}, residente e domiciliada na {{ENDERECO_COMPLETO}}.

CONTRATADOS: Dr. KELSON GIRÃO DE SOUZA, brasileiro, casado, advogado inscrito na OAB∕AM sob o n° 7.670 e Dra. GIULIANNE LOPES CURSINO, brasileira, casada, advogada, inscrita na OAB∕AM sob o n° 7.922, sócios do escritório jurídico KELSON SOUZA & GIULIANNE CURSINO ADVOGADOS, sociedade de advogados, inscrita na OAB/AM sob o n° 581/15, profissional na Av. Djalma Batista Shopping Millennium Business Tower, sala 1204, 12º andar nº 1661, Bairro: Chapada, CEP: 69050-010, Cidade: Manaus/AM. Pelo presente instrumento particular, as partes supra qualificadas convencionam entre si o seguinte:

1° O CONTRATADO obriga-se a ajuizar {{ACAO}}, conforme termos do mandato que lhe é outorgado em apartado;

2° A medida judicial referida no item anterior deverá ser ajuizada no prazo de 30 (trinta) dias, contados a partir da assinatura deste;

3° O contratado informa que não possui outro(s) processo(s) de igual teor em tramitação no judiciário. Se, no decorrer do processo for identificada a duplicidade de ações o contratado arcará com as sanções impostas pelo judiciário;

4° Pelos serviços, o CONTRATANTE em remuneração ao serviço contratado pagará, por livre e espontânea liberalidade, a porcentagem de 40% (quarenta por cento), do que for acordado em Audiência de Conciliação, Instrução e Julgamento ou que for Condenado em Sentença Judicial, em razão de não ter condições de efetuar o pagamento dos honorários inicias, valor este devido somente em SUCESSO DA AÇÃO;
Parágrafo único. Assim como em casos em que há pedido de liminar e, na hipótese de condenação do requerido por descumprimento, ficará ajustado a porcentagem de 50% deste processo autônomo;

5° Em caso de condenação de Honorários de Sucumbência, este caberá apenas ao advogado contratado, conforme disposição da Ordem dos Advogados do Brasil;

6° O CONTRATANTE responderá, ainda, por todas as despesas do processo, sendo que o pagamento deverá ser feito de imediato tão logo a conta lhe seja apresentada, não respondendo o CONTRATADO por qualquer prejuízo que advenha da demora ou do não pagamento de qualquer despesa;
Parágrafo único. O contratante fica obrigado ao pagamento de um salário mínimo e meio em caso de desistência da ação e/ou por arquivamento do processo pelo não comparecimento em audiências de conciliação e/ou instrução;

7° Havendo necessidade de confecção e protocolo de Recurso/Contrarrazões, Mandado de Segurança, Agravo de Instrumento, será acrescido 10% (dez por cento), valor este somente devido em caso de sucesso da demanda;

8° Qualquer medida judicial ou extrajudicial que tenha como objeto o conteúdo deste contrato deverá ser ajuizado no foro da Comarca de Manaus- Amazonas;

Por estarem, assim, justos e contratados, firmam o presente instrumento, que é elaborado em duas vias, de igual teor, sendo uma para cada parte.

Manaus/AM, {{DATA_ATUAL}}

_________________________
KELSON GIRÃO DE SOUZA
OAB/AM 7.670

_________________________________________________ 
{{NOME_CLIENTE}}
`;

    // Fazer todas as substituições
    Object.entries(substituicoes).forEach(([marcador, valor]) => {
      const regex = new RegExp(marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      previewText = previewText.replace(regex, valor);
    });

    // Retorna o preview formatado para exibir no frontend
    return {
      sucesso: true,
      preview: previewText.replace(/\n/g, '<br>')
    };
  } catch (error) {
    console.error('Erro ao gerar preview do contrato:', error);
    return { sucesso: false, mensagem: 'Erro ao gerar preview do contrato.' };
  }
}

module.exports = {
  gerarContrato,
  previewContrato
};