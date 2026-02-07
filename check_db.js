const db = require('./src/confiq/database');

async function checkTables() {
    try {
        const [tables] = await db.query('SHOW TABLES');
        console.log('TABLES_START');
        tables.forEach(t => console.log(Object.values(t)[0]));
        console.log('TABLES_END');
        process.exit(0);
    } catch (error) {
        console.error('Error checking tables:', error);
        process.exit(1);
    }
}

checkTables();
