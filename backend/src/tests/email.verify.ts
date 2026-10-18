import '../config/auth.config';
import { verifyEmailConnection } from '../utils/email.util';

verifyEmailConnection()
  .then(() => {
    console.log('SMTP connection and authentication succeeded');
  })
  .catch((error: { code?: string; responseCode?: number; message?: string }) => {
    console.error(
      `SMTP verification failed: code=${error.code || 'unknown'}, responseCode=${error.responseCode || 'unknown'}, message=${error.message || 'unknown error'}`,
    );
    process.exitCode = 1;
  });
