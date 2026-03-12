const db = require('../confiq/database');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, BorderStyle, HeadingLevel } = require('docx');

// Helper: get internship dates for user
async function getInternshipDates(userId) {
    const [pendaftaran] = await db.query(
        'SELECT waktu_mulai, waktu_selesai, nama_lengkap, instansi, jurusan, bidang FROM pendaftaran WHERE user_id = ? AND status = "diterima" ORDER BY created_at DESC LIMIT 1',
        [userId]
    );
    return pendaftaran.length > 0 ? pendaftaran[0] : null;
}

// Helper: format date to Indonesian
function formatDateID(dateStr) {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const parts = dateStr.split('-');
    return `${String(parseInt(parts[2])).padStart(2, '0')} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

// Show logbook list
exports.showLogbook = async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Get user data
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

        // Get internship dates
        const pendaftaran = await getInternshipDates(userId);

        // Get logbook entries - use DATE_FORMAT to avoid timezone issues
        const [entries] = await db.query(
            `SELECT id, user_id, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal, kegiatan, created_at 
             FROM logbook WHERE user_id = ? ORDER BY tanggal ASC, id ASC`,
            [userId]
        );

        res.render('pemagang/report/logbook', {
            title: 'Logbook - Infranexia',
            currentPage: 'logbook',
            user: users[0],
            entries: entries,
            pendaftaran: pendaftaran
        });

    } catch (error) {
        console.error('Show logbook error:', error);
        res.status(500).send(`Terjadi kesalahan: ${error.message}`);
    }
};

// Show add form
exports.showAddForm = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

        // Get internship dates for date constraints
        const pendaftaran = await getInternshipDates(userId);

        if (!pendaftaran) {
            return res.redirect('/pemagang/logbook');
        }

        res.render('pemagang/report/add-logbook', {
            title: 'Tambah Logbook - Infranexia',
            currentPage: 'logbook',
            user: users[0],
            entry: null,
            pendaftaran: pendaftaran
        });

    } catch (error) {
        console.error('Show add form error:', error);
        res.status(500).send(`Terjadi kesalahan: ${error.message}`);
    }
};

// Add new entry
exports.addEntry = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { tanggal, kegiatan } = req.body;

        if (!tanggal || !kegiatan) {
            return res.status(400).json({ success: false, message: 'Tanggal dan Kegiatan wajib diisi' });
        }

        // Get internship dates
        const pendaftaran = await getInternshipDates(userId);

        if (!pendaftaran) {
            return res.status(400).json({
                success: false,
                message: 'Anda belum memiliki pendaftaran magang yang diterima'
            });
        }

        // Check if date is within internship period
        const waktuMulai = new Date(pendaftaran.waktu_mulai).toISOString().split('T')[0];
        const waktuSelesai = new Date(pendaftaran.waktu_selesai).toISOString().split('T')[0];

        if (tanggal < waktuMulai || tanggal > waktuSelesai) {
            return res.status(400).json({
                success: false,
                message: `Logbook hanya dapat diisi untuk tanggal dalam periode magang (${formatDateID(waktuMulai)} - ${formatDateID(waktuSelesai)})`
            });
        }

        // Check if selected date is a weekend (Saturday=6, Sunday=0)
        const [year, month, day] = tanggal.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        const dayOfWeek = selectedDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return res.status(400).json({
                success: false,
                message: 'Logbook hanya dapat diisi untuk hari kerja (Senin - Jumat)'
            });
        }

        // Check if logbook already exists for this date
        const [existing] = await db.query(
            'SELECT id FROM logbook WHERE user_id = ? AND tanggal = ?',
            [userId, tanggal]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Anda sudah mengisi logbook untuk tanggal ini. Silakan edit entri yang sudah ada jika ingin mengubahnya.'
            });
        }

        await db.query(
            'INSERT INTO logbook (user_id, tanggal, kegiatan) VALUES (?, ?, ?)',
            [userId, tanggal, kegiatan]
        );

        // Auto-complete status check
        const [pendaftaranAll] = await db.query(
            'SELECT id, waktu_mulai, waktu_selesai FROM pendaftaran WHERE user_id = ? AND status = "diterima"',
            [userId]
        );

        if (pendaftaranAll.length > 0) {
            const p = pendaftaranAll[0];
            if (p.waktu_mulai && p.waktu_selesai) {
                const start = new Date(p.waktu_mulai);
                const end = new Date(p.waktu_selesai);
                const targetDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

                const [countResult] = await db.query(
                    'SELECT COUNT(*) as count FROM logbook WHERE user_id = ?',
                    [userId]
                );

                if (countResult[0].count >= targetDays) {
                    await db.query(
                        'UPDATE pendaftaran SET status = "selesai" WHERE id = ?',
                        [p.id]
                    );
                }
            }
        }

        res.json({ success: true, message: 'Logbook berhasil ditambahkan' });

    } catch (error) {
        console.error('Add logbook error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Show edit form
exports.showEditForm = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { id } = req.params;

        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const [entries] = await db.query(
            `SELECT id, user_id, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal, kegiatan, created_at 
             FROM logbook WHERE id = ? AND user_id = ?`,
            [id, userId]
        );

        if (entries.length === 0) {
            return res.redirect('/pemagang/logbook');
        }

        // Get internship dates for date constraints
        const pendaftaran = await getInternshipDates(userId);

        res.render('pemagang/report/add-logbook', {
            title: 'Edit Logbook - Infranexia',
            currentPage: 'logbook',
            user: users[0],
            entry: entries[0],
            pendaftaran: pendaftaran
        });

    } catch (error) {
        console.error('Show edit form error:', error);
        res.status(500).send(`Terjadi kesalahan: ${error.message}`);
    }
};

// Update entry
exports.updateEntry = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { id } = req.params;
        const { tanggal, kegiatan } = req.body;

        // Get internship dates
        const pendaftaran = await getInternshipDates(userId);

        if (pendaftaran) {
            const waktuMulai = new Date(pendaftaran.waktu_mulai).toISOString().split('T')[0];
            const waktuSelesai = new Date(pendaftaran.waktu_selesai).toISOString().split('T')[0];

            if (tanggal < waktuMulai || tanggal > waktuSelesai) {
                return res.status(400).json({
                    success: false,
                    message: `Logbook hanya dapat diisi untuk tanggal dalam periode magang (${formatDateID(waktuMulai)} - ${formatDateID(waktuSelesai)})`
                });
            }
        }

        // Check if selected date is a weekend
        const [year, month, day] = tanggal.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        const dayOfWeek = selectedDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return res.status(400).json({
                success: false,
                message: 'Logbook hanya dapat diisi untuk hari kerja (Senin - Jumat)'
            });
        }

        await db.query(
            'UPDATE logbook SET tanggal = ?, kegiatan = ? WHERE id = ? AND user_id = ?',
            [tanggal, kegiatan, id, userId]
        );

        res.json({ success: true, message: 'Logbook berhasil diperbarui' });

    } catch (error) {
        console.error('Update logbook error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete entry
exports.deleteEntry = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { id } = req.params;

        await db.query(
            'DELETE FROM logbook WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        res.json({ success: true, message: 'Logbook berhasil dihapus' });

    } catch (error) {
        console.error('Delete logbook error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Export to PDF
exports.exportPDF = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];
        const pendaftaran = await getInternshipDates(userId);

        const [entries] = await db.query(
            `SELECT DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal, kegiatan 
             FROM logbook WHERE user_id = ? ORDER BY tanggal ASC, id ASC`,
            [userId]
        );

        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Logbook_${user.nama_depan}_${user.nama_belakang || ''}.pdf`);
        doc.pipe(res);

        // === HEADER ===
        doc.fontSize(18).font('Helvetica-Bold').text('LOGBOOK MAGANG', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text('PT Infranexia / Telkom Indonesia', { align: 'center' });
        doc.moveDown(1.5);

        // === SEPARATOR LINE ===
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#E31937');
        doc.moveDown(1);

        // === INFO PEMAGANG ===
        const infoStartY = doc.y;
        const labelX = 50;
        const sepX = 200;
        const valueX = 215;

        const namaLengkap = `${user.nama_depan} ${user.nama_belakang || ''}`.trim();
        const institusi = user.institusi || '-';
        const jurusan = pendaftaran ? (pendaftaran.jurusan || '-') : '-';
        const bidang = pendaftaran ? (pendaftaran.bidang || '-') : '-';

        let periodeMagang = '-';
        if (pendaftaran) {
            const mulai = new Date(pendaftaran.waktu_mulai).toISOString().split('T')[0];
            const selesai = new Date(pendaftaran.waktu_selesai).toISOString().split('T')[0];
            periodeMagang = `${formatDateID(mulai)} - ${formatDateID(selesai)}`;
        }

        const infoRows = [
            ['Nama', namaLengkap],
            ['Perguruan Tinggi', institusi],
            ['Jurusan', jurusan],
            ['Bidang', bidang],
            ['Periode Magang', periodeMagang],
            ['Instansi', 'Infranexia']
        ];

        doc.font('Helvetica');
        infoRows.forEach(([label, value]) => {
            doc.fontSize(11).font('Helvetica-Bold').text(label, labelX, doc.y, { continued: false });
            const currentY = doc.y - 15;
            doc.font('Helvetica').text(`:  ${value}`, sepX, currentY);
        });

        doc.moveDown(1.5);

        // === TABLE HEADER ===
        const tableTop = doc.y;
        const colNo = 50;
        const colTanggal = 90;
        const colKegiatan = 220;
        const tableRight = 545;
        const rowHeight = 30;

        // Header row background
        doc.rect(colNo, tableTop, tableRight - colNo, rowHeight).fill('#E31937');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
        doc.text('No', colNo, tableTop + 9, { width: colTanggal - colNo, align: 'center' });
        doc.text('Tanggal', colTanggal, tableTop + 9, { width: colKegiatan - colTanggal, align: 'center' });
        doc.text('Kegiatan', colKegiatan, tableTop + 9, { width: tableRight - colKegiatan, align: 'center' });

        // === TABLE ROWS ===
        doc.fillColor('#1a1a1a').font('Helvetica').fontSize(10);
        let currentY = tableTop + rowHeight;

        entries.forEach((entry, index) => {
            const kegiatanText = entry.kegiatan;
            // Calculate text height for kegiatan
            const textHeight = doc.heightOfString(kegiatanText, { width: tableRight - colKegiatan - 20 });
            const dynamicRowHeight = Math.max(rowHeight, textHeight + 16);

            // Check if we need a new page
            if (currentY + dynamicRowHeight > 750) {
                doc.addPage();
                currentY = 50;
                // Redraw table header on new page
                doc.rect(colNo, currentY, tableRight - colNo, rowHeight).fill('#E31937');
                doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
                doc.text('No', colNo, currentY + 9, { width: colTanggal - colNo, align: 'center' });
                doc.text('Tanggal', colTanggal, currentY + 9, { width: colKegiatan - colTanggal, align: 'center' });
                doc.text('Kegiatan', colKegiatan, currentY + 9, { width: tableRight - colKegiatan, align: 'center' });
                doc.fillColor('#1a1a1a').font('Helvetica').fontSize(10);
                currentY += rowHeight;
            }

            // Row zebra stripe
            if (index % 2 === 0) {
                doc.rect(colNo, currentY, tableRight - colNo, dynamicRowHeight).fill('#f8fafc');
                doc.fillColor('#1a1a1a');
            }

            // Draw borders
            doc.rect(colNo, currentY, tableRight - colNo, dynamicRowHeight).stroke('#e2e8f0');

            // Cell content
            doc.text(String(index + 1), colNo, currentY + 8, { width: colTanggal - colNo, align: 'center' });
            doc.text(formatDateID(entry.tanggal), colTanggal + 5, currentY + 8, { width: colKegiatan - colTanggal - 10 });
            doc.text(kegiatanText, colKegiatan + 10, currentY + 8, { width: tableRight - colKegiatan - 20 });

            currentY += dynamicRowHeight;
        });

        if (entries.length === 0) {
            doc.rect(colNo, currentY, tableRight - colNo, rowHeight).stroke('#e2e8f0');
            doc.text('Belum ada catatan logbook', colNo, currentY + 9, { width: tableRight - colNo, align: 'center' });
        }

        // === FOOTER ===
        doc.moveDown(3);
        const footerY = currentY + 40 > 700 ? 100 : currentY + 40;
        if (currentY + 100 > 750) {
            doc.addPage();
        }

        doc.fontSize(10).font('Helvetica').text(`Total Entri Logbook: ${entries.length}`, 50, doc.y + 20);

        doc.end();

    } catch (error) {
        console.error('Export PDF error:', error);
        res.status(500).send('Terjadi kesalahan saat membuat PDF');
    }
};

// Export to Word (DOCX)
exports.exportWord = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];
        const pendaftaran = await getInternshipDates(userId);

        const [entries] = await db.query(
            `SELECT DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal, kegiatan 
             FROM logbook WHERE user_id = ? ORDER BY tanggal ASC, id ASC`,
            [userId]
        );

        const namaLengkap = `${user.nama_depan} ${user.nama_belakang || ''}`.trim();
        const institusi = user.institusi || '-';
        const jurusan = pendaftaran ? (pendaftaran.jurusan || '-') : '-';
        const bidang = pendaftaran ? (pendaftaran.bidang || '-') : '-';

        let periodeMagang = '-';
        if (pendaftaran) {
            const mulai = new Date(pendaftaran.waktu_mulai).toISOString().split('T')[0];
            const selesai = new Date(pendaftaran.waktu_selesai).toISOString().split('T')[0];
            periodeMagang = `${formatDateID(mulai)} - ${formatDateID(selesai)}`;
        }

        // Build info rows as paragraphs
        const infoData = [
            ['Nama', namaLengkap],
            ['Perguruan Tinggi', institusi],
            ['Jurusan', jurusan],
            ['Bidang', bidang],
            ['Periode Magang', periodeMagang],
            ['Instansi', 'Infranexia']
        ];

        const infoParagraphs = infoData.map(([label, value]) => {
            return new Paragraph({
                spacing: { after: 80 },
                children: [
                    new TextRun({ text: `${label}`, bold: true, size: 22, font: 'Calibri' }),
                    new TextRun({ text: `  :  ${value}`, size: 22, font: 'Calibri' }),
                ],
            });
        });

        // Build table
        const borderStyle = {
            style: BorderStyle.SINGLE,
            size: 1,
            color: '999999',
        };
        const tableBorders = {
            top: borderStyle,
            bottom: borderStyle,
            left: borderStyle,
            right: borderStyle,
        };

        // Table header row
        const headerRow = new TableRow({
            tableHeader: true,
            children: [
                new TableCell({
                    borders: tableBorders,
                    shading: { fill: 'E31937' },
                    width: { size: 800, type: WidthType.DXA },
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'No', bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })]
                    })],
                }),
                new TableCell({
                    borders: tableBorders,
                    shading: { fill: 'E31937' },
                    width: { size: 2500, type: WidthType.DXA },
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'Tanggal', bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })]
                    })],
                }),
                new TableCell({
                    borders: tableBorders,
                    shading: { fill: 'E31937' },
                    width: { size: 6200, type: WidthType.DXA },
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'Kegiatan', bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })]
                    })],
                }),
            ],
        });

        // Table data rows
        const dataRows = entries.map((entry, index) => {
            const rowShading = index % 2 === 0 ? { fill: 'F8FAFC' } : {};
            return new TableRow({
                children: [
                    new TableCell({
                        borders: tableBorders,
                        shading: rowShading,
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: String(index + 1), size: 20, font: 'Calibri' })]
                        })],
                    }),
                    new TableCell({
                        borders: tableBorders,
                        shading: rowShading,
                        children: [new Paragraph({
                            children: [new TextRun({ text: formatDateID(entry.tanggal), size: 20, font: 'Calibri' })]
                        })],
                    }),
                    new TableCell({
                        borders: tableBorders,
                        shading: rowShading,
                        children: [new Paragraph({
                            children: [new TextRun({ text: entry.kegiatan, size: 20, font: 'Calibri' })]
                        })],
                    }),
                ],
            });
        });

        // If no entries, add empty row
        if (entries.length === 0) {
            dataRows.push(new TableRow({
                children: [
                    new TableCell({
                        borders: tableBorders,
                        columnSpan: 3,
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: 'Belum ada catatan logbook', size: 20, font: 'Calibri', italics: true, color: '999999' })]
                        })],
                    }),
                ],
            }));
        }

        const table = new Table({
            width: { size: 9500, type: WidthType.DXA },
            rows: [headerRow, ...dataRows],
        });

        // Build document
        const docx = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
                    },
                },
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 100 },
                        children: [
                            new TextRun({ text: 'LOGBOOK MAGANG', bold: true, size: 36, font: 'Calibri' }),
                        ],
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                        children: [
                            new TextRun({ text: 'PT Infranexia / Telkom Indonesia', size: 24, font: 'Calibri' }),
                        ],
                    }),
                    // Separator
                    new Paragraph({
                        spacing: { after: 200 },
                        border: {
                            bottom: { style: BorderStyle.SINGLE, size: 3, color: 'E31937' },
                        },
                        children: [],
                    }),
                    ...infoParagraphs,
                    new Paragraph({ spacing: { after: 200 }, children: [] }),
                    table,
                    new Paragraph({ spacing: { before: 300 }, children: [] }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Total Entri Logbook: ${entries.length}`, size: 20, font: 'Calibri', italics: true }),
                        ],
                    }),
                ],
            }],
        });

        const buffer = await Packer.toBuffer(docx);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=Logbook_${user.nama_depan}_${user.nama_belakang || ''}.docx`);
        res.send(buffer);

    } catch (error) {
        console.error('Export Word error:', error);
        res.status(500).send('Terjadi kesalahan saat membuat dokumen Word');
    }
};
