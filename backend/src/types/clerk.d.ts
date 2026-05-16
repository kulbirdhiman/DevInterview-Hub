// src/types/clerk.d.ts
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      auth: {
        userId: string | null;
        sessionId: string | null;
        getToken: (options?: any) => Promise<string | null>;
      };
    }
  }
}