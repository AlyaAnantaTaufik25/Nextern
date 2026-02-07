const pool = require('./src/confiq/database');
const fs = require('fs');
const path = require('path');

async function runSQL() {
    try {
        const sqlPath = path.join(__dirname, 'database', 'logbook.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon and filter empty statements
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

        for (const statement of statements) {
            console.log('Executing:', statement.substring(0, 50) + '...');
            await pool.query(statement);
        }

        console.log('✅ Logbook table setup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error executing SQL:', error);
        process.exit(1);
    }
}

runSQL();
