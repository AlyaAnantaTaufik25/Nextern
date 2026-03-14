// Profile Controller - Handles user profile
const bcrypt = require('bcryptjs');
const db = require('../confiq/database');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
require('moment/locale/id');
moment.locale('id');

// Show profile page
exports.showProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const role = req.session.user.role;

        // Get user data
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];

        // Get pendaftaran history with documents and stats
        const [riwayat] = await db.query(
            `SELECT p.*, 
                (SELECT COUNT(*) FROM logbook l WHERE l.user_id = p.user_id AND l.tanggal BETWEEN p.waktu_mulai AND p.waktu_selesai) as logbook_count,
                (SELECT COUNT(*) FROM absensi a WHERE a.user_id = p.user_id AND a.tanggal BETWEEN p.waktu_mulai AND p.waktu_selesai) as absen_count,
                (SELECT file_path FROM surat s WHERE s.pendaftaran_id = p.id AND s.tipe_surat = 'balasan' LIMIT 1) as surat_balasan,
                (SELECT file_path FROM surat s WHERE s.pendaftaran_id = p.id AND s.tipe_surat = 'selesai' LIMIT 1) as surat_selesai
             FROM pendaftaran p 
             WHERE p.user_id = ? 
             ORDER BY p.created_at DESC`,
            [userId]
        );

        const currentPendaftaran = riwayat.length > 0 ? riwayat[0] : null;

        const view = role === 'admin' ? 'admin/profil' : 'profil';
        const currentPage = role === 'admin' ? '' : 'profil';

        res.render(view, {
            title: 'Profil - Infranexia',
            user: user,
            pendaftaran: currentPendaftaran,
            riwayat: riwayat,
            currentPage: currentPage,
            success: req.query.success || null,
            error: req.query.error || null,
            moment: moment // Pass moment for date formatting in view if needed
        });

    } catch (error) {
        console.error('Show profile error:', error);
        res.status(500).send('Terjadi kesalahan');
    }
};

// Update profile
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { nama_depan, nama_belakang, email, no_telepon, institusi } = req.body;

        // Check if email already exists (for other users)
        const [existingUser] = await db.query(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, userId]
        );

        if (existingUser.length > 0) {
            return res.redirect('/profil?error=' + encodeURIComponent('Email sudah digunakan oleh pengguna lain'));
        }

        // Update user data
        await db.query(
            `UPDATE users SET 
                nama_depan = ?, 
                nama_belakang = ?, 
                email = ?, 
                no_telepon = ?, 
                institusi = ?
            WHERE id = ?`,
            [nama_depan, nama_belakang || '', email, no_telepon || '', institusi || '', userId]
        );

        // Update session
        req.session.user.nama_depan = nama_depan;
        req.session.user.nama_belakang = nama_belakang;
        req.session.user.email = email;

        res.redirect('/profil?success=' + encodeURIComponent('Profil berhasil diperbarui'));

    } catch (error) {
        console.error('Update profile error:', error);
        res.redirect('/profil?error=' + encodeURIComponent('Terjadi kesalahan saat memperbarui profil'));
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { old_password, new_password, confirm_password } = req.body;

        // Validate new password
        if (new_password !== confirm_password) {
            return res.redirect('/profil?error=' + encodeURIComponent('Password baru tidak cocok'));
        }

        if (new_password.length < 8) {
            return res.redirect('/profil?error=' + encodeURIComponent('Password minimal 8 karakter'));
        }

        // Get current password
        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
        const user = users[0];

        // Verify old password
        const isValidPassword = await bcrypt.compare(old_password, user.password);
        if (!isValidPassword) {
            return res.redirect('/profil?error=' + encodeURIComponent('Password lama salah'));
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(new_password, 10);

        // Update password
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        res.redirect('/profil?success=' + encodeURIComponent('Password berhasil diubah'));

    } catch (error) {
        console.error('Change password error:', error);
        res.redirect('/profil?error=' + encodeURIComponent('Terjadi kesalahan saat mengubah password'));
    }
};

// Upload profile photo
exports.uploadPhoto = async (req, res) => {
    try {
        const userId = req.session.user.id;

        if (!req.file) {
            return res.redirect('/profil?error=' + encodeURIComponent('Tidak ada file yang diupload'));
        }

        // Get old photo to delete it
        const [users] = await db.query('SELECT foto_profil FROM users WHERE id = ?', [userId]);
        const oldPhoto = users[0].foto_profil;

        if (oldPhoto && oldPhoto.startsWith('/uploads/profil/')) {
            const oldPath = path.join(__dirname, '../../public', oldPhoto);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        const fotoPath = '/uploads/profil/' + req.file.filename;

        // Update user foto_profil in database
        await db.query('UPDATE users SET foto_profil = ? WHERE id = ?', [fotoPath, userId]);

        // Update session
        req.session.user.foto_profil = fotoPath;

        res.redirect('/profil?success=' + encodeURIComponent('Foto profil berhasil diubah'));

    } catch (error) {
        console.error('Upload photo error:', error);
        res.redirect('/profil?error=' + encodeURIComponent('Terjadi kesalahan saat mengupload foto'));
    }
};

// Delete profile photo
exports.deletePhoto = async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Get current photo
        const [users] = await db.query('SELECT foto_profil FROM users WHERE id = ?', [userId]);
        const photo = users[0].foto_profil;

        if (photo && photo.startsWith('/uploads/profil/')) {
            const photoPath = path.join(__dirname, '../../public', photo);
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
        }

        // Update database to null
        await db.query('UPDATE users SET foto_profil = NULL WHERE id = ?', [userId]);

        // Update session
        req.session.user.foto_profil = null;

        res.redirect('/profil?success=' + encodeURIComponent('Foto profil berhasil dihapus'));

    } catch (error) {
        console.error('Delete photo error:', error);
        res.redirect('/profil?error=' + encodeURIComponent('Terjadi kesalahan saat menghapus foto'));
    }
};
