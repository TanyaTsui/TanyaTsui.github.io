/* ============================================================
   LEADERBOARD STORAGE
   Google Sheet via Apps Script (see apps_script.gs + README).
   Paste the deployed Web App URL (…/exec) below. While it is empty the
   leaderboard runs in "local mode": entries live in this browser only,
   which is handy for testing but not shared between devices.

   Apps Script answers slowly (often 1.5–8 s per request), so the page never
   waits on it: submissions go into an outbox and are sent in the background,
   and the last leaderboard seen is cached so the board shows instantly.
   ============================================================ */
const LEADERBOARD_URL = "https://script.google.com/macros/s/AKfycbwtMV23LCpy3tnUyxmDqSXwQCY-UB-MY3YIIlgL3oe2RzmYGgk4DqqveNTg9cql-ek4xw/exec";

const LOCAL_KEY = "factorySiting.entries.v1";   // local mode: all entries
const CACHE_KEY = "factorySiting.cache.v1";     // sheet mode: last list fetched
const OUTBOX_KEY = "factorySiting.outbox.v1";   // sheet mode: entries not yet sent
const REQUEST_TIMEOUT_MS = 20000;

const Leaderboard = {
  mode: LEADERBOARD_URL ? "sheet" : "local",
  // Entries submitted from this browser that the Sheet hasn't returned yet.
  // Apps Script POSTs are no-cors, so we can't confirm receipt — keep them
  // visible until a fetched list contains them.
  pending: [],

  // Last known list, without waiting for the network (sheet mode) — or the
  // full list (local mode).
  cached(){
    if(this.mode==="local") return sortEntries(readStore(LOCAL_KEY));
    return mergeEntries(readStore(CACHE_KEY), this.pending.concat(readStore(OUTBOX_KEY)));
  },

  async list(){
    if(this.mode==="local") return this.cached();
    const res = await fetchWithTimeout(LEADERBOARD_URL + "?t=" + Date.now());
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const fetched = (data.entries || []).map(normaliseEntry).filter(Boolean);
    writeStore(CACHE_KEY, fetched);
    const seen = new Set(fetched.map(e=>e.id));
    this.pending = this.pending.filter(p=>!seen.has(p.id));
    return mergeEntries(fetched, this.pending.concat(readStore(OUTBOX_KEY)));
  },

  // Resolves once the request has been handed to the network; rejects if it
  // couldn't be sent (the entry then stays in the outbox for the next visit).
  async submit(entry){
    if(this.mode==="local"){
      const all = readStore(LOCAL_KEY);
      all.push(entry);
      writeStore(LOCAL_KEY, all);
      return;
    }
    this.pending.push(entry);
    writeStore(OUTBOX_KEY, readStore(OUTBOX_KEY, true).concat([entry]));
    await this._send(entry);
  },

  // Re-send anything a previous visit couldn't deliver.
  async flushOutbox(){
    if(this.mode!=="sheet") return;
    for(const entry of readStore(OUTBOX_KEY, true)){
      try{ await this._send(entry); }catch(e){ return; }
    }
  },

  async _send(entry){
    await fetchWithTimeout(LEADERBOARD_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {"Content-Type": "text/plain;charset=utf-8"},
      body: JSON.stringify(entry),
    });
    writeStore(OUTBOX_KEY, readStore(OUTBOX_KEY, true).filter(e=>e.id!==entry.id));
  },
};

function fetchWithTimeout(url, options={}){
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, {...options, signal: ctrl.signal}).finally(()=>clearTimeout(timer));
}

function sortEntries(list){
  return list.sort((a,b)=>a.score-b.score || a.ts-b.ts);
}

// Fetched entries plus local ones the Sheet doesn't have yet, de-duplicated by id.
function mergeEntries(base, extra){
  const out = base.slice();
  const seen = new Set(out.map(e=>e.id));
  extra.map(normaliseEntry).filter(Boolean).forEach(e=>{
    if(!seen.has(e.id)){ seen.add(e.id); out.push(e); }
  });
  return sortEntries(out);
}

// raw=true keeps entries exactly as stored (the outbox needs every field to re-send).
function readStore(key, raw=false){
  let list = null;
  try{
    const stored = localStorage.getItem(key);
    if(stored) list = JSON.parse(stored);
  }catch(e){ /* storage blocked or corrupt: fall through */ }
  if(!Array.isArray(list)) list = (Leaderboard._memory && Leaderboard._memory[key] || []).slice();
  return raw ? list : list.map(normaliseEntry).filter(Boolean);
}

function writeStore(key, list){
  Leaderboard._memory = Leaderboard._memory || {};
  Leaderboard._memory[key] = list.slice();
  try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){ /* storage blocked: memory only */ }
}

// Coerce a row from the Sheet (or storage) into a well-formed entry, or null.
function normaliseEntry(e){
  if(!e) return null;
  const n = v => (v===""||v==null) ? NaN : Number(v);
  const out = {
    id: String(e.id || ""),
    ts: n(e.ts) || Date.parse(e.ts) || 0,
    name: String(e.name ?? "").slice(0,30),
    reason: String(e.reason ?? "").slice(0,200),
    col: n(e.col), row: n(e.row), radius_km: n(e.radius_km),
    lat: n(e.lat), lon: n(e.lon),
    score: n(e.score), pct: n(e.pct),
  };
  if(!out.name || !isFinite(out.score) || !isFinite(out.col) || !isFinite(out.row)) return null;
  return out;
}
