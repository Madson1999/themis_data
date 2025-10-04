const express = require('express');
const router = express.Router();
const documentosCtrl = require('../controllers/documentos.controller');

router.post('/gerar', documentosCtrl.gerar);

module.exports = router;
