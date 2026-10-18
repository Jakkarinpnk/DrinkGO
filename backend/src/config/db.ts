import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const db = mysql.createPool({
  host: requireEnv('DB_HOST'),
  port: Number(process.env.DB_PORT || 3306),
  user: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_NAME'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
});

export const verifyDatabaseConnection = async (): Promise<void> => {
  const connection = await db.getConnection();
  try {
    await connection.query('SELECT 1');
  } finally {
    connection.release();
  }
};
