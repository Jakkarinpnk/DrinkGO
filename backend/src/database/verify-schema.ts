import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const expectedTables = [
  'admins', 'booking', 'booking_extra_tables', 'close_setting',
  'password_resets', 'promotion', 'reports', 'review',
  'schema_migrations', 'setting', 'store_categories', 'store_menu_files',
  'store_photo', 'store_tables', 'stores', 'users',
].sort();

const expectedColumns: Record<string, string[]> = {
  users: [
    'user_id', 'full_name', 'email', 'password_hash', 'phone_number',
    'profile_image', 'google_id', 'role', 'account_status', 'last_activity_at', 'created_at',
  ],
  admins: [
    'admin_id', 'full_name', 'email', 'password_hash', 'phone_number',
    'profile_image', 'created_at',
  ],
  password_resets: [
    'id', 'user_id', 'otp_hash', 'expires_at', 'attempt_count', 'created_at',
  ],
  stores: [
    'store_id', 'owner_user_id', 'category_id', 'store_name', 'line_contact',
    'phone', 'address', 'google_map_url', 'description', 'open_time', 'close_time', 'open_days_mask',
    'business_license_url', 'layout_image_url', 'status', 'approval_status', 'created_at',
  ],
  store_categories: ['category_id', 'category_name'],
  store_photo: [
    'photo_id', 'store_id', 'file_url', 'is_cover',
  ],
  store_menu_files: ['menu_file_id', 'store_id', 'file_url'],
  store_tables: [
    'table_id', 'store_id', 'table_number', 'seat_capacity', 'status',
    'position_x', 'position_y', 'created_at',
  ],
  setting: [
    'setting_id', 'store_id', 'booking_price', 'cancel_before_days',
    'is_booking_enabled', 'cancellation_policy_text', 'booking_policy_text',
  ],
  close_setting: [
    'close_setting_id', 'store_id', 'start_date', 'end_date', 'note', 'created_at',
  ],
  booking: ['booking_id', 'user_id', 'store_id', 'table_id', 'booking_date', 'booking_time',
    'people_count', 'booking_price', 'total_price', 'status', 'slip_image', 'created_at'],
  booking_extra_tables: ['booking_id', 'table_id'],
  promotion: ['promotion_id', 'store_id', 'promotion_name', 'description', 'discount_amount',
    'start_date', 'end_date', 'is_active', 'created_at'],
  reports: ['report_id', 'user_id', 'store_id', 'booking_id', 'detail',
    'report_date', 'response_date', 'response_detail'],
  review: ['review_id', 'booking_id', 'user_id', 'store_id', 'rating', 'review_text',
    'review_date', 'response', 'response_date'],
};

async function verifySchema(): Promise<void> {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [tableRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       ORDER BY TABLE_NAME`,
    );
    const actualTables = tableRows.map(row => String(row.TABLE_NAME)).sort();
    const missingTables = expectedTables.filter(table => !actualTables.includes(table));
    const unexpectedTables = actualTables.filter(table => !expectedTables.includes(table));
    if (missingTables.length) throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    if (unexpectedTables.length) throw new Error(`Unused tables remain: ${unexpectedTables.join(', ')}`);

    for (const [table, expected] of Object.entries(expectedColumns)) {
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [table],
      );
      const actual = rows.map(row => String(row.COLUMN_NAME));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${table} columns do not match: ${actual.join(', ')}`);
      }
    }

    const [typedColumns] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND ((TABLE_NAME = 'users' AND COLUMN_NAME = 'role')
           OR (TABLE_NAME = 'stores' AND COLUMN_NAME = 'approval_status'))`,
    );
    const roleColumn = typedColumns.find(row => row.TABLE_NAME === 'users');
    if (!roleColumn || String(roleColumn.COLUMN_TYPE) !== "enum('member','owner')") {
      throw new Error("users.role must be ENUM('member','owner')");
    }
    const approvalColumn = typedColumns.find(row => row.TABLE_NAME === 'stores');
    if (!approvalColumn || String(approvalColumn.COLUMN_TYPE) !== "enum('PENDING','APPROVED','REJECTED')") {
      throw new Error("stores.approval_status must be ENUM('PENDING','APPROVED','REJECTED')");
    }
    const [bookingTypes] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking'`,
    );
    const requiredBookingTypes: Record<string, string> = {
      booking_date: 'date', booking_time: 'time', people_count: 'int',
      booking_price: 'decimal(10,2)', total_price: 'decimal(10,2)',
      status: "enum('PENDING','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW')",
      slip_image: 'varchar(255)', created_at: 'timestamp',
    };
    for (const [name, expected] of Object.entries(requiredBookingTypes)) {
      const column = bookingTypes.find(row => row.COLUMN_NAME === name);
      const actual = expected === 'int' ? column?.DATA_TYPE : column?.COLUMN_TYPE;
      if (actual !== expected) throw new Error(`booking.${name} type must be ${expected}, found ${actual}`);
    }
    const [emptyLocations] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM stores WHERE TRIM(google_map_url) = ''",
    );
    if (Number(emptyLocations[0].count) > 0) throw new Error('Some stores have an empty Google Maps link');

    const [foreignKeyRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS count
       FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE()`,
    );
    console.log(`Schema verified: ${actualTables.length} active tables`);
    console.log(`Foreign keys: ${foreignKeyRows[0].count}`);
    console.log('Account, store, booking and supporting columns match the current models');
  } finally {
    await connection.end();
  }
}

verifySchema().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
