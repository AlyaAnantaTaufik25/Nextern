-- Create holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tanggal DATE NOT NULL UNIQUE,
    nama VARCHAR(255) NOT NULL,
    keterangan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tanggal (tanggal)
);

-- Insert Indonesia public holidays 2026
INSERT INTO holidays (tanggal, nama, keterangan) VALUES
('2026-01-01', 'Tahun Baru 2026', 'Libur Nasional'),
('2026-02-17', 'Isra Mikraj', 'Libur Nasional'),
('2026-03-11', 'Nyepi', 'Libur Nasional'),
('2026-03-31', 'Wafat Isa Almasih', 'Libur Nasional'),
('2026-04-02', 'Idul Fitri 1447 H', 'Libur Nasional'),
('2026-04-03', 'Idul Fitri 1447 H', 'Libur Nasional'),
('2026-05-01', 'Hari Buruh', 'Libur Nasional'),
('2026-05-14', 'Kenaikan Isa Almasih', 'Libur Nasional'),
('2026-06-01', 'Hari Lahir Pancasila', 'Libur Nasional'),
('2026-06-09', 'Idul Adha 1447 H', 'Libur Nasional'),
('2026-06-30', 'Tahun Baru Islam 1448 H', 'Libur Nasional'),
('2026-08-17', 'Hari Kemerdekaan RI', 'Libur Nasional'),
('2026-09-08', 'Maulid Nabi Muhammad SAW', 'Libur Nasional'),
('2026-12-25', 'Hari Raya Natal', 'Libur Nasional')
ON DUPLICATE KEY UPDATE nama=VALUES(nama);
