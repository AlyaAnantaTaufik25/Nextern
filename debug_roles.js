const db = require('./src/confiq/database');

async function checkRoles() {
    try {
        const [roles] = await db.query("SELECT DISTINCT role FROM users");
        console.log('ROLES:', JSON.stringify(roles));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
checkRoles();
