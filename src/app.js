require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'infranexia-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Make user session available to all views
app.use(async (req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    res.locals.pendaftaranStatus = null;

    if (req.session.user) {
        try {
            const db = require('./confiq/database');
            const [pendaftaran] = await db.query(
                'SELECT status FROM pendaftaran WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
                [req.session.user.id]
            );
            if (pendaftaran.length > 0) {
                res.locals.pendaftaranStatus = pendaftaran[0].status;
            }
        } catch (error) {
            console.error('Error fetching status:', error);
        }
    }
    next();
});

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Routes
const webRoutes = require('./routes/webRoutes');
const authRoutes = require('./routes/authRoutes');
const pendaftaranRoutes = require('./routes/pendaftaranRoutes');
const profilRoutes = require('./routes/profilRoutes');
const absenRoutes = require('./routes/absenRoutes');
const logbookRoutes = require('./routes/logbookRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/', webRoutes);
app.use('/auth', authRoutes);
app.use('/pendaftaran', pendaftaranRoutes);
app.use('/profil', profilRoutes);
app.use('/pemagang/absen', absenRoutes);
app.use('/pemagang/logbook', logbookRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('404');
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
