const express = require('express');

const router = express.Router();

// Cada archivo atiende el prefijo de URL que lleva su nombre
router.use('/api', require('./auth'), require('./incidents'), require('./admin'), require('./system'));

module.exports = router;
