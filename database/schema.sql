-- NEXtern Database Schema
-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_depan VARCHAR(100) NOT NULL,
    nama_belakang VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    no_telepon VARCHAR(20),
    institusi VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    foto_profil VARCHAR(500),
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foto_profil column if table already exists
-- ALTER TABLE users ADD COLUMN foto_profil VARCHAR(500) AFTER password;

-- Create pendaftaran table
CREATE TABLE IF NOT EXISTS pendaftaran (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    nama_lengkap VARCHAR(255) NOT NULL,
    instansi VARCHAR(255),
    bidang VARCHAR(100),
    jurusan VARCHAR(255),
    waktu_mulai DATE,
    waktu_selesai DATE,
    surat_pengantar VARCHAR(500),
    status ENUM('formulir', 'verifikasi', 'diterima', 'ditolak', 'selesai') DEFAULT 'formulir',
    catatan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
