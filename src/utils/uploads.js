/**
 * utils/uploads.js
 * ----------------------------------------
 * Centraliza configuração do Multer para uploads de arquivos (padrão SaaS).
 *
 * - Usa pasta temporária local (./temp) e garante sua existência
 * - Limita tamanho e quantidade de arquivos por requisição
 * - Filtra tipos de arquivo comuns (DOCX, PDF, imagens)
 *
 * Uso:
 *   const { upload } = require('../utils/uploads');
 *   router.post('/rota', upload.single('arquivo'), controller.fn);
 *   router.post('/rota', upload.fields([{ name: 'contratoArquivo' }, ...]), controller.fn);
 */

const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');

// Garante pasta temporária
const TEMP_DIR = path.join(process.cwd(), 'temp');
fs.ensureDirSync(TEMP_DIR);

// Storage em disco (mantém extensão e evita colisões)
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMP_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const base = path.basename(file.originalname || 'upload', ext).replace(/[\/\\?%*:|"<>]/g, '-').trim() || 'arquivo';
        const unique = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        cb(null, `${base}-${unique}${ext}`);
    },
});

// Tipos permitidos
const ALLOWED_MIMES = new Set([
    // documentos
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    // imagens
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
]);

function fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.has(file.mimetype)) return cb(null, true);
    // Permite fallback por extensão quando o mimetype vier genérico (ex.: on Windows)
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return cb(null, true);
    const err = new Error('Tipo de arquivo não permitido');
    err.status = 400;
    cb(err);
}

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB por arquivo
        files: 20,                  // limite por requisição
    },
});

module.exports = { upload };
