// Admin Middleware - Check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.session.user) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
    }

    if (req.session.user.role !== 'admin') {
        return res.status(403).render('403', {
            title: 'Access Denied',
            message: 'Anda tidak memiliki akses ke halaman ini'
        });
    }

    next();
};

module.exports = { isAdmin };
