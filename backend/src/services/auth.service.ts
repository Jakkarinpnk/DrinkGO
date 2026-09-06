import { db } from '../config/db'; // สมมติว่า db เป็น connection pool ของ MySQL
import { hashPassword, comparePassword } from '../utils/bcrypt.util';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.util';
import { GoogleAuthService } from './google-auth.service';

export class AuthService {
  // 1. ตรรกะสำหรับการลงทะเบียน (Register)
  static async register(email: string, password_text: string, fullName: string, phone: string) {
    // ตรวจสอบว่าอีเมลซ้ำไหม
    const [existingUser]: any = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      throw new Error('Email is already registered');
    }

    // แฮชรหัสผ่านก่อนบันทึก
    const hashedPassword = await hashPassword(password_text);

    // บันทึกลงตาราง users (สิทธิ์เริ่มต้นคือ 'user' ตามโครงสร้าง DB ของคุณ)
    const [result]: any = await db.query(
      'INSERT INTO users (email, password_hash, full_name, phone, role) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, fullName, phone, 'user']
    );

    return { userId: result.insertId, email, fullName };
  }

  // 2. ตรรกะสำหรับการล็อกอินแบบธรรมดา (Normal Login)
  static async login(email: string, password_text: string) {
    // หาผู้ใช้งานจากอีเมล
    const [users]: any = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // ตรวจสอบว่าบัญชีโดนระงับอยู่หรือไม่
    if (user.is_active === 0) {
      throw new Error('Your account has been suspended');
    }

    // ตรวจสอบรหัสผ่าน
    const isPasswordValid = await comparePassword(password_text, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // ออก Token ของระบบ
    const payload = { userId: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // บันทึก Refresh Token ลงฐานข้อมูลเพื่อใช้ทำ Persistent Login
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 วัน
    await db.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [
      user.id,
      refreshToken,
      expiresAt,
    ]);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role }
    };
  }

  // 3. ตรรกะสำหรับการล็อกอินด้วย Google OAuth
  static async googleLogin(idToken: string) {
    // ขั้นแรก: ตรวจสอบ Token กับ Google
    const googleUser = await GoogleAuthService.verifyGoogleToken(idToken);

    if (!googleUser.email) {
      throw new Error('Google account must have an email');
    }

    // ขั้นที่สอง: เช็คใน MySQL ว่าเคยมี User คนนี้ในระบบหรือยัง (เช็คจาก google_id หรือ email)
    const [users]: any = await db.query(
      'SELECT * FROM users WHERE google_id = ? OR email = ?',
      [googleUser.googleId, googleUser.email]
    );

    let user;

    if (users.length === 0) {
      // เคสที่ 1: เป็นผู้ใช้ใหม่ -> ทำการสมัครสมาชิกให้อัตโนมัติ (Role เป็น user ตามโครงสร้างคุณ)
      const [result]: any = await db.query(
        'INSERT INTO users (email, google_id, full_name, profile_img, role) VALUES (?, ?, ?, ?, ?)',
        [googleUser.email, googleUser.googleId, googleUser.fullName, googleUser.profileImg, 'user']
      );

      const [newUser]: any = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = newUser[0];
    } else {
      // เคสที่ 2: มีผู้ใช้อยู่แล้ว
      user = users[0];

      // อัปเดต google_id เผื่อกรณีที่เขาเคยสมัครแบบ Normal ไว้ก่อน แล้วเพิ่งมาผูก Google ทีหลัง
      if (!user.google_id) {
        await db.query('UPDATE users SET google_id = ? WHERE id = ?', [googleUser.googleId, user.id]);
        user.google_id = googleUser.googleId;
      }
    }

    // ตรวจสอบว่าบัญชีโดนแบนไหม
    if (user.is_active === 0) {
      throw new Error('Your account has been suspended');
    }

    // ขั้นที่สาม: ออก Token ของระบบเราเพื่อให้ Angular เอาไปใช้งานต่อ
    const payload = { userId: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // บันทึก Refresh Token ลง DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await db.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [
      user.id,
      refreshToken,
      expiresAt,
    ]);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role }
    };
  }
}
