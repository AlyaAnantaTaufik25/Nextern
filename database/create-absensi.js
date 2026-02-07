const db = require('../src/confiq/database');

async function createTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS absensi (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                tanggal DATE NOT NULL,
                jam_datang TIME,
                jam_pulang TIME,
                status VARCHAR(20) DEFAULT 'hadir',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_date (user_id, tanggal)
            )
        `);
        console.log('✅ Table absensi created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating table:', error);
        process.exit(1);
    }
}

createTable();
