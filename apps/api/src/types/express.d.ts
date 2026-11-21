import type { Role } from "@antika/shared";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        fullName: string;
        role: Role;
        mustChangePassword: boolean;
      };
    }
  }
}

export {};
