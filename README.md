# Smart Calendar Task Board (PH)
Calendar + per-date sticky-note boards, login, and admin user management.
Accounts and boards are stored on Netlify (Functions + Blobs), so every PC sees the same data.

## Deploy (must be Git or CLI — plain drag-and-drop does not install the function's dependency)
1. Push this folder to a GitHub repo, then Netlify > Add new site > Import from Git (no build command, publish dir `.`).
   OR: `npm i -g netlify-cli && npm install && netlify deploy --prod`
2. Open the site and log in with the default admin account, then change its password in Users.

## Dashboard features
Overdue / Today / Next 7 days / Inbox panel, quick-add parser (`Call supplier tomorrow 3pm !now`, `!inbox`),
drag tasks onto any day (or use the 📅 picker), week view, due times, browser reminders + daily digest,
and optional morning rollover of overdue "Now" tasks. Reminders and rollover run while the app is open in a browser tab.
