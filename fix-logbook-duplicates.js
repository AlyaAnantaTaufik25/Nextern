const db = require('./src/confiq/database');

async function fixDatabase() {
    try {
        console.log('--- Database Cleanup Started ---');

        // 1. Delete duplicates keep latest ID
        const deleteQuery = `
            DELETE l1 FROM logbook l1 
            INNER JOIN logbook l2 
            WHERE l1.id < l2.id 
            AND l1.user_id = l2.user_id 
            AND l1.tanggal = l2.tanggal
        `;
        const [deleteResult] = await db.query(deleteQuery);
        console.log('✅ Duplicates cleaned up:', deleteResult.affectedRows, 'rows deleted');

        // 2. Add Unique Index
        // First check if it already exists to avoid error
        const [indexes] = await db.query('SHOW INDEX FROM logbook WHERE KEY_NAME = "idx_user_date"');
        if (indexes.length === 0) {
            await db.query('ALTER TABLE logbook ADD UNIQUE INDEX idx_user_date (user_id, tanggal)');
            console.log('✅ Unique constraint (idx_user_date) added successfully');
        } else {
            console.log('ℹ️ Unique constraint already exists');
        }

        console.log('--- Database Cleanup Finished ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during database fix:', error);
        process.exit(1);
    }
}

fixDatabase();
