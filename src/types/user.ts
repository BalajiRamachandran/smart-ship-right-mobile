export type UserRole = 'admin' | 'manager' | 'picker' | 'viewer' | string;

export interface User {
  id: string;
  username: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string | null;
}

