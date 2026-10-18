import { Request } from 'express';

export type Role = 'member' | 'owner' | 'admin';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

export interface UserPayload {
  id: number;
  email: string;
  role: Role;
  sessionId: string;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}
