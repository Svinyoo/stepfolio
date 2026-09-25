const { randomUUID } = require('node:crypto');
const VERSION = 1;
function createProject() {
  return { format: 'stepfolio', version: VERSION, id: randomUUID(), title: 'คู่มือการใช้งาน', description: '', author: '', createdAt: new Date().toISOString(), steps: [] };
}
function validateProject(p) {
  if (!p || p.format !== 'stepfolio' || p.version !== VERSION || !Array.isArray(p.steps)) throw new Error('ไฟล์โครงการไม่ถูกต้อง หรือเป็นเวอร์ชันที่ยังไม่รองรับ');
  if (p.steps.length > 500) throw new Error('รองรับไม่เกิน 500 ขั้นตอนต่อโครงการ');
  for (const key of ['id', 'title', 'description', 'author', 'createdAt']) if (typeof p[key] !== 'string' || p[key].length > 20000) throw new Error('ข้อมูลโครงการไม่ถูกต้อง');
  const ids = new Set();
  for (const s of p.steps) {
    if (!s || typeof s.id !== 'string' || ids.has(s.id)) throw new Error('รหัสขั้นตอนไม่ถูกต้อง');
    ids.add(s.id);
    if (typeof s.image !== 'string' || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s.image) || s.image.length > 24000000) throw new Error('รูปภาพในโครงการไม่ถูกต้อง');
    for (const key of ['title','description','event','capturedAt']) if (typeof s[key] !== 'string' || s[key].length > 20000) throw new Error('รายละเอียดขั้นตอนไม่ถูกต้อง');
    if (!Number.isFinite(s.width) || !Number.isFinite(s.height) || s.width < 1 || s.height < 1 || s.width > 20000 || s.height > 20000) throw new Error('ขนาดรูปภาพไม่ถูกต้อง');
    if (s.marker !== null && (!s.marker || !Number.isFinite(s.marker.x) || !Number.isFinite(s.marker.y) || s.marker.x < 0 || s.marker.x > 1 || s.marker.y < 0 || s.marker.y > 1)) throw new Error('ตำแหน่งลูกศรไม่ถูกต้อง');
  }
  return p;
}
function pointOnDisplay(point, bounds) {
  if (point.x < bounds.x || point.y < bounds.y || point.x >= bounds.x + bounds.width || point.y >= bounds.y + bounds.height) return null;
  return {x: (point.x - bounds.x) / bounds.width, y: (point.y - bounds.y) / bounds.height};
}
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Coordinates are normalized against the captured display, independent of Retina/DPI scale.
function markerSVG(marker, width, height, number = '') {
  if (!marker) return '';
  const x = marker.x * width, y = marker.y * height;
  const r = Math.max(12, Math.min(width, height) * .025);
  const dx = x > width * .65 ? -1 : 1, dy = y > height * .65 ? -1 : 1;
  const tx = x + dx * r * 3.8, ty = y + dy * r * 3.8;
  const endX = x + dx * r * .95, endY = y + dy * r * .95;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="marker" aria-hidden="true"><circle cx="${x}" cy="${y}" r="${r}" fill="#ff583533" stroke="white" stroke-width="${r*.32}"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#f04c2e" stroke-width="${r*.16}"/><path d="M${tx} ${ty} L${endX} ${endY}" stroke="white" stroke-width="${r*.48}"/><path d="M${tx} ${ty} L${endX} ${endY}" stroke="#f04c2e" stroke-width="${r*.25}"/><path d="M${endX + dx*r*1.3} ${endY} L${endX} ${endY} L${endX} ${endY + dy*r*1.3}" fill="none" stroke="#f04c2e" stroke-width="${r*.25}"/><circle cx="${tx}" cy="${ty}" r="${r*.86}" fill="#f04c2e" stroke="white" stroke-width="${r*.15}"/><text x="${tx}" y="${ty+r*.3}" font-size="${r*.9}" font-family="Arial" font-weight="bold" text-anchor="middle" fill="white">${escapeHTML(number)}</text></svg>`;
}
function pdfHTML(p) {
  validateProject(p);
  return `<!doctype html><html lang="th"><meta charset="utf-8"><title>${escapeHTML(p.title || 'คู่มือการใช้งาน')}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'self'"><style>
  @page{size:A4;margin:18mm 17mm 20mm}*{box-sizing:border-box}body{margin:0;color:#18322e;font:12pt 'Thonburi','Leelawadee UI','Tahoma',sans-serif;line-height:1.7}h1,h2,p{overflow-wrap:anywhere}h1{font-size:34pt;line-height:1.4;margin:30mm 0 8mm}h2{font-size:20pt;line-height:1.5;margin:5mm 0}p{white-space:pre-wrap;margin:5mm 0}.brand{font:700 13pt Arial;letter-spacing:3px;color:#14846a}.cover{break-after:page}.eyebrow{font-size:10pt;color:#75847e}.cover-line{width:22mm;height:2mm;background:#e97443;margin-top:15mm}.step{break-before:page}.image{position:relative;width:100%;break-inside:avoid;margin:7mm 0}.image img{display:block;width:100%;max-height:135mm;object-fit:contain}.image-inner{position:relative;margin:auto}.marker{position:absolute;inset:0;width:100%;height:100%}.caption{color:#445d55;white-space:pre-wrap}.badge{display:inline-block;background:#e3eee8;color:#14654f;padding:1mm 4mm;border-radius:10mm;font-size:10pt}.meta{border-top:1px solid #d8e1db;margin-top:12mm;padding-top:5mm;color:#72847a;font-size:10pt}</style>
  <section class="cover"><div class="brand">STEPFOLIO / GUIDE</div><div class="cover-line"></div><h1>${escapeHTML(p.title || 'คู่มือการใช้งาน')}</h1><p>${escapeHTML(p.description)}</p><div class="meta">${escapeHTML(p.author)}<br>${p.steps.length} ขั้นตอน · ${escapeHTML(new Date(p.createdAt).toLocaleDateString('th-TH'))}</div></section>
  ${p.steps.map((s,i) => {const w = Math.min(659, 510 * s.width / s.height);return `<section class="step"><span class="badge">ขั้นตอนที่ ${i+1} / ${p.steps.length}</span><h2>${escapeHTML(s.title || `ขั้นตอนที่ ${i+1}`)}</h2><div class="image"><div class="image-inner" style="width:${w}px;max-width:100%"><img src="${s.image}"/>${markerSVG(s.marker,s.width,s.height,i+1)}</div></div><p class="caption">${escapeHTML(s.description)}</p></section>`}).join('')}</html>`;
}
module.exports = { createProject, validateProject, pointOnDisplay, markerSVG, pdfHTML, escapeHTML };
