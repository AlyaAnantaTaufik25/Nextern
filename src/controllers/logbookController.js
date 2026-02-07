const db = require('../confiq/database');

// Show logbook list
exports.showLogbook = async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Get user data
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

        // Get logbook entries - use DATE_FORMAT to avoid timezone issues
        const [entries] = await db.query(
            `SELECT id, user_id, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal, kegiatan, created_at 
             FROM logbook WHERE user_id = ? ORDER BY tanggal DESC, id DESC`,
            [userId]
        );

        res.render('pemagang/report/logbook', {
            title: 'Logbook - Infranexia',
            currentPage: 'logbook',
            user: users[0],
            entries: entries
        });

    } catch (error) {
        console.error('Show logbook error:', error);
        res.status(500).send(`Terjadi kesalahan: ${error.message}`);
    }
};

// Show add form
exports.showAddForm = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

        res.render('pemagang/report/add-logbook', {
            title: 'Tambah Logbook - Infranexia',
            currentPage: 'logbook',
            user: users[0],
            entry: null // for reuse in edit
        });

    } catch (error) {
        console.error('Show add form error:', error);
        res.status(500).send(`Terjadi kesalahan: ${error.message}`);
    }
};

// Add new entry
exports.addEntry = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { tanggal, kegiatan } = req.body;

        if (!tanggal || !kegiatan) {
            return res.status(400).json({ success: false, message: 'Tanggal dan Kegiatan wajib diisi' });
        }

        // Check if selected date is a weekend (Saturday=6, Sunday=0)
        // Parse date parts to avoid timezone issues
        const [year, month, day] = tanggal.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day); // Local timezone
        const dayOfWeek = selectedDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return res.status(400).json({
                success: false,
                message: 'Logbook hanya dapat diisi untuk hari kerja (Senin - Jumat)'
            });
        }

        // Check if logbook already exists for this date
        const [existing] = await db.query(
            'SELECT id FROM logbook WHERE user_id = ? AND tanggal = ?',
            [userId, tanggal]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Anda sudah mengisi logbook untuk tanggal ini. Silakan edit entri yang sudah ada jika ingin mengubahnya.'
            });
        }

        await db.query(
            'INSERT INTO logbook (user_id, tanggal, kegiatan) VALUES (?, ?, ?)',
            [userId, tanggal, kegiatan]
        );

        // Auto-complete status check
        const [pendaftaran] = await db.query(
            'SELECT id, waktu_mulai, waktu_selesai FROM pendaftaran WHERE user_id = ? AND status = "diterima"',
            [userId]
        );

        if (pendaftaran.length > 0) {
            const p = pendaftaran[0];
            if (p.waktu_mulai && p.waktu_selesai) {
                const start = new Date(p.waktu_mulai);
                const end = new Date(p.waktu_selesai);
                const targetDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

                const [countResult] = await db.query(
                    'SELECT COUNT(*) as count FROM logbook WHERE user_id = ?',
                    [userId]
                );

                if (countResult[0].count >= targetDays) {
                    await db.query(
                        'UPDATE pendaftaran SET status = "selesai" WHERE id = ?',
                        [p.id]
                    );
                }
            }
        }

        res.json({ success: true, message: 'Logbook berhasil ditambahkan' });

    } catch (error) {
        console.error('Add logbook error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Show edit form
exports.showEditForm = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { id } = req.params;

        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const [entries] = await db.query(
            `SELECT id, user_id, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal, kegiatan, created_at 
             FROM logbook WHERE id = ? AND user_id = ?`,
            [id, userId]
        );

        if (entries.length === 0) {
            return res.redirect('/pemagang/logbook');
        }

        res.render('pemagang/report/add-logbook', {
            title: 'Edit Logbook - Infranexia',
            currentPage: 'logbook',
            user: users[0],
            entry: entries[0]
        });

    } catch (error) {
        console.error('Show edit form error:', error);
        res.status(500).send(`Terjadi kesalahan: ${error.message}`);
    }
};

// Update entry
exports.updateEntry = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { id } = req.params;
        const { tanggal, kegiatan } = req.body;

        // Check if selected date is a weekend (Saturday=6, Sunday=0)
        // Parse date parts to avoid timezone issues
        const [year, month, day] = tanggal.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day); // Local timezone
        const dayOfWeek = selectedDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return res.status(400).json({
                success: false,
                message: 'Logbook hanya dapat diisi untuk hari kerja (Senin - Jumat)'
            });
        }

        await db.query(
            'UPDATE logbook SET tanggal = ?, kegiatan = ? WHERE id = ? AND user_id = ?',
            [tanggal, kegiatan, id, userId]
        );

        res.json({ success: true, message: 'Logbook berhasil diperbarui' });

    } catch (error) {
        console.error('Update logbook error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete entry
exports.deleteEntry = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { id } = req.params;

        await db.query(
            'DELETE FROM logbook WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        res.json({ success: true, message: 'Logbook berhasil dihapus' });

    } catch (error) {
        console.error('Delete logbook error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
