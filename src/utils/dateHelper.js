const db = require('../confiq/database');

/**
 * Check if a date is weekend (Saturday or Sunday)
 * @param {Date|string} date - Date to check
 * @returns {boolean} true if weekend, false otherwise
 */
function isWeekend(date) {
    const d = new Date(date);
    const day = d.getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Get holiday information for a specific date
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Promise<Object|null>} Holiday object or null
 */
async function getHolidayInfo(dateStr) {
    try {
        const [holidays] = await db.query(
            'SELECT * FROM holidays WHERE tanggal = ?',
            [dateStr]
        );
        return holidays.length > 0 ? holidays[0] : null;
    } catch (error) {
        console.error('Error fetching holiday info:', error);
        return null;
    }
}

/**
 * Check if a date is a working day (not weekend and not holiday)
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Promise<boolean>} true if working day, false otherwise
 */
async function isWorkingDay(dateStr) {
    // Check weekend first
    if (isWeekend(dateStr)) {
        return false;
    }

    // Check holidays
    const holiday = await getHolidayInfo(dateStr);
    return holiday === null;
}

/**
 * Get Indonesian day name
 * @param {Date|string} date
 * @returns {string} Day name in Indonesian
 */
function getIndonesianDayName(date) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = new Date(date);
    return days[d.getDay()];
}

/**
 * Count the number of working days (Mon-Fri) between two dates
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @returns {number} Number of working days
 */
function countWorkingDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) { // Not Sunday (0) and not Saturday (6)
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

module.exports = {
    isWeekend,
    getHolidayInfo,
    isWorkingDay,
    getIndonesianDayName,
    countWorkingDays
};
