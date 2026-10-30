# Phase 1 feature delivery and operations

30 October 2026. This document describes the implementation, not just the proposed architecture. The current app remains Next.js + Express + MongoDB with Clerk. NestJS/PostgreSQL migration, Redis/BullMQ, billing, file import, voice/video, panel interviews, job matching and coaching are not part of this change.

## Delivered product paths

| Location | Behavior |
|---|---|
| Resume studio `/dashboard/resume` | Structured editing, autosave, immutable versions, three layouts, downloadable PDFs and evidence-linked quality analysis |
| Interview practice `/dashboard/prep` | Four round categories, four levels, frozen resume context, adaptive follow-ups, pause/resume/end, history and per-answer reports |
| Dashboard `/dashboard` | Real resume/interview counts, latest resume quality, per-round averages and a basic score chart with an accessible data table |
| Usage/privacy `/dashboard/privacy` | Beta allowances, retention settings, complete app-data JSON export, queued account deletion |
| Operations `/dashboard/ops` | Administrator-only dependency/queue health, sampled request metrics, AI token/cost metadata and bounded failed-task retries |

Existing Clerk authentication/onboarding/profile/settings remain. Existing resumes are preserved even above the new beta resume count. Existing fixed-question preparation sessions are read-only history under their original 0–10 rubric; new sessions use the adaptive engine and 0–100 educational rubric. The old generation/review endpoints return 410 to prevent bypassing the new limits.

## Templates and PDF

ATS-friendly, Minimal and Developer are available in the editor. Legacy Classic/Modern settings map compatibly to ATS-friendly/Developer. Font family (Sans/Serif/Mono), text size, spacing, color and section order remain independent of resume content.

Download PDF saves pending changes first, then requests the authenticated API with the expected revision. Historical checkpoints have their own PDF action. A4 and Letter are supported. The API renders a frozen snapshot with PDFKit, not browser printing and not a remote rendering service. It uses single-column text, automatic wrapping/page flow, embedded Noto fonts, real selectable text and links. It does not rasterize the resume, fetch user URLs or accept executable HTML.

Bundled fonts support common Latin/Greek/Cyrillic characters and a Devanagari fallback for Hindi. Unsupported symbols/scripts fail with a clear 422 rather than silently disappearing. Exports are capped at 20 pages. Font family and spacing are honored, but the browser preview and PDF use different layout engines; identical line/page breaks are not promised. ATS-friendly describes the layout design, not official compatibility with every employer system.

Font files and license are in `backend/assets/fonts`, from the official [Noto font repository](https://github.com/notofonts/noto-fonts). The backend Docker image includes them. PDFs are generated in memory and downloaded directly through bearer-authenticated responses; no persistent PDF bucket or public/signed file URL is created. Sensitive downloads are marked no-store and have sanitized filenames.

## Resume quality analysis

Analysis freezes the current resume and its revision. Direct contact details and the candidate's name are excluded from provider context. The provider receives bounded, explicitly identified resume evidence; the report displays exactly which evidence was used. The task is asynchronous and survives leaving the page or restarting the API.

The server combines deterministic completeness/formatting checks and four model-assessed dimensions:

| Dimension | Weight |
|---|---:|
| Completeness | 15% |
| Content clarity | 20% |
| Achievement evidence/impact | 20% |
| Role relevance | 15% |
| Readability | 15% |
| Parseability/formatting | 15% |

Each rating is 0–4: absent/unusable, major gaps, adequate, strong, clear/well-supported. Total is the weighted rating divided by four, rounded to 0–100. Formatting is assessed only if the server successfully renders the supported PDF; otherwise that dimension is unassessed and coverage falls to 85%. Unassessed dimensions are excluded and weights renormalized. Overall scores require at least 70% weight coverage.

Reports show reasons, strengths, critical/moderate/minor issues, suggested actions, source evidence and limitations. Missing evidence receives explicit missing-section references. Reference IDs are checked server-side; nonexistent IDs and duplicate dimensions fail processing instead of being shown as grounded feedback. Suggestions do not mutate resumes. Quantified impact is not required when honest qualitative evidence is available, and no achievements or measurements are inserted.

Relevance uses the selected target role; job-description matching is later scope. The interface labels a report from an older revision. Revision changes are conservative, so a checkpoint-only revision increment can also trigger the older-revision notice even when content is unchanged.

These are educational quality estimates, never official ATS scores or hiring predictions. Schema validation and exact references improve traceability; they do not prove every model judgment is correct. Human calibration across languages and experience levels remains a public-launch quality gate.

## Adaptive text interviews and reports

Configuration requires an owned resume, expected revision, target role, category (HR, technical, behavioral, project discussion), difficulty (beginner/intermediate/advanced/expert), English/Hindi, and 5/15-minute active practice budget. Users see a processing notice before submitting personal text to the provider. No camera, microphone or recording is used.

A frozen resume snapshot belongs to each session. The server controls `preparing → awaiting_answer → processing → awaiting_answer/completed`, plus paused/failed states. Questions are generated one at a time, not as a fixed list. Follow-ups reference actual committed answers and cite their answer IDs; topic questions cite resume evidence. A bounded coverage policy alternates a topic with at most one immediate follow-up. Difficulty changes at most one level based on two previously evaluated answers.

Answer submission atomically saves text, submission key and state revision before AI work begins. Repeated submission keys replay the accepted session; concurrent different answers cannot both advance the turn. The queue evaluates the saved answer and proposes the next question. Exact excerpts must be substrings of the saved answer; unsupported quotes, invalid rubric dimensions or nonexistent source IDs reject the output. Empty answers cannot receive positive credit. Expected-answer criteria are hidden until evaluation.

Pausing preserves unsubmitted text in the open tab. AI processing and paused time are excluded from the active timer. Time budget is checked by the server when accepting an answer; the candidate may finish their current answer, after which the session closes if time is exhausted. A session has at most six questions. End during processing sets an end-request flag; the submitted answer is evaluated before closing, without adding another question. An empty or short session gets partial feedback, not an invented overall score.

Technical weights are knowledge 25%, reasoning 20%, project understanding 15%, clarity 15%, relevance 15%, behavioral evidence 10%. Project discussion emphasizes project understanding (30%). HR/behavioral use clarity 25%, relevance 25%, behavioral evidence 35%, reflection 15%. Scores use assessable 0–4 dimensions with explicit reasons/excerpts. Session dimensions average assessed answers and then apply the published weights. Overall scoring needs three answers of at least 40 trimmed characters and 70% rubric coverage; the length threshold is a minimum data-coverage rule, not proof of answer substance or quality.

Reports show original questions, saved transcripts, per-answer scores/dimensions, exact excerpts, strengths, gaps, better-answer outlines and study topics. Better-answer outlines are generic structures/concepts or candidate-stated facts, not fabricated work history. Highest/lowest assessed answers are indicated. No appearance, accent, protected characteristics, speculative emotion or hiring probability is scored. Dashboard comparisons filter by round; legacy/partial sessions are excluded.

## Free beta entitlements

| Metric | Allowance |
|---|---:|
| Active resumes | 1; legacy resumes above the cap remain editable |
| Immutable checkpoints per resume | 30, including restore-created checkpoints |
| Custom sections | 5 per resume |
| AI resume drafts | 2 / UTC month |
| Resume analyses | 3 / UTC month |
| Interview sessions | 2 / UTC month, up to six questions each |
| PDF downloads | 10 / UTC month |
| Account exports | 2 / UTC month |
| Provider call attempts, including retries | 40 / user / UTC month |
| Project-wide provider attempts | Default 1000 / UTC month; configured ceiling hard-capped at 1500 |

Limits are checked server-side in atomic MongoDB writes, not only disabled buttons. Each bucket embeds operation keys and reservation state, so checking the allowance and reserving a slot is one atomic update. Idempotency keys prevent duplicate resource creation/answer advancement. Buckets are bounded to 2000 entries. UTC monthly buckets are separate; active-resume slots are lifetime reservations released on resume deletion.

Successful product operations consume allowance once. Failed final analysis/start jobs release their product reservation, while provider attempts remain counted even on failure. Replays do not generate a second job. Deleting completed reports does not refund model work. Expired/orphan reservations are reconciled after ten minutes when no resource exists. An administrator's bounded recovery retry may complete a refunded operation without charging the product allowance again; the call-attempt safety caps still apply.

There is no payment or upgrade checkout in this beta. Do not advertise paid plans as active. Per-user HTTP requests are limited to 120/minute on the protected API; the single-process limiter supplements persistent expensive-operation quotas and is not a distributed WAF.

## Durable jobs and recovery

For this existing standalone MongoDB deployment, `Task` documents and resource state act as a small durable queue/outbox. This avoids requiring Redis just to deliver the approved feature slices. The architecture proposal's BullMQ/PostgreSQL migration remains a separate infrastructure milestone.

The API process polls and atomically leases one task at a time. A lease lasts 120 seconds; provider requests have a 45-second timeout and no hidden SDK retries. Up to two worker attempts are made. Task keys, resource revisions and conditional commits prevent duplicate turn advancement. Queue delivery is at least once, not exactly once; a retry after an ambiguous provider timeout can incur another charge, bounded by call-attempt limits.

Reconciliation reconstructs missing task records from pending analyses/session state and deletion tombstones, settles orphan reservations, and purges expired data. Failed interview answers stay saved. Users can end a failed session for a partial report; administrators can retry a failed task at most twice. Retrying does not restart an interview or discard committed answers. Failure codes are safe operational categories, never raw prompts, answers or provider error bodies.

Readiness requires MongoDB connectivity and a recent worker heartbeat. Liveness is separate. Graceful shutdown stops new claims; any interrupted lease can be recovered by the next process. This is appropriate for the current small beta, not an unlimited-throughput worker service. Move to a separate worker/BullMQ when queue age, latency or process isolation requires it.

## Privacy and account lifecycle

The privacy screen offers 30/90/180-day analysis/transcript retention, default 90. Changes also update existing records; cleanup removes expired records during reconciliation (normally every ~30 worker iterations, longer while inference is in flight). Resume drafts and checkpoints remain until explicitly deleted. There are no recordings or persistently stored PDF files.

Account export streams owned app profile, resume/checkpoint/source-note content, new and legacy interviews, analyses, usage, task metadata and applicable audit records as JSON. It never exports provider credentials or another user's records. The authenticated download honors response backpressure, and interrupted streams abort so the UI does not call a truncated file successful. Store exported personal data privately.

Confirmed deletion immediately creates a tombstone and blocks protected API access, cancels outstanding work, and queues app-data purge plus Clerk identity deletion. The worker removes resumes, checkpoints, analyses, transcripts, reports, legacy practice and owned quota/task data. Profile fields are removed from the tombstone. Provider-usage metadata is anonymized (owner becomes a common `deleted` marker and task IDs are removed), retaining aggregate cost accounting without the original user link. Minimal Clerk-subject tombstones remain to prevent resurrection from stale JWTs/webhooks; administrator audit metadata expires after 90 days.

Workers recheck tombstones before committing, and conditional writes cannot recreate deleted content. The integration suite explicitly tests deletion while an AI response is in flight. `user.deleted` webhooks request the same purge rather than removing only the user document. Late `user.updated` events cannot reactivate tombstones. Remote Clerk failure leaves the account blocked and the deletion task visibly failed for administrator retry; local data purge runs before the remote request, not after it. A successful local API response means deletion was accepted, not that every provider has already finished it.

This implementation controls live application data, not external backups or model-provider retention/training policies. Configure contractual provider processing/retention, HTTPS, encrypted managed storage, backups and restore-time tombstone replay before public deployment. Local Docker MongoDB is not a claim of managed encryption, backup SLA or legal compliance. There is no paid billing data to preserve in this beta.

## Observability and administrator access

Every request receives `X-Request-Id`; logs contain method, route pattern, status and duration. Bodies, query strings, tokens, career content and provider error text are not logged. Operations exposes database/worker readiness, uptime, sampled p95 latency, request/5xx counts, task state counts, failed-job retries, model token totals and configured cost estimates.

AI usage records have a 90-day TTL; terminal tasks have a seven-day TTL. Pending/running tasks do not expire merely because their queue is delayed. Request counters reset at process restart. Log retention/rotation is a hosting responsibility, not implemented as a misleading app-level guarantee.

Cost is nullable unless explicit input/output token prices are configured. Cached-token calls or unknown provider usage are marked unpriced rather than guessed free. Estimates exclude taxes, FX and invoice reconciliation. Deletion anonymizes usage, so aggregate retained estimates remain available without user-linked prompts.

Operations authorization is server-side: a server-managed `admin` role or `ADMIN_CLERK_IDS` allowlist is required. Career-profile mutations cannot grant roles. The navigation link appears only after the server capability check; direct unauthorized calls still receive 403. No first-user automatic promotion is performed.

## Configuration and running locally

The local app is exposed at the configured frontend port (currently 3001); API is 5001. Existing `.env` is preserved. New names are documented in `.env.example` and passed through Docker Compose:

- `ANTHROPIC_API_KEY`: required to enable live AI. **It is currently absent in the local environment checked for this change.** Do not paste secrets into chat or use a public frontend variable.
- `ANTHROPIC_MODEL`: model available to the account; default retains the existing `claude-opus-5`. Model/API capability follows official Anthropic structured-output documentation, but account availability was not verified without a key.
- `AI_ENABLED=false`: maintenance switch to disable new AI requests while preserving editing/PDF/history.
- `AI_MONTHLY_CALL_LIMIT`: project attempt cap, default 1000 and max 1500.
- `AI_INPUT_USD_PER_MILLION`, `AI_OUTPUT_USD_PER_MILLION`: optional verified current prices. Blank means unpriced, not zero.
- `ADMIN_CLERK_IDS`: comma-separated Clerk user IDs for operations access. Values stay server-side.
- Existing Clerk secret/publishable key, webhook signing secret, MongoDB URL and frontend/API origins remain required as documented in `AUTHENTICATION_SETUP.md`.

After supplying the AI key and optional administrator ID in the root `.env`, run:

```sh
docker compose up -d --build backend frontend
```

Clerk webhooks must point to `/api/webhooks/clerk` with the three user lifecycle events. Verify live password/reset/Google/verification flows with the correct instance before public use. No model API key, identity provider configuration or production service was purchased or fabricated by this change.

## Verification and practical limits

- Backend build and frontend TypeScript pass.
- Targeted ESLint passes. Unrelated pre-existing editor/video lint issues are outside this change.
- 19 backend tests pass when `TEST_MONGODB_URI` is provided. Two integration tests use randomly named disposable databases, offline provider fixtures and a fake identity deleter, never live user deletion or paid model calls. Without that environment variable those two tests explicitly skip.
- PDF tests extract text with PDF.js to verify selectable name/contact/project text and section order; font embedding and unsupported glyph handling are checked.
- Integration coverage includes atomic quota races, idempotency, owner isolation, frozen interview context, hidden answer criteria, pause/resume/end, end during evaluation, exact feedback excerpts, partial/overall totals, queue reconstruction, bounded failure/admin recovery, retention, account export and deletion during in-flight inference.
- Six Chrome browser scenarios cover autosave races, conflicts, custom/core entries, reordering/layouts, versions, PDF download, analysis polling/evidence display and adaptive interview/report interactions. They use the real components inside isolated fixtures with mocked HTTP/Clerk, not live account authentication.
- Production images are rebuilt and local service health is checked after implementation.

Live LLM grading quality/account model access cannot be claimed verified without a configured provider key. Human rubric calibration, privacy/legal review, load/restore drills, managed encryption/backup configuration and production monitoring alerts remain public-launch gates. The delivered beta feature implementation is not a claim that all operational requirements of a public production SaaS are already satisfied.
