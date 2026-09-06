export type Role = 'user' | 'member' | 'owner' | 'admin';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  profileImg?: string;
}

export interface AuthResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
}