const db = require('./src/confiq/database');

async function checkUsers() {
    try {
        const [users] = await db.query("SELECT COUNT(*) as count FROM users WHERE role != 'admin'");
        console.log('Total non-admin users in DB:', users[0].count);

        const [usersList] = await db.query(`
            SELECT u.id, u.email, u.nama_depan, u.nama_belakang
            FROM users u
            WHERE u.role != 'admin'
        `);
        console.log('Users list:', JSON.stringify(usersList, null, 2));

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
checkUsers();
