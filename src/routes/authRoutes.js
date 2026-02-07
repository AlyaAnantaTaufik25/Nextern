const express = require('express');
const passport = require('passport');
const router = express.Router();
const authController = require('../controllers/authController');

// Combined auth page (login/register)
router.get('/login', authController.authPage);
router.get('/register', authController.authPageRegister);

// Process login
router.post('/login', authController.login);

// Process register
router.post('/register', authController.register);

// Logout
router.get('/logout', authController.logout);

// --- Social Login Routes ---

// Google Auth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/login?error=auth_failed' }),
    authController.socialCallback
);

// Facebook Auth
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/auth/login?error=auth_failed' }),
    authController.socialCallback
);

// Apple Auth
router.get('/apple', passport.authenticate('apple'));
router.post('/apple/callback',
    passport.authenticate('apple', { failureRedirect: '/auth/login?error=auth_failed' }),
    authController.socialCallback
);

module.exports = router;
