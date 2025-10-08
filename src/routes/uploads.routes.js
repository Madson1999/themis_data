//src/routes/uploads.routes.js

const express = require('express');
const multer = require('multer');
const proc = require('../controllers/processos.upload.controller');
const usr = require('../controllers/usuarios.upload.controller');
const docs = require('../controllers/documentos.modelos.controller');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Processos: POST /api/processos/:id/anexos
router.post('/processos/:id/anexos', upload.single('arquivo'), proc.anexar);

// Usuarios: POST /api/usuarios/:id/foto
router.post('/usuarios/:id/foto', upload.single('arquivo'), usr.foto);

// Documentos (modelos): POST /api/documentos/modelos
router.post('/documentos/modelos', upload.single('arquivo'), docs.uploadModelo);

module.exports = router;
