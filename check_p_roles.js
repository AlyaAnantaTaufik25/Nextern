const db = require('./src/confiq/database');
const fs = require('fs');

async function check() {
    const [p] = await db.query('SELECT p.id as p_id, p.user_id, p.status, u.role FROM pendaftaran p LEFT JOIN users u ON p.user_id = u.id');
    let out = '';
    p.forEach(row => {
        out += `P_ID: ${row.p_id}, USER_ID: ${row.user_id}, STATUS: ${row.status}, ROLE: ${row.role}\n`;
    });
    fs.writeFileSync('p_roles.txt', out);
    process.exit(0);
}
check();
