# Advantage Loan Tracker

A personal tracker for a **Bank of Baroda Home Loan Advantage / Baroda Max Savings Home Loan** — a home loan
linked to a savings account, where interest is charged only on the outstanding amount **minus the end-of-day
balance in the linked savings account**.

Live: **https://advantage-loan-tracker.web.app** (Google sign-in; only the owner and people the owner approves can open it).

It answers the everyday questions about such a loan: how much interest is building up today, what the next EMI
will cost, how much the savings balance is saving, when the loan can be closed, and whether the bank's figures
match.

---

## Features

| Area | What it does |
|---|---|
| **Overview** | Outstanding, savings balance, the amount interest is charged on, next EMI split (interest / principal), today's interest, interest saved so far, projected payoff date, milestones, outstanding-over-time chart |
| **Daily interest** | Day-by-day table for any EMI period: money in/out, savings balance, outstanding, interest for the day, running total |
| **Savings balance** | Upload the savings **and** home-loan statements together (PDF, Excel, CSV from bob World, password-protected PDFs supported), manual balance entries, bulk paste, extra payments |
| **History** | EMIs paid, tracker interest vs the bank's, **Bank match** (EMI left savings = EMI reached loan, interest, outstanding — checked to the rupee), year report (print / save as PDF) |
| **24-year schedule** | Month-by-month and yearly amortisation, past from real data, future projected |
| **What-if** | Savings balance scenarios, repo-rate change simulator, bonus / lump-sum planner (keep in savings vs prepay) |
| **Smart payoff** *(owner only)* | Salary, expenses and card-bill timing → payoff date per plan, debt-free goal (finds the monthly amount needed) |
| **Tax** *(owner only)* | Sec 24(b) and 80C by financial year, old vs new regime, tax saved |
| **Spending** *(owner only)* | Statement entries grouped by category, top payees (re-categorise once, remembered), monthly in/out chart |
| **Loan settings** | Loan terms, **disbursements in parts** (paid out / planned), rate changes, sharing (view / admin), daily backups with a viewer (what is in each one and what changed), backup file export/restore |
| **App** | Installable (PWA) with an offline copy of the data; account menu with profile photo, install and sign-out |

### How the interest is worked out

Following the sanction letter and the bank's scheme rules:

- Interest is daily: `max(0, outstanding − savings balance at end of day) × rate ÷ 365`, charged at monthly rests with each EMI.
- Only the amount the bank has actually **paid out** (disbursements) carries interest; future parts can be added as *planned*.
- EMI is fixed; a rate change moves the tenure (rate changes apply from the date entered — the bank applies repo changes from the 1st of the following month).
- After the last real balance, savings are projected from the salary / expense plan, with the EMI taken out on each EMI date.
- **Bank figures win**: once the loan statement shows an EMI posted, that period uses the bank's interest and outstanding, so the tracker and the bank stay identical and projections start from the real balance. The tracker's own estimate is still shown in *Bank match* to show how close the rule is.

### Sharing and privacy

- Anyone with the link signs in with Google and taps **Request access**; the owner approves or declines in *Loan settings → Sharing*.
- Approved people get **view only**: no edits, uploads or restores, and they never see salary, Smart payoff, Tax or Spending.
- The owner can make an approved person an **admin** (*Loan settings → Sharing → Make admin*, tap twice to confirm) and take it back with **Remove admin**. An admin edits everything and sees salary, Smart payoff, Tax and Spending like the owner, but cannot see or create backups, open the Sharing list, approve / remove people or make other admins. Stored as `role: "admin"` on `access/<email>`; only the owner can write that document, and a request cannot carry a role.
- A change of role takes effect straight away: an open page reloads itself.
- **Salary password** (owner only, *Smart payoff → Salary password*): once set, **Show salary** asks for it. The salary then stays visible until the tab is closed, Hide is tapped or the page is idle for 5 minutes. Only a salted PBKDF2 hash is stored (`private/lock`); only the owner can set, change, remove or reset it, and admins need the owner to share the password. It is a display lock: people signed in as owner or admin can still read `private/salary` in the database. Setting, changing, removing or resetting the password needs a **fresh Google sign-in** (within 5 minutes; Google asks for the account password again), enforced by the database rules (`auth_time`), so someone using an already-open session cannot reset it.
- Enforced in Firestore security rules, not just hidden in the page. Salary lives in a document (`private/salary`) only the owner and admins can read.
- Statement files are read in the browser; only dates, amounts, descriptions and balances are stored.

### Loan settings safety

Firestore keeps an offline copy of the data in the browser, and that copy can fall behind the server while still saying it is up to date (on 6 Oct 2026 it showed the settings and the salary password as missing, and old dates). The page guards against it:

- After sign-in the loan settings (and the salary, for the owner and admins) are read straight from the server (Firestore REST) and compared with what the page got.
  - **Same:** nothing happens and saving is allowed.
  - **Different:** the offline copy is cleared and the page reloads, at most once every 5 minutes per tab.
  - **Still different after that:** the page shows the server's copy, ignores the stale one, and says so.
- The Loan settings and Smart payoff forms do not save until this check has passed, so a stale copy can't overwrite the real dates or zero the salary. Nothing is written to the database by the check itself.
- The salary password is also read from the server at sign-in and every time **Show salary** is tapped.
- When the database has no loan settings, the code defaults are this loan's own terms (disbursal 21-09-2026, first EMI 10-10-2026, ₹40 L, 7.30%, 288 months), so no placeholder dates are shown. The salary plan is never in the code.
- Firestore rules don't let the app delete `loan/settings` or `private/salary`.
- Every save of the loan settings also writes a copy to `private/settingsMirror` (owner and admins only). Nothing reads it at the moment; it is kept as an extra copy.

### Backups

- **Daily backup** into Firestore (`backups/<YYYY-MM-DD>`, India date), in the cloud only: made when the owner opens the tracker, and every day at 23:30 IST by GitHub Actions (`.github/workflows/daily-backup.yml`, runs `hosting/backup.js` with a service-account key in the repo secret `FIREBASE_SA_KEY`). A second backup on the same day gets `_HHMMSS`; **Back up now** adds one too.
- Backups are built from the **server** (Firestore REST), not from the page's copy, and carry a SHA-256 `hash` of the data. If a new backup has the same hash as the newest earlier one, the **older one is deleted** (parts first, then the head), so identical copies don't pile up. The rules allow deleting a backup only when it is an exact copy (same hash) of the newer backup named in `backupsMeta/dedupe`; backups without a hash (made before daily backups) are never deleted. Otherwise backups are never changed.
- A backup holds the whole app: loan settings (dates, amount, rate, EMI) and the salary plan, balances, rate changes, prepayments, bank statements, transactions, disbursements, loan statement rows, **plus** the goal, tax and spending categories, the salary password (hash) and the sharing list. The GitHub job (`hosting/backup.js`) makes exactly the same backup, with the same hash.
- Restoring brings back everything except the **salary password and the sharing list**: those stay in the backup but are never restored automatically, so an old backup cannot reset the password or give access back to someone who was removed.
- Any backup can be restored from *Loan settings → Daily backups*, or a backup file can be downloaded / restored.

---

## Tech

- **Single page**: `index.html` — vanilla JavaScript, no build framework. Chart.js for charts, pdf.js and SheetJS (loaded on demand) for reading statements.
- **Firebase** (Spark / free plan): Hosting, Authentication (Google), Cloud Firestore (asia-south1).
- The same `index.html` also runs without Firebase config (local state only), which is how it is tested.

## Project structure

```
index.html                 the whole app (markup, styles, script)
hosting/
  build.py                 wraps index.html with the Firebase config + SDK → public/index.html, copies manifest/sw
  firebase.json            hosting headers, rules file
  .firebaserc              Firebase project id
  firestore.rules          security rules (owner, admins, approved viewers, create-only backups)
  manifest.json, sw.js     PWA manifest and service worker (network-first page, offline fallback)
  make-icons.js            draws the app icons (public/icon-*.png) without an image library
  backup.js                daily backup into Firestore from the server (GitHub Actions; or by hand with the Firebase CLI login)
  test-rules.js            checks firestore.rules with Google's Rules Test API (113 cases)
  login.js, 1-login.cmd    one-time Firebase CLI login
  2-deploy.cmd             build + deploy
  public/icon-*.png        app icons
```

## Setup

Requirements: Node.js 18+ (a portable Node works without admin rights), Python 3, a Firebase project.

1. **Firebase project** — enable *Authentication → Google*, create *Firestore* (production mode), register a web app.
2. **Config** — put the web app config and the owner's Google email in `hosting/build.py` (`CONFIG`, `ownerEmail`),
   the same email in `hosting/firestore.rules` and `hosting/test-rules.js`, and the project id in `hosting/.firebaserc`.
3. **Install tools**
   ```bash
   cd hosting
   npm install            # firebase-tools
   node make-icons.js     # app icons
   ```
4. **Log in** to the Firebase CLI once: `npx firebase login` (or run `1-login.cmd`).

## Build and deploy

```bash
cd hosting
python build.py
npx firebase deploy --only hosting,firestore:rules
```

Or double-click `hosting/2-deploy.cmd`.

## Testing

```bash
cd hosting
node test-rules.js         # security rules: owner / admin / stranger / pending / approved viewer, create-only backups
```

The engine and UI were checked by loading `index.html` in jsdom and comparing against hand calculations
(e.g. ₹32,00,000 × 7.30% ÷ 365 = ₹640.00 a day) and against real statement layouts.

## Monthly routine

1. Download the **savings** and **home loan** statements from bob World for the same period.
2. *Savings balance → Upload bank statements* → choose both → **Read files** → **Import**.
3. Check *History → Bank match* — every posted EMI should read **✓ Matched**.

## Notes

- Built for one borrower's Bank of Baroda loan; statement parsing is tuned to bob World statements and may need adjusting for other banks.
- Figures after today are estimates. For tax filing use the bank's interest certificate.
- Not financial advice.

## Daily backup setup (one time)

1. Google Cloud console, project `advantage-loan-tracker` → *IAM & Admin → Service accounts* → **Create service account** `backup-bot` → role **Cloud Datastore User** → Done.
2. Open `backup-bot` → *Keys* → **Add key → Create new key → JSON** (a file downloads; keep it private).
3. GitHub repo → *Settings → Secrets and variables → Actions* → **New repository secret** `FIREBASE_SA_KEY` = the whole content of that file. Then delete the file from the PC.
4. GitHub → *Actions → Daily backup → Run workflow* once; the log ends with `Saved backup …`.
