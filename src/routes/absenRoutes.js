// Absen Routes
const express = require('express');
const router = express.Router();
const absenController = require('../controllers/absenController');
const { isAuthenticated } = require('../middleware/auth');
const { isPemagang } = require('../middleware/pemagangMiddleware');

// All routes require authentication and approved pendaftaran
router.use(isAuthenticated);
router.use(isPemagang);

// Show attendance page
router.get('/', absenController.showAbsen);

// Show check-in form
router.get('/check-in', absenController.showCheckInForm);

// Show check-out form
router.get('/check-out', absenController.showCheckOutForm);

// Clock in
router.post('/clock-in', absenController.clockIn);

// Clock out
router.post('/clock-out', absenController.clockOut);

module.exports = router;
