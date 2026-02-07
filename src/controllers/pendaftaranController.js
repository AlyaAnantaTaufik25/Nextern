// Pendaftaran Controller - Handles internship registration
const db = require('../confiq/database');
const path = require('path');
const fs = require('fs');
const { countWorkingDays } = require('../utils/dateHelper');

// Show pendaftaran page
exports.showPendaftaran = async (req, res) => {
    try {
        const userId = req.session.user.id;

        // 1. Calculate general quota (accepted interns whose time hasn't finished yet)
        const [activeInterns] = await db.query(
            "SELECT COUNT(*) as count FROM pendaftaran WHERE status = 'diterima' AND waktu_selesai >= CURDATE()"
        );
        const activeCount = activeInterns[0].count;
        const maxQuota = 2; // Maximum 2 people at the same time
        const isQuotaFull = activeCount >= 100; // Legacy logic, we now handle it per date in submit

        // Check if user already has a pendaftaran
        const [pendaftaran] = await db.query(
            'SELECT * FROM pendaftaran WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        // Get user data
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];

        let status = 'new'; // new, formulir, verifikasi, diterima, ditolak
        let pendaftaranData = null;

        if (pendaftaran.length > 0) {
            pendaftaranData = pendaftaran[0];
            status = pendaftaranData.status;
        }

        res.render('pendaftaran', {
            title: 'Pendaftaran - Infranexia',
            currentPage: 'pendaftaran',
            user: user,
            status: status,
            pendaftaran: pendaftaranData,
            quota: {
                current: activeCount,
                max: maxQuota,
                isFull: false // Allowing form to show, validation happens on dates
            }
        });

    } catch (error) {
        console.error('Show pendaftaran error:', error);
        res.status(500).send('Terjadi kesalahan');
    }
};

// Submit pendaftaran form
exports.submitPendaftaran = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { nama_lengkap, nim, instansi, bidang, jurusan, waktu_mulai, waktu_selesai } = req.body;

        const maxQuota = 2;

        // 1. Check Date Overlap Quota (Includes 'verifikasi' and 'diterima')
        const [overlaps] = await db.query(
            `SELECT COUNT(*) as count 
             FROM pendaftaran 
             WHERE status IN ('verifikasi', 'diterima') 
             AND user_id != ? 
             AND (
                (waktu_mulai <= ? AND waktu_selesai >= ?) OR 
                (waktu_mulai <= ? AND waktu_selesai >= ?) OR 
                (? <= waktu_mulai AND ? >= waktu_selesai)
             )`,
            [userId, waktu_mulai, waktu_mulai, waktu_selesai, waktu_selesai, waktu_mulai, waktu_selesai]
        );

        const overlapCount = overlaps[0].count;

        // If 2 or more people already occupy this period
        if (overlapCount >= maxQuota) {
            return res.status(403).send(`
                <html>
                <head>
                    <title>Periode Penuh - Infranexia</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f8fafc; }
                        .error-box { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; max-width: 500px; border: 1px solid #fee2e2; }
                        .icon { font-size: 60px; margin-bottom: 20px; }
                        h1 { color: #E31937; margin: 0 0 15px; font-size: 24px; }
                        p { color: #64748b; line-height: 1.6; margin-bottom: 30px; }
                        .dates { background: #fff1f2; padding: 15px; border-radius: 12px; color: #991b1b; font-weight: 600; margin-bottom: 30px; }
                        a { background: #E31937; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; transition: 0.3s; }
                        a:hover { background: #be123c; transform: translateY(-2px); }
                    </style>
                </head>
                <body>
                    <div class="error-box">
                        <div class="icon">📅</div>
                        <h1>⚠️ Periode Penuh</h1>
                        <p>Silakan pilih tanggal lain yang masih tersedia.</p>
                        <div class="dates">
                            ${waktu_mulai} s/d ${waktu_selesai}
                        </div>
                        <a href="/pendaftaran">Kembali dan Ubah Tanggal</a>
                    </div>
                </body>
                </html>
            `);
        }

        // Validate duration - minimum 1 month (30 working days)
        const workingDays = countWorkingDays(waktu_mulai, waktu_selesai);

        if (workingDays < 30) {
            return res.status(400).send(`
                <html>
                <head>
                    <title>Error - Durasi Tidak Valid</title>
                    <style>
                        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
                        .error-box { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
                        h1 { color: #E31937; margin-bottom: 20px; }
                        p { color: #666; margin-bottom: 30px; }
                        .stats { background: #fff1f2; padding: 15px; border-radius: 12px; color: #991b1b; font-weight: 600; margin-bottom: 30px; }
                        a { background: #E31937; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
                        a:hover { background: #c41230; }
                    </style>
                </head>
                <body>
                    <div class="error-box">
                        <h1>⚠️ Durasi Tidak Valid</h1>
                        <p>Durasi magang minimal <strong>1 bulan (30 hari kerja)</strong>.<br>Sabtu & Minggu tidak dihitung.</p>
                        <div class="stats">
                            Durasi yang Anda pilih: ${workingDays} hari kerja
                        </div>
                        <a href="/pendaftaran">Kembali ke Formulir</a>
                    </div>
                </body>
                </html>
            `);
        }

        // Get uploaded file path if any
        let suratPengantar = null;
        if (req.file) {
            suratPengantar = '/uploads/surat/' + req.file.filename;
        }

        // Check if user already has a pendaftaran
        const [existingPendaftaran] = await db.query(
            'SELECT id FROM pendaftaran WHERE user_id = ?',
            [userId]
        );

        if (existingPendaftaran.length > 0) {
            // Update existing
            await db.query(
                `UPDATE pendaftaran SET 
                    nama_lengkap = ?,
                    nim = ?,
                    instansi = ?,
                    bidang = ?,
                    jurusan = ?,
                    waktu_mulai = ?,
                    waktu_selesai = ?,
                    surat_pengantar = COALESCE(?, surat_pengantar),
                    status = 'verifikasi'
                WHERE user_id = ? `,
                [nama_lengkap, nim, instansi, bidang, jurusan, waktu_mulai, waktu_selesai, suratPengantar, userId]
            );
        } else {
            // Insert new
            await db.query(
                `INSERT INTO pendaftaran(user_id, nama_lengkap, nim, instansi, bidang, jurusan, waktu_mulai, waktu_selesai, surat_pengantar, status) 
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 'verifikasi')`,
                [userId, nama_lengkap, nim, instansi, bidang, jurusan, waktu_mulai, waktu_selesai, suratPengantar]
            );
        }

        res.redirect('/pendaftaran');

    } catch (error) {
        console.error('Submit pendaftaran error:', error);
        res.status(500).send('Terjadi kesalahan saat menyimpan pendaftaran');
    }
};

// Check quota availability (API for real-time warning)
exports.checkQuota = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { waktu_mulai, waktu_selesai } = req.body;

        if (!waktu_mulai || !waktu_selesai) {
            return res.json({ available: true });
        }

        const maxQuota = 2;

        const [overlaps] = await db.query(
            `SELECT COUNT(*) as count 
             FROM pendaftaran 
             WHERE status IN ('verifikasi', 'diterima') 
             AND user_id != ? 
             AND (
                (waktu_mulai <= ? AND waktu_selesai >= ?) OR 
                (waktu_mulai <= ? AND waktu_selesai >= ?) OR 
                (? <= waktu_mulai AND ? >= waktu_selesai)
             )`,
            [userId, waktu_mulai, waktu_mulai, waktu_selesai, waktu_selesai, waktu_mulai, waktu_selesai]
        );

        const count = overlaps[0].count;
        res.json({
            available: count < maxQuota,
            count: count,
            max: maxQuota
        });

    } catch (error) {
        console.error('Check quota error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get pendaftaran status (API)
exports.getPendaftaranStatus = async (req, res) => {
    try {
        const userId = req.session.user.id;

        const [pendaftaran] = await db.query(
            'SELECT status, catatan, waktu_selesai FROM pendaftaran WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (pendaftaran.length === 0) {
            return res.json({ status: 'new', message: 'Belum ada pendaftaran' });
        }

        res.json({
            status: pendaftaran[0].status,
            catatan: pendaftaran[0].catatan,
            waktu_selesai: pendaftaran[0].waktu_selesai
        });

    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan' });
    }
};

// Download response letter
exports.downloadSurat = async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Find the latest accepted surat for this user
        const [surat] = await db.query(`
            SELECT file_path FROM surat 
            WHERE user_id = ? 
            ORDER BY created_at DESC LIMIT 1
        `, [userId]);

        if (surat.length === 0) {
            return res.status(404).send('Surat tidak ditemukan');
        }

        const filePath = path.join(__dirname, '../../public', surat[0].file_path);
        if (!fs.existsSync(filePath)) {
            console.error('File not found:', filePath);
            return res.status(404).send('File fisik tidak ditemukan');
        }

        res.download(filePath);
    } catch (error) {
        console.error('Download surat error:', error);
        res.status(500).send('Terjadi kesalahan');
    }
};
