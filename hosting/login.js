// Logs the Firebase CLI in without its terminal prompts (Gemini and usage reporting are both turned off).
const { logger } = require("firebase-tools/lib/logger");
logger.info = (...a) => console.log(...a.map(String));
const auth = require("firebase-tools/lib/auth");
const { configstore } = require("firebase-tools/lib/configstore");

(async () => {
  configstore.set("gemini", false);
  configstore.set("usage", false);
  const result = await auth.loginGoogle(true);
  auth.recordCredentials(result);
  console.log("LOGGED IN AS", result.user && result.user.email);
  process.exit(0);
})().catch((e) => { console.error("LOGIN FAILED", e && e.message); process.exit(1); });
