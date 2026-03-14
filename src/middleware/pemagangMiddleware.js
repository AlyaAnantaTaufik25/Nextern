// Pemagang Middleware - Check if user has approved pendaftaran
const db = require('../confiq/database');

const isPemagang = async (req, res, next) => {
    try {
        // User must be authenticated first
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }

        // Check pendaftaran status
        const [pendaftaran] = await db.query(
            'SELECT status FROM pendaftaran WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [req.session.user.id]
        );

        // If no pendaftaran or status is not 'diterima' or 'selesai', block access
        if (pendaftaran.length === 0 || (pendaftaran[0].status !== 'diterima' && pendaftaran[0].status !== 'selesai')) {
            return res.render('access-denied', {
                title: 'Akses Ditolak - Infranexia',
                message: 'Anda tidak memiliki akses ke halaman ini. Pastikan pendaftaran magang Anda sudah diterima.',
                redirectUrl: '/pendaftaran'
            });
        }

        next();
    } catch (error) {
        console.error('Pemagang middleware error:', error);
        return res.status(500).send('Terjadi kesalahan');
    }
};

module.exports = { isPemagang };
