// src/controllers/processos.upload.controller.js

const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const { getTenantId } = require('../utils/tenant');
const { uploadBufferEmpresaCategoria, presignedGetUrl } = require('../services/storage.service');
const { safeName } = require('../utils/s3-keys');

exports.anexar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ ok: false, mensagem: 'Tenant não identificado.' });

    const processoId = String(req.params?.id || '').trim();
    if (!processoId) return res.status(400).json({ ok: false, mensagem: 'processoId é obrigatório.' });

    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, mensagem: 'Arquivo não enviado.' });

    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = safeName(path.basename(file.originalname, ext)) || `proc-${processoId}-${Date.now()}`;
    const filename = `${base}${ext || ''}`;

    // subpath opcional para organizar por processo
    const { key } = await uploadBufferEmpresaCategoria({
        tenantId,
        categoria: 'processos',
        buffer: file.buffer,
        filename,
        contentType: file.mimetype,
        subpath: processoId, // cria .../Processos/<processoId>/<filename>
    });

    const url = await presignedGetUrl({ key, expiresIn: 3600 });
    return res.status(201).json({ ok: true, key, bucket: process.env.S3_BUCKET, url });
});
