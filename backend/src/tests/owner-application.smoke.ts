import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { once } from 'events';
import { AddressInfo } from 'net';
import mysql from 'mysql2/promise';
import { app } from '../app';
import { db } from '../config/db';

dotenv.config();

interface ApiBody {
  message?: string;
  error?: { code?: string };
  data?: unknown;
}

interface AuthenticationData {
  accessToken: string;
  refreshToken: string;
  user: { id: number; role: string };
}

interface ApplicationData {
  id: number;
  status: string;
  applicant: { id: number; role: string };
  document: { originalName: string };
  store: { id: number; googleMapUrl: string; category: { id: number }; hours: typeof defaultHours; coverImageUrl: string | null; images: { id: number; url: string; isCover: boolean }[]; menuFiles: { id: number; url: string }[] };
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const memberEmail = `owner-app-member-${suffix}@example.com`;
const adminEmail = `owner-app-admin-${suffix}@example.com`;
const otherEmail = `owner-app-other-${suffix}@example.com`;
const password = 'OwnerApplication!123';
let baseUrl = '';
let categoryId = 0;
const defaultHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isClosed: false, openTime: '19:00', closeTime: '02:00', closesNextDay: true }));
const selectedRegistrationHours = defaultHours.map(hour => hour.dayOfWeek < 2
  ? { ...hour, isClosed: true, openTime: null, closeTime: null, closesNextDay: false }
  : hour);
const validPng = { buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64'), type: 'image/png', name: 'store.png' };
const validMenuPdf = { buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'), type: 'application/pdf', name: 'food-menu.pdf' };

const jsonRequest = async (
  endpoint: string,
  init: RequestInit,
): Promise<{ status: number; body: ApiBody }> => {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
};

const submitApplication = async (
  accessToken: string,
  filename: string,
  storeName = 'Owner Application Smoke Store',
  googleMapUrl = 'https://maps.app.goo.gl/SmokeStore',
  operations: Record<string, unknown> = { categoryId, hours: defaultHours },
  images: { buffer: Uint8Array; type: string; name: string }[] = [],
  newCoverIndex?: number,
  menuFiles: { buffer: Uint8Array; type: string; name: string }[] = [],
): Promise<{ status: number; body: ApiBody }> => {
  const form = new FormData();
  form.append('storeName', storeName);
  form.append('description', 'Store created by the owner application smoke test');
  form.append('storePhone', '0812345678');
  form.append('lineUrl', 'https://line.me/ti/p/smoke-test');
  form.append('addressLine', '123 Smoke Test Road');
  form.append('province', 'Bangkok');
  form.append('googleMapUrl', googleMapUrl);
  form.append('documentType', 'COMMERCIAL_REGISTRATION');
  if ('categoryId' in operations) form.append('categoryId', String(operations.categoryId));
  if ('hours' in operations) form.append('hours', JSON.stringify(operations.hours));
  form.append(
    'businessDocument',
    new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'], { type: 'application/pdf' }),
    filename,
  );
  for (const image of images) form.append('images', new Blob([new Uint8Array(image.buffer)], { type: image.type }), image.name);
  if (newCoverIndex !== undefined) form.append('newCoverIndex', String(newCoverIndex));
  for (const menu of menuFiles) form.append('menuFiles', new Blob([new Uint8Array(menu.buffer)], { type: menu.type }), menu.name);

  const response = await fetch(`${baseUrl}/owner-applications`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: form,
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
};

const assertStatus = (
  response: { status: number; body: ApiBody },
  expected: number,
  step: string,
): void => {
  if (response.status !== expected) {
    throw new Error(
      `${step}: expected HTTP ${expected}, received ${response.status} (${response.body.message || 'no message'})`,
    );
  }
};

const updateImages = async (token: string, storeId: number, input: Record<string, unknown>,
  images: { buffer: Uint8Array; type: string; name: string }[] = [], changes: Record<string, unknown> = {},
  menuFiles: { buffer: Uint8Array; type: string; name: string }[] = []) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) form.append(key, key === 'hours' ? JSON.stringify(value) : value == null ? '' : String(value));
  form.append('removedImageIds', JSON.stringify(changes.removedImageIds || []));
  form.append('removedMenuFileIds', JSON.stringify(changes.removedMenuFileIds || []));
  if (changes.coverImageId !== undefined) form.append('coverImageId', String(changes.coverImageId));
  if (changes.newCoverIndex !== undefined) form.append('newCoverIndex', String(changes.newCoverIndex));
  for (const image of images) form.append('images', new Blob([new Uint8Array(image.buffer)], { type: image.type }), image.name);
  for (const menu of menuFiles) form.append('menuFiles', new Blob([new Uint8Array(menu.buffer)], { type: menu.type }), menu.name);
  const response = await fetch(`${baseUrl}/owner/stores/${storeId}`, { method: 'PUT', headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: response.status, body: await response.json() as ApiBody };
};

const run = async (): Promise<void> => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/api`;
  let connection: mysql.Connection | null = null;
  const documentPaths: string[] = [];

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const categoriesResponse = await jsonRequest('/store-categories', { method: 'GET' });
    assertStatus(categoriesResponse, 200, 'list store categories');
    categoryId = (categoriesResponse.body.data as { id: number }[])[0]?.id;
    if (!categoryId) throw new Error('store category list is empty');
    for (const [email, fullName] of [
      [memberEmail, 'Owner Application Member'],
      [adminEmail, 'Owner Application Admin'],
      [otherEmail, 'Other Store Owner'],
    ]) {
      const registered = await jsonRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName, phone: '0812345678' }),
      });
      assertStatus(registered, 201, `register ${fullName}`);
    }

    await connection.query(
      `INSERT INTO admins (full_name, email, password_hash, phone_number)
       SELECT full_name, email, password_hash, phone_number
       FROM users WHERE email = ?`,
      [adminEmail],
    );
    await connection.query('DELETE FROM users WHERE email = ?', [adminEmail]);

    const memberLogin = await jsonRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: memberEmail, password }),
    });
    assertStatus(memberLogin, 200, 'member login');
    const memberAuth = memberLogin.body.data as AuthenticationData;

    const adminLogin = await jsonRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password }),
    });
    assertStatus(adminLogin, 200, 'admin login');
    let adminAuth = adminLogin.body.data as AuthenticationData;
    const refreshedAdmin = await jsonRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: adminAuth.refreshToken }),
    });
    assertStatus(refreshedAdmin, 200, 'admin refresh session');
    adminAuth = refreshedAdmin.body.data as AuthenticationData;

    const dashboardStatistics = await jsonRequest('/admin/dashboard/statistics', {
      method: 'GET',
      headers: { authorization: `Bearer ${adminAuth.accessToken}` },
    });
    assertStatus(dashboardStatistics, 200, 'load admin dashboard statistics');
    const statistics = dashboardStatistics.body.data as { onlineUsers: number; totalUsers: number };
    if (!Number.isInteger(statistics.onlineUsers) || !Number.isInteger(statistics.totalUsers)) {
      throw new Error('dashboard user statistics are not numeric');
    }
    if (statistics.onlineUsers < 1 || statistics.totalUsers < 2) {
      throw new Error('dashboard user statistics do not include the smoke-test users');
    }

    for (const invalidMapUrl of [
      '',
      'https://example.com/maps/place/Store',
      'https://www.google.com.evil.example/maps/place/Store',
      'http://maps.app.goo.gl/Store',
      'javascript:alert(1)',
      `https://maps.app.goo.gl/${'x'.repeat(2048)}`,
    ]) {
      const invalid = await submitApplication(
        memberAuth.accessToken, 'invalid-map.pdf', 'Invalid Map Store', invalidMapUrl,
      );
      assertStatus(invalid, 422, 'reject invalid or missing Maps link');
    }

    const submitted = await submitApplication(memberAuth.accessToken, 'commercial-registration.pdf');
    for (const operations of [{}, { categoryId: 0, hours: defaultHours }, { categoryId, hours: [] }]) {
      assertStatus(await submitApplication(memberAuth.accessToken, 'invalid-operations.pdf', 'Invalid Operations Store', 'https://maps.app.goo.gl/Store', operations), 422, 'require category and complete hours on registration');
    }
    assertStatus(submitted, 201, 'submit owner application');
    const application = submitted.body.data as ApplicationData;
    if (application.status !== 'PENDING') throw new Error('new application is not PENDING');
    if (application.store.category.id !== categoryId || application.store.hours.length !== 7 || application.store.hours[0].closeTime !== '02:00' || !application.store.hours[0].closesNextDay) throw new Error('registration did not return category and overnight hours');
    if (application.store.googleMapUrl !== 'https://maps.app.goo.gl/SmokeStore') {
      throw new Error('submitted Maps link was not preserved');
    }
    if (['latitude', 'longitude', 'postalCode', 'subdistrict', 'district'].some(key => key in application.store)) {
      throw new Error('application response contains removed location fields');
    }
    const [savedStores] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT google_map_url FROM stores WHERE store_id = ?', [application.store.id],
    );
    if (savedStores[0].google_map_url !== application.store.googleMapUrl) {
      throw new Error('store Maps link was not saved in the database');
    }

    const duplicate = await submitApplication(memberAuth.accessToken, 'duplicate.pdf');
    assertStatus(duplicate, 409, 'prevent duplicate owner application');
    if (duplicate.body.error?.code !== 'OWNER_APPLICATION_EXISTS') {
      throw new Error('duplicate application returned the wrong error code');
    }

    const status = await jsonRequest('/owner-applications/status', {
      method: 'GET',
      headers: { authorization: `Bearer ${memberAuth.accessToken}` },
    });
    assertStatus(status, 200, 'get owner application status');
    if ((status.body.data as ApplicationData).status !== 'PENDING') {
      throw new Error('member status endpoint did not return PENDING');
    }

    const pendingList = await jsonRequest('/admin/owner-applications?status=PENDING', {
      method: 'GET',
      headers: { authorization: `Bearer ${adminAuth.accessToken}` },
    });
    assertStatus(pendingList, 200, 'admin application list');
    const listed = pendingList.body.data as ApplicationData[];
    if (!listed.some((item) => item.id === application.id)) {
      throw new Error('submitted application is missing from the admin queue');
    }

    const documentResponse = await fetch(
      `${baseUrl}/admin/owner-applications/${application.id}/document`,
      { headers: { authorization: `Bearer ${adminAuth.accessToken}` } },
    );
    if (documentResponse.status !== 200) {
      throw new Error(`download document: expected HTTP 200, received ${documentResponse.status}`);
    }
    const documentSignature = Buffer.from(await documentResponse.arrayBuffer())
      .subarray(0, 5)
      .toString();
    if (documentSignature !== '%PDF-') throw new Error('downloaded document content is invalid');

    const approved = await jsonRequest(
      `/admin/owner-applications/${application.id}/status`,
      {
        method: 'PATCH',
        headers: { authorization: `Bearer ${adminAuth.accessToken}` },
        body: JSON.stringify({ status: 'APPROVED' }),
      },
    );
    assertStatus(approved, 200, 'approve owner application');
    if ((approved.body.data as ApplicationData).status !== 'APPROVED') {
      throw new Error('approved application did not return APPROVED');
    }

    const profile = await jsonRequest('/auth/profile', {
      method: 'GET',
      headers: { authorization: `Bearer ${memberAuth.accessToken}` },
    });
    assertStatus(profile, 200, 'member profile after approval');
    if ((profile.body.data as { role: string }).role !== 'owner') {
      throw new Error('approved store owner must receive the owner role');
    }

    const secondSubmitted = await submitApplication(
      memberAuth.accessToken,
      'second-commercial-registration.pdf',
      'Second Owner Application Smoke Store',
      'https://www.google.com/maps/place/Second+Smoke+Store',
      { categoryId, hours: selectedRegistrationHours },
      [validPng],
      0,
      [validMenuPdf, { ...validPng, name: 'food-menu.png' }],
    );
    assertStatus(secondSubmitted, 201, 'owner submits an additional store');
    const secondApplication = secondSubmitted.body.data as ApplicationData;
    if (!secondApplication.store.hours[0].isClosed || !secondApplication.store.hours[1].isClosed || secondApplication.store.hours.slice(2).some(hour => hour.isClosed)) {
      throw new Error('registration did not preserve the selected opening days');
    }
    const [registeredSchedule] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT open_days_mask FROM stores WHERE store_id = ?', [secondApplication.store.id],
    );
    if (registeredSchedule[0].open_days_mask !== 124) throw new Error('registration opening days mask was not saved');
    if (secondApplication.store.images.length !== 1 || !secondApplication.store.images[0].isCover || secondApplication.store.coverImageUrl !== secondApplication.store.images[0].url) {
      throw new Error('registration did not persist the store image and cover');
    }
    if (secondApplication.store.menuFiles.length !== 2 || !secondApplication.store.menuFiles.some(file => file.url.endsWith('.pdf')) || !secondApplication.store.menuFiles.some(file => file.url.endsWith('.png'))) {
      throw new Error('registration did not persist PDF and image menu files');
    }
    const submittedImage = await fetch(`${baseUrl.replace(/\/api$/, '')}${secondApplication.store.coverImageUrl}`);
    if (submittedImage.status !== 200 || !Buffer.from(await submittedImage.arrayBuffer()).equals(validPng.buffer)) {
      throw new Error('registration store image is not served correctly');
    }
    const pendingSearch = await jsonRequest('/stores?name=Second%20Owner%20Application%20Smoke%20Store', { method: 'GET' });
    assertStatus(pendingSearch, 200, 'search excludes pending stores');
    if ((pendingSearch.body.data as { id: number }[]).some(store => store.id === secondApplication.store.id)) throw new Error('search exposed a pending store');
    assertStatus(await jsonRequest(`/stores/${secondApplication.store.id}`, { method: 'GET' }), 404, 'hide pending store detail');

    const secondApproved = await jsonRequest(
      `/admin/owner-applications/${secondApplication.id}/status`,
      {
        method: 'PATCH',
        headers: { authorization: `Bearer ${adminAuth.accessToken}` },
        body: JSON.stringify({ status: 'APPROVED' }),
      },
    );
    assertStatus(secondApproved, 200, 'approve an additional owner store');

    const publicDetail = await jsonRequest(`/stores/${secondApplication.store.id}`, { method: 'GET' });
    assertStatus(publicDetail, 200, 'load approved public store detail');
    const publicStore = publicDetail.body.data as ApplicationData['store'] & { phone: string; lineUrl: string; addressLine: string };
    if (publicStore.images.length !== 1 || !publicStore.images[0].isCover || publicStore.menuFiles.length !== 2 || publicStore.phone !== '0812345678' || !publicStore.lineUrl || !publicStore.addressLine) {
      throw new Error('public store detail omitted its gallery or contact details');
    }

    const unfiltered = await jsonRequest('/stores', { method: 'GET' });
    assertStatus(unfiltered, 200, 'show all public approved stores without search filters');
    const allIds = (unfiltered.body.data as { id: number }[]).map(store => store.id);
    if (!allIds.includes(application.store.id) || !allIds.includes(secondApplication.store.id)) throw new Error('unfiltered listing omitted approved public stores');

    for (const filters of [
      { name: 'second owner application smoke' },
      { name: 'Second Owner Application Smoke Store', categoryId: String(categoryId) },
      { name: 'Second Owner Application Smoke Store', location: 'Bangkok' },
      { name: ' Second Owner Application Smoke Store ', categoryId: String(categoryId), location: ' Bangkok ' },
    ]) {
      const found = await jsonRequest(`/stores?${new URLSearchParams(Object.entries(filters).map(([key, value]): [string, string] => [key, value || '']))}`, { method: 'GET' });
      assertStatus(found, 200, 'search matches partial name, category and address fields');
      const rows = found.body.data as { id: number }[];
      if (rows.length !== 1 || rows[0].id !== secondApplication.store.id) throw new Error('combined store search returned incorrect results');
    }
    for (const filters of [
      { name: 'Second Owner Application Smoke Store', categoryId: '999999999' },
      { name: 'Second Owner Application Smoke Store', location: 'NonexistentProvince' },
      { name: '%' }, { name: '_' }, { name: '!' }, { name: "' OR 1=1 --" },
      { name: 'Second Owner Application Smoke Store', location: '%' },
    ]) {
      const absent = await jsonRequest(`/stores?${new URLSearchParams(Object.entries(filters).map(([key, value]): [string, string] => [key, value || '']))}`, { method: 'GET' });
      assertStatus(absent, 200, 'unmatched and literal wildcard searches');
      if ((absent.body.data as { id: number }[]).some(store => store.id === secondApplication.store.id)) throw new Error('search treated a literal or mismatched filter as a match');
    }
    for (const query of ['categoryId=0', 'categoryId=abc', 'categoryId=1&categoryId=2', 'name=one&name=two', 'location=one&location=two', `name=${'x'.repeat(101)}`, `location=${'x'.repeat(201)}`]) {
      assertStatus(await jsonRequest(`/stores?${query}`, { method: 'GET' }), 422, `reject invalid search query: ${query}`);
    }
    await connection.query("UPDATE stores SET status = 'PENDING' WHERE store_id = ?", [secondApplication.store.id]);
    const privateSearch = await jsonRequest('/stores?name=Second%20Owner%20Application%20Smoke%20Store', { method: 'GET' });
    assertStatus(privateSearch, 200, 'search excludes private stores');
    if ((privateSearch.body.data as { id: number }[]).some(store => store.id === secondApplication.store.id)) throw new Error('search exposed a private store');
    await connection.query("UPDATE stores SET status = 'OPEN' WHERE store_id = ?", [secondApplication.store.id]);

    const ownerStores = await jsonRequest('/owner/stores', {
      method: 'GET',
      headers: { authorization: `Bearer ${memberAuth.accessToken}` },
    });
    assertStatus(ownerStores, 200, 'list stores owned by the approved owner');
    if ((ownerStores.body.data as unknown[]).length !== 2) {
      throw new Error('owner stores endpoint did not return both registered stores');
    }
    if (!(ownerStores.body.data as { googleMapUrl: string }[]).some(
      store => store.googleMapUrl === 'https://www.google.com/maps/place/Second+Smoke+Store',
    )) throw new Error('owner store list is missing the Maps link');

    const otherLogin = await jsonRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email: otherEmail, password }) });
    assertStatus(otherLogin, 200, 'other member login');
    const otherAuth = otherLogin.body.data as AuthenticationData;
    const storeUrl = `/owner/stores/${secondApplication.store.id}`;
    const updatedInput = {
      name: 'Updated Owner Smoke Store', description: 'Updated description', phone: '0899999999',
      lineUrl: 'https://line.me/ti/p/updated-store', addressLine: '456 Updated Test Road',
      province: 'Bangkok',
      googleMapUrl: 'https://maps.app.goo.gl/UpdatedStore', serviceStatus: 'CLOSED_TEMPORARILY',
      ownerUserId: otherAuth.user.id, approvalStatus: 'REJECTED', isPublic: false,
      categoryId, hours: defaultHours,
    };
    for (const method of ['PUT', 'DELETE']) {
      assertStatus(await jsonRequest(storeUrl, { method, body: method === 'PUT' ? JSON.stringify(updatedInput) : undefined }), 401, 'reject unauthenticated store mutation');
      assertStatus(await jsonRequest(storeUrl, { method, headers: { authorization: `Bearer ${otherAuth.accessToken}` }, body: method === 'PUT' ? JSON.stringify(updatedInput) : undefined }), 404, 'reject another account store mutation');
    }
    for (const invalid of [{ googleMapUrl: 'https://evil.example/maps' }, { phone: 'abc' }, { name: ' ' }, { serviceStatus: 'APPROVED' }, { province: null }, { lineUrl: 'javascript:alert(1)' }]) {
      assertStatus(await jsonRequest(storeUrl, { method: 'PUT', headers: { authorization: `Bearer ${memberAuth.accessToken}` }, body: JSON.stringify({ ...updatedInput, ...invalid }) }), 422, 'reject invalid store update');
    }
    const updated = await jsonRequest(storeUrl, { method: 'PUT', headers: { authorization: `Bearer ${memberAuth.accessToken}` }, body: JSON.stringify(updatedInput) });
    assertStatus(updated, 200, 'update own store');
    const updatedStore = updated.body.data as { name: string; googleMapUrl: string; approvalStatus: string; serviceStatus: string };
    if (updatedStore.name !== updatedInput.name || updatedStore.googleMapUrl !== updatedInput.googleMapUrl || updatedStore.approvalStatus !== 'APPROVED' || updatedStore.serviceStatus !== 'CLOSED_TEMPORARILY') throw new Error('updated store fields or approval are incorrect');
    const [persisted] = await connection.query<mysql.RowDataPacket[]>('SELECT owner_user_id, store_name, google_map_url, status, open_time, close_time FROM stores WHERE store_id = ?', [secondApplication.store.id]);
    if (persisted[0].open_time !== '19:00:00' || persisted[0].close_time !== '02:00:00') throw new Error('fixed daily overnight hours were not saved');
    for (const invalidOperations of [
      { categoryId: 0 }, { categoryId: 999999999 }, { hours: [] },
      { hours: defaultHours.map(hour => ({ ...hour, dayOfWeek: 0 })) },
      { hours: defaultHours.map(hour => ({ ...hour, closeTime: '19:00', closesNextDay: false })) },
      { hours: defaultHours.map(hour => ({ ...hour, closesNextDay: false })) },
      { hours: defaultHours.map(hour => ({ ...hour, openTime: '25:00' })) },
      { hours: defaultHours.map(hour => hour.dayOfWeek === 6 ? { ...hour, openTime: '18:00' } : hour) },
      { hours: defaultHours.map(hour => ({ ...hour, isClosed: true, openTime: null, closeTime: null, closesNextDay: false })) },
      { hours: defaultHours.map(hour => hour.dayOfWeek === 6 ? { ...hour, isClosed: true, closesNextDay: false } : hour) },
    ]) assertStatus(await jsonRequest(storeUrl, { method: 'PUT', headers: { authorization: `Bearer ${memberAuth.accessToken}` }, body: JSON.stringify({ ...updatedInput, ...invalidOperations }) }), 422, 'reject invalid category or weekly hours');
    const dayHours = defaultHours.map(hour => hour.dayOfWeek === 6
      ? { ...hour, isClosed: true, openTime: null, closeTime: null, closesNextDay: false }
      : { ...hour, openTime: '10:00', closeTime: '20:00', closesNextDay: false });
    const dayUpdated = await jsonRequest(storeUrl, { method: 'PUT', headers: { authorization: `Bearer ${memberAuth.accessToken}` }, body: JSON.stringify({ ...updatedInput, hours: dayHours, serviceStatus: 'OPEN' }) });
    assertStatus(dayUpdated, 200, 'save selected open days with shared daytime hours');
    const savedOperations = dayUpdated.body.data as { category: { id: number }; hours: typeof dayHours; serviceStatus: string };
    if (savedOperations.serviceStatus !== 'OPEN') throw new Error('manual reopening was not saved');
    if (savedOperations.category.id !== categoryId || savedOperations.hours.slice(0, 6).some(hour => hour.isClosed || hour.openTime !== '10:00' || hour.closeTime !== '20:00' || hour.closesNextDay) || !savedOperations.hours[6].isClosed) throw new Error('selected opening days response is incorrect');
    const [reopened] = await connection.query<mysql.RowDataPacket[]>('SELECT owner_user_id, store_name, google_map_url, status, open_time, close_time, open_days_mask FROM stores WHERE store_id = ?', [secondApplication.store.id]);
    if (reopened[0].owner_user_id !== memberAuth.user.id || reopened[0].store_name !== updatedInput.name || reopened[0].google_map_url !== updatedInput.googleMapUrl || reopened[0].status !== 'OPEN' || reopened[0].open_time !== '10:00:00' || reopened[0].close_time !== '20:00:00' || reopened[0].open_days_mask !== 63) throw new Error('update did not persist selected opening days safely');
    const conflict = await jsonRequest(storeUrl, { method: 'PUT', headers: { authorization: `Bearer ${memberAuth.accessToken}` }, body: JSON.stringify({ ...updatedInput, name: 'Owner Application Smoke Store', phone: '0812345678', addressLine: '123 Smoke Test Road' }) });
    assertStatus(conflict, 409, 'prevent duplicate store identity after edit');
    const [rolledBack] = await connection.query<mysql.RowDataPacket[]>('SELECT store_name FROM stores WHERE store_id = ?', [secondApplication.store.id]);
    if (rolledBack[0].store_name !== updatedInput.name) throw new Error('duplicate update was not rolled back');

    assertStatus(await jsonRequest(storeUrl, { method: 'DELETE', headers: { authorization: `Bearer ${memberAuth.accessToken}` } }), 200, 'delete own store');
    const [deletedRows] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT store_id FROM stores WHERE store_id = ?', [secondApplication.store.id],
    );
    if (deletedRows.length) throw new Error('store was not deleted');
    for (const endpoint of ['/owner/stores', '/stores']) {
      const listedStores = await jsonRequest(endpoint, { method: 'GET', headers: { authorization: `Bearer ${memberAuth.accessToken}` } });
      assertStatus(listedStores, 200, 'list stores after deletion');
      if ((listedStores.body.data as { id: number }[]).some(s => s.id === secondApplication.store.id)) throw new Error('deleted store is still visible');
    }
    assertStatus(await jsonRequest(storeUrl, { method: 'PUT', headers: { authorization: `Bearer ${memberAuth.accessToken}` }, body: JSON.stringify(updatedInput) }), 404, 'cannot edit deleted store');
    assertStatus(await jsonRequest(storeUrl, { method: 'DELETE', headers: { authorization: `Bearer ${memberAuth.accessToken}` } }), 404, 'cannot delete store again');
    const pendingDeleted = await submitApplication(memberAuth.accessToken, 'pending-deleted.pdf', 'Pending Deleted Smoke Store');
    assertStatus(pendingDeleted, 201, 'register pending store for deletion');
    const pendingApplication = pendingDeleted.body.data as ApplicationData;
    assertStatus(await jsonRequest(`/owner/stores/${pendingApplication.store.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${memberAuth.accessToken}` } }), 200, 'delete pending store');
    assertStatus(await jsonRequest(`/admin/owner-applications/${pendingApplication.id}/status`, { method: 'PATCH', headers: { authorization: `Bearer ${adminAuth.accessToken}` }, body: JSON.stringify({ status: 'APPROVED' }) }), 404, 'cannot approve deleted pending store');
    const pendingAfterDelete = await jsonRequest('/admin/owner-applications?status=PENDING', { method: 'GET', headers: { authorization: `Bearer ${adminAuth.accessToken}` } });
    if ((pendingAfterDelete.body.data as { id: number }[]).some(a => a.id === pendingApplication.id)) throw new Error('deleted store remains in admin queue');
    const replacementResponse = await submitApplication(memberAuth.accessToken, 'replacement.pdf', 'Pending Deleted Smoke Store');
    assertStatus(replacementResponse, 201, 'can register again after deleting store');
    const replacement = replacementResponse.body.data as ApplicationData;
    const photoStoreId = application.store.id;
    const photoInput = { ...updatedInput, name: 'Photo Smoke Store', phone: '0812340000', addressLine: '123 Photo Test Road', serviceStatus: 'OPEN' };
    const png = validPng;
    const detailUrl = `/owner/stores/${photoStoreId}`;
    assertStatus(await jsonRequest(detailUrl, { method: 'GET' }), 401, 'protect store detail');
    assertStatus(await jsonRequest(detailUrl, { method: 'GET', headers: { authorization: `Bearer ${otherAuth.accessToken}` } }), 404, 'hide another owner store detail');
    const beforePhotos = await jsonRequest(detailUrl, { method: 'GET', headers: { authorization: `Bearer ${memberAuth.accessToken}` } });
    assertStatus(beforePhotos, 200, 'get owner detail before photos');
    if ((beforePhotos.body.data as { images: unknown[] }).images.length) throw new Error('unexpected images on fresh store');
    assertStatus(await updateImages(otherAuth.accessToken, photoStoreId, photoInput, [png]), 404, 'prevent foreign image upload');
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [{ ...png, buffer: Buffer.from('not a PNG') }]), 422, 'reject forged image content');
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [{ ...png, type: 'image/svg+xml' }]), 422, 'reject unsupported image type');
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [{ ...png, buffer: new Uint8Array(5 * 1024 * 1024 + 1) }]), 422, 'reject oversized image');
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [], {}, [{ ...validMenuPdf, buffer: Buffer.from('not a PDF') }]), 422, 'reject forged menu file content');
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [], {}, [{ ...validMenuPdf, type: 'text/plain' }]), 422, 'reject unsupported menu file type');
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [], {}, [{ ...validMenuPdf, buffer: new Uint8Array(10 * 1024 * 1024 + 1) }]), 422, 'reject oversized menu file');
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [], {}, Array.from({ length: 11 }, () => validMenuPdf)), 422, 'enforce menu file count limit');
    const uploaded = await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [png, { ...png, name: 'second.png' }], { newCoverIndex: 1 }, [validMenuPdf, { ...png, name: 'menu.png' }]);
    assertStatus(uploaded, 200, 'upload store gallery and choose second cover');
    type PhotoDetail = { name: string; coverImageUrl: string | null; images: { id: number; url: string; isCover: boolean }[]; menuFiles: { id: number; url: string }[] };
    const photos = uploaded.body.data as PhotoDetail;
    if (photos.images.length !== 2 || !photos.images[1].isCover || photos.images[0].isCover || photos.coverImageUrl !== photos.images[1].url || photos.name !== photoInput.name) throw new Error('gallery or cover was not persisted');
    if (photos.menuFiles.length !== 2) throw new Error('menu files were not persisted during store editing');
    const staticImage = await fetch(`${baseUrl.replace(/\/api$/, '')}${photos.coverImageUrl}`);
    if (staticImage.status !== 200 || !Buffer.from(await staticImage.arrayBuffer()).equals(png.buffer)) throw new Error('uploaded image is not served correctly');
    const publicPhotos = await jsonRequest('/stores', { method: 'GET' });
    if (!(publicPhotos.body.data as { id: number; coverImageUrl: string }[]).some(s => s.id === photoStoreId && s.coverImageUrl === photos.coverImageUrl)) throw new Error('public store list is missing cover image');
    assertStatus(await updateImages(memberAuth.accessToken, replacement.store.id, { ...photoInput, name: 'Other Photo Store' }, [], { removedImageIds: [photos.images[0].id] }), 422, 'prevent cross-store image removal');
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [], { coverImageId: photos.images[0].id, newCoverIndex: 0 }), 422, 'reject conflicting cover options');
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [], { removedImageIds: ['bad'] }), 422, 'reject invalid image IDs');
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, photoInput, Array.from({ length: 9 }, () => png)), 422, 'enforce total gallery limit');
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, photoInput, Array.from({ length: 11 }, () => png)), 422, 'enforce upload count limit');
    const imageFolder = path.resolve(__dirname, '../../uploads/store-images');
    const diskBeforeFailure = await fs.readdir(imageFolder);
    assertStatus(await updateImages(memberAuth.accessToken, photoStoreId, { ...photoInput, name: 'Pending Deleted Smoke Store', phone: '0812345678', addressLine: '123 Smoke Test Road' }, [png]), 409, 'roll back photo upload on duplicate identity');
    const diskAfterFailure = await fs.readdir(imageFolder);
    if (JSON.stringify(diskBeforeFailure.sort()) !== JSON.stringify(diskAfterFailure.sort())) throw new Error('failed upload left an orphan file');
    const [fileCount] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM store_photo sp INNER JOIN stores s ON s.store_id = sp.store_id WHERE s.owner_user_id = ?',
      [memberAuth.user.id],
    );
    if (fileCount[0].count !== 2) throw new Error('failed uploads left database file rows');
    const coverChanged = await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [], { coverImageId: photos.images[0].id });
    assertStatus(coverChanged, 200, 'change existing cover');
    const replaced = await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [png], { removedImageIds: photos.images.map(i => i.id), newCoverIndex: 0 });
    assertStatus(replaced, 200, 'replace store images');
    const replacementPhotos = replaced.body.data as PhotoDetail;
    if (replacementPhotos.images.length !== 1 || !replacementPhotos.images[0].isCover) throw new Error('photo replacement failed');
    const retired = await fetch(`${baseUrl.replace(/\/api$/, '')}${photos.images[0].url}`);
    if (retired.status !== 404) throw new Error('retired photo file was not removed');
    const removedPhotos = await updateImages(memberAuth.accessToken, photoStoreId, photoInput, [], { removedImageIds: [replacementPhotos.images[0].id], removedMenuFileIds: replacementPhotos.menuFiles.map(file => file.id) });
    assertStatus(removedPhotos, 200, 'remove all store images');
    if ((removedPhotos.body.data as PhotoDetail).images.length || (removedPhotos.body.data as PhotoDetail).coverImageUrl !== null) throw new Error('empty gallery cover is incorrect');
    if ((removedPhotos.body.data as PhotoDetail).menuFiles.length) throw new Error('menu files were not removed');
    console.log('Owner application/store smoke test passed: ownership, edits, deletion, gallery and menu upload/removal, file validation and transaction rollback');
  } finally {
    if (connection) {
      const [users] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT user_id FROM users WHERE email IN (?, ?)',
        [memberEmail, otherEmail],
      );
      const userIds = users.map((user) => Number(user.user_id));
      if (userIds.length > 0) {
        const placeholders = userIds.map(() => '?').join(',');
        const [files] = await connection.query<mysql.RowDataPacket[]>(
          `SELECT sp.file_url AS storage_key
           FROM store_photo sp INNER JOIN stores s ON s.store_id = sp.store_id
           WHERE s.owner_user_id IN (${placeholders})
           UNION ALL
           SELECT smf.file_url AS storage_key
           FROM store_menu_files smf INNER JOIN stores s ON s.store_id = smf.store_id
           WHERE s.owner_user_id IN (${placeholders})`,
          [...userIds, ...userIds],
        );
        const [licenses] = await connection.query<mysql.RowDataPacket[]>(
          `SELECT business_license_url AS storage_key FROM stores WHERE owner_user_id IN (${placeholders})`,
          userIds,
        );
        files.push(...licenses);
        for (const file of files) {
          documentPaths.push(
            path.resolve(
              __dirname,
              String(file.storage_key).startsWith('/uploads/store-images/') ? '../../uploads/store-images'
                : String(file.storage_key).startsWith('/uploads/menu-files/') ? '../../uploads/menu-files'
                  : '../../private-uploads/owner-documents',
              path.basename(String(file.storage_key)),
            ),
          );
        }
        await connection.query(`DELETE FROM stores WHERE owner_user_id IN (${placeholders})`, userIds);
        await connection.query(`DELETE FROM users WHERE user_id IN (${placeholders})`, userIds);
      }
      const [admins] = await connection.query<mysql.RowDataPacket[]>('SELECT admin_id FROM admins WHERE email = ?', [adminEmail]);
      if (admins[0]) {
        await connection.query('DELETE FROM admins WHERE admin_id = ?', [admins[0].admin_id]);
      }
      await connection.end();
    }
    for (const documentPath of documentPaths) {
      await fs.unlink(documentPath).catch(() => undefined);
    }
    server.close();
    await db.end();
  }
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
