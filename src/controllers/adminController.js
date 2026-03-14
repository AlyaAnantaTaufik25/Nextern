const db = require('../confiq/database');
const path = require('path');
const fs = require('fs');
const { generateAcceptanceLetter, generateCompletionLetter } = require('../utils/pdfGenerator');
const { extractLetterDetails } = require('../utils/letterExtractor');
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

        // Query active interns per division with their names and activity stats
        const [divisionInterns] = await db.query(`
            SELECT p.divisi_penempatan, p.nama_lengkap, p.user_id, p.waktu_mulai, p.waktu_selesai,
                   u.nama_depan, u.nama_belakang, u.email,
                   COALESCE(a.total_absensi, 0) as total_absensi,
                   COALESCE(l.total_logbook, 0) as total_logbook
            FROM pendaftaran p 
            JOIN users u ON p.user_id = u.id 
            LEFT JOIN (
                SELECT user_id, COUNT(*) as total_absensi FROM absensi GROUP BY user_id
            ) a ON a.user_id = p.user_id
            LEFT JOIN (
                SELECT user_id, COUNT(*) as total_logbook FROM logbook GROUP BY user_id
            ) l ON l.user_id = p.user_id
            WHERE p.status = 'diterima' AND p.divisi_penempatan IS NOT NULL
            ORDER BY p.divisi_penempatan, p.nama_lengkap
        `);

        // Group by division
        const divisionStats = {
            'AOM': { full: 'Account Operation Maintenance', count: 0, interns: [] },
            'ASO': { full: 'Access Support Operation', count: 0, interns: [] },
            'NOC': { full: 'Network Operation Center', count: 0, interns: [] }
        };

        divisionInterns.forEach(intern => {
            const nama = intern.nama_lengkap || `${intern.nama_depan} ${intern.nama_belakang || ''}`.trim();
            let durasiHari = 0;
            if (intern.waktu_mulai && intern.waktu_selesai) {
                durasiHari = Math.ceil((new Date(intern.waktu_selesai) - new Date(intern.waktu_mulai)) / (1000 * 60 * 60 * 24));
            }
            const progress = durasiHari > 0 ? Math.min(100, Math.round((intern.total_logbook / durasiHari) * 100)) : 0;

            const internData = { 
                userId: intern.user_id,
                nama, 
                email: intern.email, 
                totalAbsensi: intern.total_absensi, 
                totalLogbook: intern.total_logbook, 
                durasiHari,
                progress 
            };

            if (intern.divisi_penempatan === 'Account Operation Maintenance') {
                divisionStats['AOM'].count++;
                divisionStats['AOM'].interns.push(internData);
            } else if (intern.divisi_penempatan === 'Access Support Operation') {
                divisionStats['ASO'].count++;
                divisionStats['ASO'].interns.push(internData);
            } else if (intern.divisi_penempatan === 'Network Operation Center') {
                divisionStats['NOC'].count++;
                divisionStats['NOC'].interns.push(internData);
            }
        });

        res.render('admin/dashboard', {
            title: 'Dashboard Admin - Infranexia',
            currentPage: 'dashboard',
            stats: {
                totalPendaftaran: totalPendaftaran[0].count,
                pesertaAktif: pesertaAktif[0].count,
                selesai: selesai[0].count
            },
            divisionStats,
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

        const data = pendaftaran[0];

        // Automated Extraction for Student Letter Details
        let extractedDetails = { no_surat: '', tanggal: '', perihal: 'Permohonan Kerja Praktek Mahasiswa' };
        if (data.surat_pengantar && data.surat_pengantar.toLowerCase().endsWith('.pdf')) {
            const absolutePath = path.join(__dirname, '../../public', data.surat_pengantar);
            if (fs.existsSync(absolutePath)) {
                extractedDetails = await extractLetterDetails(absolutePath);
            }
        }

        let hasSelesaiLetter = false;
        if (data.status === 'selesai') {
            const [surat] = await db.query(`SELECT id FROM surat WHERE pendaftaran_id = ? AND tipe_surat = 'selesai' LIMIT 1`, [id]);
            hasSelesaiLetter = surat.length > 0;
        }

        res.render('admin/pendaftaran-detail', {
            title: 'Detail Pendaftaran - Infranexia',
            currentPage: 'pendaftaran',
            data: data,
            extractedDetails: extractedDetails,
            hasSelesaiLetter
        });
    } catch (error) {
        console.error('Admin pendaftaran detail error:', error);
        res.status(500).send(`Terjadi kesalahan: ${error.message}`); // Show error for debugging
    }
};

// Update status pendaftaran
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, divisi_penempatan, no_surat_pemohon, tgl_surat_pemohon, perihal_pemohon } = req.body;

        if (status === 'diterima' && divisi_penempatan) {
            await db.query(`
                UPDATE pendaftaran SET 
                    status = ?, 
                    divisi_penempatan = ?,
                    no_surat_pemohon = ?,
                    tgl_surat_pemohon = ?,
                    perihal_pemohon = ?
                WHERE id = ?`, 
                [status, divisi_penempatan, no_surat_pemohon || null, tgl_surat_pemohon || null, perihal_pemohon || null, id]
            );
        } else {
            await db.query('UPDATE pendaftaran SET status = ? WHERE id = ?', [status, id]);
        }

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
            const [maxSeq] = await db.query(`SELECT MAX(sequence) as maxS FROM surat WHERE YEAR(created_at) = ?`, [year]);
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
                no_surat_pemohon: p.no_surat_pemohon,
                tgl_surat_pemohon: p.tgl_surat_pemohon ? moment(p.tgl_surat_pemohon).format('DD MMMM YYYY') : '-',
                perihal_pemohon: p.perihal_pemohon,
                students: [{
                    nama: `${p.nama_depan} ${p.nama_belakang || ''}`.trim(),
                    nim: p.nim || '-',
                    prodi: p.jurusan
                }],
                startDate: moment(p.waktu_mulai).format('DD MMMM YYYY'),
                endDate: moment(p.waktu_selesai).format('DD MMMM YYYY')
            };

            const filePathRelative = await generateAcceptanceLetter(pdfData);

            // Save to surat table
            await db.query(`
                INSERT INTO surat (no_surat, sequence, user_id, pendaftaran_id, file_path, perihal, target_nama, tipe_surat)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'balasan')
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
            SELECT u.*, p.bidang, p.jurusan, p.status as pendaftaran_status, p.id as pendaftaran_id
            FROM users u
            LEFT JOIN pendaftaran p ON u.id = p.user_id
            WHERE u.id = ?
        `, [id]);

        if (users.length === 0) {
            return res.status(404).send('User tidak ditemukan');
        }

        let hasSelesaiLetter = false;
        if (users[0].pendaftaran_status === 'selesai' && users[0].pendaftaran_id) {
            const [surat] = await db.query(`SELECT id FROM surat WHERE pendaftaran_id = ? AND tipe_surat = 'selesai' LIMIT 1`, [users[0].pendaftaran_id]);
            hasSelesaiLetter = surat.length > 0;
        }

        res.render('admin/user-detail', {
            title: 'Detail User - Infranexia',
            currentPage: 'users',
            data: users[0],
            hasSelesaiLetter
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
// Generate completion letter
exports.generateCompletionLetter = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch detailed pendaftaran data
        const [dataList] = await db.query(`
            SELECT p.*, u.nama_depan, u.nama_belakang, u.email, u.no_telepon, u.institusi 
            FROM pendaftaran p 
            JOIN users u ON p.user_id = u.id 
            WHERE p.id = ?
        `, [id]);

        if (dataList.length === 0) {
            return res.status(404).json({ success: false, message: 'Pendaftaran tidak ditemukan' });
        }

        const p = dataList[0];

        // Only allow for completed status
        if (p.status !== 'selesai') {
            return res.status(400).json({ success: false, message: 'Peserta belum selesai magang' });
        }

        // Generate letter number specific to Surat Tanda Selesai
        const year = moment().format('YYYY');
        const month = moment().format('MM');
        
        // Count existing selesai letters to get the sequential number (01, 02, 03...)
        const [selesaiCount] = await db.query("SELECT COUNT(*) as cnt FROM surat WHERE tipe_surat = 'selesai'");
        const selesaiSeq = (selesaiCount[0].cnt || 0) + 1;
        const seqStr = String(selesaiSeq).padStart(2, '0');
        const noSurat = `09.${seqStr}/TIF/${month}/${year}`;

        // Also get global max sequence for the surat table
        const [maxSeq] = await db.query('SELECT MAX(sequence) as maxS FROM surat WHERE YEAR(created_at) = ?', [year]);
        const nextSeq = (maxSeq[0].maxS || 0) + 1;

        // Calculate working days (approximate or precise if dateHelper is used)
        // For now using the simple subtraction from dashboard logic
        const startDate = new Date(p.waktu_mulai);
        const endDate = new Date(p.waktu_selesai);
        const durasiHari = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

        // Prepare PDF data
        const pdfData = {
            no_surat: noSurat,
            date: moment().format('D MMMM YYYY'),
            intern_name: `${p.nama_depan} ${p.nama_belakang || ''}`.trim(),
            intern_origin: p.instansi,
            intern_id: p.nim || '-',
            days: durasiHari,
            startDate: moment(p.waktu_mulai).format('D MMMM YYYY'),
            endDate: moment(p.waktu_selesai).format('D MMMM YYYY'),
            manager_name: 'RINI MARLINI', // Default from provided image
            manager_role: 'Head Of District Padang'
        };

        const filePathRelative = await generateCompletionLetter(pdfData);

        // Save to surat table with tipe_surat = 'selesai'
        const internName = `${p.nama_depan} ${p.nama_belakang || ''}`.trim();
        await db.query(`
            INSERT INTO surat (no_surat, sequence, user_id, pendaftaran_id, file_path, perihal, target_nama, tipe_surat)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'selesai')
        `, [noSurat, nextSeq, p.user_id, id, filePathRelative, `Surat Keterangan Selesai Magang - ${internName}`, internName]);

        res.json({ success: true, message: 'Surat Tanda Selesai berhasil dibuat' });
    } catch (error) {
        console.error('Generate completion letter error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan' });
    }
};
