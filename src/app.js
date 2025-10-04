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
const bodyParser = require('body-parser'); // ok manter se já usa
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error');

const app = express();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Parsers
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Cookies
app.use(cookieParser());

// Static geral (serve /public/*)
app.use(express.static(PUBLIC_DIR));

// Static dedicado para documentos gerados (garante URL /documentos/gerados/AAAA/MM/arquivo.docx)
app.use(
    '/docuemntos',
    express.static(path.join(PUBLIC_DIR, 'documentos'), {
        maxAge: '1h',
        immutable: false,
    })
);

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
app.get('/documentos', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'documentos.html')));
app.get('/acoes', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'acoes.html')));
app.get('/protocolacao', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'protocolacao.html')));
app.get('/kanban', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'kanban.html')));
app.get('/usuarios', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'usuarios.html')));

// Compatibilidade: manter /login fora de /api (frontend existente)
const authController = require('./controllers/auth.controller');
app.post('/login', authController.login);

// API existente
app.use('/api', routes);

// API de documentos (nova)
const documentosRoutes = require('./routes/documentos.routes');
app.use('/api/documentos', documentosRoutes);

// TESTE
const debugRoutes = require('./routes/debug.routes');
app.use('/debug', debugRoutes);


// 404 e tratador de erros
app.use(notFound);
app.use(errorHandler);

module.exports = app;
