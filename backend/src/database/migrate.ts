import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const databaseName = process.env.DB_NAME!;
if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error('DB_NAME may contain only letters, numbers, and underscores');
}

const migrationsDirectory = path.resolve(__dirname, '../../../database/migrations');

async function migrate(): Promise<void> {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    charset: 'utf8mb4',
    multipleStatements: true,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${databaseName}\``);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        filename VARCHAR(255) NOT NULL,
        checksum CHAR(64) NOT NULL,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_schema_migrations_filename (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const filenames = (await fs.readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .sort();

    for (const filename of filenames) {
      const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT checksum FROM schema_migrations WHERE filename = ?',
        [filename],
      );

      if (rows.length > 0) {
        if (rows[0].checksum !== checksum) {
          throw new Error(`Applied migration was modified: ${filename}`);
        }
        console.log(`Skipped ${filename} (already applied)`);
        continue;
      }

      console.log(`Applying ${filename}`);
      await connection.query(sql);
      await connection.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)',
        [filename, checksum],
      );
      console.log(`Applied ${filename}`);
    }

    console.log('Database migrations completed successfully');
  } finally {
    await connection.end();
  }
}

migrate().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

