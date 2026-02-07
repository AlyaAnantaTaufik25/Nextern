const db = require('./src/confiq/database');

async function checkDuplicates() {
    try {
        const [counts] = await db.query(`
            SELECT user_id, COUNT(*) as c 
            FROM pendaftaran 
            GROUP BY user_id 
            HAVING c > 1
        `);
        console.log('USERS_WITH_MULTIPLE_REGISTRATIONS:', JSON.stringify(counts));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
checkDuplicates();
