# Development notes

Read `CLAUDE.md` for build, test, authentication, and release conventions.

## OAuth redirects

`login()` must resolve relative authorization redirects against the current request URL. Only the authentication origin may receive the session cookie. Read the authorization code only from the exact configured callback origin and path, without fetching that callback. Reject URL credentials, fragments, HTTPS downgrades, and other destinations. Do not include redirect URLs in errors because their query strings can contain credentials.

Tests cover these cases in `tests/auth-session-login.test.ts`. Run `npm run test:coverage` and `npm run build` after authentication changes. A read of `/frames` verified password login on September 18, 2026. Repeat that read before claiming compatibility with a later API change.
