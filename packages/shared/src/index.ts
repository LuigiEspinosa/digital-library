// ---- Book ----

export type BookFormat = 'epub' | 'pdf' | 'cbz' | 'cbr' | 'images';

export interface Book {
  id: String;
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
  publised_at?: string;
  page_count?: number;
  file_size?: number;
  created_at: string;
}

// ---- Library ----

export interface Library {
  id: string;
  name: string;
  description?: string;
  created_at: string;
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
