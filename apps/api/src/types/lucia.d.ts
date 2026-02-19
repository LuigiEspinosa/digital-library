import type { DatabaseUserAttributes, LuciaInstance } from '../auth/lucia.js';

// Lucia v3 module augmentation — tells Lucia what's in our users table
// and which Lucia instance is in use. Placing this in src/types/ means
// TypeScript applies it to every file in the project automatically.
declare module 'lucia' {
  interface Register {
    Lucia: LuciaInstance;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}