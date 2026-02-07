const db = require('./src/confiq/database');

async function checkOrphans() {
    try {
        const [orphans] = await db.query(`
            SELECT * FROM pendaftaran 
            WHERE user_id NOT IN (SELECT id FROM users)
        `);
        console.log('ORPHAN_REGISTRATIONS:', JSON.stringify(orphans));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
checkOrphans();
