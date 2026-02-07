// Admin Routes
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/adminMiddleware');

// Apply admin middleware to all routes
router.use(isAdmin);

// Dashboard
router.get('/', adminController.dashboard);

// Pendaftaran management
router.get('/pendaftaran', adminController.pendaftaran);
router.get('/pendaftaran/:id', adminController.pendaftaranDetail);
router.put('/pendaftaran/:id/status', adminController.updateStatus);

// User management
router.get('/users', adminController.users);
router.get('/users/:id', adminController.userDetail);
router.delete('/users/:id', adminController.deleteUser);

// Monitoring
router.get('/users/:id/absensi', adminController.userAbsensi);
router.put('/absensi/:id/status', adminController.updateAbsensiStatus);
router.get('/users/:id/logbook', adminController.userLogbook);
router.delete('/logbook/:id', adminController.deleteLogbook);

// Surat management
router.get('/surat', adminController.surat);

module.exports = router;
