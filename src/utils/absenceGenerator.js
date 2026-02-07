const db = require('../confiq/database');
const { isWorkingDay } = require('../utils/dateHelper');

/**
 * Generate missing absences ("Tanpa Keterangan") for users who didn't clock in
 * on working days
 * @param {string} dateStr - Date to check in YYYY-MM-DD format (optional, default: yesterday)
 * @returns {Promise<Object>} Result with count of records generated
 */
async function generateMissingAbsences(dateStr = null) {
    try {
        // Default to previous working day if no date specified
        const targetDate = dateStr || getPreviousWorkingDay();

        // Check if target date is a working day
        const isWorking = await isWorkingDay(targetDate);
        if (!isWorking) {
            return {
                success: false,
                message: `${targetDate} is not a working day`,
                count: 0
            };
        }

        // Get all active users (assuming role 'pemagang' or status 'diterima')
        const [users] = await db.query(
            `SELECT id FROM users WHERE role = 'pemagang' AND EXISTS (
                SELECT 1 FROM pendaftaran WHERE user_id = users.id AND status = 'diterima'
            )`
        );

        let generatedCount = 0;

        for (const user of users) {
            // Check if user already has attendance record for this date
            const [existing] = await db.query(
                'SELECT id FROM absensi WHERE user_id = ? AND tanggal = ?',
                [user.id, targetDate]
            );

            // If  no record exists, create "Tanpa Keterangan" entry
            if (existing.length === 0) {
                await db.query(
                    'INSERT INTO absensi (user_id, tanggal, status) VALUES (?, ?, ?)',
                    [user.id, targetDate, 'tanpa_keterangan']
                );
                generatedCount++;
            }
        }

        return {
            success: true,
            message: `Generated ${generatedCount} "Tanpa Keterangan" records for ${targetDate}`,
            count: generatedCount,
            date: targetDate
        };

    } catch (error) {
        console.error('Error generating missing absences:', error);
        return {
            success: false,
            message: error.message,
            count: 0
        };
    }
}

/**
 * Get the previous working day (skip weekends and holidays)
 * @returns {string} Date in YYYY-MM-DD format
 */
function getPreviousWorkingDay() {
    const today = new Date();
    let checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1); // Start with yesterday

    const dateStr = checkDate.toISOString().split('T')[0];
    return dateStr;
}

module.exports = {
    generateMissingAbsences
};
