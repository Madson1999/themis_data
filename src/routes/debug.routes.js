const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const modelos = ['CONTRATO.docx', 'DECLARACAO.docx', 'FICHA.docx', 'PROCURACAO.docx'];

router.get('/docx', async (req, res) => {
    const base = path.join(__dirname, '..', '..', 'public', 'documentos', 'modelos');
    const out = [];
    for (const nome of modelos) {
        const p = path.join(base, nome);
        if (!await fs.pathExists(p)) {
            out.push({ nome, ok: false, erro: 'arquivo não encontrado' });
            continue;
        }
        try {
            const bin = await fs.readFile(p, 'binary');
            const zip = new PizZip(bin);
            // só compila, não renderiza
            new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: '[[', end: ']]' },
            });

            out.push({ nome, ok: true });
        } catch (e) {
            const errors = e?.properties?.errors?.map(er => ({
                file: er.properties?.file,
                context: er.properties?.context,
                message: er.message
            })) || [{ message: e.message }];
            out.push({ nome, ok: false, errors });
        }
    }
    res.json(out);
});

module.exports = router;
