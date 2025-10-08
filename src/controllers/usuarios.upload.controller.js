//src/controllers/usuarios.upload.controller.js

const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const { getTenantId } = require('../utils/tenant');
const { uploadBufferEmpresaCategoria, presignedGetUrl } = require('../services/storage.service');

exports.foto = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ ok: false, mensagem: 'Tenant não identificado.' });

    const usuarioId = String(req.params?.id || '').trim();
    if (!usuarioId) return res.status(400).json({ ok: false, mensagem: 'usuarioId é obrigatório.' });

    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, mensagem: 'Arquivo não enviado.' });

    const ext = (path.extname(file.originalname || '').toLowerCase()) || '.jpg';
    const filename = `user-${usuarioId}${ext}`;

    const { key } = await uploadBufferEmpresaCategoria({
        tenantId,
        categoria: 'usuarios',
        buffer: file.buffer,
        filename,
        contentType: file.mimetype,
        subpath: '', // direto em .../Usuarios/
    });

    const url = await presignedGetUrl({ key, expiresIn: 3600 });
    return res.status(201).json({ ok: true, key, bucket: process.env.S3_BUCKET, url });
});
