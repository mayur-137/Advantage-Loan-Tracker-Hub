"""Builds hosting/public/index.html from ../index.html for Firebase Hosting.

The source page is written for claude.ai, which wraps it in a document skeleton.
Here we add that skeleton ourselves, plus the Firebase SDK and config, so the same
page signs in with Google and keeps its data in Firestore.
"""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE.parent / "index.html"
OUT = HERE / "public" / "index.html"

SDK = "10.12.2"
CONFIG = {
    "apiKey": "AIzaSyCuP3Kl5yTjHVnGqNLHk2H1t8ScD06Im8M",
    "authDomain": "advantage-loan-tracker.firebaseapp.com",
    "projectId": "advantage-loan-tracker",
    "storageBucket": "advantage-loan-tracker.firebasestorage.app",
    "messagingSenderId": "813329014441",
    "appId": "1:813329014441:web:0a63ded1bb8225e5ac13b8",
    # The owner gets the full tracker; anyone else must request access (see firestore.rules).
    "ownerEmail": "mayursavaliya150@gmail.com",
}

HEAD = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#1d6b52">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Loan Tracker">
<link rel="manifest" href="/manifest.json">
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/icon-180.png">
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0;font:14px system-ui,sans-serif}}img{{max-width:100%}}[hidden]{{display:none!important}}body.fb-wait .wrap{{visibility:hidden}}</style>
<script>window.FIREBASE_CONFIG = {json.dumps(CONFIG)};
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {{}}));</script>
<script src="https://www.gstatic.com/firebasejs/{SDK}/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/{SDK}/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/{SDK}/firebase-firestore-compat.js"></script>
</head>
<body class="fb-wait">
"""

OUT.parent.mkdir(parents=True, exist_ok=True)
# App files for the installable version (icons come from make-icons.js).
import shutil
for name in ("manifest.json", "sw.js"):
    shutil.copyfile(HERE / name, OUT.parent / name)
OUT.write_text(HEAD + SRC.read_text(encoding="utf-8") + "\n</body>\n</html>\n", encoding="utf-8")
print("wrote", OUT)
