/**
 * Factory siting game — leaderboard backend (Google Apps Script).
 *
 * Paste into Extensions → Apps Script of a NEW Google Sheet, then
 * Deploy → New deployment → Web app, execute as: Me, access: Anyone.
 * Copy the …/exec URL into LEADERBOARD_URL in leaderboard.js.
 *
 * Moderation: put TRUE (or tick a checkbox) in the "hidden" column of a row
 * to remove it from the public leaderboard. Deleting the row also works.
 */
const HEADERS = [
  'timestamp', 'id', 'name', 'reason', 'col', 'row', 'radius_km', 'lat', 'lon',
  'score', 'pct', 'climate_change', 'eutrophication_marine', 'land_use', 'hidden',
];

function getSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

// Plain single-line text, length-capped, and never interpreted as a formula.
function clean_(value, max) {
  let s = String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function num_(value) {
  const n = Number(value);
  return isFinite(n) ? n : '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const name = clean_(d.name, 30);
    if (!name || num_(d.score) === '') return json_({ ok: false });
    getSheet_().appendRow([
      new Date(), clean_(d.id, 64), name, clean_(d.reason, 200),
      num_(d.col), num_(d.row), num_(d.radius_km), num_(d.lat), num_(d.lon),
      num_(d.score), num_(d.pct),
      num_(d.climate_change), num_(d.eutrophication_marine), num_(d.land_use),
      '',
    ]);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const values = getSheet_().getDataRange().getValues();
  const head = values.shift();
  const col = name => head.indexOf(name);
  const entries = values
    .filter(r => !r[col('hidden')])
    .map(r => ({
      ts: r[col('timestamp')] instanceof Date ? r[col('timestamp')].getTime() : r[col('timestamp')],
      id: r[col('id')],
      name: r[col('name')],
      reason: r[col('reason')],
      col: r[col('col')],
      row: r[col('row')],
      radius_km: r[col('radius_km')],
      lat: r[col('lat')],
      lon: r[col('lon')],
      score: r[col('score')],
      pct: r[col('pct')],
    }));
  return json_({ entries: entries });
}
