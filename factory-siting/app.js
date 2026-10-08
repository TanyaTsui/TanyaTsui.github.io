/* ============================================================
   UI: map, panels, choose flow, leaderboard
   ============================================================ */
const MATERIAL_COLOR_HEX = {
  bark:'#8B5A2B', cellulose:'#C9A227', cotton:'#D8CBAE',
  hempdust:'#6B7A3A', peas:'#7A9B57', sawdust:'#A9743B', seagrass:'#2F6E5E'
};
const CATEGORY_LABELS = {
  'climate change': 'Climate change',
  'eutrophication: marine': 'Marine eutrophication',
  'land use': 'Land use',
};
const CATEGORY_COLORS = {
  'climate change':'#A8432B', 'eutrophication: marine':'#3E6FA0', 'land use':'#6B7A3A',
};

const svg = document.getElementById('mapSvg');
const SVG_NS = "http://www.w3.org/2000/svg";

/* ---------- state ---------- */
let site = null;        // {col,row} snapped land cell
let distKm = 150;
let current = null;     // {agg, impacts, score, feasible, pct}
let entries = [];       // leaderboard, sorted best first
let myEntryId = null;   // id of the entry submitted from this page view

/* ============================================================
   MAP
   ============================================================ */
function el(tag, attrs){
  const node = document.createElementNS(SVG_NS, tag);
  for(const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

function buildBasemap(){
  svg.appendChild(el('rect',{x:-14,y:-14,width:449,height:432,fill:'var(--map-bg)'}));
  const land = el('g',{fill:'var(--map-land)',stroke:'var(--map-stroke)','stroke-width':'0.4','stroke-linejoin':'round'});
  COASTLINE.forEach(poly=>{
    if(poly.length<3) return;
    const d = 'M' + poly.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join('L') + 'Z';
    land.appendChild(el('path',{d}));
  });
  svg.appendChild(land);

  svg.appendChild(el('g',{id:'entryDots'}));

  const marker = el('g',{id:'marker'});
  marker.style.display = 'none';
  marker.appendChild(el('circle',{id:'radiusCircle',fill:'var(--accent)','fill-opacity':'0.10',stroke:'var(--accent)','stroke-width':'1.1','stroke-dasharray':'3,2.4'}));
  marker.appendChild(el('line',{id:'cross1',stroke:'var(--accent)','stroke-width':'1'}));
  marker.appendChild(el('line',{id:'cross2',stroke:'var(--accent)','stroke-width':'1'}));
  marker.appendChild(el('circle',{id:'centerDot',r:'2.6',fill:'var(--accent)',stroke:'#fff','stroke-width':'0.8'}));
  svg.appendChild(marker);
}

function updateMarker(){
  const marker = document.getElementById('marker');
  if(!site){ marker.style.display='none'; return; }
  marker.style.display='block';
  const {col,row} = site;
  const rGrid = (distKm*1000)/((PXX+PXY)/2);
  const set = (id, attrs)=>{ const n=document.getElementById(id); for(const k in attrs) n.setAttribute(k, attrs[k]); };
  set('radiusCircle',{cx:col,cy:row,r:rGrid});
  const arm = Math.min(10, rGrid*0.35+3);
  set('cross1',{x1:col-arm,y1:row,x2:col+arm,y2:row});
  set('cross2',{x1:col,y1:row-arm,x2:col,y2:row+arm});
  set('centerDot',{cx:col,cy:row});
}

function renderEntryDots(){
  const g = document.getElementById('entryDots');
  g.innerHTML = '';
  entries.forEach(e=>{
    const mine = e.id===myEntryId;
    const dot = el('circle',{
      cx:e.col, cy:e.row, r: mine?3.2:2,
      fill: mine?'var(--accent)':'#E6C7A8',
      'fill-opacity': mine?1:0.75,
      stroke:'#182720','stroke-width':'0.5',
    });
    const title = el('title',{});
    title.textContent = `${e.name} · ${e.radius_km} km · ${e.score.toFixed(3)} pts`;
    dot.appendChild(title);
    g.appendChild(dot);
  });
}

function svgPointFromEvent(evt){
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
  return {col:loc.x, row:loc.y};
}

function onMapClick(evt){
  const {col,row} = svgPointFromEvent(evt);
  if(col<0||col>NCOLS-1||row<0||row>NROWS-1) return;
  const snapped = snapToLand(col,row);
  if(!snapped) return;   // open sea: ignore
  setSite(snapped);
}

function setSite(s){
  site = s;
  document.getElementById('hintBadge').style.display='none';
  const [lat,lon] = gridToLatLonApprox(s.col,s.row);
  document.getElementById('coordReadout').textContent = formatLatLon(lat,lon);
  updateMarker();
  recompute();
}

function formatLatLon(lat,lon){
  return `${Math.abs(lat).toFixed(2)}°${lat>=0?'N':'S'}, ${Math.abs(lon).toFixed(2)}°${lon>=0?'E':'W'}`;
}

/* ============================================================
   PANELS
   ============================================================ */
function formatTonnes(t){
  if(t>=1e6) return (t/1e6).toFixed(1)+' Mt';
  if(t>=1000) return (t/1000).toFixed(t>=1e4?0:1)+' kt';
  return t.toFixed(0)+' t';
}

function formatSci(v){
  const av = Math.abs(v);
  if(av===0) return '0';
  if(av < 0.001 || av >= 100000) return v.toExponential(2);
  if(av < 1) return v.toFixed(4);
  if(av < 100) return v.toFixed(3);
  return v.toFixed(1);
}

function describeArc(cx,cy,r,a0,a1){
  const p = a=>{ const t=(a-90)*Math.PI/180; return {x:cx+r*Math.cos(t), y:cy+r*Math.sin(t)}; };
  const s=p(a0), e=p(a1);
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${a1-a0<=180?0:1} 1 ${e.x} ${e.y} Z`;
}

// Panels always render their full layout (empty bars, all materials listed) so
// the right-hand column — and therefore the map beside it — keeps one height.
function renderPie(){
  const body = document.getElementById('pieBody');
  const agg = site && current ? current.agg : null;
  const grand = agg ? agg.grand : 0;
  const share = k => grand>0 ? agg.totals[k]/grand : 0;
  const keys = MATERIAL_KEYS.slice().sort((a,b)=>share(b)-share(a));

  let slices = '';
  const shown = keys.filter(k=>share(k)>=0.0005);
  if(shown.length===0){
    slices = `<circle cx="48" cy="48" r="44" fill="var(--line)"/>`;
  } else if(shown.length===1){
    slices = `<circle cx="48" cy="48" r="44" fill="${MATERIAL_COLOR_HEX[shown[0]]}"/>`;
  } else {
    let angle = 0;
    shown.forEach(k=>{
      const sweep = share(k)*360;
      slices += `<path d="${describeArc(48,48,44,angle,angle+sweep)}" fill="${MATERIAL_COLOR_HEX[k]}" stroke="var(--card)" stroke-width="1.5"/>`;
      angle += sweep;
    });
  }
  const legend = keys.map(k=>{
    const v = share(k);
    const has = v>=0.0005;
    return `<div class="legend-item${has?'':' zero'}">
      <span class="legend-dot" style="background:${MATERIAL_COLOR_HEX[k]}"></span>
      <span class="legend-name">${RASTER_DATA.material_display_names[k].replace(/ (filler|binder)$/,'')}</span>
      <span class="legend-val">${agg ? (v*100).toFixed(v>=0.1?0:1)+'%' : '–'}</span>
    </div>`;
  }).join('');
  const feasible = agg && current.feasible;
  body.innerHTML = `
    <div class="pie-row">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">${slices}</svg>
      <div class="legend">${legend}</div>
    </div>
    <div class="stat-strip">
      <div class="stat"><div class="k">Available</div><div class="v">${agg ? formatTonnes(grand)+'/yr' : '–'}</div></div>
      <div class="stat ${agg ? (feasible?'ok':'short') : ''}"><div class="k">Factory needs</div><div class="v">${formatTonnes(MIN_DEMAND_T)}/yr${agg ? (feasible?' ✓':' ✗') : ''}</div></div>
      <div class="stat"><div class="k">Average haul</div><div class="v">${agg && grand>0 ? (agg.meanDistKm*TRANSPORT.road_detour).toFixed(0)+' km' : '–'}</div></div>
    </div>`;
}

// Impacts are shown in impact points: value / EU per-person normalisation x 1000,
// i.e. thousandths of an average European's yearly footprint in that category.
// All three categories share this unit, so the three Net bars add up to the score.
function toPoints(val, category){ return val/EF_NORM[category]*1000; }

function renderBars(){
  const body = document.getElementById('barBody');
  const impacts = site && current ? current.impacts : null;
  const TERMS = [['feedstock','Feedstock'],['transport','Transport'],['fabrication','Fabrication'],['avoided','Avoided'],['net','Net']];
  const pts = {};
  CATEGORIES.forEach(c=>{
    pts[c] = {};
    TERMS.forEach(([k])=>pts[c][k] = impacts ? toPoints(impacts[c][k], c) : null);
  });
  // one shared scale across all categories, so bar lengths are comparable
  const maxMag = impacts ? Math.max(...CATEGORIES.flatMap(c=>TERMS.map(([k])=>Math.abs(pts[c][k]))), 1e-12) : 1;
  const row = (label, val, color, isNet)=>{
    const pct = val==null ? 0 : Math.min(100, Math.abs(val)/maxMag*100)/2;
    const pos = val>=0 ? `left:50%;width:${pct}%;` : `right:50%;width:${pct}%;`;
    return `<div class="bar-row${isNet?' net':''}">
      <span class="lab">${label}</span>
      <div class="bar-track"><div class="zero"></div><div class="bar-fill" style="${pos}background:${color};"></div></div>
      <span class="bar-val">${val==null ? '–' : (val>0?'+':'')+formatSci(val)}</span>
    </div>`;
  };
  body.innerHTML = CATEGORIES.map(c=>`<div class="impact-group">
      <h3><i class="cat-dot" style="background:${CATEGORY_COLORS[c]}"></i>${CATEGORY_LABELS[c]}</h3>
      <div class="bars">
        ${TERMS.map(([k,label])=>row(label, pts[c][k], CATEGORY_COLORS[c], k==='net')).join('')}
      </div>
    </div>`).join('') + `
    <div class="impact-note">
      Simplified estimate, not a full LCA. Transport assumes 1 kg feedstock per kg biopolymer;
      fabrication (mixing, printing, drying, baking) is the same everywhere.
    </div>`;
}

function renderLiveScore(){
  const box = document.getElementById('liveScore');
  const btn = document.getElementById('chooseBtn');
  if(!site || !current){
    box.innerHTML = `<div class="score-head"><span>Your score <small>lower is better</small></span><b>–</b></div>
      <div>Click the map to place your factory.</div>`;
    btn.disabled = true;
    return;
  }
  if(!current.feasible){
    box.innerHTML = `<p class="score-warn"><b>Not enough feedstock:</b> ${formatTonnes(current.agg.grand)} of the ${formatTonnes(MIN_DEMAND_T)}/yr needed. Widen the distance or move.</p>`;
    btn.disabled = true;
    return;
  }
  const nets = CATEGORIES.map(c=>({c, v: toPoints(current.impacts[c].net, c)}));
  const posSum = nets.reduce((s,n)=>s+Math.max(0,n.v),0) || 1;
  const segs = nets.filter(n=>n.v>0).map(n=>
    `<div class="score-seg" style="width:${n.v/posSum*100}%;background:${CATEGORY_COLORS[n.c]}" title="${CATEGORY_LABELS[n.c]}: ${formatSci(n.v)}"></div>`).join('');
  const sum = nets.map(n=>`<span style="color:${CATEGORY_COLORS[n.c]}">${formatSci(n.v)}</span>`).join(' + ');
  box.innerHTML = `
    <div class="score-head"><span>Your score <small>lower is better</small></span><b>${current.score.toFixed(3)}</b></div>
    <div class="score-bar">${segs}</div>
    <div class="score-sum">${sum} = ${current.score.toFixed(3)}</div>`;
  btn.disabled = false;
}

function recompute(){
  if(!site){ current = null; }
  else {
    const agg = aggregateMaterials(site.col, site.row, distKm);
    const impacts = computeImpacts(agg);
    const score = computeScore(impacts);
    const feasible = isFeasible(agg) && score!=null;
    current = {agg, impacts, score, feasible, pct: feasible ? percentileBeaten(score) : null};
  }
  renderPie(); renderBars(); renderLiveScore();
}

/* ============================================================
   CHOOSE FLOW
   ============================================================ */
const modalBack = document.getElementById('modalBack');

function openChoose(){
  if(!current || !current.feasible) return;
  document.getElementById('chooseForm').hidden = false;
  document.getElementById('resultView').hidden = true;
  const [lat,lon] = gridToLatLonApprox(site.col,site.row);
  document.getElementById('chooseSummary').textContent =
    `Factory at ${formatLatLon(lat,lon)}, sourcing feedstock up to ${distKm} km away. Score ${current.score.toFixed(3)} impact points.`;
  modalBack.classList.add('open');
  setTimeout(()=>document.getElementById('nameInput').focus(), 30);
}

function closeModal(){ modalBack.classList.remove('open'); }

function newId(){
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));
}

async function submitChoice(evt){
  evt.preventDefault();
  const name = document.getElementById('nameInput').value.trim();
  if(!name) return;
  const reason = document.getElementById('reasonInput').value.trim();
  const [lat,lon] = gridToLatLonApprox(site.col,site.row);
  const entry = {
    id: newId(), ts: Date.now(), name, reason,
    col: site.col, row: site.row, radius_km: distKm,
    lat: +lat.toFixed(3), lon: +lon.toFixed(3),
    score: +current.score.toFixed(6), pct: +current.pct.toFixed(2),
    climate_change: current.impacts['climate change'].net,
    eutrophication_marine: current.impacts['eutrophication: marine'].net,
    land_use: current.impacts['land use'].net,
  };
  myEntryId = entry.id;

  let saved = true;
  try{ await Leaderboard.submit(entry); }catch(e){ saved = false; }
  await refreshBoard();
  if(!entries.some(e=>e.id===entry.id)){
    entries.push(normaliseEntry(entry));
    entries.sort((a,b)=>a.score-b.score || a.ts-b.ts);
    renderBoard();
  }
  const rank = entries.findIndex(e=>e.id===entry.id)+1;

  document.getElementById('resultPct').textContent = Math.floor(entry.pct)+'%';
  document.getElementById('resultLine').textContent =
    `of all ${(SCORE_DIST.n_feasible/1e6).toFixed(1)} million possible factory locations and travel distances in Europe.`;
  document.getElementById('resultMeta').innerHTML =
    `Leaderboard rank <b>#${rank}</b> of <b>${entries.length}</b><br>` +
    `Score <b>${entry.score.toFixed(3)}</b> impact points` +
    (saved ? '' : '<br><span style="color:var(--danger)">Could not reach the leaderboard; your entry is shown on this screen only.</span>');
  document.getElementById('chooseForm').hidden = true;
  document.getElementById('resultView').hidden = false;
  document.getElementById('chooseForm').reset();
}

/* ============================================================
   LEADERBOARD
   ============================================================ */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function refreshBoard(){
  const status = document.getElementById('boardStatus');
  try{
    entries = await Leaderboard.list();
    const count = `${entries.length} ${entries.length===1?'entry':'entries'}`;
    status.textContent = Leaderboard.mode==='local' ? `${count} · local mode (this browser only)` : count;
  }catch(e){
    status.textContent = 'leaderboard unavailable right now';
  }
  renderBoard();
}

function renderBoard(){
  const body = document.getElementById('boardBody');
  renderEntryDots();
  if(entries.length===0){
    body.innerHTML = '<p class="empty-state">No factories yet. Be the first!</p>';
    return;
  }
  const TOP = 10;
  const myIdx = entries.findIndex(e=>e.id===myEntryId);
  const rowsToShow = entries.map((e,i)=>({e,i})).filter(({i})=>i<TOP || i===myIdx);
  let html = `<table class="board-table">
    <thead><tr><th>#</th><th>Name</th><th class="hide-sm">Site</th><th>Distance</th><th>Score</th><th class="hide-sm">Beats</th></tr></thead><tbody>`;
  let prev = -1;
  rowsToShow.forEach(({e,i})=>{
    if(i>prev+1) html += `<tr class="gap"><td colspan="6">…</td></tr>`;
    prev = i;
    html += `<tr class="entry${e.id===myEntryId?' you':''}" data-idx="${i}" title="Show on map">
      <td class="num">${i+1}</td>
      <td><span class="name">${escapeHtml(e.name)}</span>${e.reason?`<span class="reason">“${escapeHtml(e.reason)}”</span>`:''}</td>
      <td class="num hide-sm">${isFinite(e.lat)?formatLatLon(e.lat,e.lon):''}</td>
      <td class="num">${e.radius_km} km</td>
      <td class="num">${e.score.toFixed(3)}</td>
      <td class="num hide-sm">${isFinite(e.pct)?Math.floor(e.pct)+'%':''}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  body.innerHTML = html;
  body.querySelectorAll('tr.entry').forEach(tr=>{
    tr.addEventListener('click', ()=>previewEntry(entries[+tr.dataset.idx]));
  });
}

function previewEntry(e){
  setDistance(e.radius_km);
  setSite({col:e.col, row:e.row});
  document.querySelector('.map-panel').scrollIntoView({behavior:'smooth', block:'start'});
}

/* ============================================================
   INIT
   ============================================================ */
const slider = document.getElementById('distSlider');

function setDistance(km){
  distKm = km;
  slider.value = km;
  document.getElementById('distVal').textContent = km+' km';
  slider.style.setProperty('--fill', (km-slider.min)/(slider.max-slider.min)*100+'%');
  updateMarker();
}

function initControls(){
  slider.addEventListener('input', ()=>{ setDistance(parseInt(slider.value,10)); recompute(); });
  setDistance(distKm);
  svg.addEventListener('click', onMapClick);
  document.getElementById('chooseBtn').addEventListener('click', openChoose);
  document.getElementById('chooseForm').addEventListener('submit', submitChoice);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('doneBtn').addEventListener('click', ()=>{
    closeModal();
    document.querySelector('.board').scrollIntoView({behavior:'smooth', block:'start'});
  });
  modalBack.addEventListener('click', e=>{ if(e.target===modalBack) closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
}

(async function init(){
  buildBasemap();
  initControls();
  recompute();
  await decodeAll();
  document.getElementById('loadingScreen').style.display='none';
  if(new URLSearchParams(location.search).has('selftest')){
    console.log('Self-test', runSelfTest() ? 'PASSED' : 'FAILED');
  }
  refreshBoard();
})();
