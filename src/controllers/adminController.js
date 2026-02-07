const db = require('../confiq/database');
const path = require('path');
const { generateAcceptanceLetter } = require('../utils/pdfGenerator');
const moment = require('moment');
require('moment/locale/id');
moment.locale('id');

// Dashboard - Show stats
exports.dashboard = async (req, res) => {
    try {
        const { year, month } = req.query;
        let whereClause = '';
        const queryParams = [];

        if (year && month) {
            whereClause = 'WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?';
            queryParams.push(year, month);
        } else if (year) {
            whereClause = 'WHERE YEAR(created_at) = ?';
            queryParams.push(year);
        } else if (month) {
            whereClause = 'WHERE MONTH(created_at) = ?';
            queryParams.push(month);
        }

        // Helper function for building queries
        const buildQuery = (baseQuery) => {
            // For queries that already have a WHERE clause
            if (baseQuery.includes('WHERE')) {
                return year || month ? `${baseQuery} AND ${whereClause.replace('WHERE', '')}` : baseQuery;
            }
            return `${baseQuery} ${whereClause}`;
        };

        // Helper to adjust parameters for queries that might already have params (none here so far for the simple counts, but good for safety)
        // For simple counts:
        const [totalPendaftaran] = await db.query(`SELECT COUNT(*) as count FROM pendaftaran ${whereClause}`, queryParams);

        // For specific statuses, we need to be careful with WHERE
        let activeWhere = "WHERE status = 'diterima'";
        if (year || month) {
            activeWhere += ` AND ${whereClause.replace('WHERE', '')}`;
        }
        const [pesertaAktif] = await db.query(`SELECT COUNT(*) as count FROM pendaftaran ${activeWhere}`, queryParams);

        let selesaiWhere = "WHERE status = 'selesai'";
        if (year || month) {
            selesaiWhere += ` AND ${whereClause.replace('WHERE', '')}`;
        }
        const [selesai] = await db.query(`SELECT COUNT(*) as count FROM pendaftaran ${selesaiWhere}`, queryParams);

        // Recent pendaftaran - confusing to filter "recent" by old dates, but user asked for "filter dashboard".
        // Usually "Recent" implies order by time. If filter is applied, it shows "Pendaftaran in that period".
        // We will Apply the filter to this list as well.
        let recentQuery = `
            SELECT p.*, u.nama_depan, u.nama_belakang, u.email 
            FROM pendaftaran p 
            JOIN users u ON p.user_id = u.id 
        `;

        // We need to qualify the created_at in whereClause to p.created_at because of the JOIN potentially (though users also has created_at)
        // Actually pendaftaran has created_at as per the queries.
        // Let's be specific: p.created_at
        let recentWhereClause = '';
        if (year && month) {
            recentWhereClause = 'WHERE YEAR(p.created_at) = ? AND MONTH(p.created_at) = ?';
        } else if (year) {
            recentWhereClause = 'WHERE YEAR(p.created_at) = ?';
        } else if (month) {
            recentWhereClause = 'WHERE MONTH(p.created_at) = ?';
        }

        recentQuery += ` ${recentWhereClause} ORDER BY p.created_at DESC LIMIT 10`;

        const [recentPendaftaran] = await db.query(recentQuery, queryParams);

        res.render('admin/dashboard', {
            title: 'Dashboard Admin - Infranexia',
            currentPage: 'dashboard',
            stats: {
                totalPendaftaran: totalPendaftaran[0].count,
                pesertaAktif: pesertaAktif[0].count,
                selesai: selesai[0].count
            },
            recentPendaftaran,
            filter: { year, month }
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).send('Terjadi kesalahan');
    }
};

// Pendaftaran management
exports.pendaftaran = async (req, res) => {
    try {
        const [pendaftaran] = await db.query(`
            SELECT p.*, u.nama_depan, u.nama_belakang, u.email, u.no_telepon, u.institusi
            FROM pendaftaran p 
            JOIN users u ON p.user_id = u.id 
            ORDER BY p.created_at DESC
        `);

        res.render('admin/pendaftaran', {
            title: 'Kelola Pendaftaran - Infranexia',
            currentPage: 'pendaftaran',
            pendaftaran
        });
    } catch (error) {
        console.error('Admin pendaftaran error:', error);
        res.status(500).send('Terjadi kesalahan');
    }
};

// Pendaftaran detail
exports.pendaftaranDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const [pendaftaran] = await db.query(`
            SELECT p.*, u.nama_depan, u.nama_belakang, u.email, u.no_telepon, u.institusi
            FROM pendaftaran p 
            JOIN users u ON p.user_id = u.id 
            WHERE p.id = ?
        `, [id]);

        if (pendaftaran.length === 0) {
            return res.status(404).send('Pendaftaran tidak ditemukan');
        }

        res.render('admin/pendaftaran-detail', {
            title: 'Detail Pendaftaran - Infranexia',
            currentPage: 'pendaftaran',
            data: pendaftaran[0]
        });
    } catch (error) {
        console.error('Admin pendaftaran detail error:', error);
        res.status(500).send('Terjadi kesalahan');
    }
};

// Update status pendaftaran
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await db.query('UPDATE pendaftaran SET status = ? WHERE id = ?', [status, id]);

        if (status === 'diterima') {
            // Fetch detailed pendaftaran data for PDF
            const [dataList] = await db.query(`
                SELECT p.*, u.nama_depan, u.nama_belakang, u.email, u.no_telepon, u.institusi 
                FROM pendaftaran p 
                JOIN users u ON p.user_id = u.id 
                WHERE p.id = ?
            `, [id]);

            const p = dataList[0];

            // Generate letter number
            const year = moment().format('YYYY');
            const month = moment().format('MM');
            const [maxSeq] = await db.query('SELECT MAX(sequence) as maxS FROM surat WHERE YEAR(created_at) = ?', [year]);
            const nextSeq = (maxSeq[0].maxS || 0) + 1;
            const seqStr = String(nextSeq).padStart(3, '0');
            const noSurat = `Tel. 11.${seqStr}/TIF/${month}/${year}`;

            // Prepare PDF data
            const pdfData = {
                no_surat: noSurat,
                date: moment().format('D MMMM YYYY'),
                recipient_name: 'Ketua Jurusan ' + p.jurusan,
                recipient_dept: p.instansi,
                instansi: p.instansi,
                subject: `Persetujuan Melaksanakan Kerja Praktek Mahasiswa ${p.jurusan} ${p.instansi}`,
                students: [{
                    nama: p.nama_lengkap,
                    nim: p.nim || '-',
                    prodi: p.jurusan
                }],
                startDate: moment(p.waktu_mulai).format('DD MMMM YYYY'),
                endDate: moment(p.waktu_selesai).format('DD MMMM YYYY')
            };

            const filePathRelative = await generateAcceptanceLetter(pdfData);

            // Save to surat table
            await db.query(`
                INSERT INTO surat (no_surat, sequence, user_id, pendaftaran_id, file_path, perihal, target_nama)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [noSurat, nextSeq, p.user_id, id, filePathRelative, pdfData.subject, pdfData.recipient_name]);
        }

        res.json({ success: true, message: 'Status berhasil diperbarui' });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan' });
    }
};

// User management
exports.users = async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT u.id, u.nama_depan, u.nama_belakang, u.email, u.no_telepon, u.institusi, u.role, u.created_at,
                   p.bidang, p.jurusan, p.status as pendaftaran_status
            FROM users u
            LEFT JOIN pendaftaran p ON u.id = p.user_id
            WHERE u.role != 'admin'
            ORDER BY u.created_at DESC
        `);

        res.render('admin/users', {
            title: 'Kelola User - Infranexia',
            currentPage: 'users',
            users
        });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).send('Terjadi kesalahan');
    }
};

// User detail
exports.userDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await db.query(`
            SELECT u.*, p.bidang, p.jurusan, p.status as pendaftaran_status
            FROM users u
            LEFT JOIN pendaftaran p ON u.id = p.user_id
            WHERE u.id = ?
        `, [id]);

        if (users.length === 0) {
            return res.status(404).send('User tidak ditemukan');
        }

        res.render('admin/user-detail', {
            title: 'Detail User - Infranexia',
            currentPage: 'users',
            data: users[0]
        });
    } catch (error) {
        console.error('Admin user detail error:', error);
        res.status(500).send('Terjadi kesalahan');
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Delete user's pendaftaran first (foreign key constraint)
        await db.query('DELETE FROM pendaftaran WHERE user_id = ?', [id]);

        // Delete user
        await db.query('DELETE FROM users WHERE id = ?', [id]);

        res.json({ success: true, message: 'User berhasil dihapus' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan' });
    }
};

// User monitoring - Absensi
exports.userAbsensi = async (req, res) => {
    try {
        const { id } = req.params;

        // Get user data
        const [users] = await db.query(`
            SELECT u.*, p.bidang, p.jurusan
            FROM users u
            LEFT JOIN pendaftaran p ON u.id = p.user_id
            WHERE u.id = ?
        `, [id]);

        if (users.length === 0) {
            return res.status(404).send('User tidak ditemukan');
        }

        // Get absensi data
        const [absensi] = await db.query(`
            SELECT * FROM absensi 
            WHERE user_id = ? 
            ORDER BY tanggal DESC
        `, [id]);

        // Get stats
        const [stats] = await db.query(`
            SELECT 
                COUNT(CASE WHEN status = 'Hadir' THEN 1 END) as hadir,
                COUNT(CASE WHEN status = 'Izin' THEN 1 END) as izin
            FROM absensi 
            WHERE user_id = ?
        `, [id]);

        res.render('admin/user-absensi', {
            title: 'Monitoring Absensi - Infranexia',
            currentPage: 'users',
            data: users[0],
            absensi,
            stats: stats[0],
            moment
        });
    } catch (error) {
        console.error('Admin user absensi error:', error);
        res.status(500).send('Terjadi kesalahan');
    }
};

// Update absensi status
exports.updateAbsensiStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, keterangan } = req.body;

        await db.query('UPDATE absensi SET status = ?, keterangan = ? WHERE id = ?', [status, keterangan || null, id]);

        res.json({ success: true, message: 'Status absensi berhasil diperbarui' });
    } catch (error) {
        console.error('Update absensi status error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan' });
    }
};

// User monitoring - Logbook
exports.userLogbook = async (req, res) => {
    try {
        const { id } = req.params;

        // Get user data
        const [users] = await db.query(`
            SELECT u.*, p.bidang, p.jurusan, p.waktu_mulai, p.waktu_selesai
            FROM users u
            LEFT JOIN pendaftaran p ON u.id = p.user_id
            WHERE u.id = ?
        `, [id]);

        if (users.length === 0) {
            return res.status(404).send('User tidak ditemukan');
        }

        // Get logbook data - use DATE_FORMAT to avoid timezone issues
        const [logbook] = await db.query(`
            SELECT id, user_id, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal, kegiatan, created_at 
            FROM logbook 
            WHERE user_id = ? 
            ORDER BY tanggal DESC
        `, [id]);

        res.render('admin/user-logbook', {
            title: 'Monitoring LogBook - Infranexia',
            currentPage: 'users',
            data: users[0],
            logbook
        });
    } catch (error) {
        console.error('Admin user logbook error:', error);
        res.status(500).send('Terjadi kesalahan');
    }
};

// Delete logbook
exports.deleteLogbook = async (req, res) => {
    try {
        const { id } = req.params;

        await db.query('DELETE FROM logbook WHERE id = ?', [id]);

        res.json({ success: true, message: 'Logbook berhasil dihapus' });
    } catch (error) {
        console.error('Delete logbook error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan' });
    }
};

// Surat management
exports.surat = async (req, res) => {
    try {
        const [surat] = await db.query('SELECT * FROM surat ORDER BY created_at DESC');

        res.render('admin/surat', {
            title: 'Daftar Surat - Infranexia',
            currentPage: 'surat',
            surat,
            moment
        });
    } catch (error) {
        console.error('Admin surat error:', error);
        res.status(500).send('Terjadi kesalahan');
    }
};
