const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pendaftaranController = require('../controllers/pendaftaranController');
const { isAuthenticated } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/uploads/surat');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'surat-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Hanya file PDF, DOC, DOCX, JPG, JPEG, atau PNG yang diizinkan'));
    }
});

// Routes - all require authentication
router.get('/', isAuthenticated, pendaftaranController.showPendaftaran);
router.post('/', isAuthenticated, upload.single('surat_pengantar'), pendaftaranController.submitPendaftaran);
router.post('/check-quota', isAuthenticated, pendaftaranController.checkQuota);
router.get('/status', isAuthenticated, pendaftaranController.getPendaftaranStatus);
router.get('/download-surat', isAuthenticated, pendaftaranController.downloadSurat);
router.get('/download-surat-selesai', isAuthenticated, pendaftaranController.downloadSuratSelesai);
router.get('/daftar-lagi', isAuthenticated, pendaftaranController.daftarLagi);

module.exports = router;
