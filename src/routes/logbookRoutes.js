const express = require('express');
const router = express.Router();
const logbookController = require('../controllers/logbookController');
const { isAuthenticated } = require('../middleware/auth');
const { isPemagang } = require('../middleware/pemagangMiddleware');

router.use(isAuthenticated);
router.use(isPemagang);

// List logbook
router.get('/', logbookController.showLogbook);

// Add logbook
router.get('/add', logbookController.showAddForm);
router.post('/add', logbookController.addEntry);

// Edit logbook
router.get('/edit/:id', logbookController.showEditForm);
router.post('/edit/:id', logbookController.updateEntry);

// Delete logbook
router.post('/delete/:id', logbookController.deleteEntry);

// Export logbook
router.get('/export/pdf', logbookController.exportPDF);
router.get('/export/word', logbookController.exportWord);

module.exports = router;
