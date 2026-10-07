// Made-up sample data for /demo: a ₹32 L savings-linked home loan taken about ten months ago, with a salary account
// that gets a salary, pays the EMI, a card bill and day-to-day spending. Dates are worked out from today, so the demo
// always looks current. Nothing here belongs to a real person. index.html loads window.DEMO_SEED when there is no
// Firebase config (see loadDemo there); nothing is saved.
(function () {
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const day = (y, m, d) => new Date(y, m, d);
  const now = new Date();
  const today = day(now.getFullYear(), now.getMonth(), now.getDate());

  const principal = 3200000, rate = 7.3, tenure = 288;
  const start = day(now.getFullYear(), now.getMonth() - 10, 21);         // disbursal
  const firstEmi = day(start.getFullYear(), start.getMonth() + 1, 10);   // first EMI
  const r = rate / 1200, f = Math.pow(1 + r, tenure);
  const emi = Math.round(principal * r * f / (f - 1));                   // same formula as the tracker

  // The salary account, day by day.
  const rows = [];
  let bal = 180000;
  const add = (d, desc, inAmt, outAmt) => {
    if (d > today) return;
    bal = Math.round((bal + inAmt - outAmt) * 100) / 100;
    rows.push({ date: ymd(d), desc, in: inAmt, out: outAmt, bal });
  };
  const spend = [["UPI-BIGBASKET GROCERIES", 2400], ["UPI-SWIGGY", 640], ["UPI-PETROL PUMP", 1800], ["UPI-PHARMACY", 520], ["UPI-AMAZON", 1350], ["UPI-ELECTRICITY BILL", 2100]];
  let prepayDate = null;
  for (let k = 0; ; k++) {
    const y = start.getFullYear(), m = start.getMonth() + k;
    const first = day(y, m, 1);
    if (first > today) break;
    if (k > 0) add(day(y, m, 1), "NEFT SALARY ACME TECH PVT LTD", 92000, 0);
    if (k > 0) add(day(y, m, 8), "CREDIT CARD BILL PAYMENT", 0, 18500 + (k % 3) * 1200);
    if (day(y, m, 10) >= firstEmi) add(day(y, m, 10), "HOME LOAN EMI RECOVERY", 0, emi);
    spend.forEach(([desc, amt], i) => add(day(y, m, 12 + i * 3), desc, 0, amt + ((k * 37 + i * 11) % 9) * 50));
    if (k === 6) { add(day(y, m, 15), "NEFT BONUS ACME TECH PVT LTD", 60000, 0); prepayDate = day(y, m, 20); }
  }

  // Balances: the closing balance of each day with activity.
  const close = {};
  rows.forEach((t) => { close[t.date] = t.bal; });
  const balances = Object.keys(close).sort().map((d) => ({ id: d, date: d, amount: close[d], note: "Statement" }));
  // Statement rows by month (Spending tab, backup viewer).
  const months = {};
  rows.forEach((t) => { const mo = t.date.slice(0, 7); (months[mo] = months[mo] || []).push(t); });
  const txns = Object.keys(months).sort().map((mo) => ({ id: mo, month: mo, rows: months[mo] }));

  const rateDate = day(start.getFullYear(), start.getMonth() + 5, 1);
  window.DEMO_SEED = {
    label: "Sample Bank · Demo home loan",
    settings: {
      principal, rate, tenure, emi: null, startDate: ymd(start), firstEmiDate: ymd(firstEmi), configured: true,
      creditAmount: 92000, creditDay: 1, expense: 28000, expenseMode: "card", cardDay: 8, stepUp: 5,
    },
    disb: [{ id: ymd(start) + "_" + principal, date: ymd(start), amount: principal, note: "Sample disbursement" }],
    rates: rateDate <= today ? [{ id: ymd(rateDate), date: ymd(rateDate), rate: 7.1 }] : [],
    prepay: prepayDate && prepayDate <= today ? [{ id: ymd(prepayDate) + "_demo", date: ymd(prepayDate), amount: 50000 }] : [],
    balances,
    txns,
    statements: [],
    loantx: [],
    goal: { target: (now.getFullYear() + 14) + "-03" },
    tax: { regime: "old", slab: 20, other80C: 60000 },
  };
})();
