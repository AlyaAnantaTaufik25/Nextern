const express = require('express');
const router = express.Router();
const webController = require('../controllers/webController');

// Landing page
router.get('/', webController.index);

// FAQ page
router.get('/faq', webController.faq);

// Program page
router.get('/program', webController.program);

module.exports = router;
