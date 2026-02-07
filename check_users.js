const db = require('./src/confiq/database');
const fs = require('fs');

async function check() {
    const [rows] = await db.query('SELECT u.id, u.nama_depan, p.status FROM users u LEFT JOIN pendaftaran p ON u.id = p.user_id WHERE u.role != "admin"');
    fs.writeFileSync('users_data.json', JSON.stringify(rows, null, 2));
    process.exit(0);
}
check();
