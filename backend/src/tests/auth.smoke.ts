import dotenv from 'dotenv';
import { once } from 'events';
import { AddressInfo } from 'net';
import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import { app } from '../app';
import { db } from '../config/db';
import { authConfig } from '../config/auth.config';
import { hashOtp } from '../utils/crypto.util';

dotenv.config();

interface JsonResponse {
  data?: {
    accessToken?: string;
    refreshToken?: string;
    resetToken?: string;
    fullName?: string;
    phone?: string | null;
    profileImageUrl?: string | null;
    user?: {
      fullName?: string;
      phone?: string | null;
      profileImageUrl?: string | null;
    };
  };
  message?: string;
}

let baseUrl = '';
const email = `auth-smoke-${Date.now()}@example.com`;
const password = 'TestDrinkGo!123';
const newPassword = 'NewTestDrinkGo!456';
const resetPasswordValue = 'ResetTestDrinkGo!789';
let uploadedImagePath: string | null = null;

const request = async (
  path: string,
  init: RequestInit,
): Promise<{ status: number; body: JsonResponse }> => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return { status: response.status, body: (await response.json()) as JsonResponse };
};

const multipartRequest = async (
  path: string,
  accessToken: string,
  formData: FormData,
): Promise<{ status: number; body: JsonResponse }> => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  return { status: response.status, body: (await response.json()) as JsonResponse };
};

const assertStatus = (
  response: { status: number; body: JsonResponse },
  expected: number,
  step: string,
): void => {
  if (response.status !== expected) {
    throw new Error(
      `${step}: expected HTTP ${expected}, received ${response.status} (${response.body.message || 'no message'})`,
    );
  }
};

const run = async (): Promise<void> => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/api/auth`;

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const corsPreflight = await fetch(`${baseUrl}/login`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:4200',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    if (
      corsPreflight.status !== 204 ||
      corsPreflight.headers.get('access-control-allow-origin') !== 'http://127.0.0.1:4200'
    ) {
      throw new Error('CORS preflight did not allow the development frontend origin');
    }

    const invalidRegistration = await request('/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `invalid-${email}`,
        password: 'short',
        fullName: 'Invalid Password',
      }),
    });
    assertStatus(invalidRegistration, 422, 'register validation');

    const registered = await request('/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        fullName: 'Auth Smoke Test',
        phone: '0812345678',
      }),
    });
    assertStatus(registered, 201, 'register');

    const loggedIn = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    assertStatus(loggedIn, 200, 'login');
    const accessToken = loggedIn.body.data?.accessToken;
    const refreshToken = loggedIn.body.data?.refreshToken;
    if (!accessToken || !refreshToken) throw new Error('login did not return both tokens');
    const [activityRows] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT user_id, last_activity_at FROM users WHERE email = ?', [email],
    );
    if (!activityRows[0]?.last_activity_at) throw new Error('successful login did not record user activity');
    await connection.query('UPDATE users SET last_activity_at = UTC_TIMESTAMP(3) - INTERVAL 10 MINUTE WHERE user_id = ?', [activityRows[0].user_id]);
    const activity = await request('/activity', {
      method: 'POST', headers: { authorization: `Bearer ${accessToken}` }, body: '{}',
    });
    assertStatus(activity, 200, 'record authenticated user activity');
    const [recentActivityRows] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT last_activity_at >= UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE AS is_recent FROM users WHERE user_id = ?', [activityRows[0].user_id],
    );
    if (Number(recentActivityRows[0]?.is_recent) !== 1) throw new Error('activity heartbeat did not refresh last_activity_at');

    const profile = await request('/profile', {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assertStatus(profile, 200, 'profile');

    const profileForm = new FormData();
    profileForm.append('email', email);
    profileForm.append('fullName', 'Updated Auth Smoke Test');
    profileForm.append('phone', '0899999999');
    const onePixelPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    profileForm.append('profileImage', new Blob([onePixelPng], { type: 'image/png' }), 'avatar.png');
    const updatedProfile = await multipartRequest('/profile', accessToken, profileForm);
    assertStatus(updatedProfile, 200, 'update profile');
    if (
      updatedProfile.body.data?.fullName !== 'Updated Auth Smoke Test' ||
      !updatedProfile.body.data.profileImageUrl
    ) {
      throw new Error('update profile did not return the updated user and image URL');
    }
    uploadedImagePath = path.resolve(
      __dirname,
      '../../uploads',
      updatedProfile.body.data.profileImageUrl.replace(/^\/uploads\//, ''),
    );
    await fs.access(uploadedImagePath);

    const refreshed = await request('/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    assertStatus(refreshed, 200, 'refresh');
    const newAccessToken = refreshed.body.data?.accessToken;
    const newRefreshToken = refreshed.body.data?.refreshToken;
    if (!newAccessToken || !newRefreshToken) throw new Error('refresh did not rotate both tokens');

    const reusedRefreshToken = await request('/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    assertStatus(reusedRefreshToken, 200, 'stateless refresh token remains valid until logout');

    const profileAfterReuse = await request('/profile', {
      method: 'GET',
      headers: { authorization: `Bearer ${newAccessToken}` },
    });
    assertStatus(profileAfterReuse, 200, 'session after refresh token reuse');

    const secondLogin = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    assertStatus(secondLogin, 200, 'second login');
    const secondAccessToken = secondLogin.body.data?.accessToken;
    if (!secondAccessToken) throw new Error('second login did not return an access token');

    const changedPassword = await request('/change-password', {
      method: 'POST',
      headers: { authorization: `Bearer ${secondAccessToken}` },
      body: JSON.stringify({ currentPassword: password, newPassword }),
    });
    assertStatus(changedPassword, 200, 'change password');

    const profileAfterPasswordChange = await request('/profile', {
      method: 'GET',
      headers: { authorization: `Bearer ${secondAccessToken}` },
    });
    assertStatus(profileAfterPasswordChange, 200, 'stateless member session after password change');

    const oldPasswordLogin = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    assertStatus(oldPasswordLogin, 401, 'old password login');

    const newPasswordLogin = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: newPassword }),
    });
    assertStatus(newPasswordLogin, 200, 'new password login');
    const beforeResetAccessToken = newPasswordLogin.body.data?.accessToken;
    if (!beforeResetAccessToken) throw new Error('new password login did not return tokens');

    const [resetUsers] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    const knownOtp = '654321';
    await connection.query(
      `INSERT INTO password_resets (user_id, otp_hash, expires_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE))`,
      [resetUsers[0].user_id, hashOtp(knownOtp, authConfig.jwtSecret)],
    );

    const verifiedOtp = await request('/verify-reset-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp: knownOtp }),
    });
    assertStatus(verifiedOtp, 200, 'verify password reset OTP');
    const resetToken = verifiedOtp.body.data?.resetToken;
    if (!resetToken) throw new Error('OTP verification did not return a reset token');

    const resetPassword = await request('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, newPassword: resetPasswordValue }),
    });
    assertStatus(resetPassword, 200, 'two-step password reset');

    const reusedResetToken = await request('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, newPassword: newPassword }),
    });
    assertStatus(reusedResetToken, 400, 'reset token reuse detection');

    const sessionAfterReset = await request('/profile', {
      method: 'GET',
      headers: { authorization: `Bearer ${beforeResetAccessToken}` },
    });
    assertStatus(sessionAfterReset, 200, 'stateless member session after password reset');

    const finalLogin = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: resetPasswordValue }),
    });
    assertStatus(finalLogin, 200, 'login after two-step password reset');
    const finalAccessToken = finalLogin.body.data?.accessToken;
    const finalRefreshToken = finalLogin.body.data?.refreshToken;
    if (!finalAccessToken || !finalRefreshToken) {
      throw new Error('login after password reset did not return tokens');
    }

    const invalidOtpVerification = await request('/verify-reset-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp: '000000' }),
    });
    assertStatus(invalidOtpVerification, 400, 'invalid password reset OTP');

    const invalidReset = await request('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken: '0'.repeat(64), newPassword: password }),
    });
    assertStatus(invalidReset, 400, 'invalid password reset token');

    const forgotUnknown = await request('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: `unknown-${email}` }),
    });
    assertStatus(forgotUnknown, 200, 'unknown email password reset privacy');

    const loggedOut = await request('/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: finalRefreshToken }),
    });
    assertStatus(loggedOut, 200, 'logout');

    const profileAfterLogout = await request('/profile', {
      method: 'GET',
      headers: { authorization: `Bearer ${finalAccessToken}` },
    });
    assertStatus(profileAfterLogout, 200, 'stateless member access token after local logout');
    assertStatus(await request('/refresh', {
      method: 'POST', body: JSON.stringify({ refreshToken: finalRefreshToken }),
    }), 200, 'stateless member refresh token after local logout');

    console.log(
      'Auth smoke test passed: validation, register, login, profile/image, stateless member tokens, password change, two-step password reset, logout',
    );
  } finally {
    await connection.query('DELETE FROM users WHERE email = ?', [email]);
    if (uploadedImagePath) await fs.unlink(uploadedImagePath).catch(() => undefined);
    await connection.end();
    server.close();
    await db.end();
  }
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
