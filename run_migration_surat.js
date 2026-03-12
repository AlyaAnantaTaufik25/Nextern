const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Starting migration...');
        
        // Add tipe_surat column
        await connection.query(`
            ALTER TABLE surat 
            ADD COLUMN tipe_surat ENUM('balasan', 'selesai') DEFAULT 'balasan'
        `);
        
        console.log('Migration successful: Added tipe_surat column to surat table.');
    } catch (error) {
        if (error.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column tipe_surat already exists. Skipping.');
        } else {
            console.error('Migration failed:', error);
        }
    } finally {
        await connection.end();
    }
}

migrate();
