/* ============================================================
   LEADERBOARD STORAGE
   Google Sheet via Apps Script (see apps_script.gs + README).
   Paste the deployed Web App URL (…/exec) below. While it is empty the
   leaderboard runs in "local mode": entries live in this browser only,
   which is handy for testing but not shared between devices.
   ============================================================ */
const LEADERBOARD_URL = "https://script.google.com/macros/s/AKfycbwtMV23LCpy3tnUyxmDqSXwQCY-UB-MY3YIIlgL3oe2RzmYGgk4DqqveNTg9cql-ek4xw/exec";

const LOCAL_KEY = "factorySiting.entries.v1";

const Leaderboard = {
  mode: LEADERBOARD_URL ? "sheet" : "local",
  // Entries submitted in this session. Apps Script POSTs are no-cors, so we
  // can't confirm receipt — keep them visible until the Sheet returns them.
  pending: [],

  async list(){
    let entries;
    if(this.mode==="sheet"){
      const res = await fetch(LEADERBOARD_URL + "?t=" + Date.now());
      if(!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      entries = (data.entries || []).map(normaliseEntry).filter(Boolean);
      const seen = new Set(entries.map(e=>e.id));
      this.pending = this.pending.filter(p=>!seen.has(p.id));
      entries = entries.concat(this.pending);
    } else {
      entries = readLocal();
    }
    return entries.sort((a,b)=>a.score-b.score || a.ts-b.ts);
  },

  async submit(entry){
    if(this.mode==="sheet"){
      this.pending.push(entry);
      await fetch(LEADERBOARD_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {"Content-Type": "text/plain;charset=utf-8"},
        body: JSON.stringify(entry),
      });
    } else {
      const all = readLocal();
      all.push(entry);
      try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); }catch(e){ /* storage blocked: entry lives for this page only */ }
      this._memory = all;
    }
  },
};

function readLocal(){
  try{
    const raw = localStorage.getItem(LOCAL_KEY);
    if(raw) return JSON.parse(raw).map(normaliseEntry).filter(Boolean);
  }catch(e){ /* fall through */ }
  return (Leaderboard._memory || []).slice();
}

// Coerce a row from the Sheet (or storage) into a well-formed entry, or null.
function normaliseEntry(e){
  if(!e) return null;
  const n = v => (v===""||v==null) ? NaN : Number(v);
  const out = {
    id: String(e.id || ""),
    ts: n(e.ts) || Date.parse(e.ts) || 0,
    name: String(e.name || "").slice(0,30),
    reason: String(e.reason || "").slice(0,200),
    col: n(e.col), row: n(e.row), radius_km: n(e.radius_km),
    lat: n(e.lat), lon: n(e.lon),
    score: n(e.score), pct: n(e.pct),
  };
  if(!out.name || !isFinite(out.score) || !isFinite(out.col) || !isFinite(out.row)) return null;
  return out;
}
