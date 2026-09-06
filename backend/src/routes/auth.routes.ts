import { Router } from 'express';
import { registerController, loginController, googleLoginController } from '../controllers/auth.controller';

const router = Router();

// Endpoint: POST /api/auth/register
router.post('/register', registerController);

// Endpoint: POST /api/auth/login
router.post('/login', loginController);

// Endpoint: POST /api/auth/google
router.post('/google', googleLoginController);

export default router;