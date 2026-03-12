-- Add divisi_penempatan column to pendaftaran table
ALTER TABLE pendaftaran ADD COLUMN divisi_penempatan VARCHAR(255) DEFAULT NULL AFTER jurusan;
