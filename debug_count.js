const db = require('./src/confiq/database');

async function checkUsers() {
    try {
        const [users] = await db.query("SELECT COUNT(*) as count FROM users");
        console.log('TOTAL_USERS_IN_DB:' + users[0].count);

        const [nonAdmins] = await db.query("SELECT COUNT(*) as count FROM users WHERE role != 'admin'");
        console.log('NON_ADMIN_USERS_IN_DB:' + nonAdmins[0].count);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
checkUsers();
