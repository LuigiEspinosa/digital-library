# Changelog

## [Unreleased] - Phase 5: Library Browse UI

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
