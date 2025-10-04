/**
 * acoes.service.js
 * ----------------------------------------
 * Service que contém toda a lógica de banco e filesystem relacionada às ações (processos).
 * Funcionalidades:
 * - Criar uma ação (monta pastas, salva arquivos iniciais e insere no banco)
 * - Upload de arquivos adicionais (contrato, procuração, declaração, ficha, documentação, provas, ação)
 * - Remoção de arquivos associados a uma ação
 * - Listagem de ações (com filtro por status)
 * - Aprovação de ações (define data_aprovado)
 * - Consulta e atualização de status/designado
 * - Listagem e separação de arquivos por tipo
 * - Inserção e leitura de comentários
 * - Listagem de “minhas ações” (ações atribuídas ao usuário logado)
 */

const path = require('path');
const fs = require('fs-extra');
const { executeQuery } = require('../config/database');

// Função util para garantir pasta
async function ensureDir(p) {
    await fs.ensureDir(p);
    return p;
}

// Gera nome de arquivo único dentro de uma pasta (evita "dest already exists")
async function gerarNomeUnico(dir, nomeDesejado) {
    let destino = path.join(dir, nomeDesejado);
    if (!(await fs.pathExists(destino))) return { nome: nomeDesejado, caminho: destino };

    const ext = path.extname(nomeDesejado);
    const base = path.basename(nomeDesejado, ext);
    let i = 1;
    while (await fs.pathExists(destino)) {
        const candidato = `${base} (${i})${ext}`;
        destino = path.join(dir, candidato);
        i++;
    }
    return { nome: path.basename(destino), caminho: destino };
}


// Criar uma ação nova
exports.criar = async ({
    cliente_id,
    designado_id,
    titulo,
    status = 'Não iniciado',
    criador_id = null,
    arquivos = [],
    complexidade,
}) => {
    if (!cliente_id) throw new Error('cliente_id é obrigatório');
    if (!titulo) throw new Error('titulo é obrigatório');

    // Buscar cliente
    const [cliente] = await executeQuery('SELECT id, nome, cpf_cnpj FROM cliente WHERE id = ?', [cliente_id]);
    if (!cliente) throw new Error('Cliente não encontrado');

    // Buscar designado (se não for “Nenhum”)
    let designadoNome = null;
    let designadoIdFinal = null;
    if (designado_id && designado_id !== 'Nenhum') {
        const [d] = await executeQuery('SELECT id, nome FROM usuarios WHERE id = ?', [designado_id]);
        if (d) { designadoNome = d.nome; designadoIdFinal = d.id; }
    }

    // Buscar criador
    const [criador] = await executeQuery('SELECT nome FROM usuarios WHERE id = ?', [criador_id]);
    const criadorNome = criador ? criador.nome : 'Sistema';

    // Montar estrutura de pastas
    const letraInicial = cliente.nome.charAt(0).toUpperCase();
    const nomeClienteFormatado = `${cliente.nome} ${cliente.cpf_cnpj || ''}`.trim().replace(/[^a-zA-Z0-9\s]/g, '');
    const tituloFormatado = String(titulo).replace(/[^a-zA-Z0-9\s]/g, '');
    const pastaAcao = path.join(process.cwd(), 'public', 'uploads', 'PROCESSOS', letraInicial, nomeClienteFormatado, tituloFormatado);
    await ensureDir(pastaAcao); // <- sua helper

    // Mover arquivos (com prefixos + nome único)
    for (const arquivo of arquivos) {
        let prefixo = '';
        if (arquivo.fieldname === 'contratoArquivo') prefixo = 'CON - ';
        else if (arquivo.fieldname === 'procuracaoArquivo') prefixo = 'PRO - ';
        else if (arquivo.fieldname === 'declaracaoArquivo') prefixo = 'DEC - ';
        else if (arquivo.fieldname === 'fichaArquivo') prefixo = 'FIC - ';
        else if (arquivo.fieldname === 'documentacaoArquivo') prefixo = 'DOC - ';
        else if (arquivo.fieldname === 'provasArquivo') prefixo = 'PROV - ';
        else if (arquivo.fieldname === 'acaoArquivo') prefixo = 'ACAO - ';

        const nomeDesejado = prefixo + arquivo.originalname;
        const { caminho } = await gerarNomeUnico(pastaAcao, nomeDesejado); // <- sua helper
        await fs.move(arquivo.path, caminho);
    }

    // evita undefined no bind
    const toNull = (v) => (v === undefined ? null : v);
    const valores = [
        toNull(cliente.nome),
        toNull(cliente.id),
        toNull(titulo),
        toNull(complexidade),
        toNull(designadoNome),
        toNull(designadoIdFinal),
        toNull(criadorNome),
        toNull(criador_id ?? null),
        toNull(status),
        toNull(pastaAcao),
    ];

    const result = await executeQuery(
        `INSERT INTO acoes
      (cliente, cliente_id, titulo, complexidade, designado, designado_id, criador, criador_id, status, arquivo_path, data_criacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        valores
    );

    return { id: result.insertId, pasta: pastaAcao };
};



// Upload adicional
exports.uploadArquivo = async ({ acao_id, arquivo, prefixo }) => {
    const [acao] = await executeQuery('SELECT * FROM acoes WHERE id = ?', [acao_id]);
    if (!acao) throw new Error('Ação não encontrada');

    const clienteNome = acao.cliente;
    const [cliente] = await executeQuery('SELECT cpf_cnpj FROM cliente WHERE nome = ?', [clienteNome]);
    const clienteCpf = cliente ? cliente.cpf_cnpj : '';
    const letraInicial = clienteNome.charAt(0).toUpperCase();
    const nomeClienteFormatado = `${clienteNome} ${clienteCpf}`.replace(/[^a-zA-Z0-9\s]/g, '');
    const tituloFormatado = acao.titulo.replace(/[^a-zA-Z0-9\s]/g, '');
    const pastaAcao = path.join(process.cwd(), 'public', 'uploads', 'PROCESSOS', letraInicial, nomeClienteFormatado, tituloFormatado);
    await ensureDir(pastaAcao);

    // Nome único
    let nomeArquivo = `${prefixo} - ${arquivo.originalname}`;
    let destino = path.join(pastaAcao, nomeArquivo);
    let i = 1;
    while (await fs.pathExists(destino)) {
        const ext = path.extname(arquivo.originalname);
        const base = path.basename(arquivo.originalname, ext);
        nomeArquivo = `${prefixo} - ${base} (${i})${ext}`;
        destino = path.join(pastaAcao, nomeArquivo);
        i++;
    }
    await fs.move(arquivo.path, destino);

    await executeQuery('UPDATE acoes SET arquivo_path = ? WHERE id = ?', [pastaAcao, acao_id]);
    return { nome: nomeArquivo, caminho: destino };
};

// Remover arquivo
exports.removerArquivo = async ({ acaoId, nomeArquivo }) => {
    const [acao] = await executeQuery('SELECT arquivo_path FROM acoes WHERE id = ?', [acaoId]);
    if (!acao) throw new Error('Ação não encontrada');
    const caminho = path.join(acao.arquivo_path, nomeArquivo);
    if (await fs.pathExists(caminho)) {
        await fs.remove(caminho);
        return true;
    }
    throw new Error('Arquivo não encontrado');
};

// Listar ações (com filtro opcional de status)
exports.listar = async (status) => {
    let sql = `SELECT id, cliente, titulo, complexidade, designado, criador, status, data_criacao, arquivo_path, data_aprovado FROM acoes`;
    const params = [];
    if (status) {
        sql += ' WHERE status = ?';
        params.push(status);
    }
    sql += ' ORDER BY data_criacao DESC';
    return executeQuery(sql, params);
};

// Aprovar ação
exports.aprovar = (id) =>
    executeQuery('UPDATE acoes SET data_aprovado = NOW() WHERE id = ?', [id]);

// Buscar status
exports.getStatus = async (id) => {
    const [r] = await executeQuery(
        'SELECT status, complexidade, designado FROM acoes WHERE id = ?',
        [id]
    );
    return r ? { status: r.status, complexidade: r.complexidade, designado: r.designado } : null;
};

// Atualizar status/designado
exports.updateStatus = (id, { status, designado, complexidade }) => {
    const sets = ['status = ?', 'designado = ?'];
    const params = [status, designado];

    if (complexidade) {
        sets.push('complexidade = ?');
        params.push(complexidade); // "Baixo/Médio/Alto" (normalizado no controller)
    }

    // mantém tua lógica de data_concluido, mas tornando case-insensitive
    const st = String(status || '').toLowerCase();
    if (st === 'finalizado') {
        sets.push('data_concluido = NOW()');
    } else if (st === 'em andamento') {
        sets.push('data_concluido = NULL');
    }

    const sql = `UPDATE acoes SET ${sets.join(', ')} WHERE id = ?`;
    params.push(id);
    return executeQuery(sql, params);
};

// Listar arquivos de uma ação
exports.listarArquivos = async (id) => {
    const [acao] = await executeQuery('SELECT arquivo_path, designado FROM acoes WHERE id = ?', [id]);
    if (!acao || !acao.arquivo_path || !(await fs.pathExists(acao.arquivo_path))) {
        return { Contrato: [], Procuracao: [], Declaracao: [], Ficha: [], Documentacao: [], Provas: [], Acao: [], __designadoAtual: acao?.designado || 'Nenhum' };
    }
    const arquivos = await fs.readdir(acao.arquivo_path);
    const lista = arquivos.map(nome => ({ nome, path: path.join(acao.arquivo_path, nome) }));
    return {
        Contrato: lista.filter(a => a.nome.startsWith('CON - ')),
        Procuracao: lista.filter(a => a.nome.startsWith('PRO - ')),
        Declaracao: lista.filter(a => a.nome.startsWith('DEC - ')),
        Ficha: lista.filter(a => a.nome.startsWith('FIC - ')),
        Documentacao: lista.filter(a => a.nome.startsWith('DOC - ')),
        Provas: lista.filter(a => a.nome.startsWith('PROV - ')),
        Acao: lista.filter(a => a.nome.startsWith('ACAO - ')),
        __designadoAtual: acao.designado || 'Nenhum'
    };
};

// Salvar comentário
exports.salvarComentario = (acaoId, comentario) =>
    executeQuery('UPDATE acoes SET comentario = ? WHERE id = ?', [comentario, acaoId]);

exports.obterComentario = async (acaoId) => {
    const [r] = await executeQuery('SELECT comentario FROM acoes WHERE id = ?', [acaoId]);
    return r ? r.comentario || '' : '';
};

// Minhas ações
exports.listarMinhas = (userId) =>
    executeQuery(
        `SELECT a.id, a.protocolado, a.cliente, a.titulo, a.designado, a.criador, a.status,
            a.data_concluido, a.data_aprovado, a.comentario, a.arquivo_path, a.data_criacao
     FROM acoes a
     JOIN usuarios u ON TRIM(LOWER(a.designado)) = TRIM(LOWER(u.nome))
     WHERE u.id = ?
     ORDER BY a.data_criacao DESC`, [userId]);

// Atualizar status (restrito ao designado)
exports.atualizarStatusMine = async (acaoId, userId, status) => {
    const check = await executeQuery(
        `SELECT a.id FROM acoes a
     JOIN usuarios u ON TRIM(LOWER(a.designado)) = TRIM(LOWER(u.nome))
     WHERE a.id = ? AND u.id = ?`,
        [acaoId, userId]
    );
    if (!check.length) throw new Error('Ação não encontrada ou não pertence a você');
    await executeQuery('UPDATE acoes SET status = ? WHERE id = ?', [status, acaoId]);
};
