// Absen Controller - Handles attendance management
const db = require('../confiq/database');

// Show attendance page
exports.showAbsen = async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Get pendaftaran info
        const pendaftaranId = req.query.id;
        let pendaftaran;
        if (pendaftaranId) {
            const [p] = await db.query('SELECT * FROM pendaftaran WHERE id = ? AND user_id = ?', [pendaftaranId, userId]);
            pendaftaran = p.length > 0 ? p[0] : null;
        } else {
            const [p] = await db.query('SELECT * FROM pendaftaran WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
            pendaftaran = p.length > 0 ? p[0] : null;
        }

        // Get latest registration for navigation logic
        const [latestPendaftaran] = await db.query(
            'SELECT id, status FROM pendaftaran WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        const pendaftaranStatus = latestPendaftaran.length > 0 ? latestPendaftaran[0].status : null;

        // Is this a historical view?
        const isHistory = pendaftaranId ? true : (pendaftaran && pendaftaran.status === 'selesai');

        // Get user data
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.redirect('/auth/login');
        const user = users[0];

        // Get attendance records for this user - filter by period if pendaftaran exists
        let absensiQuery = `SELECT *, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal FROM absensi WHERE user_id = ?`;
        let queryParams = [userId];

        if (pendaftaran) {
            absensiQuery += ` AND tanggal BETWEEN ? AND ?`;
            queryParams.push(pendaftaran.waktu_mulai, pendaftaran.waktu_selesai);
        }

        absensiQuery += ` ORDER BY tanggal DESC`;
        const [absensi] = await db.query(absensiQuery, queryParams);

        res.render('pemagang/absen/index', {
            title: 'Absensi - Infranexia',
            currentPage: 'absensi',
            user: user,
            absensi: absensi,
            pendaftaranStatus: pendaftaranStatus,
            isHistory: isHistory,
            pendaftaran: pendaftaran
        });

    } catch (error) {
        console.error('Show absen error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).send(`Terjadi kesalahan: ${error.message}`);
    }
};

// Show check-in form
exports.showCheckInForm = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const today = new Date().toISOString().split('T')[0];
        const { isWorkingDay, getHolidayInfo, getIndonesianDayName } = require('../utils/dateHelper');

        // Get user data
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

        if (users.length === 0) {
            return res.redirect('/');
        }

        // Check if today is a working day
        const isWorking = await isWorkingDay(today);
        const holidayInfo = await getHolidayInfo(today);
        const dayName = getIndonesianDayName(today);

        // Get latest registration status
        const [pendaftaran] = await db.query(
            'SELECT status FROM pendaftaran WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (pendaftaran.length > 0 && pendaftaran[0].status === 'selesai') {
            return res.redirect('/pemagang/absen');
        }

        res.render('pemagang/absen/check-in', {
            title: 'Check-In Absensi - Infranexia',
            currentPage: 'absensi',
            user: users[0],
            isWorkingDay: isWorking,
            holidayInfo: holidayInfo,
            dayName: dayName
        });

    } catch (error) {
        console.error('Show check-in error:', error);
        res.status(500).send(`Terjadi kesalahan: ${error.message}`);
    }
};

// Show check-out form
exports.showCheckOutForm = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const today = new Date().toISOString().split('T')[0];

        // Get user data
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

        if (users.length === 0) {
            return res.redirect('/');
        }

        // Get today's attendance record
        const [absensi] = await db.query(
            'SELECT * FROM absensi WHERE user_id = ? AND tanggal = ?',
            [userId, today]
        );

        if (absensi.length === 0) {
            return res.redirect('/pemagang/absen');
        }

        res.render('pemagang/absen/check-out', {
            title: 'Absen Pulang - Infranexia',
            currentPage: 'absensi',
            user: users[0],
            absensi: absensi[0]
        });

    } catch (error) {
        console.error('Show check-out error:', error);
        res.status(500).send(`Terjadi kesalahan: ${error.message}`);
    }
};

// Record attendance (clock in)
exports.clockIn = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const today = new Date().toISOString().split('T')[0];

        // Check if today is a weekend (Saturday=6, Sunday=0)
        const currentDay = new Date().getDay();
        if (currentDay === 0 || currentDay === 6) {
            return res.json({
                success: false,
                message: 'Absensi hanya dapat dilakukan pada hari kerja (Senin - Jumat)'
            });
        }

        // Check if already clocked in today
        const [existing] = await db.query(
            'SELECT * FROM absensi WHERE user_id = ? AND tanggal = ?',
            [userId, today]
        );

        if (existing.length > 0) {
            return res.json({
                success: false,
                message: 'Anda sudah absen hari ini'
            });
        }

        // Insert new attendance record
        const { divisi, status, location, locationAddress, waktuDatang, keterangan } = req.body;

        // Use waktuDatang from frontend (the frozen time when user clicked button)
        // For izin status, don't record time
        let jamDatang = null;
        if (status === 'hadir') {
            jamDatang = waktuDatang;
            if (!jamDatang) {
                const now = new Date();
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                jamDatang = `${hours}:${minutes}:${seconds}`;
            }
        }

        const locationStr = locationAddress || (location ? `${location.latitude},${location.longitude}` : null);

        await db.query(
            'INSERT INTO absensi (user_id, tanggal, jam_datang, status, divisi, lokasi, keterangan) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, today, jamDatang, status || 'hadir', divisi, locationStr, keterangan || null]
        );

        res.json({
            success: true,
            message: 'Absensi berhasil dicatat!',
            jamDatang: jamDatang
        });

    } catch (error) {
        console.error('Clock in error:', error);
        res.json({
            success: false,
            message: 'Terjadi kesalahan saat mencatat absensi'
        });
    }
};

// Record clock out
exports.clockOut = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const today = new Date().toISOString().split('T')[0];

        // Find today's attendance record
        const [existing] = await db.query(
            'SELECT * FROM absensi WHERE user_id = ? AND tanggal = ?',
            [userId, today]
        );

        if (existing.length === 0) {
            return res.json({
                success: false,
                message: 'Anda belum absen masuk hari ini'
            });
        }

        if (existing[0].jam_pulang) {
            return res.json({
                success: false,
                message: 'Anda sudah absen pulang hari ini'
            });
        }

        // Update with clock out time
        const { waktuPulang } = req.body;

        let jamPulang = waktuPulang;
        if (!jamPulang) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            jamPulang = `${hours}:${minutes}:${seconds}`;
        }

        await db.query(
            'UPDATE absensi SET jam_pulang = ? WHERE user_id = ? AND tanggal = ?',
            [jamPulang, userId, today]
        );

        res.json({
            success: true,
            message: 'Absensi pulang berhasil dicatat!',
            jamPulang: jamPulang
        });

    } catch (error) {
        console.error('Clock out error:', error);
        res.json({
            success: false,
            message: 'Terjadi kesalahan saat mencatat absensi pulang'
        });
    }
};
