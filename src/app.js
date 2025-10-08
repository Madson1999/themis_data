/**
 * app.js
 * ----------------------------------------
 * Configuração principal do Express (SaaS multi-tenant).
 *
 * - Middlewares globais: JSON/URL-encoded, cookies, static
 * - Páginas estáticas: (/ , /menu, /clientes, /documentos, /acoes, /protocolacao, /kanban, /usuarios)
 * - Rotas:
 *     • /administrador e /api/admin/*  → montadas via admin.routes (SUPERADMIN)
 *     • /api/*                         → montadas via routes/index.js (multi-tenant)
 * - Tratadores: 404 e error handler
 *
 * Notas importantes:
 * - Evitamos montar o agregador de rotas duas vezes (nada de app.use('/', routes)).
 * - Rotas de documentos já estão dentro de /api pelo agregador; não duplicamos /api/documentos.
 * - (Removido) Rota de debug de modelos DOCX que apontava para arquivo inexistente.
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const apiRoutes = require('./routes');                    // agregador /api/*
const adminRoutes = require('./routes/admin.routes');     // /administrador + /api/admin/*
// const debugDocxRoutes = require('./routes/debug.documentos.routes'); // REMOVIDO

const { notFound, errorHandler } = require('./middlewares/error');

const app = express();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/* ---------- Middlewares globais ---------- */
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

/* ---------- Static ---------- */
app.use(express.static(PUBLIC_DIR));
app.use(
    '/documentos',
    express.static(path.join(PUBLIC_DIR, 'documentos'), { maxAge: '1h' })
);

/* ---------- Páginas estáticas ---------- */
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));

app.get('/menu', (req, res) => {
    const { usuario_id, usuario_nome } = req.cookies || {};
    if (!usuario_id || !usuario_nome) return res.redirect('/login.html');
    if (!req.cookies?.usuario_id) res.cookie('usuario_id', usuario_id, { path: '/' });
    return res.sendFile(path.join(PUBLIC_DIR, 'menu.html'));
});

app.get('/clientes', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'clientes.html')));
app.get('/documentos', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'documentos.html')));
app.get('/acoes', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'acoes.html')));
app.get('/protocolacao', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'protocolacao.html')));
app.get('/kanban', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'kanban.html')));
app.get('/usuarios', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'usuarios.html')));

/* ---------- Login compat (fora de /api) ---------- */
const authController = require('./controllers/auth.controller');
app.post('/login', authController.login);

/* ---------- Rotas do SUPERADMIN (globais) ---------- */
app.use('/', adminRoutes); // /administrador e /api/admin/*

/* ---------- API multi-tenant (/api/*) ---------- */
app.use('/api', apiRoutes);

/* ---------- Debug de modelos DOCX ---------- */
// app.use('/debug', debugDocxRoutes); // REMOVIDO

/* ---------- 404 e erro ---------- */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
