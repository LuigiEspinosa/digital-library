# Digital Library

- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [One-Command Deploy](#one-command-deploy)
- [Development](#development)
- [Required Secrets (GitHub Actions)](#required-secrets-github-actions)
- [Build Phases](#build-phases)

## Project Overview

Self-hosted, privacy-first digital library that handles EPUB, PDF, CBZ/CBR comics, and loose image files. It is designed to run entirely from a Docker Compose stack with no external cloud services and no recurring costs.

### Core features

- Full-text search with FTS5 MB25 ranking (porter stemmer, prefix matching) across title and author, with 350ms debounced input and per-term highlighting.
- Filter by format, author, series, language, and tags with URL-driven state (bookmarkable, back-button-safe).
- GSAP page transitions and card animations.
- User auth with per-library ACL.
- Native EPUB / PDF / Comic readers.
- Rich metadata + auto-fetch.
- Send to Kindle via SMTP.
- Auto-import file watcher.
- Desktop first.

## Technology Stack

| Technology                       | Why?                                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fastify + TypeScript**         | 2x faster than Express, first-class TypeScript, great plugin ecosystem.                                                                                                                                                                                                                                                     |
| **SvelteKit**                    | Tiny bundles (than Next.js), which matters for a reading app that may run on a Raspberry Pi or low-end VPS, file-based routing, SSR out of the box, no virtual DOM overhead. Also, Svelte's reactivity model is a better fit for reader UI state (page position, zoom, layout mode) with less boilerplate than React hooks. |
| **SQLite (better-sqlite3)**      | Zero infra, file-based, ACID, blazing read speed for single-node self-hosted apps.                                                                                                                                                                                                                                          |
| **SQLite FTS5**                  | Built into SQLite, no Elasticsearch overhead, supports prefix & phrase queries.                                                                                                                                                                                                                                             |
| **epub.js (client-side)**        | De facto standard, supports CFI positions, reflow, custom CSS injection.                                                                                                                                                                                                                                                    |
| **PDF.js (client-side)**         | Mozilla's library, works fully offline, no server-side processing required.                                                                                                                                                                                                                                                 |
| **Open Library API + ComicVine** | Both free, Open Library requires no API key at all.                                                                                                                                                                                                                                                                         |
| **chokidar**                     | Battle-tested, cross-platform, handles rapid write bursts gracefully.                                                                                                                                                                                                                                                       |
| **Calibre CLI (headless)**       | Industry standard, free, packaged in Docker for EPUB to MOBI/AZW3 conversion.                                                                                                                                                                                                                                               |
| **BullMQ + Redis**               | Async metadata fetch and Kindle send jobs. Redis Alpine is only 30MB.                                                                                                                                                                                                                                                       |
| **nodemailer + SMTP**            | Free with Gmail App Password or any SMTP provider.                                                                                                                                                                                                                                                                          |
| **Docker + Compose**             | One-command deploy, fully portable, no cloud lock-in.                                                                                                                                                                                                                                                                       |
| **Caddy**                        | Auto HTTPS via Let's Encrypt, trivial config, single static binary.                                                                                                                                                                                                                                                         |
| **Vitest**                       | SvelteKit already uses internally, zero extra tooling, single test command.                                                                                                                                                                                                                                                 |

## Architecture

### CI/CD Pipeline

```mermaid
flowchart TD
    Push[Push to branch] --> PR[Open Pull Request]
    PR --> CI[GitHub Actions: CI job]
    CI --> Test[pnpm test]
    CI --> TC[pnpm typecheck]
    Test & TC --> Gate{All pass?}
    Gate -->|No| Blocked[Merge blocked]
    Gate -->|Yes| Merge[Merge to main]
    Merge --> Deploy[GitHub Actions: Deploy job]
    Deploy --> SSH[SSH into Hetzner VPS]
    SSH --> Pull[git pull origin main]
    Pull --> Up[docker compose up -d --build]
    Up --> Live[Live at library.cuatro.dev]
```

### High-level Diagram

```mermaid
graph TB
    Caddy[Caddy<br/>Reverse Proxy + Auto HTTPS]
    SvelteKit[SvelteKit]
    FastifyAPI[Fastify API]
    SQLite[SQLite + FTS5]
    BooksData["/data/<br/>books/"]
    Redis["Redis<br/>(jobs)"]

    Caddy -->|Port 3000| SvelteKit
    Caddy -->|Port 4000| FastifyAPI
    FastifyAPI -->SQLite
    FastifyAPI -->BooksData
    FastifyAPI -->Redis
```

### Database Schema

```mermaid
erDiagram
    users {
        text id PK
        text email UK
        text password_hash
        boolean is_admin
        text created_at
    }
    sessions {
        text id PK
        text user_id FK
        text expires_at
    }
    libraries {
        text id PK
        text name
        text description
        text created_at
    }
    user_libraries {
        text user_id FK
        text library_id FK
    }
    books {
        text id PK
        text library_id FK
        text title
        text author
        text format
        text sha256 UK
        text file_path UK
        text language
        text tags
        text created_at
    }
    books_fts {
        text title
        text author
        text description
    }

    users ||--o{ sessions : has
    users ||--o{ user_libraries : accesses
    libraries ||--o{ user_libraries : grants
    libraries ||--o{ books : contains
    books ||--|| books_fts : "synced by triggers"
```

### Repository Structure

```txt
digital-library/
  ├── apps/
  │ ├── api/                  # Fastify backend
  │ │ └── src/
  │ │ ├── routes/             # books, auth, libraries, kindle
  │ │ ├── services/           # metadata, importer, smtp
  │ │ ├── db/                 # schema, migrations, queries
  │ │ └── jobs/               # BullMQ workers
  │ └── web/                  # SvelteKit frontend
  │ └── src/
  │ ├── routes/               # SvelteKit page files
  │ ├── lib/readers/          # EpubReader, PdfReader, ComicReader
  │ └── lib/stores/           # reading position, user settings
  ├── packages/
  │ └── shared/               # shared TypeScript types (pnpm workspace)
  ├── data/                   # mounted Docker volume
  │ ├── books/                # all uploaded files
  │ ├── covers/               # generated thumbnails
  │ └── library.db            # SQLite database
  └── docker-compose.yml
```

### Design Patterns

| Pattern                        | Where & Why?                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Repository Pattern**         | All DB access goes through typed repository classes (e.g. BookRepository, UserRepository). This keeps raw SQL out of route handlers and makes testing and future storage swaps easy. |
| **Plugin Architecture**        | Each domain (books, auth, libraries, kindle) is a separate Fastify plugin registered with fastify.register(). Clean separation, lazy loading, and scoped decorators.                 |
| **Command / Job Queue**        | Async work like metadata fetch, Kindle send, and thumbnail generation is dispatched as BullMQ jobs rather than blocking the HTTP request. The API returns 202 Accepted immediately.  |
| **Adapter Pattern (Metadata)** | A MetadataAdapter interface with concrete implementations for OpenLibrary, ComicVine, and a FallbackAdapter. Adding a new metadata source does not touch business logic.             |
| **Reader Strategy Pattern**    | A single `<Reader>` Svelte component dispatches to `<EpubReader>`, `<PdfReader>`, or `<ComicReader>` based on `book.format`. Each reader owns its own layout modes and settings.     |
| **FTS5 Shadow Table**          | A virtual FTS5 table mirrors the books table. An SQLite trigger keeps it in sync on insert/update. Searches hit FTS5 for ranking then JOIN back to the main table for metadata.      |

### Auth & Session Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant SvelteKit
    participant API as Fastify API
    participant DB as SQLite

    User->>Browser: Submit login form
    Browser->>SvelteKit: POST /login (form action)
    SvelteKit->>API: POST /api/auth/login
    API->>DB: SELECT user WHERE email = ?
    DB-->>API: User row + argon2 hash
    API->>API: argon2.verify(hash, password)
    API->>DB: INSERT INTO sessions
    API-->>SvelteKit: Set-Cookie: session=id HttpOnly
    SvelteKit-->>Browser: Redirect to /libraries

    Note over Browser,API: Every subsequent request
    Browser->>SvelteKit: GET /libraries (cookie attached)
    SvelteKit->>API: GET /api/auth/me (cookie forwarded)
    API->>DB: SELECT session JOIN user WHERE expires_at > now
    DB-->>API: User row
    API-->>SvelteKit: { user }
    SvelteKit-->>Browser: SSR page with user context
```

### Book Import Pipeline

```mermaid
sequenceDiagram
    actor Admin
    participant API as Fastify API
    participant Disk
    participant DB as SQLite + FTS5
    participant Queue as BullMQ

    Admin->>API: POST /api/libraries/:id/books (multipart)
    API->>Disk: Stream to TEMP_PATH (no buffering)
    API->>API: detectFormat(filename)
    API->>API: sha256(file)
    API->>DB: SELECT WHERE sha256 = ? (dedup check)

    alt Duplicate file
        DB-->>API: Existing book row
        API-->>Admin: 409 Conflict + existing book
    else New file
        API->>Disk: Move to /data/books/
        API->>API: extractEpubMetadata() + cover blob
        API->>Disk: Write cover to /data/covers/
        API->>DB: INSERT INTO books
        Note over DB: books_ai trigger fires
        DB->>DB: INSERT INTO books_fts
        API->>Queue: Enqueue metadata enrichment job
        API-->>Admin: 201 Created + book
    end

    Note over Disk,DB: Auto-import via inbox watcher
    Disk->>API: chokidar detects file in /data/inbox/
    API->>DB: Same import pipeline as above
```

### Browse & Filter Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant SvelteKit as SvelteKit<br/>(+page.server.ts)
    participant API as Fastify API
    participant DB as SQLite + FTS5

    User->>Browser: Applies filter (format, tag, search term)
    Browser->>SvelteKit: GET /libraries/:id?format=epub&q=robots&tags=fiction
    Note over SvelteKit: Parses URL params,<br/>builds URLSearchParams for API

    par Parallel fetches
        SvelteKit->>API: GET /api/libraries/:id/books?...
        SvelteKit->>API: GET /api/libraries/:id/books/filters
    end

    API->>DB: SELECT with dynamic WHERE<br/>(format, FTS5 MATCH, json_each tags)
    DB-->>API: Matching rows + COUNT(*)
    API-->>SvelteKit: { data, total, limit, offset }

    API->>DB: SELECT DISTINCT format, author, series...
    DB-->>API: Filter option lists
    API-->>SvelteKit: { formats, authors, series, tags, languages }

    SvelteKit-->>Browser: SSR page with books + filter sidebar
    Browser-->>User: Grid/list renders, GSAP staggers cards in

    User->>Browser: Clicks to book detail
    Browser->>SvelteKit: GET /libraries/:id/books/:bookId
    SvelteKit->>API: GET /api/books/:bookId
    API-->>SvelteKit: { book }
    SvelteKit-->>Browser: Detail page (SSR)
    Browser-->>User: Cover slides in from left,<br/>metadata slides in from right
```

### Full-Text Search Flow

```mermaid
sequenceDiagram
    actor User
    participant Input as Search Input<br/>(350ms debounce)
    participant SK as SvelteKit<br/>+page.server.ts
    participant API as Fastify API<br/>BookRepository
    participant FTS as SQLite FTS5<br/>books_fts

    User->>Input: types "dune"
    Note over Input: waits 350ms
    Input->>SK: goto(?q=dune)
    SK->>API: GET /libraries/:id/books?q=dune
    Note over API: ftsActive = true
    API->>FTS: JOIN books_fts WHERE books_fts MATCH 'dune*'
    FTS-->>API: rows ordered by books_fts.rank (BM25)
    API-->>SK: { data: [...], total: N }
    SK-->>User: cards rendered with highlighted terms
```

---

## One-Command Deploy

```bash
git clone https://github.com/LuigiEspinosa/digital-library
cd digital-library
cp .env.example .env
# edit .env
docker compose up -d
```

## Development

```bash
# Prerequisites: Node 22, pnpm 10
corepack enable
pnpm install

# Run API + web in parallel
pnpm dev

# Tests
pnpm test

# Type check
pnpm typecheck
```

## Required Secrets (GitHub Actions)

| Secret           | Description              |
| ---------------- | ------------------------ |
| `SERVER_HOST`    | VPS IP address           |
| `SERVER_USER`    | SSH username             |
| `SERVER_SSH_KEY` | Private SSH key contents |
| `SERVER_PORT`    | SSH port (usually 22)    |

## Build Phases

| #   | Phase                                        | Status         |
| --- | -------------------------------------------- | -------------- |
| 1   | Monorepo scaffold + Docker Compose           | ✅ Done        |
| 2   | Auth system (auth, sessions, ACL)            | ✅ Done        |
| 3   | Library management CRUD                      | ✅ Done        |
| 4   | File import, deduplication, metadata extract | ✅ Done        |
| 5   | Library browse UI                            | ✅ Done        |
| 6   | Full-text search (FTS5)                      | ✅ Done        |
| 7   | EPUB reader                                  | 🚧 In progress |
| 8   | PDF reader                                   | 🔜             |
| 9   | Comic/image reader                           | 🔜             |
| 10  | Metadata enrichment (OpenLibrary, ComicVine) | 🔜             |
| 11  | Kindle send                                  | 🔜             |
| 12  | Polish & release                             | 🔜             |
