import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { app } from '../app';
import { db } from '../config/db';
import { generateAccessToken } from '../utils/jwt.util';
import { arrivalFor, isServiceDate } from '../services/booking-time';
import { BookingInput } from '../services/booking.service';

async function run() {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const userIds: number[] = [];
  const storeIds: number[] = [];
  let checks = 0;
  async function request(path: string, expected: number, token = '', method = 'GET', payload?: unknown) {
    const response = await fetch(`${base}${path}`, { method, headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
    const body = await response.json() as { data: any; message?: string };
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(body)}`);
    checks++;
    return body.data;
  }
  try {
    assert.equal(isServiceDate('2028-02-30'), false);
    assert.equal(isServiceDate('2028-02-29'), true);
    assert.equal(arrivalFor('2028-10-17', '01:00', '18:00', '02:00').toISOString(), '2028-10-17T18:00:00.000Z');
    assert.throws(() => arrivalFor('2028-10-17', '02:00', '18:00', '02:00'));
    assert.throws(() => arrivalFor('2028-10-17', '12:00', '18:00', '02:00'));
    assert.equal(arrivalFor('2028-10-17', '10:00', '09:00', '17:00').toISOString(), '2028-10-17T03:00:00.000Z');
    const tokens: string[] = [];
    for (const role of ['owner', 'member', 'member', 'owner', 'member'] as const) {
      const [result] = await db.query<ResultSetHeader>(
        "INSERT INTO users (full_name, email, phone_number, role, account_status) VALUES ('Booking Test', ?, '0812345678', ?, 'ACTIVE')",
        [`booking-${randomUUID()}@example.com`, role]);
      userIds.push(result.insertId);
      tokens.push(generateAccessToken({ userId: result.insertId, role, sessionId: randomUUID() }));
    }
    const [categories] = await db.query<RowDataPacket[]>('SELECT category_id FROM store_categories LIMIT 1');
    for (let i = 0; i < 2; i++) {
      const [result] = await db.query<ResultSetHeader>(
        `INSERT INTO stores (owner_user_id, category_id, store_name, line_contact, phone, address,
         google_map_url, open_time, close_time, open_days_mask, business_license_url, status, approval_status)
         VALUES (?, ?, 'Booking Smoke Test', 'https://line.me/test', '0812345678', 'Test address',
         'https://maps.app.goo.gl/Test', '18:00', '02:00', 127, '', 'OPEN', 'APPROVED')`, [userIds[i ? 3 : 0], categories[0].category_id]);
      storeIds.push(result.insertId);
    }
    const [table] = await db.query<ResultSetHeader>("INSERT INTO store_tables (store_id, table_number, seat_capacity) VALUES (?, 'A1', 4)", [storeIds[0]]);
    const [extraTableA] = await db.query<ResultSetHeader>("INSERT INTO store_tables (store_id, table_number, seat_capacity) VALUES (?, 'A2', 2)", [storeIds[0]]);
    const [extraTableB] = await db.query<ResultSetHeader>("INSERT INTO store_tables (store_id, table_number, seat_capacity) VALUES (?, 'A3', 2)", [storeIds[0]]);
    const [otherTable] = await db.query<ResultSetHeader>("INSERT INTO store_tables (store_id, table_number, seat_capacity) VALUES (?, 'B1', 4)", [storeIds[1]]);
    const date = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const input: BookingInput = { storeId: storeIds[0], tableId: table.insertId, serviceDate: date, arrivalTime: '01:00', peopleCount: 4 };
    const availabilityPath = `/stores/${storeIds[0]}/availability?date=${date}&peopleCount=4`;
    const create = (expected: number, overrides: Partial<BookingInput> = {}, token = tokens[1]) => request('/bookings', expected, token, 'POST', { ...input, ...overrides });
    await request('/bookings', 401, '', 'POST', input);
    await create(422, { serviceDate: '2028-02-30' });
    await create(422, { arrivalTime: '02:00' });
    await create(422, { peopleCount: 5 });
    await create(422, { peopleCount: 1.5 });
    await db.query('UPDATE users SET phone_number = NULL WHERE user_id = ?', [userIds[1]]);
    await create(422);
    await db.query("UPDATE users SET phone_number = '0812345678' WHERE user_id = ?", [userIds[1]]);
    await create(409, { tableId: otherTable.insertId });
    await create(422, { serviceDate: '2020-01-01' });
    assert.equal((await request(availabilityPath, 200)).tables[0].state, 'AVAILABLE');
    const concurrent = await Promise.all([tokens[1], tokens[2]].map(async token => {
      const response = await fetch(`${base}/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(input) });
      return { status: response.status, body: await response.json() as { data: any } };
    }));
    assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]); checks++;
    const winnerIndex = concurrent.findIndex(r => r.status === 201);
    const winner = concurrent[winnerIndex].body.data;
    const winnerToken = tokens[winnerIndex + 1];
    const loserToken = tokens[winnerIndex === 0 ? 2 : 1];
    assert.equal(winner.status, 'CONFIRMED');
    const nextDay = new Date(`${date}T00:00:00Z`); nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    assert.equal(new Date(winner.arrivalAt).getTime(), new Date(`${nextDay.toISOString().slice(0, 10)}T01:00:00+07:00`).getTime());
    const [paid] = await db.query<RowDataPacket[]>('SELECT booking_price, total_price, slip_image, DATE_FORMAT(booking_date, \'%Y-%m-%d\') AS booking_date FROM booking WHERE booking_id = ?', [winner.id]);
    assert.equal(Number(paid[0].booking_price), 0); assert.equal(Number(paid[0].total_price), 0); assert.equal(paid[0].slip_image, null);
    assert.equal(paid[0].booking_date, nextDay.toISOString().slice(0, 10));
    const [columns] = await db.query<RowDataPacket[]>("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking' ORDER BY ORDINAL_POSITION");
    assert.deepEqual(columns.map(column => column.COLUMN_NAME), ['booking_id', 'user_id', 'store_id', 'table_id', 'booking_date', 'booking_time', 'people_count', 'booking_price', 'total_price', 'status', 'slip_image', 'created_at']);
    assert.equal((await request(availabilityPath, 200)).tables[0].state, 'BOOKED');
    await request(`/bookings/${winner.id}/cancel`, 404, loserToken, 'PATCH', {});
    assert.equal((await request('/bookings/mine', 200, loserToken)).length, 0);
    assert.equal((await request('/bookings/mine', 200, winnerToken))[0].id, winner.id);
    await request(`/owner/stores/${storeIds[0]}/bookings?date=${date}`, 403, tokens[1]);
    await request(`/owner/stores/${storeIds[0]}/bookings?date=${date}`, 404, tokens[3]);
    assert.equal((await request(`/owner/stores/${storeIds[0]}/bookings?date=${date}`, 200, tokens[0])).bookings.length, 1);
    await request(`/owner/stores/${storeIds[0]}/bookings/${winner.id}/status`, 404, tokens[3], 'PATCH', { status: 'CANCELLED' });
    await request(`/owner/stores/${storeIds[0]}/bookings/${winner.id}/status`, 409, tokens[0], 'PATCH', { status: 'COMPLETED' });
    await request(`/owner/stores/${storeIds[0]}/tables/${table.insertId}`, 409, tokens[0], 'DELETE');
    await request(`/owner/stores/${storeIds[0]}`, 409, tokens[0], 'DELETE');
    await request(`/bookings/${winner.id}/cancel`, 200, winnerToken, 'PATCH', {});
    assert.equal((await request(availabilityPath, 200)).tables[0].state, 'AVAILABLE');
    const created = await request('/bookings', 201, tokens[1], 'POST', input);
    const replay = await request('/bookings', 201, tokens[1], 'POST', input);
    assert.equal(created.id, replay.id);
    await request('/bookings', 409, tokens[1], 'POST', { ...input, peopleCount: 3 });
    await create(409, { arrivalTime: '20:00' });
    await db.query("UPDATE booking SET booking_date = '2020-01-01' WHERE booking_id = ?", [created.id]);
    await request(`/bookings/${created.id}/cancel`, 409, tokens[1], 'PATCH', {});
    await request(`/owner/stores/${storeIds[0]}/bookings/${created.id}/status`, 200, tokens[0], 'PATCH', { status: 'COMPLETED' });
    await db.query('UPDATE booking SET booking_date = ? WHERE booking_id = ?', [nextDay.toISOString().slice(0, 10), created.id]);
    assert.equal((await request(availabilityPath, 200)).tables[0].state, 'BOOKED');
    await create(409);
    await request(`/owner/stores/${storeIds[0]}/bookings/${created.id}/status`, 409, tokens[0], 'PATCH', { status: 'CANCELLED' });
    const second = { storeId: storeIds[1], tableId: otherTable.insertId };
    await db.query('INSERT INTO setting (store_id, is_booking_enabled, cancel_before_days) VALUES (?, 0, 30)', [storeIds[1]]);
    await create(409, second);
    await db.query('UPDATE setting SET is_booking_enabled = 1 WHERE store_id = ?', [storeIds[1]]);
    await db.query('INSERT INTO close_setting (store_id, start_date, end_date) VALUES (?, ?, ?)', [storeIds[1], date, date]);
    await create(409, second);
    await db.query('DELETE FROM close_setting WHERE store_id = ?', [storeIds[1]]);
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
    await db.query('UPDATE stores SET open_days_mask = ? WHERE store_id = ?', [127 & ~(1 << weekday), storeIds[1]]);
    await create(409, second);
    await db.query("UPDATE stores SET open_days_mask = 127, status = 'CLOSED' WHERE store_id = ?", [storeIds[1]]);
    await create(409, second);
    await db.query("UPDATE stores SET status = 'OPEN' WHERE store_id = ?", [storeIds[1]]);
    await db.query("UPDATE store_tables SET status = 'INACTIVE' WHERE table_id = ?", [otherTable.insertId]);
    await create(409, second);
    await db.query("UPDATE store_tables SET status = 'ACTIVE' WHERE table_id = ?", [otherTable.insertId]);
    await create(409, second);
    const lateCancel = await create(201, second, tokens[4]);
    await request(`/bookings/${lateCancel.id}/cancel`, 409, tokens[4], 'PATCH', {});
    await request(`/owner/stores/${storeIds[1]}/bookings/${lateCancel.id}/status`, 200, tokens[3], 'PATCH', { status: 'CANCELLED' });
    assert.equal((await create(201, second, tokens[4])).status, 'CONFIRMED');
    const multiInput = { storeId: storeIds[0], tableIds: [extraTableA.insertId, extraTableB.insertId],
      serviceDate: date, arrivalTime: '20:00', peopleCount: 4 };
    await request('/bookings', 422, tokens[2], 'POST', { ...multiInput, tableIds: [extraTableA.insertId, extraTableA.insertId] });
    await request('/bookings', 409, tokens[2], 'POST', { ...multiInput, tableIds: [extraTableA.insertId, table.insertId] });
    const multi = await request('/bookings', 201, tokens[2], 'POST', multiInput);
    assert.equal(multi.tableNumber, 'A2, A3');
    assert.equal(multi.tableCount, 2);
    assert.equal(multi.peopleCount, 4);
    const [extraRows] = await db.query<RowDataPacket[]>('SELECT table_id FROM booking_extra_tables WHERE booking_id = ?', [multi.id]);
    assert.deepEqual(extraRows.map(row => Number(row.table_id)), [extraTableB.insertId]);
    assert.equal((await request('/bookings', 201, tokens[2], 'POST', multiInput)).id, multi.id);
    await request('/bookings', 409, tokens[1], 'POST', { ...multiInput, tableIds: [extraTableB.insertId], peopleCount: 1 });
    const multiAvailability = await request(`/stores/${storeIds[0]}/availability?date=${date}&peopleCount=2`, 200);
    assert.equal(multiAvailability.tables.find((row: { id: number }) => row.id === extraTableA.insertId).state, 'BOOKED');
    assert.equal(multiAvailability.tables.find((row: { id: number }) => row.id === extraTableB.insertId).state, 'BOOKED');
    await request(`/owner/stores/${storeIds[0]}/tables/${extraTableB.insertId}`, 409, tokens[0], 'DELETE');
    await request(`/bookings/${multi.id}/cancel`, 200, tokens[2], 'PATCH', {});
    const freed = await request(`/stores/${storeIds[0]}/availability?date=${date}&peopleCount=2`, 200);
    assert.equal(freed.tables.find((row: { id: number }) => row.id === extraTableA.insertId).state, 'AVAILABLE');
    assert.equal(freed.tables.find((row: { id: number }) => row.id === extraTableB.insertId).state, 'AVAILABLE');
    const [otherFreeTable] = await db.query<ResultSetHeader>(
      "INSERT INTO store_tables (store_id, table_number, seat_capacity) VALUES (?, 'B2', 2)", [storeIds[1]]);
    const sameMember = await Promise.all([
      { ...input, tableId: extraTableA.insertId, arrivalTime: '20:00', peopleCount: 2 },
      { ...input, storeId: storeIds[1], tableId: otherFreeTable.insertId, arrivalTime: '20:00', peopleCount: 2 },
    ].map(async body => {
      const response = await fetch(`${base}/bookings`, { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${tokens[2]}` }, body: JSON.stringify(body) });
      return response.status;
    }));
    assert.deepEqual(sameMember.sort(), [201, 409]); checks++;
    console.log(`Booking smoke passed: ${checks} API/concurrency checks plus date, payment, privacy and idempotency assertions.`);
  } finally {
    try {
      for (const storeId of storeIds) {
        await db.query('DELETE FROM booking WHERE store_id = ?', [storeId]);
        await db.query('DELETE FROM stores WHERE store_id = ?', [storeId]);
      }
      for (const userId of userIds) await db.query('DELETE FROM users WHERE user_id = ?', [userId]);
    } finally {
      server.close(); await once(server, 'close'); await db.end();
    }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
