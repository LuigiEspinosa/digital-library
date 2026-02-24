# Changelog

## [0.6.0] - Phase 6: Full-Text Search Enhancements

### Added

- **BM25 ranking**: `GET /api/libraries/:id/books?q=` now returns results ordered by relevance score instead of title. `BookRepository.findByLibrary` switches to a `JOIN books_fts.rowid = b.rowid ORDER BY books_fts.rank` path when `q` is present. The existing sort/order params are intentionally ignored on this path. BM25 always wins.
- **Debounce**: search input fires navigation 350ms after the user stops typing, not on every keystroke. Pressing Enter cancels the pending timer and navigates immediately.
- **Term highlighting**: matched search terms are highlighted in yellow on book card titles and authors in both grid and list views. Implemented with a two-pass approach: HTML entities are escaped first, then matches are wrapped in `<mark>` tags, so user input never reaches the DOM as raw HTML.
- **Active filter chips**: a dismissible chip row appears whenever any filter is active. Each chip shows the filter value and has an X button that removes only that filter. A "Clear all" button at the end of the row replaces the previous standalone "Clear filters" link.

### Changed

- FTS query path refactored to a clean branch inside `findByLibrary`. Non-FTS path is identical to before.

## [0.5.0] - Phase 5: Library Browse UI

### Added

- **Language field**: `language` column added to the `books` table and extracted from EPUB `dc:language` metadata on import.

- **Advanced book filtering**: `GET /api/libraries/:id/books` now accepts query parameters: `q` (FTS5 full-text search), `format`, `author`, `series`, `language`, `tags` (comma-separated, OR semantics), `sort` (`title` | `author` | `created_at` | `published_at`), `order` (`asc` | `desc`), `limit`, `offset`. Sort column is allowlisted to prevent SQL injection.

- **Filter options endpoint**: `GET /api/libraries/:id/books/filters` returns distinct sorted values for all filterable fields scoped to the library.

- **Library browse page**: Grid (5-column) and list view toggle. Sticky header with breadcrumb. Filter bar: full-text search, author/series/language selects, format chips, multi-select tag pills, sort control. URL-driven state (bookmarkable, back-button-safe). Ellipsis pagination.

- **Book detail page**: Two-column layout; cover art + Read button on the left, full metadata (title, author, format badge, description, series, published date,
  ISBN, language, page count, file size, tags) on the right. Tags link back to the library with the tag filter pre-applied.

- **GSAP animations**: Page exit/enter transitions via `onNavigate` / `afterNavigate` in the root layout. Book cards stagger in on mount. Cover and metadata panels slide in from opposite sides on the detail page.

### Fixed

- `BODY_SIZE_LIMIT` env var wired correctly in `docker-compose.yml` for `adapter-node` upload size configuration.

---

## [0.4.0] - Phase 4: File import, Deduplication & Metadata

### Added

- **Multipart upload**: `POST /api/libraries/:id/books` streams uploads directly to a temp file via `pipeline()`, no full-file buffering. Configurable via `TEMP_PATH`.
- **Format detection**: extension-based allowlist maps files to `BookFormat` (`epub` | `pdf` | `cbz` | `cbr`). Unsupported types return 415.
- **SHA-256 deduplication**: hash computed on every upload and stored in `book.sha256` (UNIQUE). Duplicate content returns 409 with the existing book record rather than creating a second copy.
- **EPUB metadata extraction**: OPF manifest parsed from the zip archive; extracts `dc:title`, `dc:creator`, `dc:description`, `dc:identifier` (ISBN), `dc:date`, `dc:language`, and cover image blob.
- **Cover thumbnails**: extracted cover written to `/data/covers/` and served as static files under `/files/covers/*`.
- **FTS5 virtual table**: `books_fts` shadow table with `tokenize='poster ascii'` kept in sync by three SQLite triggers (`books_ai`, `books_au`, `books_ad`).
- **Inbox watcher**: `chokidar` monitors `/data/inbox/` and auto-imports any dropped file, then moves it to `/data/books/`.
- **BullMQ job queue**: async workers for metadata enrichment and future Kindle-send jobs backed by Redis Apline.

---

## [0.3.0] - Phase 3: Library Management CRUD

### Added

- **`LibraryRepository`**: `findAll`, `findAllowed` (ACL-filtered), `findById`,
  `create`, `update`, `delete`, plus `user_count` aggregate for the admin panel.

- **User-facing library routes**: `GET /api/libraries`, `GET /api/libraries/:id`.
  Results filtered by the caller's ACL.

- **Admin library routes**: `POST`, `PATCH`, `DELETE` under `/api/admin/libraries`.
  `GET /api/admin/libraries/:id/users` lists users with access.

- **User access management**: `PUT /api/admin/users/:userId/libraries/:libraryId`
  grants access; `DELETE` revokes it. Full user CRUD under `/api/admin/users`.

- **Admin panel pages**: library list with create/edit/delete, user list with
  create/delete and grant/revoke access. All use SvelteKit form actions.

- **`LibraryWithCount` shared type** for the admin aggregate query.

---

## [0.2.0] - Phase 2: Auth System

### Added

- **Argon2 password hashing** for all stored passwords.

- **Session-based auth**: sessions persisted in a `sessions` SQLite table.
  Cookie lifecycle managed server-side; instant invalidation on logout.

- **`UserRepository`**: `create`, `findByEmail`, `findById`. Admin user seeded
  on first run from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars.

- **Auth routes**: `POST /api/auth/login`, `POST /api/auth/logout`,
  `GET /api/auth/me`, `POST /api/auth/register`.

- **`requireAuth` Fastify preHandler**: validates session cookie and decorates
  `request.user` for downstream handlers.

- **Per-library ACL**: `user_libraries` join table. `hasAccess()` enforced in
  every book and library route. `getAllowedLibraryIds()` for the global list.
  Admins bypass all ACL checks.

- **SvelteKit auth flow**: root layout server calls `GET /api/auth/me` and
  propagates `user` via `parent()`. Login and logout pages with form actions.

---

## [0.1.0] - Phase 1: Monorepo Scaffold & Docker Compose

### Added

- **pnpm workspace monorepo**: `apps/api` (Fastify 4 + TypeScript, port 4000),
  `apps/web` (SvelteKit 2 + Svelte 5, port 3000), `packages/shared` (shared types).
  Build order enforced: shared compiles before apps.

- **Docker Compose stack**: `api`, `web`, `redis` (Alpine), `caddy` services.
  `data/` volume for SQLite DB, uploaded books, and generated covers.
  SQLite WAL mode enabled on every connection.

- **Caddy reverse proxy**: custom image built with the Hetzner DNS plugin.
  TLS via Let's Encrypt DNS-01. Dev overlay (`docker-compose.dev.yml`) serves
  plain HTTP on localhost with hot-reload bind mounts.

- **SQLite schema**: initial DDL in `db/migration.ts` runs on startup via a
  `better-sqlite3` singleton.

- **GitHub Actions CI/CD**: test job on PRs and pushes to `main`; deploy job
  SSHes into the VPS and runs `docker compose up -d --build` after tests pass.
