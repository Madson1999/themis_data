/**
 * app.js
 * ----------------------------------------
 * Configuração principal do Express.
 * - Middlewares globais: JSON, URL-encoded, cookies, logger, static
 * - Rotas de páginas estáticas (/, /menu, /clientes, etc.)
 * - Monta API em /api (src/routes/index.js)
 * - Tratadores: 404 e error handler
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error');

const app = express();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR));

// Páginas estáticas (iguais às do server.js original)
app.get('/', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));

app.get('/menu', (req, res) => {
    const usuarioId = req.cookies?.usuario_id;
    const usuarioNome = req.cookies?.usuario_nome;

    if (!usuarioId || !usuarioNome) return res.redirect('/login.html');
    if (!req.cookies?.usuario_id) res.cookie('usuario_id', usuarioId, { path: '/' });

    res.sendFile(path.join(PUBLIC_DIR, 'menu.html'));
});

app.get('/clientes', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'clientes.html')));
app.get('/contratos', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'contratos.html')));
app.get('/acoes', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'acoes.html')));
app.get('/protocolacao', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'protocolacao.html')));
app.get('/kanban', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'kanban.html')));
app.get('/usuarios', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'usuarios.html')));

// Compatibilidade: manter /login fora de /api (frontend existente)
const authController = require('./controllers/auth.controller');
app.post('/login', authController.login);

// API
app.use('/api', routes);

// 404 e tratador de erros
app.use(notFound);
app.use(errorHandler);

module.exports = app;
