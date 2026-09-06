import { Request } from 'express';

export type Role = 'user' | 'member' | 'owner' | 'admin';

export interface UserPayload {
  id: number;
  email: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}