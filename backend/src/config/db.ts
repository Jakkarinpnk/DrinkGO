// โครงสร้างมาตรฐานสำหรับ src/config/db.ts (ใช้ไลบรารี mysql2)
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'drinkgo',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'table_booking_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});