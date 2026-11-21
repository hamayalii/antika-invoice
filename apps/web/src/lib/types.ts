import type { Role } from "@antika/shared";

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface AuthResponse {
  user: AuthUser;
}
