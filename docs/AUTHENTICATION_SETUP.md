# Authentication, onboarding and settings

Implemented slice: existing Next.js + Clerk and Express/MongoDB. This change does not perform the proposed NestJS/PostgreSQL migration.

## App behavior

- `/sign-in` uses Clerk's managed UI, including password recovery when enabled in the instance. It preserves an intended redirect, otherwise opens `/dashboard`.
- `/sign-up` sends successful registrations to `/onboarding`, including Google registrations handled by Clerk. Clerk controls email verification and enabled authentication methods.
- `/onboarding` collects name, education, experience, target role/industry, skills, goals, language, and optional annual salary range/currency. Name, experience and role are required to complete; other fields are optional. Save draft persists partial input; returning resumes it.
- `/dashboard` and its workspace children check stored onboarding status before mounting workspace UI. Account settings remain available during incomplete onboarding. This is a user-flow gate; API authorization independently uses the verified Clerk session.
- `/dashboard/profile` edits career preferences and existing bio/links.
- `/dashboard/settings` uses Clerk's managed account/security interface for name/email, connected accounts, password and sessions as enabled by the instance.
- API profile reads provision a missing local user from verified Clerk identity when `user.created` has not arrived yet. A verified primary email is required for this provisioning path. The app never accepts a browser-supplied Clerk ID, email, admin role or completion timestamp as profile data.
- All existing protected API routes now use the installed SDK's function-style auth through `getAuth()`, and return JSON 401 for anonymous calls.
- Webhooks verify signatures against the raw body, use the primary email ID, preserve career fields, and return a retryable 503 on persistence failure.

Language is a saved preference, not a claim that voice or every interview mode already supports both languages. No billing or subscription behavior is added.

## Clerk instance configuration (must be checked by an instance administrator)

The repository cannot establish which authentication methods are enabled in a remote Clerk instance. The following settings and end-to-end checks remain unverified; no dashboard settings were changed by this implementation.

1. Select the correct development instance in [Clerk Dashboard](https://dashboard.clerk.com/). Enable email sign-up/sign-in, require an email address, and enable password authentication. Require email verification during registration. Confirm the password-recovery option is enabled and email delivery works.
2. Enable Google under social connections. Configure production OAuth credentials and allowed redirect origins before production use; development credentials do not establish production readiness.
3. Configure app paths: sign-in `/sign-in`, sign-up `/sign-up`, home `/dashboard`. The app sets sign-up completion to `/onboarding`; do not override this with a conflicting dashboard redirect.
4. Configure the backend webhook at `/api/webhooks/clerk` (see the route file) for `user.created`, `user.updated`, `user.deleted`. Set its signing secret server-side; a public frontend URL cannot reach a local API without a development tunnel.
5. Configure account profile/security capabilities and user deletion policy deliberately. Managed account deletion is an identity operation; complete resume/transcript data export and purge remain a separate planned privacy feature. Disable self-service account deletion in Clerk until the application-wide deletion lifecycle is ready for public launch.
6. Keep development and production keys, allowed origins and webhook secrets separate. No Clerk secret or webhook signing secret belongs in a `NEXT_PUBLIC_` variable.

The managed screens follow instance settings; rendering `<SignIn>` alone does not enable Google or password authentication. See [Clerk SignIn documentation](https://clerk.com/docs/nextjs/reference/components/authentication/sign-in) and [UserProfile documentation](https://clerk.com/docs/nextjs/reference/components/user/user-profile).

## Environment

Use `.env.example` as the variable-name reference. Docker Compose already injects the Clerk keys into the correct services. For independent local development, the backend needs `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `MONGODB_URI` and `FRONTEND_URL`. The frontend needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` and `NEXT_PUBLIC_API_URL` in its own local environment or inherited process environment. Next.js does not automatically load the repository-root environment file from inside `frontend/`.

Never use placeholder credentials to claim successful live authentication. With the API and MongoDB running, start each project using its existing `npm run dev` script. API URL/port must agree; Docker maps the backend to port 5001 by default in the provided environment example.

## API contract

- `GET /api/users/me`: authenticated current user; provisions from Clerk only if absent locally.
- `PUT /api/users/update-profile`: partial allowlisted profile update, 422 on invalid fields/range, 409 on a concurrent database revision change.
- `POST /api/users/onboarding/complete`: validates the saved profile merged with provided changes, requires name/experience/role, and records completion server-side once.

Profiles have no arbitrary metadata mutation. Salary must be integer minor-free annual units (for INR, whole rupees per year), nonnegative and min ≤ max. Both bounds may be omitted. Links accept only HTTP/HTTPS URLs. Skills, strings and arrays have server-side size/type limits. Session authentication is authoritative; the dashboard gate does not substitute for endpoint ownership checks.

Concurrent updates read and compare the database revision so simultaneous conflicting writes cannot create invalid ranges. This is not a client-side multi-tab merge system: a form saved later can intentionally replace older values. A 409 requires reload before retry.

## Verification

Automated checks run for this slice:

- `npm test --prefix backend`: 11 tests pass (guards, ownership, protected fields, completion validation, salary/URL/size validation, concurrent update, delayed-webhook identity provisioning, unverified-primary rejection, and signed webhook tamper protection). Tests isolate the controller/validation/identity boundary with fake persistence; they do not assert real MongoDB integration or live Clerk credentials.
- `npm run build --prefix backend`: passes.
- Frontend `npx tsc --noEmit`: passes.
- Targeted ESLint on changed frontend files: passes.
- Full frontend lint retains pre-existing `any` errors in `components/CodeEditor.tsx` and warnings in existing editor/video code.
- Frontend production build attempted with the inherited root environment; blocked fetching existing Geist/Geist Mono resources from Google Fonts in this environment. No successful production build is claimed.

Manual end-to-end checks required with a configured instance:

1. Anonymous dashboard/profile/settings access redirects to sign-in; anonymous `/api/users/me` returns JSON 401.
2. Register with email/password, verify delivered code, arrive at onboarding. An unverified registration must not receive a usable verified session before completing configured Clerk verification.
3. Save a partial onboarding draft, reload, complete required fields, arrive at dashboard. Refresh persists completion. Existing users with no completion timestamp are prompted once.
4. Sign out and sign back in; completed users reach the dashboard; incomplete users return to onboarding.
5. Complete Google sign-up/sign-in, including callback and new/existing-account cases.
6. Use Forgot password, verify recovery code, choose a new password, and verify old credentials no longer work.
7. Edit identity/email/security in settings; complete any reauthentication and new-email verification. Update career preferences and reload them independently.
8. Disable/retry webhook delivery in development; a new verified user still loads a profile through the authenticated fallback. Replay a signed user update without losing onboarding/preferences.
9. Use two different test users: neither token can read/update the other's profile. Expired/invalid tokens cannot modify data.
10. Disconnect API/MongoDB or expire the session while onboarding; show a useful error and retry without claiming save success.

The remote configuration and browser checks above are release gates. They are not marked passed by the unit tests.
