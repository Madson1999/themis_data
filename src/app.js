/**
 * app.js
 * ----------------------------------------
 * Configuração principal do Express.
 * - Middlewares globais: JSON, URL-encoded, cookies, logger, static
 * - Rotas de páginas estáticas (/, /menu, /clientes, etc.)
 * - Monta API em /api (src/routes/index.js) + /api/documentos
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

// --- Middlewares globais ---
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Static ---
app.use(express.static(PUBLIC_DIR));
app.use('/documentos', express.static(path.join(PUBLIC_DIR, 'documentos'), { maxAge: '1h' }));

// --- Páginas estáticas ---
app.get('/', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
app.get('/menu', (req, res) => {
    const { usuario_id, usuario_nome } = req.cookies || {};
    if (!usuario_id || !usuario_nome) return res.redirect('/login.html');
    if (!req.cookies?.usuario_id) res.cookie('usuario_id', usuario_id, { path: '/' });
    res.sendFile(path.join(PUBLIC_DIR, 'menu.html'));
});
app.get('/clientes', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'clientes.html')));
app.get('/documentos', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'documentos.html')));
app.get('/acoes', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'acoes.html')));
app.get('/protocolacao', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'protocolacao.html')));
app.get('/kanban', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'kanban.html')));
app.get('/usuarios', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'usuarios.html')));

// Mantém /login fora de /api
const authController = require('./controllers/auth.controller');
app.post('/login', authController.login);

// --- Rotas API e admin (/administrador) ---
app.use('/', routes);            // inclui admin.routes via src/routes/index.js
app.use('/api', routes);         // se seu index também expõe endpoints de API
app.use('/api/documentos', require('./routes/documentos.routes'));
app.use('/debug', require('./routes/debug.routes'));

// 404 e erro
app.use(notFound);
app.use(errorHandler);

module.exports = app;
