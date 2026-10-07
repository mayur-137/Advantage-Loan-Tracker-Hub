// "What is an Advantage home loan?" popup: a short, simple explanation in English and Hindi.
// Opens from any element with data-whatis, or by itself once per browser on pages that set
// <script src="/what-is.js" data-auto></script> (the landing page and the demo). Esc, the backdrop or "Got it" close it.
(function () {
  const SEEN = "alt-whatis-seen";
  const T = {
    en: {
      title: "What is an Advantage home loan?",
      sub: "Also called a savings-linked or overdraft home loan (e.g. Home Loan Advantage, MaxGain, Money Saver).",
      points: [
        "Your home loan is <b>joined to a savings account</b>.",
        "When the bank works out interest, the money in that account is <b>taken off the loan</b>, every day.",
        "<b>Example:</b> loan ₹30 lakh, savings ₹5 lakh → interest only on <b>₹25 lakh</b>.",
        "The money stays yours: <b>withdraw any time</b>. Your EMI stays the same, and the loan <b>finishes sooner</b>.",
      ],
      loan: "Loan", savings: "Savings", charged: "Interest charged on",
      calc: "Try with your numbers", more: "Read more", ok: "Got it", lang: "हिंदी",
    },
    hi: {
      title: "एडवांटेज होम लोन क्या है?",
      sub: "इसे सेविंग्स से जुड़ा या ओवरड्राफ़्ट होम लोन भी कहते हैं (जैसे Home Loan Advantage, MaxGain, Money Saver)।",
      points: [
        "आपका होम लोन एक <b>सेविंग्स अकाउंट से जुड़ा</b> होता है।",
        "बैंक जब ब्याज निकालता है, तो उस अकाउंट में रखा पैसा <b>लोन में से घटा दिया जाता है</b>, हर दिन।",
        "<b>उदाहरण:</b> लोन ₹30 लाख, सेविंग्स ₹5 लाख → ब्याज सिर्फ़ <b>₹25 लाख</b> पर।",
        "पैसा आपका ही रहता है: <b>जब चाहें निकालें</b>। EMI वही रहती है, और लोन <b>जल्दी खत्म</b> होता है।",
      ],
      loan: "लोन", savings: "सेविंग्स", charged: "ब्याज लगेगा",
      calc: "अपने नंबर से देखें", more: "और पढ़ें", ok: "समझ गया", lang: "English",
    },
  };
  let lang = (navigator.language || "").toLowerCase().startsWith("hi") ? "hi" : "en";
  let box = null, lastFocus = null;

  const css = `
.wi-back{position:fixed;inset:0;z-index:60;background:rgba(10,20,15,.45);display:grid;place-items:center;padding:16px;animation:wi-in .18s ease-out}
.wi-card{background:var(--surface,#fff);color:var(--fg,#17211c);border:1px solid var(--line,#d3ddd7);border-radius:20px;max-width:480px;width:100%;
  max-height:calc(100vh - 32px);overflow:auto;padding:22px 22px 18px;box-shadow:0 20px 50px rgba(0,0,0,.25);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
.wi-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.wi-card h2{margin:0 0 4px;font-size:20px;line-height:1.3}
.wi-sub{margin:0 0 12px;color:var(--muted,#5b6b62);font-size:13px}
.wi-lang{flex:none;border:1px solid var(--line,#d3ddd7);background:transparent;color:var(--accent,#1d6b52);border-radius:999px;padding:4px 10px;font:600 13px system-ui,sans-serif;cursor:pointer}
.wi-card ul{margin:0 0 12px;padding-left:20px}
.wi-card li{margin:0 0 6px}
.wi-bar{display:flex;height:34px;border-radius:10px;overflow:hidden;margin:6px 0 4px;font:600 12px system-ui,sans-serif}
.wi-bar span{display:grid;place-items:center;white-space:nowrap;padding:0 6px}
.wi-bar .c{flex:25;background:var(--accent,#1d6b52);color:var(--accent-fg,#fff)}
.wi-bar .s{flex:5;background:var(--accent-soft,#dcefe6);color:var(--accent,#1d6b52)}
.wi-legend{display:flex;justify-content:space-between;font-size:12px;color:var(--muted,#5b6b62);margin-bottom:14px}
.wi-act{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center}
.wi-act a{color:var(--accent,#1d6b52);font-size:14px;margin-right:auto}
.wi-act a + a{margin-right:0}
.wi-act button{border:0;border-radius:999px;padding:9px 18px;font:600 14px system-ui,sans-serif;cursor:pointer;background:var(--accent,#1d6b52);color:var(--accent-fg,#fff)}
.wi-card :focus-visible{outline:3px solid var(--accent,#1d6b52);outline-offset:2px}
@keyframes wi-in{from{opacity:0}to{opacity:1}}
@media (max-width:600px){.wi-back{place-items:end center;padding:0}.wi-card{border-radius:20px 20px 0 0;max-height:85vh}}
@media (prefers-reduced-motion:reduce){.wi-back{animation:none}}`;

  function render() {
    const t = T[lang];
    box.querySelector(".wi-card").innerHTML =
      `<div class="wi-top"><h2 id="wi-title">${t.title}</h2><button type="button" class="wi-lang" data-wi-lang>${t.lang}</button></div>
       <p class="wi-sub">${t.sub}</p>
       <ul>${t.points.map((p) => "<li>" + p + "</li>").join("")}</ul>
       <div class="wi-bar" aria-hidden="true"><span class="c">${t.charged} ₹25 L</span><span class="s">−₹5 L</span></div>
       <div class="wi-legend" aria-hidden="true"><span>${t.loan} ₹30 L</span><span>${t.savings} ₹5 L</span></div>
       <div class="wi-act"><a href="/calculator">${t.calc}</a><a href="/learn/how-savings-linked-home-loans-work">${t.more}</a>
       <button type="button" data-wi-close>${t.ok}</button></div>`;
  }
  function open() {
    if (box) return;
    lastFocus = document.activeElement;
    if (!document.getElementById("wi-style")) { const st = document.createElement("style"); st.id = "wi-style"; st.textContent = css; document.head.appendChild(st); }
    box = document.createElement("div");
    box.className = "wi-back";
    box.innerHTML = '<div class="wi-card" role="dialog" aria-modal="true" aria-labelledby="wi-title"></div>';
    render();
    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.closest("[data-wi-close]")) close();
      else if (e.target.closest("[data-wi-lang]")) { lang = lang === "en" ? "hi" : "en"; render(); box.querySelector("[data-wi-lang]").focus(); }
    });
    document.body.appendChild(box);
    box.querySelector("[data-wi-close]").focus();
    try { localStorage.setItem(SEEN, "1"); } catch (e) {}
  }
  function close() {
    if (!box) return;
    box.remove(); box = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-whatis]"); if (a) { e.preventDefault(); open(); } });
  window.showWhatIs = open;

  const me = document.currentScript;
  if (me && me.hasAttribute("data-auto")) {
    let seen = false;
    try { seen = !!localStorage.getItem(SEEN); } catch (e) {}
    if (!seen) addEventListener("load", () => setTimeout(open, 1200));
  }
})();
