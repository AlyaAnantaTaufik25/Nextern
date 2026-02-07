const db = require('./src/confiq/database');

async function check() {
    try {
        const [rows] = await db.query('DESCRIBE pendaftaran');
        const [statusRows] = await db.query("SHOW COLUMNS FROM pendaftaran LIKE 'status'");
        const fs = require('fs');
        const info = {
            structure: rows,
            statusColumn: statusRows[0]
        };
        fs.writeFileSync('db_info.json', JSON.stringify(info, null, 2));
        console.log('Info written to db_info.json');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
