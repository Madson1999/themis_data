/**
 * uploads.js
 * ----------------------------------------
 * Centraliza configuração do multer para uploads de arquivos.
 * - Define pasta temporária de uploads (temp/)
 * - Exporta instância do multer para ser usada nas rotas
 * Uso: router.post('/rota', upload.single('arquivo'), controller.fn)
 */

const multer = require('multer');
const upload = multer({ dest: 'temp/' });
module.exports = { upload };
