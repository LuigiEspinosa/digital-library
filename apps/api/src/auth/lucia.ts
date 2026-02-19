import { Lucia } from "lucia";
import { BetterSqlite3Adapter } from "@lucia-auth/adapter-sqlite";
import type { Db } from "../db/connection.js";

// DatabaseUserAttributes mirrors the extra columns we added to the users table.
// Defined here so it can be referenced in the getUserAttributes callback below
// and re-exported for the module augmentation in types/lucia.d.ts.
export interface DatabaseUserAttributes {
  email: string;
  is_admin: number;       // SQLite stores booleans as 0 | 1
  kindle_email: string | null;
}

export function initLucia(db: Db): Lucia {
  const adapter = new BetterSqlite3Adapter(db, {
    user: 'users',
    session: 'sessions',
  });

  return new Lucia(adapter, {
    sessionCookie: {
      name: 'auth_session',
      expires: true,
      attributes: {
        // secure=true in production so cookie is HTTPS-only
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      },
    },
    // Expose our custom user columns
    // SQLite stores booleans as 0/1 integers
    // so we coerce is_admin here once, centrally
    getUserAttributes(attributes: DatabaseUserAttributes) {
      return {
        email: attributes.email,
        is_admin: attributes.is_admin === 1,
        kindle_email: attributes.kindle_email ?? null,
      };
    },
  });
}

// Export the instance type so lucia.d.ts can reference it without circular imports
export type LuciaInstance = ReturnType<typeof initLucia>;
