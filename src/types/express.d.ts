import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
        firstName: string;
        lastName: string;
      };
    }
  }
}

// # Run migrations
// npx prisma migrate dev --name init

// # Seed the database
// npm run prisma:seed

// # Start the backend
// npm run start:dev
