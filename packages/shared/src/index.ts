// ---- Book ----

export type BookFormat = 'epub' | 'pdf' | 'cbz' | 'cbr' | 'images';

export interface Book {
  id: string;
  library_id: string;
  title: string;
  author?: string;
  format: BookFormat;
  file_path: string;
  cover_path?: string;
  description?: string;
  series?: string;
  series_idx?: number;
  // JSON array string stored in SQLite, parsed to string[] by the API
  tags?: string[];
  isbn?: string;
  published_at?: string;
  page_count?: number;
  file_size?: number;
  language?: string;
  created_at: string;
}

/**
 * A book as served by GET /api/libraries/:id/books — the base record plus the
 * REQUESTING USER's stored position. Always present on that payload, which is
 * why it is a separate type rather than an optional field on Book: findById,
 * create and the /books list return Book without it.
 *
 * position is a CFI string for EPUB and a page-number string for PDF/comics.
 */
export interface BookWithProgress extends Book {
  progress_position: string | null;
}

// ---- Library ----

export interface Library {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  // Present on list payloads (GET /api/libraries). Absent on findById/create/update,
  // which return this same type — hence optional rather than required.
  book_count?: number;
  user_count?: number;
  // MAX(books.created_at) for this library; null when the library has no books.
  last_import_at?: string | null;
}

// ---- User ----

export interface User {
  id: string;
  email: string;
  is_admin: boolean;
  kindle_email?: string;
  created_at: string;
}

// ---- Reading Progress ----

export interface ReadingProgress {
  user_id: string;
  book_id: string;
  // CFI string for EPUB; page number (as string) for PDF/comics
  position: string;
  updated_at: string;
}

// ---- API Response Shapes ----

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface LibraryFilters {
  formats: string[];
  authors: string[];
  series: string[];
  tags: string[];
  languages: string[];
}

// ---- Health ----

export interface HealthResponse {
  status: 'ok';
  version: string;
  uptime: number;
  book_count: number;
}

// ---- Session ----

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  fresh: boolean;
}
