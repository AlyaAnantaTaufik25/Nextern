const db = require('./src/confiq/database');

async function checkPendaftaran() {
    try {
        const [rows] = await db.query("SELECT DISTINCT status FROM pendaftaran");
        rows.forEach(row => {
            console.log('STATUS_VAL:' + row.status);
        });
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
checkPendaftaran();
