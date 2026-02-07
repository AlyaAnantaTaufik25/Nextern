const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const AppleStrategy = require('passport-apple').Strategy;
const db = require('../confiq/database');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        done(null, users[0]);
    } catch (err) {
        done(err, null);
    }
});

// Helper to handle social login logic
async function handleSocialLogin(profile, provider, done) {
    try {
        const providerIdField = `${provider}_id`;
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

        // 1. Try to find user by social ID
        let [users] = await db.query(`SELECT * FROM users WHERE ${providerIdField} = ?`, [profile.id]);

        if (users.length > 0) {
            return done(null, users[0]);
        }

        // 2. If not found, try to find by email
        if (email) {
            [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

            if (users.length > 0) {
                // Update user with social ID
                await db.query(`UPDATE users SET ${providerIdField} = ? WHERE id = ?`, [profile.id, users[0].id]);
                return done(null, { ...users[0], [providerIdField]: profile.id });
            }
        }

        // 3. If still not found, create new user
        const nama_depan = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
        const nama_belakang = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';
        const foto_profil = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

        const [result] = await db.query(
            `INSERT INTO users (nama_depan, nama_belakang, email, role, foto_profil, ${providerIdField}) VALUES (?, ?, ?, ?, ?, ?)`,
            [nama_depan, nama_belakang, email, 'user', foto_profil, profile.id]
        );

        const newUser = {
            id: result.insertId,
            nama_depan,
            nama_belakang,
            email,
            role: 'user',
            foto_profil,
            [providerIdField]: profile.id
        };

        done(null, newUser);
    } catch (err) {
        done(err, null);
    }
}

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    console.log('--- Passport: Google Strategy Registered ---');
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback",
        proxy: true
    }, (accessToken, refreshToken, profile, done) => {
        handleSocialLogin(profile, 'google', done);
    }));
} else {
    console.warn('--- Passport: Google credentials missing in .env ---');
}

// Facebook Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    console.log('--- Passport: Facebook Strategy Registered ---');
    passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: "/auth/facebook/callback",
        profileFields: ['id', 'displayName', 'name', 'emails', 'photos'],
        proxy: true
    }, (accessToken, refreshToken, profile, done) => {
        handleSocialLogin(profile, 'facebook', done);
    }));
} else {
    console.warn('--- Passport: Facebook credentials missing in .env ---');
}

// Apple Strategy
if (process.env.APPLE_SERVICE_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) {
    console.log('--- Passport: Apple Strategy Registered ---');
    passport.use(new AppleStrategy({
        clientID: process.env.APPLE_SERVICE_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        privateKeyString: process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        callbackURL: "/auth/apple/callback",
        passReqToCallback: true
    }, (req, accessToken, refreshToken, idToken, profile, done) => {
        handleSocialLogin(profile, 'apple', done);
    }));
} else {
    console.warn('--- Passport: Apple credentials missing in .env ---');
}

module.exports = passport;
