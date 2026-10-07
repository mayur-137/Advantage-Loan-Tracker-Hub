"""Builds hosting/public/ for Firebase Hosting.

- /app   the tracker (../index.html) with the Firebase SDK and config: Google sign-in, data in Firestore. Not indexed.
- /demo  the same tracker without Firebase, filled with made-up sample data (demo-seed.js): no sign-in, nothing saved.
- Public pages from site/ (landing, calculator, articles, guide, terms, privacy): each source starts with a
  <!--page {...}--> line (title, description, path, ...); this script adds the head (SEO, Open Graph, structured
  data), the site header and footer. Also robots.txt, sitemap.xml and, once AdSense is set up, ads.txt.

The tracker source is written for claude.ai, which wraps it in a document skeleton; here we add that skeleton.
"""
import datetime
import html
import json
import pathlib
import re
import shutil

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE.parent / "index.html"
SITE_SRC = HERE / "site"
PUB = HERE / "public"

SITE = "https://advantage-loan-tracker-hub.web.app"
NAME = "Advantage Loan Tracker"
SDK = "10.12.2"
CONFIG = {
    "apiKey": "AIzaSyDZLmmE8d7avaEveTxseuY2OWyw48lmXxI",
    "authDomain": "advantage-loan-tracker-hub.firebaseapp.com",
    "projectId": "advantage-loan-tracker-hub",
    "storageBucket": "advantage-loan-tracker-hub.firebasestorage.app",
    "messagingSenderId": "625022243493",
    "appId": "1:625022243493:web:4a939bd67c70af64c6734c",
    # The app's administrator: sees the admin dashboard and every loan read-only (enforced in firestore.rules).
    "superAdmin": "mayursavaliya150@gmail.com",
}
# Google AdSense. Empty = no ad code anywhere. Fill "client" with the ca-pub-... id from AdSense; fill a slot with the
# data-ad-slot number of an ad unit made in AdSense (Ads -> By ad unit -> Display ads) to show that unit.
ADS = {
    "client": "",
    "content": "",  # responsive unit inside public pages (landing, calculator, articles, guide)
    "rail": "",     # 160x600 unit for the side rails beside the tracker on wide screens (/app, /demo)
}
TODAY = datetime.date.today().isoformat()


def esc(s):
    return html.escape(str(s), quote=True)


def ads_head():
    if not ADS["client"]:
        return ""
    return (f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={esc(ADS["client"])}" '
            'crossorigin="anonymous"></script>\n<meta name="google-adsense-account" content="' + esc(ADS["client"]) + '">\n')


def ad_unit():
    if not (ADS["client"] and ADS["content"]):
        return ""
    return ('<div class="ad"><span class="ad-label">Advertisement</span>'
            f'<ins class="adsbygoogle" style="display:block" data-ad-client="{esc(ADS["client"])}" data-ad-slot="{esc(ADS["content"])}" '
            'data-ad-format="auto" data-full-width-responsive="true"></ins>'
            '<script>(adsbygoogle = window.adsbygoogle || []).push({});</script></div>')


NAV = [("home", "/", "Home"), ("calc", "/calculator", "Calculator"), ("learn", "/learn/", "Learn"),
       ("guide", "/guide", "How it works"), ("demo", "/demo", "Demo")]


def header(active):
    links = "".join(f'<a href="{href}"' + (' aria-current="page"' if key == active else "") + f">{label}</a>" for key, href, label in NAV)
    return ('<header class="site-head"><div class="wrap">'
            f'<a class="brand" href="/"><img src="/icon-192.png" alt="" width="32" height="32"><span>{NAME}</span></a>'
            # "What is it?" opens the explainer popup (what-is.js); without JS it is a plain link to the article.
            f'<nav class="site-nav" aria-label="Main"><a href="/learn/how-savings-linked-home-loans-work" data-whatis>What is it?</a>{links}'
            '<a class="cta" href="/app">Open tracker</a></nav>'
            '</div></header>')


FOOTER = ('<footer class="site-foot"><div class="wrap">'
          '<nav aria-label="Footer"><a href="/">Home</a><a href="/calculator">EMI &amp; savings calculator</a><a href="/learn/">Learn</a>'
          '<a href="/guide">How it works</a><a href="/demo">Demo</a><a href="/app">Open tracker</a>'
          '<a href="/terms">Terms &amp; disclaimer</a><a href="/privacy">Privacy</a></nav>'
          f'<p style="margin:0">{NAME} is an independent tool, not a bank and not connected to any bank. Figures are estimates; '
          'your bank\'s statement is the final word. Not financial advice.</p></div></footer>')


def page_html(meta, body):
    path = meta["path"]
    url = SITE + path
    title = meta["title"]
    desc = meta["description"]
    is_article = meta.get("type") == "article"
    robots = "noindex,follow" if meta.get("noindex") else "index,follow,max-image-preview:large"
    ld = [{
        "@context": "https://schema.org", "@type": "Article" if is_article else "WebPage", "url": url,
        ("headline" if is_article else "name"): meta.get("headline", title), "description": desc, "inLanguage": "en-IN",
        "isPartOf": {"@type": "WebSite", "name": NAME, "url": SITE + "/"},
    }]
    if is_article:
        ld[0].update({"datePublished": meta.get("published", TODAY), "dateModified": meta.get("modified", meta.get("published", TODAY)),
                      "author": {"@type": "Organization", "name": NAME, "url": SITE + "/"},
                      "publisher": {"@type": "Organization", "name": NAME, "logo": {"@type": "ImageObject", "url": SITE + "/icon-512.png"}},
                      "image": SITE + "/icon-512.png", "mainEntityOfPage": url})
    crumbs = meta.get("crumbs")
    if crumbs:
        ld.append({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + p} for i, (n, p) in enumerate(crumbs)]})
    ld += meta.get("jsonld", [])
    article_meta = (f'<meta property="article:published_time" content="{esc(meta.get("published", TODAY))}">\n' if is_article else "")
    head = f"""<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{esc(url)}">
<meta name="robots" content="{robots}">
<meta name="theme-color" content="#1d6b52">
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="manifest" href="/manifest.json">
<meta property="og:type" content="{'article' if is_article else 'website'}">
<meta property="og:site_name" content="{NAME}">
<meta property="og:locale" content="en_IN">
<meta property="og:title" content="{esc(meta.get('og_title', title))}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{esc(url)}">
<meta property="og:image" content="{SITE}/icon-512.png">
<meta property="og:image:alt" content="{NAME} logo">
{article_meta}<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{esc(meta.get('og_title', title))}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{SITE}/icon-512.png">
<link rel="stylesheet" href="/site.css">
<script src="/what-is.js" defer{' data-auto' if meta.get('whatis_auto') else ''}></script>
<script type="application/ld+json">{json.dumps(ld if len(ld) > 1 else ld[0], ensure_ascii=False)}</script>
{ads_head() if meta.get("ads", True) else ""}</head>
<body>
"""
    crumb_html = ""
    if crumbs and len(crumbs) > 1:
        crumb_html = '<nav class="crumbs" aria-label="Breadcrumb">' + " / ".join(
            (f'<a href="{p}">{esc(n)}</a>' if i < len(crumbs) - 1 else esc(n)) for i, (n, p) in enumerate(crumbs)) + "</nav>"
    body = body.replace("{{AD}}", ad_unit() if meta.get("ads", True) else "")
    if meta.get("card", True):
        body = f'<div class="card">{body}</div>'
    narrow = " narrow" if meta.get("narrow", True) else ""
    return head + header(meta.get("nav")) + f'<main><div class="wrap{narrow}">{crumb_html}{body}</div></main>' + FOOTER + "\n</body>\n</html>\n"


def build_site():
    pages = []
    for src in sorted(SITE_SRC.rglob("*.html")):
        text = src.read_text(encoding="utf-8")
        m = re.match(r"\s*<!--page\s+(\{.*?\})\s*-->\s*", text, re.S)
        if not m:
            raise SystemExit(f"{src}: missing <!--page {{...}}--> header")
        meta = json.loads(m.group(1))
        rel = src.relative_to(SITE_SRC)
        out = PUB / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(page_html(meta, text[m.end():]), encoding="utf-8")
        pages.append(meta)
    shutil.copyfile(SITE_SRC / "site.css", PUB / "site.css")
    return pages


def app_head(demo):
    title = "Demo: savings-linked home loan tracker with sample data" if demo else "Your loans · " + NAME
    desc = ("Try the full Advantage Loan Tracker with a sample home loan: daily interest, savings offset, EMI split, "
            "payoff date, bank match and tax, without signing in.") if demo else "Track your savings-linked home loan."
    robots = "index,follow" if demo else "noindex,nofollow"
    path = "/demo" if demo else "/app"
    ads = {"client": ADS["client"], "rail": ADS["rail"]}
    if demo:
        boot = (f"<script>window.SITE_ADS = {json.dumps(ads)};</script>\n"
                '<script src="/demo-seed.js"></script>\n<script src="/what-is.js" defer data-auto></script>\n' + ads_head())
    else:
        boot = (f"<script>window.FIREBASE_CONFIG = {json.dumps(CONFIG)}; window.SITE_ADS = {json.dumps(ads)};\n"
                'if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));</script>\n'
                '<script src="/what-is.js" defer></script>\n'
                f'<script src="https://www.gstatic.com/firebasejs/{SDK}/firebase-app-compat.js"></script>\n'
                f'<script src="https://www.gstatic.com/firebasejs/{SDK}/firebase-auth-compat.js"></script>\n'
                f'<script src="https://www.gstatic.com/firebasejs/{SDK}/firebase-firestore-compat.js"></script>\n')
    return f"""<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{SITE}{path}">
<meta name="robots" content="{robots}">
<meta name="theme-color" content="#1d6b52">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Loan Tracker">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{NAME}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:image" content="{SITE}/icon-512.png">
<meta name="twitter:card" content="summary">
<link rel="manifest" href="/manifest.json">
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/icon-180.png">
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0;font:14px system-ui,sans-serif}}img{{max-width:100%}}[hidden]{{display:none!important}}body.fb-wait .wrap{{visibility:hidden}}</style>
{boot}</head>
<body{'' if demo else ' class="fb-wait"'}>
"""


def main():
    if PUB.exists():
        for old in ["index.html", "app.html", "demo.html", "guide.html", "terms.html", "privacy.html", "calculator.html", "404.html"]:
            (PUB / old).unlink(missing_ok=True)
        shutil.rmtree(PUB / "learn", ignore_errors=True)
    PUB.mkdir(parents=True, exist_ok=True)
    app = SRC.read_text(encoding="utf-8")
    (PUB / "app.html").write_text(app_head(False) + app + "\n</body>\n</html>\n", encoding="utf-8")
    (PUB / "demo.html").write_text(app_head(True) + app + "\n</body>\n</html>\n", encoding="utf-8")
    for name in ("manifest.json", "sw.js", "demo-seed.js", "what-is.js"):
        shutil.copyfile(HERE / name, PUB / name)
    pages = build_site()
    # Search engines: everything public, not the signed-in tracker.
    (PUB / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /app\n\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8")
    urls = [p for p in pages if not p.get("noindex")] + [{"path": "/demo", "priority": "0.7"}]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p in urls:
        sm.append(f"  <url><loc>{SITE}{p['path']}</loc><lastmod>{p.get('modified', p.get('published', TODAY))}</lastmod>"
                  f"<priority>{p.get('priority', '0.6')}</priority></url>")
    sm.append("</urlset>")
    (PUB / "sitemap.xml").write_text("\n".join(sm) + "\n", encoding="utf-8")
    ads_txt = PUB / "ads.txt"
    if ADS["client"]:
        ads_txt.write_text(f"google.com, {ADS['client'].replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")
    else:
        ads_txt.unlink(missing_ok=True)
    print("wrote app.html, demo.html,", len(pages), "pages, robots.txt, sitemap.xml" + (", ads.txt" if ADS["client"] else ""))


if __name__ == "__main__":
    main()
