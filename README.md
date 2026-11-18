# Smart Calendar Task Board (PH)
Calendar + per-date sticky-note boards, login, and admin user management.
Accounts and boards are stored on Netlify (Functions + Blobs), so every PC sees the same data.

## Deploy (must be Git or CLI — plain drag-and-drop does not install the function's dependency)
1. Push this folder to a GitHub repo, then Netlify > Add new site > Import from Git (no build command, publish dir `.`).
   OR: `npm i -g netlify-cli && npm install && netlify deploy --prod`
2. Open the site and log in with the default admin account (`admin` / `admin123`). A banner prompts you to change it — use **🔑 Account**.

## Dashboard features
Overdue / Today / Next 7 days / Inbox panel, quick-add parser (`Call supplier tomorrow 3pm !now`, `!inbox`),
drag tasks onto any day (or use the 📅 picker), week view, due times, browser reminders + daily digest,
and optional morning rollover of overdue "Now" tasks. Reminders and rollover run while the app is open in a browser tab.

## Changelog — hardening & polish pass
**Server (`netlify/functions/api.mjs`)**
- Sessions are stored per user (`sess:<userId>:<random>`): password change / reset / disable / delete signs out that user's devices; 30-day expiry, max 15 sessions per account (old/expired pruned).
- Login throttling per IP (10 failures / 15 min → 429) and equal-cost hashing whether or not the user exists. Async scrypt (does not block the function).
- Board saves carry a revision (`_rev`). A stale device gets `409` plus the latest board instead of silently overwriting. 4 MB board cap (`413`).
- Self-service `POST /api/password` for every user (current password required).
- Backup restore validates users/boards before replacing anything and signs out deleted users.
- Tolerates empty POST bodies (fixes logout).

**App (`app.js`)**
- Save engine: debounced, retries on failure (8 s), "✓ Saved / Saving… / ⚠ Not saved" indicator, flush on tab close, warns before leaving with unsaved edits.
- Multi-device: tab re-syncs from the server on focus / every 60 s (never while a dialog is open or edits are pending); 409 conflicts adopt the server copy and tell you.
- Loaded boards are normalised (`norm()`), colours sanitised.
- Calendar built from a per-render date index (faster), keyboard accessible (Enter/Space), aria labels.
- Undo for complete / trash / erase / column moves; Empty-trash; edits survive re-render while typing.
- 🔑 Account dialog (change password) + default-password banner; focus trap, Esc handling, focus restored on close; no mobile keyboard pop-up on touch.
- Quick-add rejects impossible dates (e.g. Feb 30); daily digest is per user.
- Friendly "Can't reach the server" screen with Retry.

**UI (`style.css`, HTML)**
- Rewritten stylesheet with theme variables (light / dark / pink / CEPALCO, incl. warning colours), focus rings, reduced-motion support, mobile bottom-sheet dialogs, safe-area padding.
- Shared styles for login/users pages, favicon, theme-color, no flash of wrong theme.

## Optimization pass
- Date formatters are created once (previously rebuilt on every `todayStr()` call, i.e. per dashboard row).
- Repeating tasks stop generating ~18 months ahead and stale generation markers (>13 months old) are pruned, so the board can't grow toward the 4 MB cap just by browsing the calendar.
- Background sync polls `/api/me?rev=N`; the server answers `unchanged` without sending the board when nothing changed.

## Verification
Server: 40 API tests (auth, sessions, throttling, conflicts, backup, admin guards) — all pass.
Performance: 10 years of calendar browsing adds ≤401 tasks; month render with 200 tasks ≈ 4 ms.
Browser (Playwright, desktop + mobile): 41 end-to-end checks — all pass. The two console "errors" in the run are the intentional 401 (wrong password) and 409 (conflict) tests.
