// Checks firestore.rules with Google's Firebase Rules test API (no emulator needed).
// Uses the Firebase CLI login on this PC. Run: node test-rules.js
const fs = require("fs");
const auth = require("firebase-tools/lib/auth");
const { configstore } = require("firebase-tools/lib/configstore");

const OWNER = "mayursavaliya150@gmail.com";
const FRIEND = "friend@example.com";
const STRANGER = "stranger@example.com";
const ADMIN = "admin@example.com";
const D = "/databases/(default)/documents";

// authAge = seconds since the Google sign-in (auth_time); default is "just signed in".
const user = (email, authAge = 0) => ({ uid: "u-" + email, token: { email, email_verified: true, auth_time: Math.floor(Date.now() / 1000) - authAge } });
// Pretend access/<email> exists with this status (or doesn't exist when status is null).
const accessMocks = (email, status, role) => [
  { function: "exists", args: [{ exactValue: `${D}/access/${email}` }], result: { value: status !== null } },
  { function: "get", args: [{ exactValue: `${D}/access/${email}` }], result: status === null ? { undefined: {} } : { value: { data: role ? { status, role } : { status } } } },
];
const tc = (name, expectation, who, method, path, opts = {}) => ({
  name,
  tc: {
    expectation,
    request: Object.assign({ auth: who ? user(who, opts.authAge || 0) : null, path: `${D}/${path}`, method, time: new Date().toISOString() }, opts.data ? { resource: { data: opts.data } } : {}),
    resource: opts.existing ? { data: opts.existing } : undefined,
    functionMocks: (who && who !== OWNER ? accessMocks(who, opts.status === undefined ? null : opts.status, opts.role) : []).concat(opts.mocks || []),
  },
});

// Mocks for the backup de-duplication rule: backupsMeta/dedupe and the two backup heads.
const getMock = (path, data) => ({ function: "get", args: [{ exactValue: `${D}/${path}` }], result: data === null ? { undefined: {} } : { value: { data } } });
const dd = (meta, oldHash, newHash) => [
  getMock("backupsMeta/dedupe", meta),
  getMock(`backups/${meta.oldId}`, oldHash === undefined ? {} : { hash: oldHash }),
  getMock(`backups/${meta.newId}`, newHash === undefined ? {} : { hash: newHash }),
];
function dedupeCases() {
  const meta = { oldId: "2026-10-07", newId: "2026-10-08" };
  return [
    tc("owner deletes an identical older backup", "ALLOW", OWNER, "delete", "backups/2026-10-07", { existing: { hash: "h1" }, mocks: dd(meta, "h1", "h1") }),
    tc("owner deletes a part of an identical older backup", "ALLOW", OWNER, "delete", "backups/2026-10-07/parts/settings", { existing: { settings: {} }, mocks: dd(meta, "h1", "h1") }),
    tc("owner can't delete a backup whose hash differs", "DENY", OWNER, "delete", "backups/2026-10-07", { existing: { hash: "h1" }, mocks: dd(meta, "h1", "h2") }),
    tc("owner can't delete a part when the hash differs", "DENY", OWNER, "delete", "backups/2026-10-07/parts/settings", { existing: { settings: {} }, mocks: dd(meta, "h1", "h2") }),
    tc("owner can't delete a backup not named in dedupe", "DENY", OWNER, "delete", "backups/2026-10-06", { existing: { hash: "h1" }, mocks: dd(meta, "h1", "h1").concat([getMock("backups/2026-10-06", { hash: "h1" })]) }),
    tc("owner can't delete the newer backup", "DENY", OWNER, "delete", "backups/2026-10-08", { existing: { hash: "h1" }, mocks: [getMock("backupsMeta/dedupe", meta), getMock("backups/2026-10-08", { hash: "h1" }), getMock("backups/2026-10-07", { hash: "h1" })] }),
    tc("owner can't delete an old backup without a hash", "DENY", OWNER, "delete", "backups/2026-10-07", { existing: {}, mocks: dd(meta, undefined, undefined) }),
    tc("admin can't delete a duplicate backup", "DENY", ADMIN, "delete", "backups/2026-10-07", { status: "approved", role: "admin", existing: { hash: "h1" }, mocks: dd(meta, "h1", "h1") }),
    tc("owner can't change a backup head", "DENY", OWNER, "update", "backups/2026-10-07", { data: { hash: "x" }, existing: { hash: "h1" } }),
    tc("owner writes backupsMeta", "ALLOW", OWNER, "update", "backupsMeta/dedupe", { data: { oldId: "a", newId: "b" }, existing: { oldId: "c", newId: "d" } }),
    tc("owner creates backupsMeta", "ALLOW", OWNER, "create", "backupsMeta/dedupe", { data: { oldId: "a", newId: "b" } }),
    tc("admin can't read backupsMeta", "DENY", ADMIN, "get", "backupsMeta/dedupe", { status: "approved", role: "admin" }),
    tc("admin can't write backupsMeta", "DENY", ADMIN, "update", "backupsMeta/dedupe", { status: "approved", role: "admin", data: { oldId: "a" }, existing: { oldId: "c" } }),
    tc("viewer can't read backupsMeta", "DENY", FRIEND, "get", "backupsMeta/dedupe", { status: "approved" }),
  ];
}

const cases = [
  tc("owner reads loan settings", "ALLOW", OWNER, "get", "loan/settings"),
  tc("owner writes a balance", "ALLOW", OWNER, "update", "balances/2026-10-05", { data: { amount: 1 }, existing: { amount: 0 } }),
  tc("owner reads salary", "ALLOW", OWNER, "get", "private/salary"),
  tc("owner approves a request", "ALLOW", OWNER, "update", `access/${FRIEND}`, { data: { status: "approved" }, existing: { status: "pending" } }),
  tc("owner removes a person", "ALLOW", OWNER, "delete", `access/${FRIEND}`, { existing: { status: "approved" } }),
  tc("owner creates a backup", "ALLOW", OWNER, "create", "backups/2026-11", { data: { month: "2026-11" } }),
  tc("owner can't delete a backup", "DENY", OWNER, "delete", "backups/2026-10", { existing: { month: "2026-10" } }),
  tc("owner can't change a backup", "DENY", OWNER, "update", "backups/2026-10/parts/balances", { data: { rows: [] }, existing: { rows: [] } }),
  tc("signed-out can't read", "DENY", null, "get", "loan/settings"),
  tc("stranger can't read loan", "DENY", STRANGER, "get", "loan/settings"),
  tc("stranger can ask for access", "ALLOW", STRANGER, "create", `access/${STRANGER}`, { data: { email: STRANGER, name: "S", status: "pending", requestedAt: "x" } }),
  tc("stranger can't self-approve on create", "DENY", STRANGER, "create", `access/${STRANGER}`, { data: { email: STRANGER, name: "S", status: "approved", requestedAt: "x" } }),
  tc("stranger can't ask for someone else", "DENY", STRANGER, "create", `access/${FRIEND}`, { data: { email: FRIEND, name: "S", status: "pending", requestedAt: "x" } }),
  tc("pending can't approve itself", "DENY", STRANGER, "update", `access/${STRANGER}`, { status: "pending", data: { status: "approved" }, existing: { status: "pending" } }),
  tc("pending can read own request", "ALLOW", STRANGER, "get", `access/${STRANGER}`, { status: "pending" }),
  tc("pending can't read loan", "DENY", STRANGER, "get", "loan/settings", { status: "pending" }),
  tc("declined can't read loan", "DENY", STRANGER, "get", "balances/2026-10-05", { status: "denied" }),
  tc("approved reads loan", "ALLOW", FRIEND, "get", "loan/settings", { status: "approved" }),
  tc("approved lists balances", "ALLOW", FRIEND, "list", "balances/x", { status: "approved" }),
  tc("approved reads statements", "ALLOW", FRIEND, "get", "txns/2026-09", { status: "approved" }),
  tc("approved reads loan statement", "ALLOW", FRIEND, "get", "loantx/2026-10", { status: "approved" }),
  tc("approved can't change loan statement", "DENY", FRIEND, "update", "loantx/2026-10", { status: "approved", data: { rows: [] }, existing: { rows: [] } }),
  tc("approved reads disbursements", "ALLOW", FRIEND, "get", "disb/2026-09-21_3200000", { status: "approved" }),
  tc("approved can't add disbursement", "DENY", FRIEND, "create", "disb/2027-01-01_100000", { status: "approved", data: { amount: 100000 } }),
  tc("owner adds disbursement", "ALLOW", OWNER, "create", "disb/2027-01-01_100000", { data: { amount: 100000 } }),
  tc("approved can't read salary", "DENY", FRIEND, "get", "private/salary", { status: "approved" }),
  tc("approved can't read backups", "DENY", FRIEND, "get", "backups/2026-10", { status: "approved" }),
  tc("approved can't read access list", "DENY", FRIEND, "get", `access/${STRANGER}`, { status: "approved" }),
  tc("approved can't write data", "DENY", FRIEND, "update", "balances/2026-10-05", { status: "approved", data: { amount: 1 }, existing: { amount: 0 } }),
  tc("approved can't delete data", "DENY", FRIEND, "delete", "balances/2026-10-05", { status: "approved", existing: { amount: 0 } }),
  tc("owner saves goal", "ALLOW", OWNER, "create", "private/goal", { data: { target: "2032-12" } }),
  tc("owner saves tax", "ALLOW", OWNER, "create", "private/tax", { data: { regime: "old", slab: 20, other80C: 0 } }),
  tc("approved can't read goal", "DENY", FRIEND, "get", "private/goal", { status: "approved" }),
  tc("approved can't read tax", "DENY", FRIEND, "get", "private/tax", { status: "approved" }),
  tc("approved can't read categories", "DENY", FRIEND, "get", "private/categories", { status: "approved" }),
  // ---- admin role (access/<email>.role == "admin", status approved) ----
  tc("admin reads loan", "ALLOW", ADMIN, "get", "loan/settings", { status: "approved", role: "admin" }),
  tc("admin writes a balance", "ALLOW", ADMIN, "update", "balances/2026-10-05", { status: "approved", role: "admin", data: { amount: 1 }, existing: { amount: 0 } }),
  tc("admin deletes a balance", "ALLOW", ADMIN, "delete", "balances/2026-10-05", { status: "approved", role: "admin", existing: { amount: 0 } }),
  tc("admin adds disbursement", "ALLOW", ADMIN, "create", "disb/2027-01-01_100000", { status: "approved", role: "admin", data: { amount: 100000 } }),
  tc("admin reads salary", "ALLOW", ADMIN, "get", "private/salary", { status: "approved", role: "admin" }),
  tc("admin writes salary", "ALLOW", ADMIN, "update", "private/salary", { status: "approved", role: "admin", data: { creditAmount: 1 }, existing: { creditAmount: 0 } }),
  tc("admin reads tax", "ALLOW", ADMIN, "get", "private/tax", { status: "approved", role: "admin" }),
  tc("admin can't read backups", "DENY", ADMIN, "get", "backups/2026-10", { status: "approved", role: "admin" }),
  tc("admin can't create a backup", "DENY", ADMIN, "create", "backups/2026-11", { status: "approved", role: "admin", data: { month: "2026-11" } }),
  tc("admin can't read backup parts", "DENY", ADMIN, "get", "backups/2026-10/parts/balances", { status: "approved", role: "admin" }),
  tc("admin can't read someone else's access", "DENY", ADMIN, "get", `access/${STRANGER}`, { status: "approved", role: "admin" }),
  tc("admin can't approve a request", "DENY", ADMIN, "update", `access/${STRANGER}`, { status: "approved", role: "admin", data: { status: "approved" }, existing: { status: "pending" } }),
  tc("admin can't make another admin", "DENY", ADMIN, "update", `access/${FRIEND}`, { status: "approved", role: "admin", data: { role: "admin" }, existing: { status: "approved" } }),
  tc("admin can't remove a person", "DENY", ADMIN, "delete", `access/${FRIEND}`, { status: "approved", role: "admin", existing: { status: "approved" } }),
  tc("viewer can't make themselves admin", "DENY", FRIEND, "update", `access/${FRIEND}`, { status: "approved", data: { status: "approved", role: "admin" }, existing: { status: "approved" } }),
  tc("request can't carry a role", "DENY", STRANGER, "create", `access/${STRANGER}`, { data: { email: STRANGER, name: "S", status: "pending", requestedAt: "x", role: "admin" } }),
  tc("owner makes someone admin", "ALLOW", OWNER, "update", `access/${FRIEND}`, { data: { role: "admin" }, existing: { status: "approved" } }),
  tc("owner removes admin role", "ALLOW", OWNER, "update", `access/${FRIEND}`, { data: { role: "viewer" }, existing: { status: "approved", role: "admin" } }),
  tc("pending with role=admin is not admin", "DENY", STRANGER, "get", "loan/settings", { status: "pending", role: "admin" }),
  tc("declined with role=admin is not admin", "DENY", STRANGER, "update", "balances/2026-10-05", { status: "denied", role: "admin", data: { amount: 1 }, existing: { amount: 0 } }),
  tc("role=viewer can't write", "DENY", FRIEND, "update", "balances/2026-10-05", { status: "approved", role: "viewer", data: { amount: 1 }, existing: { amount: 0 } }),
  tc("role=viewer can't read salary", "DENY", FRIEND, "get", "private/salary", { status: "approved", role: "viewer" }),
  // ---- salary password (private/lock) ----
  tc("owner sets salary password", "ALLOW", OWNER, "create", "private/lock", { data: { v: 1, salt: "x", iter: 1, hash: "y" } }),
  tc("owner changes salary password", "ALLOW", OWNER, "update", "private/lock", { data: { hash: "z" }, existing: { hash: "y" } }),
  tc("owner removes salary password", "ALLOW", OWNER, "delete", "private/lock", { existing: { hash: "y" } }),
  tc("admin reads salary password hash", "ALLOW", ADMIN, "get", "private/lock", { status: "approved", role: "admin" }),
  tc("admin can't set salary password", "DENY", ADMIN, "create", "private/lock", { status: "approved", role: "admin", data: { v: 1, salt: "x", iter: 1, hash: "y" } }),
  tc("admin can't change salary password", "DENY", ADMIN, "update", "private/lock", { status: "approved", role: "admin", data: { hash: "z" }, existing: { hash: "y" } }),
  tc("admin can't remove salary password", "DENY", ADMIN, "delete", "private/lock", { status: "approved", role: "admin", existing: { hash: "y" } }),
  tc("admin can still write salary", "ALLOW", ADMIN, "update", "private/salary", { status: "approved", role: "admin", data: { creditAmount: 2 }, existing: { creditAmount: 1 } }),
  // ---- changing the salary password needs a fresh Google sign-in (auth_time within 5 minutes) ----
  tc("owner (stale login) can't set salary password", "DENY", OWNER, "create", "private/lock", { authAge: 3600, data: { v: 1, salt: "x", iter: 1, hash: "y" } }),
  tc("owner (stale login) can't change salary password", "DENY", OWNER, "update", "private/lock", { authAge: 3600, data: { hash: "z" }, existing: { hash: "y" } }),
  tc("owner (stale login) can't reset salary password", "DENY", OWNER, "delete", "private/lock", { authAge: 3600, existing: { hash: "y" } }),
  tc("owner (login 4 min ago) can change salary password", "ALLOW", OWNER, "update", "private/lock", { authAge: 240, data: { hash: "z" }, existing: { hash: "y" } }),
  tc("owner (login 6 min ago) can't reset salary password", "DENY", OWNER, "delete", "private/lock", { authAge: 360, existing: { hash: "y" } }),
  tc("owner (stale login) can still write loan data", "ALLOW", OWNER, "update", "balances/2026-10-05", { authAge: 3600, data: { amount: 1 }, existing: { amount: 0 } }),
  tc("owner (stale login) can still write salary", "ALLOW", OWNER, "update", "private/salary", { authAge: 3600, data: { creditAmount: 2 }, existing: { creditAmount: 1 } }),
  tc("owner (stale login) can still read salary password", "ALLOW", OWNER, "get", "private/lock", { authAge: 3600 }),
  tc("admin (stale login) still writes loan data", "ALLOW", ADMIN, "update", "balances/2026-10-05", { authAge: 3600, status: "approved", role: "admin", data: { amount: 1 }, existing: { amount: 0 } }),
  // ---- the settings documents can be changed but not deleted; the mirror copy follows the same rules ----
  tc("owner can't delete loan settings", "DENY", OWNER, "delete", "loan/settings", { existing: { principal: 1 } }),
  tc("owner can't delete salary doc", "DENY", OWNER, "delete", "private/salary", { existing: { creditAmount: 1 } }),
  tc("owner can't delete settings mirror", "DENY", OWNER, "delete", "private/settingsMirror", { existing: { principal: 1 } }),
  tc("admin can't delete loan settings", "DENY", ADMIN, "delete", "loan/settings", { status: "approved", role: "admin", existing: { principal: 1 } }),
  tc("admin can't delete salary doc", "DENY", ADMIN, "delete", "private/salary", { status: "approved", role: "admin", existing: { creditAmount: 1 } }),
  tc("admin can't delete settings mirror", "DENY", ADMIN, "delete", "private/settingsMirror", { status: "approved", role: "admin", existing: { principal: 1 } }),
  tc("owner creates loan settings", "ALLOW", OWNER, "create", "loan/settings", { data: { principal: 1 } }),
  tc("owner updates loan settings", "ALLOW", OWNER, "update", "loan/settings", { data: { principal: 2 }, existing: { principal: 1 } }),
  tc("owner creates salary doc", "ALLOW", OWNER, "create", "private/salary", { data: { creditAmount: 1 } }),
  tc("owner creates settings mirror", "ALLOW", OWNER, "create", "private/settingsMirror", { data: { principal: 1 } }),
  tc("owner updates settings mirror", "ALLOW", OWNER, "update", "private/settingsMirror", { data: { principal: 2 }, existing: { principal: 1 } }),
  tc("admin updates loan settings", "ALLOW", ADMIN, "update", "loan/settings", { status: "approved", role: "admin", data: { principal: 2 }, existing: { principal: 1 } }),
  tc("admin updates settings mirror", "ALLOW", ADMIN, "update", "private/settingsMirror", { status: "approved", role: "admin", data: { principal: 2 }, existing: { principal: 1 } }),
  tc("admin reads settings mirror", "ALLOW", ADMIN, "get", "private/settingsMirror", { status: "approved", role: "admin" }),
  tc("viewer can't read settings mirror", "DENY", FRIEND, "get", "private/settingsMirror", { status: "approved" }),
  tc("stranger can't read settings mirror", "DENY", STRANGER, "get", "private/settingsMirror"),
  tc("owner creates the private backup part", "ALLOW", OWNER, "create", "backups/2026-11/parts/private", { data: { docs: { goal: { target: "2031-04" } } } }),
  tc("owner creates the access backup part", "ALLOW", OWNER, "create", "backups/2026-11/parts/access", { data: { rows: [] } }),
  tc("owner can't change the private backup part", "DENY", OWNER, "update", "backups/2026-10/parts/private", { data: { docs: {} }, existing: { docs: {} } }),
  tc("admin can't read the private backup part", "DENY", ADMIN, "get", "backups/2026-10/parts/private", { status: "approved", role: "admin" }),
  tc("admin can't create a backup part", "DENY", ADMIN, "create", "backups/2026-11/parts/access", { status: "approved", role: "admin", data: { rows: [] } }),
  // ---- daily backups: only an exact duplicate (same hash as the newer backup in backupsMeta/dedupe) can be deleted ----
  ...dedupeCases(),
  tc("owner can still delete a balance", "ALLOW", OWNER, "delete", "balances/2026-10-05", { existing: { amount: 0 } }),
  tc("owner can still delete a disbursement", "ALLOW", OWNER, "delete", "disb/2026-09-21_3200000", { existing: { amount: 3200000 } }),
  tc("viewer can't read salary password", "DENY", FRIEND, "get", "private/lock", { status: "approved" }),
  tc("stranger can't read salary password", "DENY", STRANGER, "get", "private/lock"),
];

(async () => {
  const tokens = configstore.get("tokens");
  const { access_token } = await auth.getAccessToken(tokens.refresh_token, []);
  const body = {
    source: { files: [{ name: "firestore.rules", content: fs.readFileSync(__dirname + "/firestore.rules", "utf8") }] },
    testSuite: { testCases: cases.map(c => c.tc) },
  };
  const r = await fetch("https://firebaserules.googleapis.com/v1/projects/advantage-loan-tracker-hub:test", {
    method: "POST", headers: { Authorization: "Bearer " + access_token, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const res = await r.json();
  if (!r.ok) { console.log(JSON.stringify(res, null, 2)); process.exit(1); }
  if (res.issues) console.log("ISSUES", JSON.stringify(res.issues));
  let fail = 0;
  (res.testResults || []).forEach((t, i) => {
    const ok = t.state === "SUCCESS";
    if (!ok) fail++;
    console.log((ok ? "PASS " : "FAIL ") + cases[i].name + (ok ? "" : "  " + JSON.stringify(t.debugMessages || t.errorPosition || "")));
  });
  console.log(fail ? fail + " failed" : "all " + cases.length + " passed");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
