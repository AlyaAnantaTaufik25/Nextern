const fs = require('fs');
const pdf = require('pdf-parse');

/**
 * Extract details from student application letter
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {Promise<Object>} - { no_surat, tanggal, perihal }
 */
async function extractLetterDetails(filePath) {
    const results = {
        no_surat: '',
        tanggal: '',
        perihal: 'Permohonan Kerja Praktek Mahasiswa'
    };

    if (!filePath || !filePath.toLowerCase().endsWith('.pdf')) {
        return results;
    }

    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        const text = data.text;

        // 1. Extract Letter Number
        // Patterns: Nomor: ..., No: ..., NO. ...
        const noMatch = text.match(/(?:Nomor|No|NO)\.?\s*:\s*([^\n\r]+)/i);
        if (noMatch) {
            results.no_surat = noMatch[1].trim();
        }

        // 2. Extract Date
        // Patterns: Padang, 08 Oktober 2025 or just date
        const dateMatch = text.match(/(\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i);
        if (dateMatch) {
            results.tanggal = dateMatch[1].trim();
        }

        // 3. Extract Subject (Perihal)
        const perihalMatch = text.match(/(?:Perihal|Hal)\.?\s*:\s*([^\n\r]+)/i);
        if (perihalMatch) {
            results.perihal = perihalMatch[1].trim();
        }

        return results;
    } catch (error) {
        console.error('Error extracting PDF details:', error);
        return results;
    }
}

module.exports = { extractLetterDetails };
