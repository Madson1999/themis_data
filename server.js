const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
require('dotenv').config();
const cookieParser = require('cookie-parser');

// Importar configuração do banco de dados
const { testConnection, executeQuery, initializeDatabase } = require('./config/database');
const { gerarContrato, previewContrato } = require('./config/contratos');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Configuração do multer para upload de arquivos
const upload = multer({ dest: 'temp/' });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());


// Rota para servir a página de login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rota para o menu
app.get('/menu', (req, res) => {
  // Verificar se o usuário está logado
  const usuarioId = req.cookies?.usuario_id;
  const usuarioNome = req.cookies?.usuario_nome;

  if (!usuarioId || !usuarioNome) {
    return res.redirect('/login.html');
  }

  // Definir cookie do usuario_id se não existir
  if (!req.cookies?.usuario_id) {
    res.cookie('usuario_id', usuarioId, { path: '/' });
  }

  res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

// Rota para a página de clientes
app.get('/clientes', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'clientes.html'));
});

// Rota para a página de contratos
app.get('/contratos', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contratos.html'));
});

// Rota para a página de Ações
app.get('/acoes', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'acoes.html'));
});

// Rota para a página de usuarios
app.get('/usuarios', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'usuarios.html'));
});

// API de clientes - Listar todos
app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await executeQuery('SELECT * FROM cliente ORDER BY nome');
    res.json(clientes);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }
});

// API de clientes - Cadastrar novo
app.post('/api/clientes', async (req, res) => {
  try {
    const { nome, data_nasc, cpf_cnpj, rg, telefone, email, endereco, bairro, cep, uf, cidade, profissao, nacionalidade, estado_civil } = req.body;



    // Verificar se CPF/CNPJ já existe
    const clienteExistente = await executeQuery('SELECT id FROM cliente WHERE cpf_cnpj = ?', [cpf_cnpj]);
    if (clienteExistente.length > 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'CPF/CNPJ já cadastrado' });
    }

    // Inserir novo cliente
    const result = await executeQuery(
      'INSERT INTO cliente (nome, data_nasc, cpf_cnpj, rg, telefone, email, endereco, bairro, cep, uf, cidade, profissao, nacionalidade, estado_civil) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nome || null, data_nasc || null, cpf_cnpj || null, rg || null, telefone || null, email, endereco || null, bairro || null, cep || null, uf || null, cidade || null, profissao || null, nacionalidade || null, estado_civil || null]
    );

    res.json({ sucesso: true, mensagem: 'Cliente cadastrado com sucesso!', id: result.insertId });
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Preencha os dados corretamente' });
  }
});

// API de clientes - Buscar por ID
app.get('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const clientes = await executeQuery('SELECT * FROM cliente WHERE id = ?', [id]);

    if (clientes.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }

    res.json(clientes[0]);
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ erro: 'Erro ao buscar cliente' });
  }
});

// API de clientes - Atualizar
app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, data_nasc, cpf_cnpj, rg, telefone, email, endereco, bairro, cep, uf, cidade, profissao, nacionalidade, estado_civil } = req.body;

    // Verificar se cliente existe
    const clienteExistente = await executeQuery('SELECT id FROM cliente WHERE id = ?', [id]);
    if (clienteExistente.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado' });
    }

    // Verificar se CPF/CNPJ já existe em outro cliente
    const cpfExistente = await executeQuery('SELECT id FROM cliente WHERE cpf_cnpj = ? AND id != ?', [cpf_cnpj, id]);
    if (cpfExistente.length > 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'CPF/CNPJ já cadastrado para outro cliente' });
    }

    // Atualizar cliente
    await executeQuery(
      'UPDATE cliente SET nome = ?, data_nasc = ?, cpf_cnpj = ?, rg = ?, telefone = ?, email = ?, endereco = ?, bairro = ?, cep = ?, uf = ?, cidade = ?, profissao = ?, nacionalidade = ?, estado_civil = ? WHERE id = ?',
      [nome, data_nasc || null, cpf_cnpj, rg || null, telefone || null, email || null, endereco || null, bairro || null, cep || null, uf || null, cidade || null, profissao || null, nacionalidade || null, estado_civil || null, id]
    );

    res.json({ sucesso: true, mensagem: 'Cliente atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
});

// API de clientes - Excluir
app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se cliente existe
    const clienteExistente = await executeQuery('SELECT id FROM cliente WHERE id = ?', [id]);
    if (clienteExistente.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado' });
    }

    // Excluir cliente
    await executeQuery('DELETE FROM cliente WHERE id = ?', [id]);

    res.json({ sucesso: true, mensagem: 'Cliente excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
});

// Endpoint de autenticação com banco de dados
app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const usuarios = await executeQuery(
      'SELECT id, nome, email, senha, nivel_acesso FROM usuarios WHERE email = ? AND ativo = TRUE',
      [email]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });
    }

    const usuario = usuarios[0];
    const bcrypt = require('bcryptjs');
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return res.status(401).json({ sucesso: false, mensagem: 'Senha incorreta.' });
    }

    // Cookies de sessão (sem expiração longa)
    res.cookie('usuario_nome', usuario.nome, { path: '/' });
    res.cookie('usuario_email', usuario.email, { path: '/' });
    res.cookie('usuario_nivel', usuario.nivel_acesso, { path: '/' });
    res.cookie('usuario_id', usuario.id, { path: '/' });

    return res.json({
      sucesso: true,
      mensagem: 'Login realizado com sucesso!',
      redirect: '/menu',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        nivel_acesso: usuario.nivel_acesso
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
});

app.get('/api/usuario-logado', async (req, res) => {
  const usuarioId = req.cookies?.usuario_id;
  if (!usuarioId) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  try {
    const usuarios = await executeQuery('SELECT id, nome, email, nivel_acesso FROM usuarios WHERE id = ?', [usuarioId]);
    if (usuarios.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    res.json(usuarios[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar usuário logado' });
  }
});

// Endpoint para obter estatísticas do menu
app.get('/api/stats', async (req, res) => {
  try {
    const [totalUsuarios] = await executeQuery('SELECT COUNT(*) as total FROM usuarios WHERE ativo = TRUE');
    const [usuariosHoje] = await executeQuery('SELECT COUNT(*) as total FROM usuarios WHERE DATE(data_criacao) = CURDATE()');
    const [acessosHoje] = await executeQuery('SELECT COUNT(*) as total FROM logs_acesso WHERE DATE(data_acesso) = CURDATE()');
    const [totalLogs] = await executeQuery('SELECT COUNT(*) as total FROM logs_acesso');

    res.json({
      usuarios: totalUsuarios.total,
      novosHoje: usuariosHoje.total,
      acessosHoje: acessosHoje.total,
      totalLogs: totalLogs.total
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
  }
});

// API de preview do contrato
app.post('/api/contratos/preview', async (req, res) => {
  try {
    const { cliente_id, acao } = req.body;

    if (!cliente_id) {
      return res.status(400).json({ sucesso: false, mensagem: 'ID do cliente é obrigatório' });
    }

    // Buscar dados do cliente
    const clientes = await executeQuery('SELECT * FROM cliente WHERE id = ?', [cliente_id]);
    if (clientes.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado' });
    }
    const cliente = clientes[0];

    // Gerar preview
    const resultado = await previewContrato({
      cliente,
      acao
    });

    res.json(resultado);

  } catch (error) {
    console.error('Erro ao gerar preview:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao gerar preview' });
  }
});

// API de geração de contrato (real)
app.post('/api/contratos/gerar', async (req, res) => {
  try {
    const { cliente_id, acao } = req.body;

    if (!cliente_id) {
      return res.status(400).json({ sucesso: false, mensagem: 'ID do cliente é obrigatório' });
    }

    // Buscar dados do cliente
    const clientes = await executeQuery('SELECT * FROM cliente WHERE id = ?', [cliente_id]);
    if (clientes.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado' });
    }
    const cliente = clientes[0];

    // Gerar número do contrato
    const data = new Date();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    const numero_contrato = `CON-${ano}${mes}${dia}-${hora}${minuto}`;

    // Gerar contrato
    const resultado = await gerarContrato({
      cliente,
      numero_contrato,
      acao
    });

    // Salvar no banco de dados
    await executeQuery(
      'INSERT INTO contratos (nome, cliente_id, contrato, acao, arquivo_path, data_geracao) VALUES (?, ?, ?, ?, ?, NOW())',
      [
        cliente.nome,
        cliente_id,
        numero_contrato,
        acao,
        resultado.caminho
      ]
    );

    res.json({
      sucesso: true,
      mensagem: 'Contrato gerado com sucesso!',
      arquivo: resultado.url,
      nomeArquivo: resultado.nomeArquivo
    });

  } catch (error) {
    console.error('Erro ao gerar contrato:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao gerar contrato' });
  }
});

// API para listar contratos
app.get('/api/contratos', async (req, res) => {
  try {
    const contratos = await executeQuery(`
      SELECT c.*, cl.nome as cliente_nome 
      FROM contratos c 
      JOIN cliente cl ON c.cliente_id = cl.id 
      ORDER BY c.data_geracao DESC
    `);
    res.json(contratos);
  } catch (error) {
    console.error('Erro ao buscar contratos:', error);
    res.status(500).json({ erro: 'Erro ao buscar contratos' });
  }
});

// API para download de contrato
app.get('/api/contratos/:id/download', async (req, res) => {
  try {
    const contratoId = req.params.id;

    // Buscar informações do contrato
    const contratos = await executeQuery('SELECT * FROM contratos WHERE id = ?', [contratoId]);
    if (contratos.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Contrato não encontrado' });
    }

    const contrato = contratos[0];
    const arquivoPath = contrato.arquivo_path;

    // Verificar se o arquivo existe
    if (!await fs.pathExists(arquivoPath)) {
      return res.status(404).json({ sucesso: false, mensagem: 'Arquivo do contrato não encontrado' });
    }

    // Configurar headers para download
    const nomeArquivo = path.basename(arquivoPath);
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    // Enviar o arquivo
    res.sendFile(arquivoPath);

  } catch (error) {
    console.error('Erro ao fazer download do contrato:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao fazer download do contrato' });
  }
});

// API de usuários - Cadastrar novo
app.post('/api/usuarios', async (req, res) => {
  try {
    const { nome, email, senha, nivel_acesso, ativo } = req.body;
    if (!nome || !email || !senha || !nivel_acesso) {
      return res.status(400).json({ sucesso: false, mensagem: 'Preencha todos os campos obrigatórios.' });
    }
    // Verificar se email já existe
    const usuarioExistente = await executeQuery('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (usuarioExistente.length > 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'Email já cadastrado.' });
    }
    // Criptografar senha
    const bcrypt = require('bcryptjs');
    const senhaHash = await bcrypt.hash(senha, 10);
    // Inserir novo usuário
    const result = await executeQuery(
      'INSERT INTO usuarios (nome, email, senha, nivel_acesso, data_criacao, ativo) VALUES (?, ?, ?, ?, NOW(), ?)',
      [nome, email, senhaHash, nivel_acesso, ativo || 1]
    );
    res.json({ sucesso: true, mensagem: 'Usuário cadastrado com sucesso!', id: result.insertId });
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao cadastrar usuário.' });
  }
});

// API de usuários - Atualizar
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const campos = req.body;
    if (!id || Object.keys(campos).length === 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'Nenhum dado para atualizar.' });
    }
    // Se for atualizar o email, verificar se já existe em outro usuário
    if (campos.email) {
      const emailExistente = await executeQuery('SELECT id FROM usuarios WHERE email = ? AND id != ?', [campos.email, id]);
      if (emailExistente.length > 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'Email já cadastrado para outro usuário.' });
      }
    }
    // Monta a query dinamicamente
    const setStr = Object.keys(campos).map(campo => `${campo} = ?`).join(', ');
    const valores = Object.values(campos);
    valores.push(id);
    const sql = `UPDATE usuarios SET ${setStr} WHERE id = ?`;
    await executeQuery(sql, valores);
    res.json({ sucesso: true, mensagem: 'Usuário atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar usuário.' });
  }
});

// API para listar usuários
app.get('/api/usuarios', async (req, res) => {
  try {
    const usuarios = await executeQuery(
      'SELECT id, nome, email, nivel_acesso, data_criacao, ultimo_acesso, ativo FROM usuarios'
    );
    res.json(usuarios);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ erro: 'Erro ao buscar usuários' });
  }
});

// API para listar designados (estagiário ou adv, ativos)
app.get('/api/designados', async (req, res) => {
  try {
    const designados = await executeQuery(
      "SELECT id, nome, nivel_acesso FROM usuarios WHERE (nivel_acesso = 'estagiario' OR nivel_acesso = 'adv') AND ativo = 1 ORDER BY nome"
    );
    res.json(designados);
  } catch (error) {
    console.error('Erro ao buscar designados:', error);
    res.status(500).json({ erro: 'Erro ao buscar designados' });
  }
});

// API para criar ações
app.post('/api/acoes', upload.fields([
  { name: 'contratoArquivo' },
  { name: 'documentacaoArquivo' },
  { name: 'provasArquivo' }
]), async (req, res) => {
  try {
    const { cliente_id, designado_id, titulo, status } = req.body;
    const arquivos = req.files || [];
    const criador_id = req.cookies?.usuario_id;

    if (!cliente_id || !titulo || !status) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }

    // Buscar dados do cliente
    const clientes = await executeQuery('SELECT nome, cpf_cnpj FROM cliente WHERE id = ?', [cliente_id]);
    if (clientes.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado' });
    }
    const cliente = clientes[0];

    // Buscar dados do designado (se não for "nenhum")
    let designadoNome = null;
    if (designado_id && designado_id !== 'Nenhum') {
      const designados = await executeQuery('SELECT nome FROM usuarios WHERE id = ?', [designado_id]);
      if (designados.length > 0) {
        designadoNome = designados[0].nome;
      }
    }

    // Buscar dados do criador
    const criadores = await executeQuery('SELECT nome FROM usuarios WHERE id = ?', [criador_id]);
    const criadorNome = criadores.length > 0 ? criadores[0].nome : 'Sistema';

    // Criar estrutura de pastas
    const letraInicial = cliente.nome.charAt(0).toUpperCase();
    const nomeClienteFormatado = `${cliente.nome} ${cliente.cpf_cnpj}`.replace(/[^a-zA-Z0-9\s]/g, '');
    const tituloFormatado = titulo.replace(/[^a-zA-Z0-9\s]/g, '');

    const pastaRaiz = path.join(__dirname, 'public', 'uploads', 'PROCESSOS');
    const pastaLetra = path.join(pastaRaiz, letraInicial);
    const pastaCliente = path.join(pastaLetra, nomeClienteFormatado);
    const pastaAcao = path.join(pastaCliente, tituloFormatado);

    // Criar pastas se não existirem
    await fs.ensureDir(pastaAcao);

    // Juntar todos os arquivos dos campos
    const arquivosUpload = [
      ...(req.files['contratoArquivo'] || []),
      ...(req.files['documentacaoArquivo'] || []),
      ...(req.files['provasArquivo'] || [])
    ];
    for (const arquivo of arquivosUpload) {
      let prefixo = '';
      if (arquivo.fieldname === 'contratoArquivo') {
        prefixo = 'CON - ';
      } else if (arquivo.fieldname === 'documentacaoArquivo') {
        prefixo = 'DOC - ';
      } else if (arquivo.fieldname === 'provasArquivo') {
        prefixo = 'PROV - ';
      }
      const nomeArquivoComPrefixo = prefixo + arquivo.originalname;
      const caminhoDestino = path.join(pastaAcao, nomeArquivoComPrefixo);
      await fs.move(arquivo.path, caminhoDestino);
    }

    // Salvar no banco de dados apenas o caminho da pasta
    const result = await executeQuery(
      'INSERT INTO acoes (cliente, titulo, designado, criador, status, arquivo_path, data_criacao) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [
        cliente.nome,
        titulo,
        designadoNome,
        criadorNome,
        status,
        pastaAcao
      ]
    );

    res.json({
      sucesso: true,
      mensagem: 'Ação criada com sucesso!',
      id: result.insertId,
      arquivos: arquivos
    });

  } catch (error) {
    console.error('Erro ao criar ação:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
});

// Upload de arquivo do tipo 'Ação' para uma ação existente
app.post('/api/acoes/upload-acao', upload.single('arquivo'), async (req, res) => {
  try {
    const { acao_id } = req.body;
    const arquivo = req.file;
    if (!acao_id || !arquivo) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }
    // Buscar ação
    const acoes = await executeQuery('SELECT * FROM acoes WHERE id = ?', [acao_id]);
    if (acoes.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ação não encontrada' });
    }
    const acao = acoes[0];
    // Buscar cliente para montar pasta
    const clienteNome = acao.cliente;
    // Buscar cliente para pegar CPF/CNPJ
    let clienteCpf = '';
    const clientes = await executeQuery('SELECT cpf_cnpj FROM cliente WHERE nome = ?', [clienteNome]);
    if (clientes.length > 0) clienteCpf = clientes[0].cpf_cnpj;
    const letraInicial = clienteNome.charAt(0).toUpperCase();
    const nomeClienteFormatado = `${clienteNome} ${clienteCpf}`.replace(/[^a-zA-Z0-9\s]/g, '');
    const tituloFormatado = acao.titulo.replace(/[^a-zA-Z0-9\s]/g, '');
    const pastaRaiz = path.join(__dirname, 'public', 'uploads', 'PROCESSOS');
    const pastaLetra = path.join(pastaRaiz, letraInicial);
    const pastaCliente = path.join(pastaLetra, nomeClienteFormatado);
    const pastaAcao = path.join(pastaCliente, tituloFormatado);
    await fs.ensureDir(pastaAcao);
    // Salvar arquivo com prefixo, garantindo nome único
    let nomeArquivoComPrefixo = 'ACAO - ' + arquivo.originalname;
    let caminhoDestino = path.join(pastaAcao, nomeArquivoComPrefixo);
    let contador = 1;
    const ext = path.extname(arquivo.originalname);
    const base = path.basename(arquivo.originalname, ext);
    while (await fs.pathExists(caminhoDestino)) {
      nomeArquivoComPrefixo = `ACAO - ${base} (${contador})${ext}`;
      caminhoDestino = path.join(pastaAcao, nomeArquivoComPrefixo);
      contador++;
    }
    await fs.move(arquivo.path, caminhoDestino);
    // Atualizar campo arquivo_path no banco (mantém só o caminho da pasta)
    await executeQuery('UPDATE acoes SET arquivo_path = ? WHERE id = ?', [pastaAcao, acao_id]);
    res.json({ sucesso: true, mensagem: 'Arquivo salvo com sucesso!' });
  } catch (error) {
    console.error('Erro ao salvar arquivo de ação:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar arquivo' });
  }
});

// Upload de arquivo do tipo 'Contrato' para uma ação existente
app.post('/api/acoes/upload-contrato', upload.single('arquivo'), async (req, res) => {
  try {
    const { acao_id } = req.body;
    const arquivo = req.file;
    if (!acao_id || !arquivo) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }
    const acoes = await executeQuery('SELECT * FROM acoes WHERE id = ?', [acao_id]);
    if (acoes.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ação não encontrada' });
    }
    const acao = acoes[0];
    const clienteNome = acao.cliente;
    let clienteCpf = '';
    const clientes = await executeQuery('SELECT cpf_cnpj FROM cliente WHERE nome = ?', [clienteNome]);
    if (clientes.length > 0) clienteCpf = clientes[0].cpf_cnpj;
    const letraInicial = clienteNome.charAt(0).toUpperCase();
    const nomeClienteFormatado = `${clienteNome} ${clienteCpf}`.replace(/[^a-zA-Z0-9\s]/g, '');
    const tituloFormatado = acao.titulo.replace(/[^a-zA-Z0-9\s]/g, '');
    const pastaRaiz = path.join(__dirname, 'public', 'uploads', 'PROCESSOS');
    const pastaLetra = path.join(pastaRaiz, letraInicial);
    const pastaCliente = path.join(pastaLetra, nomeClienteFormatado);
    const pastaAcao = path.join(pastaCliente, tituloFormatado);
    await fs.ensureDir(pastaAcao);
    // Salvar arquivo com prefixo, garantindo nome único
    let nomeArquivoComPrefixo = 'CON - ' + arquivo.originalname;
    let caminhoDestino = path.join(pastaAcao, nomeArquivoComPrefixo);
    let contador = 1;
    const ext = path.extname(arquivo.originalname);
    const base = path.basename(arquivo.originalname, ext);
    while (await fs.pathExists(caminhoDestino)) {
      nomeArquivoComPrefixo = `CON - ${base} (${contador})${ext}`;
      caminhoDestino = path.join(pastaAcao, nomeArquivoComPrefixo);
      contador++;
    }
    await fs.move(arquivo.path, caminhoDestino);
    await executeQuery('UPDATE acoes SET arquivo_path = ? WHERE id = ?', [pastaAcao, acao_id]);
    res.json({ sucesso: true, mensagem: 'Arquivo salvo com sucesso!' });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar arquivo' });
  }
});

// Upload de arquivo do tipo 'Documentação' para uma ação existente
app.post('/api/acoes/upload-documentacao', upload.single('arquivo'), async (req, res) => {
  try {
    const { acao_id } = req.body;
    const arquivo = req.file;
    if (!acao_id || !arquivo) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }
    const acoes = await executeQuery('SELECT * FROM acoes WHERE id = ?', [acao_id]);
    if (acoes.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ação não encontrada' });
    }
    const acao = acoes[0];
    const clienteNome = acao.cliente;
    let clienteCpf = '';
    const clientes = await executeQuery('SELECT cpf_cnpj FROM cliente WHERE nome = ?', [clienteNome]);
    if (clientes.length > 0) clienteCpf = clientes[0].cpf_cnpj;
    const letraInicial = clienteNome.charAt(0).toUpperCase();
    const nomeClienteFormatado = `${clienteNome} ${clienteCpf}`.replace(/[^a-zA-Z0-9\s]/g, '');
    const tituloFormatado = acao.titulo.replace(/[^a-zA-Z0-9\s]/g, '');
    const pastaRaiz = path.join(__dirname, 'public', 'uploads', 'PROCESSOS');
    const pastaLetra = path.join(pastaRaiz, letraInicial);
    const pastaCliente = path.join(pastaLetra, nomeClienteFormatado);
    const pastaAcao = path.join(pastaCliente, tituloFormatado);
    await fs.ensureDir(pastaAcao);
    // Salvar arquivo com prefixo, garantindo nome único
    let nomeArquivoComPrefixo = 'DOC - ' + arquivo.originalname;
    let caminhoDestino = path.join(pastaAcao, nomeArquivoComPrefixo);
    let contador = 1;
    const ext = path.extname(arquivo.originalname);
    const base = path.basename(arquivo.originalname, ext);
    while (await fs.pathExists(caminhoDestino)) {
      nomeArquivoComPrefixo = `DOC - ${base} (${contador})${ext}`;
      caminhoDestino = path.join(pastaAcao, nomeArquivoComPrefixo);
      contador++;
    }
    await fs.move(arquivo.path, caminhoDestino);
    await executeQuery('UPDATE acoes SET arquivo_path = ? WHERE id = ?', [pastaAcao, acao_id]);
    res.json({ sucesso: true, mensagem: 'Arquivo salvo com sucesso!' });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar arquivo' });
  }
});

// Upload de arquivo do tipo 'Provas' para uma ação existente
app.post('/api/acoes/upload-provas', upload.single('arquivo'), async (req, res) => {
  try {
    const { acao_id } = req.body;
    const arquivo = req.file;
    if (!acao_id || !arquivo) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }
    const acoes = await executeQuery('SELECT * FROM acoes WHERE id = ?', [acao_id]);
    if (acoes.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Ação não encontrada' });
    }
    const acao = acoes[0];
    const clienteNome = acao.cliente;
    let clienteCpf = '';
    const clientes = await executeQuery('SELECT cpf_cnpj FROM cliente WHERE nome = ?', [clienteNome]);
    if (clientes.length > 0) clienteCpf = clientes[0].cpf_cnpj;
    const letraInicial = clienteNome.charAt(0).toUpperCase();
    const nomeClienteFormatado = `${clienteNome} ${clienteCpf}`.replace(/[^a-zA-Z0-9\s]/g, '');
    const tituloFormatado = acao.titulo.replace(/[^a-zA-Z0-9\s]/g, '');
    const pastaRaiz = path.join(__dirname, 'public', 'uploads', 'PROCESSOS');
    const pastaLetra = path.join(pastaRaiz, letraInicial);
    const pastaCliente = path.join(pastaLetra, nomeClienteFormatado);
    const pastaAcao = path.join(pastaCliente, tituloFormatado);
    await fs.ensureDir(pastaAcao);
    // Salvar arquivo com prefixo, garantindo nome único
    let nomeArquivoComPrefixo = 'PROV - ' + arquivo.originalname;
    let caminhoDestino = path.join(pastaAcao, nomeArquivoComPrefixo);
    let contador = 1;
    const ext = path.extname(arquivo.originalname);
    const base = path.basename(arquivo.originalname, ext);
    while (await fs.pathExists(caminhoDestino)) {
      nomeArquivoComPrefixo = `PROV - ${base} (${contador})${ext}`;
      caminhoDestino = path.join(pastaAcao, nomeArquivoComPrefixo);
      contador++;
    }
    await fs.move(arquivo.path, caminhoDestino);
    await executeQuery('UPDATE acoes SET arquivo_path = ? WHERE id = ?', [pastaAcao, acao_id]);
    res.json({ sucesso: true, mensagem: 'Arquivo salvo com sucesso!' });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao salvar arquivo' });
  }
});

// Rota para remover arquivo de uma ação
app.post('/api/acoes/remover-arquivo', async (req, res) => {
  try {
    const { acaoId, nomeArquivo } = req.body;
    if (!acaoId || !nomeArquivo) return res.status(400).json({ erro: 'Dados obrigatórios não fornecidos' });
    const acoes = await executeQuery('SELECT arquivo_path FROM acoes WHERE id = ?', [acaoId]);
    if (acoes.length === 0) return res.status(404).json({ erro: 'Ação não encontrada' });
    const pasta = acoes[0].arquivo_path;
    const caminho = path.join(pasta, nomeArquivo);
    if (await fs.pathExists(caminho)) {
      await fs.remove(caminho);
      return res.json({ sucesso: true });
    } else {
      return res.status(404).json({ erro: 'Arquivo não encontrado' });
    }
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao remover arquivo' });
  }
});

// API para listar ações (para o kanban, com filtro opcional por status)
app.get('/api/acoes', async (req, res) => {
  try {
    const status = req.query.status;
    let sql = `SELECT id, cliente, titulo, designado, criador, status, data_criacao, arquivo_path, data_aprovado FROM acoes`;
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY data_criacao DESC';
    const acoes = await executeQuery(sql, params);
    // Organizar ações por designado
    const acoesPorDesignado = {};
    acoes.forEach(acao => {
      const designado = acao.designado || 'Nenhum';
      if (!acoesPorDesignado[designado]) {
        acoesPorDesignado[designado] = [];
      }
      acoesPorDesignado[designado].push(acao);
    });
    res.json(acoesPorDesignado);
  } catch (error) {
    console.error('Erro ao buscar ações:', error);
    res.status(500).json({ erro: 'Erro ao buscar ações' });
  }
});

// Aprovar ação (salva data_aprovado)
app.post('/api/acoes/aprovar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await executeQuery('UPDATE acoes SET data_aprovado = NOW() WHERE id = ?', [id]);
    res.json({ sucesso: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao aprovar ação' });
  }
});

// Rota para buscar status da ação
app.get('/api/acoes/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const acoes = await executeQuery('SELECT status FROM acoes WHERE id = ?', [id]);
    if (acoes.length === 0) return res.status(404).json({ erro: 'Ação não encontrada' });
    res.json({ status: acoes[0].status });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar status' });
  }
});

// Rota para atualizar status e designado da ação
app.put('/api/acoes/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, designado } = req.body;
    if (status === 'finalizado') {
      await executeQuery('UPDATE acoes SET status = ?, designado = ?, data_concluido = NOW() WHERE id = ?', [status, designado, id]);
    } else if (status === 'em andamento') {
      await executeQuery('UPDATE acoes SET status = ?, designado = ?, data_concluido = NULL WHERE id = ?', [status, designado, id]);
    } else {
      await executeQuery('UPDATE acoes SET status = ?, designado = ? WHERE id = ?', [status, designado, id]);
    }
    res.json({ sucesso: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar status/designado' });
  }
});

// Rota para listar arquivos da ação por tipo
app.get('/api/acoes/arquivos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const acoes = await executeQuery('SELECT arquivo_path, designado FROM acoes WHERE id = ?', [id]);
    if (acoes.length === 0) return res.status(404).json({ erro: 'Ação não encontrada' });
    const pasta = acoes[0].arquivo_path;
    const designadoAtual = acoes[0].designado || 'Nenhum';
    if (!pasta || !(await fs.pathExists(pasta))) return res.json({ Contrato: [], Documentacao: [], Provas: [], Acao: [], __designadoAtual: designadoAtual });
    const arquivos = await fs.readdir(pasta);
    const lista = arquivos.map(nome => ({ nome, path: path.join(pasta, nome) }));
    // Separar por prefixo
    const tipos = {
      Contrato: lista.filter(a => a.nome.startsWith('CON - ')),
      Documentacao: lista.filter(a => a.nome.startsWith('DOC - ')),
      Provas: lista.filter(a => a.nome.startsWith('PROV - ')),
      Acao: lista.filter(a => a.nome.startsWith('ACAO - ')),
      __designadoAtual: designadoAtual
    };
    res.json(tipos);
  } catch (error) {
    console.error('Erro ao listar arquivos da ação:', error);
    res.status(500).json({ erro: 'Erro ao listar arquivos' });
  }
});

// Rota para salvar comentário de devolução da ação (agora atualiza a coluna comentario na tabela acoes)
app.post('/api/acoes/comentario/:acaoId', async (req, res) => {
  const { acaoId } = req.params;
  const { comentario } = req.body;
  if (!comentario || !acaoId) {
    return res.status(400).json({ mensagem: 'Comentário ou ação inválidos.' });
  }
  try {
    await executeQuery('UPDATE acoes SET comentario = ? WHERE id = ?', [comentario, acaoId]);
    res.json({ mensagem: 'Comentário salvo com sucesso!' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensagem: 'Erro ao salvar comentário.' });
  }
});

// Rota para buscar o comentário da ação
app.get('/api/acoes/comentario/:acaoId', async (req, res) => {
  const { acaoId } = req.params;
  try {
    const result = await executeQuery('SELECT comentario FROM acoes WHERE id = ?', [acaoId]);
    if (result.length === 0) return res.json({ comentario: '' });
    res.json({ comentario: result[0].comentario || '' });
  } catch (e) {
    res.status(500).json({ comentario: '' });
  }
});

// Inicializar banco de dados e iniciar servidor
async function startServer() {
  try {
    // Testar conexão com banco de dados
    const conexaoOk = await testConnection();
    if (!conexaoOk) {
      console.log('⚠️  Servidor iniciando sem banco de dados...');
    } else {
      // Inicializar tabelas
      await initializeDatabase();
    }

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);

    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer(); 