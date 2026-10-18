import nodemailer from 'nodemailer';

const requireMailConfig = (): {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
} => {
  const host = process.env.MAIL_HOST?.trim();
  const user = process.env.MAIL_USER?.trim();
  const pass = process.env.MAIL_PASS?.trim();
  const port = Number(process.env.MAIL_PORT || 587);

  if (!host || !user || !pass || !Number.isInteger(port)) {
    throw new Error('Email service is not configured');
  }
  const from = process.env.MAIL_FROM?.trim() || user;
  return { host, port, user, pass, from };
};

const createMailTransporter = () => {
  const config = requireMailConfig();
  return {
    config,
    transporter: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    }),
  };
};

export const verifyEmailConnection = async (): Promise<void> => {
  const { transporter } = createMailTransporter();
  await transporter.verify();
};

export const sendPasswordResetOtp = async (
  email: string,
  otp: string,
  expiresInMinutes: number,
): Promise<void> => {
  const { config, transporter } = createMailTransporter();

  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: 'รหัส OTP สำหรับตั้งรหัสผ่านใหม่ - DrinkGo',
    text: `รหัส OTP ของคุณคือ ${otp} รหัสนี้จะหมดอายุใน ${expiresInMinutes} นาที`,
    html: `<p>รหัส OTP สำหรับตั้งรหัสผ่านใหม่ของคุณคือ <strong>${otp}</strong></p><p>รหัสนี้จะหมดอายุใน ${expiresInMinutes} นาที</p>`,
  });
};
