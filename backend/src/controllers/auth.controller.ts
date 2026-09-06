import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export const registerController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, phone } = req.body;

    // Validation เบื้องต้น
    if (!email || !password || !fullName) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const newUser = await AuthService.register(email, password, fullName, phone || null);
    res.status(201).json({ message: 'User registered successfully', data: newUser });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Registration failed' });
  }
};

export const loginController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const authData = await AuthService.login(email, password);
    res.status(200).json({ message: 'Login successful', data: authData });
  } catch (error: any) {
    res.status(401).json({ message: error.message || 'Login failed' });
  }
};

export const googleLoginController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ message: 'idToken is required' });
      return;
    }

    const authData = await AuthService.googleLogin(idToken);
    res.status(200).json({ message: 'Google login successful', data: authData });
  } catch (error: any) {
    res.status(401).json({ message: error.message || 'Google login failed' });
  }
};