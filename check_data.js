const db = require('./src/confiq/database');

async function checkData() {
    try {
        const [rows] = await db.query('SELECT * FROM logbook LIMIT 10');
        console.log('DATA:', JSON.stringify(rows));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
checkData();
