const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
require('moment/locale/id');
moment.locale('id');

/**
 * Generate official acceptance letter
 * @param {Object} data - { no_surat, date, recipient_name, recipient_dept, instansi, subject, students: [{nama, nim, prodi}], startDate, endDate }
 * @returns {Promise<string>} - Relative path to the generated PDF
 */
async function generateAcceptanceLetter(data) {
    return new Promise((resolve, reject) => {
        try {
            // Margin 2:2 (2cm is approx 57 points)
            const margin = 57;
            const doc = new PDFDocument({
                size: 'A4',
                margin: 0
            });

            const fileName = `surat_balasan_${Date.now()}.pdf`;
            const uploadDir = path.join(__dirname, '../../public/uploads/surat_balasan');

            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const filePath = path.join(uploadDir, fileName);
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            let currentY = 50;
            const contentWidth = doc.page.width - (margin * 2);

            // Header Logo (Top Right)
            const logoPath = path.join(__dirname, '../../public/img/logotelkom.png');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, doc.page.width - margin - 170, 25, { width: 170 });
            }

            currentY = 110;

            // Header Info
            doc.font('Helvetica').fontSize(10).fillColor('#000');
            doc.text('Nomor', margin, currentY);
            doc.text(`: ${data.no_surat}`, margin + 70, currentY);

            currentY += 20;
            doc.text(`Padang, ${data.date || moment().format('D MMMM YYYY')}`, margin, currentY);

            currentY += 15;
            doc.text('Kepada', margin, currentY, { continued: true }).font('Helvetica-Bold').text('   Yth.');
            doc.text(data.recipient_name || 'Ketua Jurusan', margin + 70, currentY + 15);
            doc.text('di Padang', margin + 70, currentY + 30);

            currentY += 65;
            doc.font('Helvetica').text('Lampiran', margin, currentY);
            doc.text(': -', margin + 70, currentY);

            currentY += 15;
            doc.text('Perihal', margin, currentY);
            doc.font('Helvetica-Bold').text(`: ${data.subject}`, margin + 70, currentY, { width: contentWidth - 70 });

            currentY = doc.y + 35;

            // Body Paragraph 1
            doc.font('Helvetica').fontSize(10).text(`Menindaklanjuti Surat No. 353/UN16.15.3.2/HM.01.01/2025 tanggal 08 Oktober 2025 perihal Surat Permohonan Kerja Praktek Mahasiswa sebagai berikut :`, margin, currentY, {
                align: 'justify',
                lineGap: 3,
                width: contentWidth
            });

            currentY = doc.y + 15;

            // Table
            const col1 = margin;
            const col2 = margin + 35;
            const col3 = margin + 225;
            const col4 = margin + 345;

            doc.font('Helvetica-Bold');
            doc.rect(col1, currentY, contentWidth, 22).stroke();
            doc.text('NO', col1 + 8, currentY + 6);
            doc.text('Nama Siswa', col2, currentY + 6, { width: 190, align: 'center' });
            doc.text('NIM', col3, currentY + 6, { width: 120, align: 'center' });
            doc.text('Program Studi', col4, currentY + 6, { width: contentWidth - (col4 - margin), align: 'center' });

            // Vertical Lines
            doc.moveTo(col2, currentY).lineTo(col2, currentY + 22).stroke();
            doc.moveTo(col3, currentY).lineTo(col3, currentY + 22).stroke();
            doc.moveTo(col4, currentY).lineTo(col4, currentY + 22).stroke();

            currentY += 22;
            doc.font('Helvetica');

            data.students.forEach((s, i) => {
                const rowHeight = 22;
                doc.rect(col1, currentY, contentWidth, rowHeight).stroke();
                doc.text(`${i + 1}`, col1 + 12, currentY + 6);
                doc.text(s.nama, col2 + 10, currentY + 6);
                doc.text(s.nim || '-', col3 + 10, currentY + 6);
                doc.text(s.prodi, col4 + 10, currentY + 6);

                doc.moveTo(col2, currentY).lineTo(col2, currentY + rowHeight).stroke();
                doc.moveTo(col3, currentY).lineTo(col3, currentY + rowHeight).stroke();
                doc.moveTo(col4, currentY).lineTo(col4, currentY + rowHeight).stroke();
                currentY += rowHeight;
            });

            currentY += 20;
            doc.font('Helvetica-Bold').text(`Kerja Praktek Mahasiswa akan dilaksanakan pada tanggal : ${data.startDate} - ${data.endDate}`, margin, currentY);

            currentY += 25;
            doc.font('Helvetica').text(`Sehubungan dengan permohonan tersebut pada prinsipnya Kami dapat menyetujui mahasiswa tersebut untuk melaksanakan Kerja Praktek Mahasiswa di PT. Telkom Infrastruktur Indonesia (PT.TIF) District Sumbar. Adapun dalam Pelaksanaan kegiatan kerja praktek tersebut diharuskan melengkapi ketentuan persyaratan sebagai berikut :`, margin, currentY, {
                align: 'justify',
                lineGap: 3,
                width: contentWidth
            });

            currentY = doc.y + 10;

            // Bullet points
            const points = [
                'Membuat surat pernyataan dan surat kesediaan untuk tidak menggunakan dokumen PT. Telkom Infrastruktur Indonesia (PT. TIF) District Sumbar untuk kepentingan lain selain kegiatan izin kegiatan Kerja Praktek Mahasiswa dengan dibubuhi materai Rp 10.000,- sebagaimana tertera dalam lampiran surat ini.',
                'Pelaksanaan Kegiatan Izin kegiatan Kerja Praktek Mahasiswa berlangsung sesuai dengan jadwal terlampir di atas.',
                'Peserta Kerja Praktek Mahasiswa mentaati dan mengikuti segala Peraturan dan Tata Tertib yang berlaku di PT.Telkom Infrastruktur Indonesia (PT.TIF) District Sumbar sesuai dengan ketentuan yang berlaku.'
            ];

            points.forEach(p => {
                doc.circle(margin + 15, currentY + 5, 2).fill('#333');
                doc.font('Helvetica').text(p, margin + 30, currentY, { align: 'justify', lineGap: 1.5, width: contentWidth - 30 });
                currentY = doc.y + 5;
            });

            currentY += 10;
            doc.text('Demikian kami sampaikan atas perhatian dan kerjasamanya kami ucapkan terima kasih.', margin, currentY);

            currentY += 35;
            doc.text('Hormat Kami,', margin, currentY);

            currentY += 55;

            doc.font('Helvetica-Bold').text('AGUS FRIADI, M.M', margin, currentY, { underline: true });
            doc.font('Helvetica').fontSize(9).text('HEAD OF TELKOM INFRASTRUKTUR INDONESIA AREA SUMBAR & JAMBI', margin, currentY + 12);

            // --- HD VECTOR FOOTER ---
            const footerY = doc.page.height - 100;
            const footerHeight = 70;

            // 1. Left Graphic Block (Greenish/Gray)
            doc.rect(0, footerY + 15, 220, 60).fill('#7fa99c');

            // 2. Middle Address Section
            doc.fillColor('#000').font('Helvetica-Bold').fontSize(9).text('District Sumatera Barat', 235, footerY + 22);
            doc.text('PT Telkom Infrastruktur Indonesia', 235, footerY + 33);
            doc.font('Helvetica').fontSize(8.5).text('Jl. Kh. Ahmad Dahlan No. 17', 235, footerY + 44);
            doc.text('Padang - 25138', 235, footerY + 55);

            // 3. Right Graphic Blocks (Brown then Red)
            const rightBlocksX = 485;
            doc.rect(rightBlocksX, footerY + 15, 15, 60).fill('#5d4037'); // Brown
            doc.rect(rightBlocksX + 15, footerY + 15, 95, 60).fill('#e31937'); // Red

            // 4. Infranexia Logo (Using Logo Image - Centered)
            const footerLogoPath = path.join(__dirname, '../../public/img/logo N.png');
            if (fs.existsSync(footerLogoPath)) {
                // Red box: X=500, Y=footerY+15, Width=95, Height=60
                // For width 50: X = 500 + (95-50)/2 = 522.5
                // For height 50: Y = (footerY+15) + (60-50)/2 = footerY+20
                doc.image(footerLogoPath, rightBlocksX + 37.5, footerY + 20, { width: 50 });
            } else {
                doc.fillColor('#fff').font('Helvetica-Bold').fontSize(38).text('N', rightBlocksX + 40, footerY + 25);
            }

            doc.end();

            stream.on('finish', () => {
                resolve('/uploads/surat_balasan/' + fileName);
            });

            stream.on('error', (err) => {
                reject(err);
            });

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateAcceptanceLetter };
