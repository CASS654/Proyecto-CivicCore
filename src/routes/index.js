const express = require('express');
const apiRoutes = require('./api');

const router = express.Router();

// Montar rutas de API con prefijo /api
router.use('/api', apiRoutes);

module.exports = router;
