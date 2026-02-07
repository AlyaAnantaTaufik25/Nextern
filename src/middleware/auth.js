// Authentication Middleware

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    // Store the original URL for redirect after login
    req.session.returnTo = req.originalUrl;
    res.redirect('/auth/login');
};

// Check if user is NOT authenticated (for login/register pages)
const isNotAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return res.redirect('/');
    }
    next();
};

// Check if user is admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).send('Access denied');
};

module.exports = {
    isAuthenticated,
    isNotAuthenticated,
    isAdmin
};
