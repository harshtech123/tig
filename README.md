# TIG Gym – fee manager

An iPhone app for **The Iron Garage Gym** admin: member profiles, fee tracking, due-date reminders, WhatsApp/SMS reminders with a UPI QR code, and automatic Google Drive backup. No server is needed.

It is an installable web app (PWA). It runs full-screen from the Home Screen, works offline, and keeps all data on the phone.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Put it on the iPhone (free)

1. Push this folder to a GitHub repo (branch `main`).
2. Repo → **Settings → Pages → Source: GitHub Actions**. Every push deploys to
   `https://<user>.github.io/<repo>/`.
3. On the iPhone, open that link in **Safari** → **Share** → **Add to Home Screen**.
4. Open the app from the Home Screen → tap **Turn on fee alerts**.

## Google Drive backup (one-time, free)

1. <https://console.cloud.google.com> → new project → enable **Google Drive API**.
2. **OAuth consent screen** → External → add your Gmail as test user → **Publish app**.
3. **Credentials → OAuth client ID → Web application**, Authorised JavaScript origin:
   `https://<user>.github.io` (no path).
4. Paste the Client ID in the app under **Settings → One-time Google setup**, or save it
   as a repo variable `GOOGLE_CLIENT_ID` (Settings → Secrets and variables → Actions → Variables)
   so it's built in.
5. In the app, tap **Connect Google Drive**.

The backup is a single file in Drive's hidden app folder (`drive.appdata` scope, so the app cannot
see your other files). Every change marks data as unsaved. After 4 seconds without edits, one upload
**overwrites the same file**, so a burst of edits causes one upload, not one per tap. Drive keeps
earlier revisions of the file. On a new phone, connect and choose **Restore**. The app never
overwrites an existing backup without asking first.

**Export backup file** in Settings saves a `.json` file to Files or iCloud. It works without Google.

## How reminders work on iPhone

- **When you open the app:** a notification, the red badge on the app icon, and the Due tab list fees due
  within the reminder window (default 2 days) and overdue fees.
- **When the app is closed:** iOS does not let web apps schedule notifications. Use **Remind**
  on a member, or **Settings → All to Calendar**. This adds the due dates to the iPhone Calendar
  with alerts at 9 AM, 2 days before and on the due date.

## Messages

- **WhatsApp → Send QR + message:** creates a branded "scan to pay" image (UPI QR with the
  amount filled in, plus your UPI ID) and opens the share sheet. Pick WhatsApp, then the member.
  The message text is also copied, so you can paste it if WhatsApp drops the caption.
- **WhatsApp → Open chat:** opens that member's chat directly with the text filled in.
- **SMS:** opens Messages with the text and your UPI ID.

Edit the message wording in **Settings → Message templates**.
