const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();
const cookieParser = require('cookie-parser');

// Importar configuração do banco de dados
const { testConnection, executeQuery, initializeDatabase } = require('./config/database');
const { gerarContrato, previewContrato } = require('./config/contratos');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware

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