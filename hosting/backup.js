// Daily backup of every loan, into Firestore loans/<loanId>/backups/<id>, built from the server (Firestore REST), never
// from a browser cache. Run by GitHub Actions every night (service account key in FIREBASE_SA_KEY, see
// .github/workflows/daily-backup.yml) or by hand with the Firebase CLI login: node backup.js [loanId]
// The website makes the same backup when a loan's owner opens it (index.html, runBackup): same layout, same hash.
// If a loan's new backup is identical (same hash) to its newest earlier one, the older one is deleted; backups without
// a hash are never deleted. Loans being deleted are skipped. The log shows no names or emails: only a short loan id,
// counts and a short hash. node backup.js --dry only reads (and compares with the newest backup).
const crypto = require("crypto");

const PROJECT = "advantage-loan-tracker-hub";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const COLS = ["balances", "rates", "prepay", "statements", "txns", "disb", "loantx"];
const PRIVATE = ["goal", "tax", "categories", "lock"];
const PARTS = ["settings"].concat(COLS, ["private", "access"]);

function decode(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("mapValue" in v) return fromFields(v.mapValue.fields);
  return null;
}
function fromFields(f) { const o = {}; for (const k of Object.keys(f || {})) o[k] = decode(f[k]); return o; }
function encode(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === "string") return { stringValue: x };
  if (typeof x === "boolean") return { booleanValue: x };
  if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(encode) } };
  return { mapValue: { fields: toFields(x) } };
}
function toFields(o) { const f = {}; for (const k of Object.keys(o)) f[k] = encode(o[k]); return f; }

// Canonical JSON (keys sorted at every level) so the same data always gives the same hash, here and in the website.
function canon(x) {
  if (Array.isArray(x)) return x.map(canon);
  if (x && typeof x === "object") { const o = {}; Object.keys(x).sort().forEach((k) => { o[k] = canon(x[k]); }); return o; }
  return x;
}
const snapshotHash = (snap) => crypto.createHash("sha256").update(JSON.stringify(canon(snap))).digest("hex");
// Backup ids use the date and time in India.
function ist(now) { const t = new Date(now.getTime() + 330 * 60000).toISOString(); return { day: t.slice(0, 10), time: t.slice(11, 19).replace(/:/g, "") }; }

// One loan's backup. base is the loan's document URL (BASE + "/loans/<id>").
async function runBackup({ fetchFn = fetch, token, base, now = new Date(), manual = false, dry = false, log = console.log }) {
  const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const ROOT = base;
  const call = async (method, url, body) => {
    const r = await fetchFn(url, { method, headers, body: body && JSON.stringify(body) });
    if (r.status === 404 && method === "GET") return null;
    if (!r.ok) throw new Error(`${method} ${url.replace(ROOT, "")} -> ${r.status}`);
    return method === "DELETE" ? true : r.json();
  };
  const getDoc = async (path) => { const d = await call("GET", `${ROOT}/${path}`); return d ? fromFields(d.fields) : null; };
  const list = async (col) => {
    const rows = [];
    let page = "";
    do {
      const res = (await call("GET", `${ROOT}/${col}?pageSize=300${page ? "&pageToken=" + encodeURIComponent(page) : ""}`)) || {};
      for (const d of res.documents || []) rows.push({ id: decodeURIComponent(d.name.split("/").pop()), data: fromFields(d.fields) });
      page = res.nextPageToken || "";
    } while (page);
    return rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  };

  // 1. What is in the database right now.
  const snap = { loan: (await getDoc("loan/settings")) || {}, salary: (await getDoc("private/salary")) || {}, private: {}, access: await list("access"), cols: {} };
  for (const k of PRIVATE) { const d = await getDoc(`private/${k}`); if (d) snap.private[k] = d; }
  for (const c of COLS) snap.cols[c] = await list(c);
  const hash = snapshotHash(snap);
  if (dry) {
    // Reads only: compare with the newest backup the website (or an earlier run) made.
    const newest = (await list("backups")).sort((a, b) => ((a.data.created || "") < (b.data.created || "") ? 1 : -1))[0];
    log(`  dry run: hash ${hash.slice(0, 12)}; newest backup ${newest ? newest.id + " " + String(newest.data.hash || "").slice(0, 12) + (newest.data.hash === hash ? " (same data)" : " (data changed since)") : "none"}`);
    return { id: null, hash, replaced: null, counts: null };
  }

  // 2. Save it as a new backup.
  const heads = await list("backups");
  const prev = heads.slice().sort((a, b) => ((a.data.created || "") < (b.data.created || "") ? 1 : -1))[0];
  const { day, time } = ist(now);
  const id = manual || heads.some((h) => h.id === day) ? day + "_" + time : day;
  const create = (collPath, docId, data) => call("POST", `${ROOT}/${collPath}?documentId=${encodeURIComponent(docId)}`, { fields: toFields(data) });
  await create(`backups/${id}/parts`, "settings", { settings: Object.assign({}, snap.loan, snap.salary) });
  for (const c of COLS) await create(`backups/${id}/parts`, c, { rows: snap.cols[c] });
  await create(`backups/${id}/parts`, "private", { docs: snap.private });
  await create(`backups/${id}/parts`, "access", { rows: snap.access });
  const counts = {};
  COLS.forEach((c) => { counts[c] = snap.cols[c].length; });
  counts.access = snap.access.length; counts.private = Object.keys(snap.private).length;
  await create("backups", id, { month: id, created: now.toISOString(), counts, hash });

  // 3. Same as the newest earlier backup: that older copy goes (parts first, the head last).
  let replaced = null;
  if (prev && prev.id !== id && prev.data.hash && prev.data.hash === hash) {
    await call("PATCH", `${ROOT}/backupsMeta/dedupe`, { fields: toFields({ newId: id, oldId: prev.id, at: now.toISOString() }) });
    for (const p of PARTS) await call("DELETE", `${ROOT}/backups/${prev.id}/parts/${p}`);
    await call("DELETE", `${ROOT}/backups/${prev.id}`);
    replaced = prev.id;
  }
  log(`  saved ${id} (${COLS.map((c) => c + " " + counts[c]).join(", ")}, access ${counts.access}, private ${counts.private}), hash ${hash.slice(0, 12)}` +
    (replaced ? `; removed ${replaced}, it was identical` : ""));
  return { id, hash, replaced, counts };
}

async function accessToken() {
  if (process.env.FIREBASE_SA_KEY) {
    // GitHub Actions: a service account with the "Cloud Datastore User" role.
    const { GoogleAuth } = require("google-auth-library");
    const client = await new GoogleAuth({ credentials: JSON.parse(process.env.FIREBASE_SA_KEY), scopes: ["https://www.googleapis.com/auth/datastore"] }).getClient();
    return (await client.getAccessToken()).token;
  }
  const auth = require("firebase-tools/lib/auth");
  const { configstore } = require("firebase-tools/lib/configstore");
  const tokens = configstore.get("tokens");
  if (!tokens || !tokens.refresh_token) throw new Error("No FIREBASE_SA_KEY and the Firebase CLI is not logged in (run 1-login.cmd once).");
  return (await auth.getAccessToken(tokens.refresh_token, [])).access_token;
}

// Every loan (or just the ones named), one after another. A loan that fails doesn't stop the others; the run fails at
// the end if any did, so GitHub shows it.
async function runAll({ fetchFn = fetch, token, only = [], now = new Date(), dry = false, log = console.log }) {
  const headers = { Authorization: "Bearer " + token };
  const loans = [];
  let page = "";
  do {
    const r = await fetchFn(`${BASE}/loans?pageSize=300${page ? "&pageToken=" + encodeURIComponent(page) : ""}`, { headers });
    if (!r.ok) throw new Error(`GET loans -> ${r.status}`);
    const res = await r.json();
    for (const d of res.documents || []) loans.push({ id: d.name.split("/").pop(), data: fromFields(d.fields) });
    page = res.nextPageToken || "";
  } while (page);
  const todo = loans.filter((l) => (!only.length || only.includes(l.id)) && !l.data.deleting);
  log(`${loans.length} loans; backing up ${todo.length}` + (loans.length - todo.length ? ` (${loans.length - todo.length} skipped)` : ""));
  let ok = 0, failed = 0, replaced = 0;
  for (const l of todo) {
    log(`loan ${l.id.slice(0, 6)}…`);
    try {
      const r = await runBackup({ fetchFn, token, base: `${BASE}/loans/${l.id}`, now, dry, log });
      ok++; if (r.replaced) replaced++;
    } catch (e) { failed++; log(`  FAILED: ${e.message}`); }
  }
  log(dry ? `Done (dry run, nothing written): ${ok} checked, ${failed} failed.` : `Done: ${ok} backed up (${replaced} identical to the day before, older copy removed), ${failed} failed.`);
  if (failed) throw new Error(`${failed} of ${todo.length} loans failed`);
  return { ok, failed, replaced, total: loans.length };
}

module.exports = { runBackup, runAll, snapshotHash, canon, ist, decode, fromFields, encode, toFields, COLS, PRIVATE, PARTS };

if (require.main === module) {
  const args = process.argv.slice(2), dry = args.includes("--dry");
  accessToken().then((token) => runAll({ token, dry, only: args.filter((a) => a !== "--dry") })).catch((e) => { console.error("BACKUP FAILED:", e.message); process.exit(1); });
}
