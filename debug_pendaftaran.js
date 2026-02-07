const db = require('./src/confiq/database');

async function checkPendaftaran() {
    try {
        const [pendaftaran] = await db.query("SELECT COUNT(*) as count FROM pendaftaran");
        console.log('PENDAFTARAN_COUNT:' + pendaftaran[0].count);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
checkPendaftaran();
