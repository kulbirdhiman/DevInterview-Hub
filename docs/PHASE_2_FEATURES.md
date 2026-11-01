# Phase 2 implementation

1 November 2026. The existing Next.js, Express, MongoDB and Clerk stack is retained.

## Delivered paths

`/dashboard/career` provides four tools against an owned, revision-checked resume:

- Pasted job-description matching: mandatory/preferred requirements, supported/partial/missing/unclear evidence, preparation topics and linked frozen evidence. The server computes a transparent educational score: requirements 50%, scope 25%, responsibilities 15%, terminology 10%; support values 1/0.5/0. Unclear requirements are excluded. Assessed dimension weights are renormalized; overall scores require 70% dimension coverage. These are heuristic evidence scores, not employer endorsement or hiring predictions.
- Reviewed rewrites: summary/headline proposals with before/after text, reasons and evidence. Each edit requires selection and explicit factual review. Applying checks the original revision and creates an immutable checkpoint before changing the draft. Changes made elsewhere cause a conflict. Existing active-resume quotas are preserved; tailoring updates the draft with a recoverable checkpoint rather than creating an additional active resume.
- Text resume import: paste text or select a UTF-8 `.txt` file up to 30 KB. Extraction runs as a durable task. Users review warnings and correct contact and structured sections using the existing section forms. Nothing is applied until explicit review confirmation. Import replaces the selected resume and saves a checkpoint first. Contact details in imported source text go to the configured provider; this is disclosed before generation.
- Grounded seven-day coach: optionally select up to five owned completed interviews. Recommendations cite frozen resume/evaluated-answer evidence or are labeled general guidance. Each day has an exercise and completion criterion. Completion tracking persists and can be toggled by the owner. Exercise text and completion criteria can be edited; customized days are labeled.

Interview practice now offers 30/60-minute soft active budgets as well as 5/15 minutes. Longer sessions have at most twelve questions; shorter sessions retain six. Provider-call limits still apply, so the longest budget does not guarantee uninterrupted AI availability for every possible follow-up.

The optional voice prototype uses browser speech recognition and speech synthesis. Start dictation is an explicit action after a browser-provider disclosure. Audio may be processed by that browser's speech service. Only reviewed, explicitly submitted text reaches this app's interview engine. There is no stored audio. Pausing, submitting and leaving stop active speech. Unsupported browsers and permission failures preserve typed practice. English/Hindi locale hints are supplied, without claiming verified recognition accuracy.

Completed interview reports compare the latest earlier scored session with the same role, category, difficulty, language, duration and rubric. Per-dimension ratings are shown side by side. Comparisons explain that different questions/evidence affect scores. Detailed report JSON can be downloaded locally.

## Operations and privacy

Career tasks reuse the durable queue, bounded worker attempts, provider quotas, sampled usage metadata and administrator recovery. A new `career` allowance permits eight tasks per user per UTC month. Replays reuse the saved resource. Successful tasks consume once; terminal failures release the career allowance. Provider attempts remain counted. Reconciliation reconstructs missing queue records and releases orphan reservations.

New records have owner-scoped access, retention, data export and account deletion coverage. Original task input is removed after success (import reports retain the original text for factual review); reports retain the evidence needed to explain their recommendations. Applying rewrites/imports never bypasses revision validation or the 30-checkpoint bound. Career results can be deleted individually.

No new service keys or paid services are required beyond the existing AI configuration. No live model call or deployment is performed by this implementation.

## Verification and remaining roadmap scope

Backend tests include weighted match scoring and fabricated citation rejection. A disposable-database integration test covers queue reconstruction, replay, ownership, reviewed edits, checkpoint preservation, stale-review rejection, coach progress and deletion. It requires `TEST_MONGODB_URI`; it never calls a live AI provider or identity service.

This is a bounded Phase 2 implementation, not completion of every integration in the architecture proposal. PDF/DOCX uploads, quarantined object storage, malware scanning, isolated document parsers/OCR, server-side STT/TTS and speech cost attribution remain unimplemented. Browser speech is a prototype alternative, not that server speech pipeline. Rewrites currently cover summary/headline, not arbitrary experience bullets. Tailoring preserves a checkpoint rather than a separate resume copy. Human grading calibration and live provider/browser validation remain release work.

## Local verification results

- Backend TypeScript build and frontend production build passed. The frontend build required network access to download the existing Google Fonts.
- Targeted frontend ESLint and frontend TypeScript passed.
- Backend suite: 19 passing, three MongoDB-dependent integration tests skipped because no test database was configured and the Docker daemon was stopped.
- All six existing Chrome browser regression scenarios passed, including editor autosave/conflicts, versions, export/analysis and interview interactions. These are regression checks, not live microphone/provider or new career-screen end-to-end validation.
