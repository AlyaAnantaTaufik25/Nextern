const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const profilController = require('../controllers/profilController');
const { isAuthenticated } = require('../middleware/auth');

// Multer configuration for profile photo upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../public/uploads/profil'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profil-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Hanya file gambar yang diperbolehkan!'));
    }
});

// All routes require authentication
router.use(isAuthenticated);

// Show profile page
router.get('/', profilController.showProfile);

// Update profile
router.post('/update', profilController.updateProfile);

// Change password
router.post('/change-password', profilController.changePassword);

// Upload profile photo
router.post('/upload-photo', upload.single('foto_profil'), profilController.uploadPhoto);

// Delete profile photo
router.post('/delete-photo', profilController.deletePhoto);

module.exports = router;
