# Structured resume editor

Implemented in the existing Next.js / Express / MongoDB application. No database migration is required for existing resumes.

## User flow

Open Resume studio at `/dashboard/resume`. Create a blank resume without an AI key, or optionally generate a draft from real career notes. Open a saved resume to edit:

- Name/headline and contact email, phone, location, website, LinkedIn and GitHub.
- Summary, skills, experience (including individual responsibility/impact bullets), projects, education, certifications and achievements.
- Up to five titled custom text sections.
- Entry creation/removal and keyboard entry movement; section dragging and keyboard up/down controls. Contact details remain fixed at the top. Empty sections are omitted from preview.
- Classic/Modern/Minimal layout, Sans/Serif/Mono fonts, three text sizes, three spacing presets and four accent colors. Content remains independent from presentation.

Preview updates locally while typing. On narrow screens the editor provides Edit/Preview controls; desktop uses side-by-side columns. Existing browser print is retained for a clean preview printout; this slice does not implement server-side PDF generation.

## Saving and recovery

After a 750ms typing pause, the editor sends the entire validated content with the expected revision. Saves are serialized, and changes typed while a request is in flight are saved afterward. Responses update the revision and save status without overwriting newer local text. Save now and leaving via All resumes flush pending edits.

The server atomically updates only if the revision matches. A stale tab gets HTTP 409 and pauses autosave, retaining its draft in memory. Transport/validation failures also pause autosave until Retry save. The user can download a JSON copy of the current draft or reload the saved resume after confirmation. Refresh/unload and ordinary link navigation warn while there are unsaved changes. The editor does not persist personal resume drafts into localStorage by default; closing/discarding a tab can lose unsaved in-memory changes. Browser history/back behavior is subject to browser navigation handling; it is not a durable draft backup.

## Versions

Save version first flushes all draft edits, then captures an immutable server-side snapshot of content and presentation. Versions have labels, timestamps, schema version and source revision. Restore does not mutate the original checkpoint: one atomic write adds a checkpoint of the current draft, restores the selected snapshot and advances the revision. Other users cannot read, save or restore these versions.

There are at most 30 checkpoints per resume, including restore-created checkpoints. At capacity, new checkpoint/restore operations are rejected explicitly, without silently removing history or discarding the current draft. A separate resume can be created for further work. Each validated document is limited to 100 KB, with additional field, list and custom-section limits; keeping history embedded makes these operations atomic on the existing standalone MongoDB deployment and bounds the document far below its 16 MB limit. A future PostgreSQL migration can move snapshots into separate rows without changing the content contract.

Legacy resumes without revision or new content fields are normalized at read/edit time. A missing revision accepts one revision-zero write; concurrent later writes conflict. Existing generated content and raw source notes remain stored, while raw source notes and historical snapshots are excluded from normal resume reads. New resumes do not receive a permanent history checkpoint on every autosave; explicit versions remain distinct from the current draft.

## API

All routes use the current Clerk session and owner filter:

- `POST /api/resumes`: validated blank/manual content, defaulting missing sections.
- `GET /api/resumes` and `GET /api/resumes/:id`: current resumes, excluding embedded history and source notes.
- `PUT /api/resumes/:id`: `{ expectedRevision, content }`. The former unversioned flat edit payload is replaced; the shipped editor uses this contract.
- `GET /api/resumes/:id/versions`: version metadata, with no historical snapshot payload.
- `POST /api/resumes/:id/versions`: `{ expectedRevision, label? }`.
- `POST /api/resumes/:id/versions/:versionId/restore`: `{ expectedRevision }`.
- Existing generation and deletion routes remain; deletion removes that owner's resume and embedded history after UI confirmation.

Invalid IDs return 400, invalid/oversize structured content 422, missing/not-owned resources 404, revision conflicts 409 and unavailable persistence 503. Reserved ownership, raw notes, revision and history fields are not editable through the content payload. URLs are restricted to HTTP/HTTPS and rendered as text/links, never arbitrary HTML.

## Validation performed

- 15 backend tests pass with `TEST_MONGODB_URI=mongodb://127.0.0.1:27017/devinterview_editor_test npm test --prefix backend`.
- The integration test uses a randomly named disposable database that overrides the supplied URI database; only that disposable database is removed. It exercises HTTP routes against actual MongoDB, owner isolation, concurrent saves, immutable restoration, history capacity and legacy documents. Without `TEST_MONGODB_URI`, this test explicitly skips.
- Four browser tests pass with `npm run test:editor --prefix frontend`: in-flight autosave plus a simultaneous Save now; custom sections/keyboard reordering/checkpoint restoration; conflict preservation; and all entry types/drag reordering/layout changes.
- Browser tests bundle the real editor into an isolated fixture, mock Clerk only inside that test bundle, and intercept API calls. No authentication bypass is added to application routes. They test interactions, not live Clerk authentication or actual MongoDB persistence; the backend integration test covers persistence separately.
- Browser tests use installed Google Chrome by default. On a system without Chrome, install a Playwright Chromium browser and run with `PLAYWRIGHT_CHANNEL=chromium`. The test harness creates and removes a temporary directory.
- Backend build, frontend TypeScript and targeted ESLint pass. Full frontend production build passes in Docker.

The shared Field primitive now uses explicit labels and separate hint descriptions so a textarea's value does not become part of its accessible label.
