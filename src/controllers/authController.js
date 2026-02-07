// Auth Controller - Handles authentication
const bcrypt = require('bcryptjs');
const db = require('../confiq/database');

// Show auth page (login/register)
exports.authPage = (req, res) => {
    res.render('auth', {
        title: 'Login - Infranexia',
        mode: 'login',
        error: null,
        success: null
    });
};

exports.authPageRegister = (req, res) => {
    res.redirect('/auth/login?mode=register');
};

// Process login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.render('auth', {
                title: 'Login - Infranexia',
                mode: 'login',
                error: 'Email dan password harus diisi',
                success: null
            });
        }

        // Check if user exists
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.render('auth', {
                title: 'Login - Infranexia',
                mode: 'login',
                error: 'Email atau password salah',
                success: null
            });
        }

        const user = users[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.render('auth', {
                title: 'Login - Infranexia',
                mode: 'login',
                error: 'Email atau password salah',
                success: null
            });
        }

        // Create session
        req.session.user = {
            id: user.id,
            nama_depan: user.nama_depan,
            nama_belakang: user.nama_belakang,
            email: user.email,
            role: user.role,
            foto_profil: user.foto_profil
        };

        // Redirect based on role
        if (user.role === 'admin') {
            return res.redirect('/admin');
        }

        // Redirect to original URL or home
        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(returnTo);

    } catch (error) {
        console.error('Login error:', error);
        res.render('auth', {
            title: 'Login - Infranexia',
            mode: 'login',
            error: 'Terjadi kesalahan, silakan coba lagi',
            success: null
        });
    }
};

// Process register
exports.register = async (req, res) => {
    try {
        console.log('=== REGISTER REQUEST ===');
        console.log('Request body:', req.body);

        const { nama_depan, nama_belakang, email, no_telepon, institusi, password, confirm_password } = req.body;

        // Validate input
        if (!nama_depan || !email || !password) {
            return res.render('auth', {
                title: 'Register - Infranexia',
                mode: 'register',
                error: 'Nama depan, email, dan password harus diisi',
                success: null
            });
        }

        if (password !== confirm_password) {
            return res.render('auth', {
                title: 'Register - Infranexia',
                mode: 'register',
                error: 'Password dan konfirmasi password tidak cocok',
                success: null
            });
        }

        if (password.length < 8) {
            return res.render('auth', {
                title: 'Register - Infranexia',
                mode: 'register',
                error: 'Password minimal 8 karakter',
                success: null
            });
        }

        // Check if email already exists
        const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

        if (existingUsers.length > 0) {
            return res.render('auth', {
                title: 'Register - Infranexia',
                mode: 'register',
                error: 'Email sudah terdaftar',
                success: null
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user to database
        const [result] = await db.query(
            'INSERT INTO users (nama_depan, nama_belakang, email, no_telepon, institusi, password) VALUES (?, ?, ?, ?, ?, ?)',
            [nama_depan, nama_belakang || '', email, no_telepon || '', institusi || '', hashedPassword]
        );

        console.log('User registered successfully! ID:', result.insertId);

        // Redirect to login with success message
        res.render('auth', {
            title: 'Login - Infranexia',
            mode: 'login',
            error: null,
            success: 'Registrasi berhasil! Silakan login dengan akun Anda.'
        });

    } catch (error) {
        console.error('Register error:', error);
        res.render('auth', {
            title: 'Register - Infranexia',
            mode: 'register',
            error: 'Terjadi kesalahan, silakan coba lagi',
            success: null
        });
    }
};

// Process logout
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
};

// Handle social login callback
exports.socialCallback = (req, res) => {
    try {
        const user = req.user;

        // Manual session sync (Passport uses req.user, our existing code uses req.session.user)
        req.session.user = {
            id: user.id,
            nama_depan: user.nama_depan,
            nama_belakang: user.nama_belakang,
            email: user.email,
            role: user.role,
            foto_profil: user.foto_profil
        };

        // Redirect based on role
        if (user.role === 'admin') {
            return res.redirect('/admin');
        }

        res.redirect('/');
    } catch (error) {
        console.error('Social callback error:', error);
        res.redirect('/auth/login?error=auth_failed');
    }
};
