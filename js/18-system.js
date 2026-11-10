// ── SYSTEM 창(MFD 계통 화면) ──
// 탭의 'SYSTEM' 으로 연다. CDU 의 Aircraft Systems 아홉 버튼이 이 창의 화면을 고른다(sysPageSet).
// 왼쪽은 엔진·계통 띠(TGT · NG · EOT · EOP · MGB · Fuel F · Fuel P · HYD P · Fuel QTY · Battery · ACCP),
// 위는 정보 줄(FOD · END · VSR · FLT · DNALT · CCG · TOD · MSA), 가운데 큰 칸이 고른 계통 화면이다.
// 지금 갖춘 화면은 Fuel — 나머지는 이름과 '준비 중'.
//
// 그림은 1000×630 의 설계 크기로 그려 창에 맞춰 줄이고 키운다(실기 MFD 사진의 비율).

const SYS_W = 1000, SYS_H = 630;
const SYS_PAGES = {
  asys_afcs: 'AFCS', asys_status: 'Aircraft Status', asys_elec: 'Electrical', asys_eng: 'Engines',
  asys_fuel: 'Fuel', asys_hocas: 'HOCAS', asys_tests: 'System Tests', asys_video: 'Video', asys_maint: 'Maintenance',
};
let sysPage = 'asys_fuel';
function sysPageSet(id) {
  if (!SYS_PAGES[id]) return;
  sysPage = id;
  try { sysDraw(); } catch (e) { _swallow(e); }
}

// ── 연료(lbs) ── 쪽마다 집합 탱크(FT1 · FT2)와 주 탱크(FWD · AFT · F5)의 제 몫.
// 엔진은 제 쪽 집합 탱크에서 먹고, 이송 펌프가 주 탱크에서 집합 탱크를 채워 둔다(주 탱크가 빌 때까지).
// 주 탱크 셋은 처음 양의 비로 함께 줄어든다(화면에는 FWD · AFT · F5 로 나눠 보인다).
const FUEL_FT_FULL = { 1: 266, 2: 305 };          // 집합 탱크 가득(사진의 값)
const FUEL_MAIN0 = { fwd: 653, aft: 420, f5: 270 };  // 주 탱크 처음 양
const FUEL_MAX = 2500;                              // 채울 수 있는 끝(lbs)
const FUEL_XFER_PPH = 1000;                         // 이송 펌프가 집합 탱크로 보내는 빠르기(lbs/h)
const FUEL_LOW_LBS = 165;                           // FUEL n LOW — 집합 탱크가 이 아래
const FUEL_IMB_LBS = 200;                           // FUEL IMBALANCE — 양쪽 차가 이 위
let fuel = { ft1: 266, ft2: 305, mainL: 690, mainR: 653, aux: 0 };   // L 956 · R 958 · 합 1914
let sysFltSec = 0;                                  // FLT — 비행 시간(시뮬 시간)
function fuelLeft()  { return fuel.ft1 + fuel.mainL; }
function fuelRight() { return fuel.ft2 + fuel.mainR; }
function fuelTotal() { return fuelLeft() + fuelRight() + fuel.aux; }
// 합을 정해 양쪽에 반씩 채운다 — 집합 탱크를 먼저 채우고 나머지는 주 탱크로
function fuelSetTotal(lbs) {
  const tot = Math.max(0, Math.min(FUEL_MAX, Number(lbs) || 0));
  const side = n => {
    const half = tot / 2, ft = Math.min(FUEL_FT_FULL[n], half);
    return { ft, main: half - ft };
  };
  const a = side(1), b = side(2);
  fuel = { ft1: a.ft, ft2: b.ft, mainL: a.main, mainR: b.main, aux: 0 };
  _fuelCduRefresh();
}
function fuelAdjust(d) { fuelSetTotal(fuelTotal() + Number(d || 0)); }
function fuelReset() { fuel = { ft1: 266, ft2: 305, mainL: 690, mainR: 653, aux: 0 }; sysFltSec = 0; _fuelCduRefresh(); }
// 주 탱크 셋으로 나눠 보인다(처음 양의 비)
function fuelMainSplit() {
  const m = fuel.mainL + fuel.mainR, m0 = FUEL_MAIN0.fwd + FUEL_MAIN0.aft + FUEL_MAIN0.f5;
  const k = m / m0;
  return { fwd: FUEL_MAIN0.fwd * k, aft: FUEL_MAIN0.aft * k, f5: FUEL_MAIN0.f5 * k };
}
// 엔진마다 연료 흐름(pph) — 토크를 따라 오른다. IDLE 은 130 · 멎은 엔진 · 제 쪽 연료가 다 떨어지면 0
function fuelFlow() {
  let P = null;
  try { P = engParams(); } catch (e) { P = null; }
  const one = (e, n) => {
    if (!e || !(e.ng > 0)) return 0;
    if ((n === 1 ? fuelLeft() : fuelRight()) <= 0) return 0;
    return e.tq > 0 ? 180 + 4.5 * e.tq : 130;
  };
  return P ? { f1: one(P.e1, 1), f2: one(P.e2, 2), P } : { f1: 0, f2: 0, P: null };
}
let _sysT = 0;
function sysTick() {
  const now = performance.now();
  const dtReal = _sysT ? Math.min(2, (now - _sysT) / 1000) : 0;
  _sysT = now;
  let k = 0;
  try { k = S.running ? (Number(simSpeed) || 1) : 0; } catch (e) { k = 0; }
  const dt = dtReal * k;                             // 시뮬 시간(배속 포함)
  if (dt > 0) {
    sysFltSec += dt;
    const { f1, f2 } = fuelFlow();
    const burn = (ftKey, mainKey, pph) => {
      fuel[ftKey] = Math.max(0, fuel[ftKey] - pph * dt / 3600);
      const room = FUEL_FT_FULL[ftKey === 'ft1' ? 1 : 2] - fuel[ftKey];
      const x = Math.min(room, fuel[mainKey], FUEL_XFER_PPH * dt / 3600);
      fuel[ftKey] += x; fuel[mainKey] -= x;
    };
    burn('ft1', 'mainL', f1); burn('ft2', 'mainR', f2);
  }
  const w = document.getElementById('sysp-wrap');
  if (w && !w.classList.contains('page-hidden')) sysDraw();
  _fuelCduRefresh();
  _elecCduRefresh();
}
setInterval(sysTick, 250);

// ── 그리기 ──
const SYS_GREEN = '#3ad13a', SYS_LINE = '#22c822', SYS_CYAN = '#2fe0e0', SYS_AMBER = '#ffb000';
function sysEnsure() {
  const wrap = document.getElementById('sysp-wrap');
  if (!wrap) return null;
  let c = wrap.querySelector('canvas');
  if (!c) { c = document.createElement('canvas'); c.id = 'sysp-cvs'; wrap.appendChild(c); }
  const dpr = window.devicePixelRatio || 1, W = wrap.clientWidth, H = wrap.clientHeight;
  if (!(W > 0 && H > 0)) return null;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = W + 'px'; c.style.height = H + 'px';
  }
  return { c, g: c.getContext('2d'), W, H, dpr };
}
function sysDraw() {
  const E = sysEnsure();
  if (!E) return;
  const { g, W, H, dpr } = E;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#000'; g.fillRect(0, 0, E.c.width, E.c.height);
  const k = Math.min(W / SYS_W, H / SYS_H);
  g.setTransform(k * dpr, 0, 0, k * dpr, (W - SYS_W * k) / 2 * dpr, (H - SYS_H * k) / 2 * dpr);
  const F = fuelFlow();
  _sysLeftStrip(g, F);
  _sysTopBar(g, F);
  // 큰 칸 — 청록 테두리와 위 가운데 화면 이름
  const name = SYS_PAGES[sysPage] || '';
  g.strokeStyle = SYS_CYAN; g.lineWidth = 4;
  g.strokeRect(224, 32, 772, 594);
  g.font = 'bold 11px Helvetica Neue, Arial, sans-serif';
  const tw = g.measureText(name).width + 12;
  g.fillStyle = '#000'; g.fillRect(605 - tw / 2, 33, tw, 14);
  g.strokeStyle = '#ccc'; g.lineWidth = 1; g.strokeRect(605 - tw / 2 + 0.5, 33.5, tw - 1, 13);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(name, 605, 44);
  if (sysPage === 'asys_fuel') _sysFuelPage(g, F);
  else if (sysPage === 'asys_elec') _sysElecPage(g, F);
  else {
    g.fillStyle = '#4a6a7a'; g.font = 'bold 26px Helvetica Neue, Arial, sans-serif';
    g.fillText(name.toUpperCase(), 610, 310);
    g.font = '14px Helvetica Neue, Arial, sans-serif'; g.fillStyle = '#567';
    g.fillText('준비 중 — 이 계통 화면은 차차 갖춥니다', 610, 340);
  }
}
const _f = (sz, b = true) => `${b ? 'bold ' : ''}${sz}px Helvetica Neue, Arial, sans-serif`;
// 둥근 테두리 칸 + 위 가운데 제목(테두리를 비우고)
function _sysBox(g, x, y, w, h, title, unit) {
  g.strokeStyle = '#5a6672'; g.lineWidth = 1.2;
  const r = 6;
  g.font = _f(12);
  const t = title + (unit ? ' ' : '');
  const tw = g.measureText(t).width + (unit ? (g.font = _f(8), g.measureText(unit).width) : 0) + 8;
  g.beginPath();
  g.moveTo(x + w / 2 + tw / 2, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.lineTo(x + w / 2 - tw / 2, y);
  g.stroke();
  g.fillStyle = '#e8edf2'; g.textAlign = 'left';
  g.font = _f(12); const t1 = g.measureText(t).width;
  const sx = x + w / 2 - (tw - 8) / 2;
  g.fillText(t, sx, y + 4);
  if (unit) { g.font = _f(8); g.fillText(unit, sx + t1, y + 4); }
}
// 막대 둘(위에 이름·값) — lo/hi 범위, 빨강·노랑 선(비율), 녹색 채움
function _sysBars(g, x, y, w, h, lbls, vals, frac, lines) {
  const n = vals.length, colW = w / n;
  vals.forEach((v, i) => {
    const cx = x + colW * (i + 0.5);
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = _f(8); g.fillText(lbls[i], cx, y + 10);
    let fs = 15; g.font = _f(fs);
    while (fs > 9 && g.measureText(v).width > colW - 3) { fs -= 1; g.font = _f(fs); }   // 네 자리(HYD P)는 칸에 맞춰 줄인다
    g.fillText(v, cx, y + 26);
    const bw = Math.min(14, colW * 0.42), by = y + 34, bh = h - 40, bx = cx - bw / 2;
    g.strokeStyle = '#ddd'; g.lineWidth = 1.2; g.strokeRect(bx, by, bw, bh);
    const f = Math.max(0, Math.min(1, frac[i]));
    g.fillStyle = SYS_GREEN; g.fillRect(bx + 1.5, by + bh * (1 - f), bw - 3, bh * f - 1.5);
    (lines || []).forEach(([fr, col]) => {
      g.strokeStyle = col; g.lineWidth = 2;
      g.beginPath(); g.moveTo(bx - 2, by + bh * (1 - fr)); g.lineTo(bx + bw + 2, by + bh * (1 - fr)); g.stroke();
    });
  });
}
function _sysLeftStrip(g, F) {
  const P = F.P || { e1: { tgt: 0, ng: 0 }, e2: { tgt: 0, ng: 0 }, nr: 0 };
  const run1 = P.e1.ng > 50, run2 = P.e2.ng > 50, rot = (P.nr || 0) > 50;
  const r0 = v => String(Math.round(v));
  // TGT · NG
  _sysBox(g, 5, 20, 103, 152, 'TGT', '°C');
  _sysBars(g, 9, 24, 95, 145, ['TGT1', 'TGT2'], [r0(P.e1.tgt), r0(P.e2.tgt)], [P.e1.tgt / 1000, P.e2.tgt / 1000],
    [[0.78, '#ff3030'], [0.66, '#ffcc00']]);
  _sysBox(g, 114, 20, 104, 152, 'NG', '%');
  _sysBars(g, 118, 24, 96, 145, ['NG1', 'NG2'], [P.e1.ng.toFixed(1), P.e2.ng.toFixed(1)], [P.e1.ng / 110, P.e2.ng / 110],
    [[0.70, '#ff3030'], [0.66, '#ffcc00']]);
  // EOT · EOP · MGB
  const eot = [run1 ? 91 : 30, run2 ? 93 : 30], eop = [run1 ? 68 : 0, run2 ? 66 : 0];
  _sysBox(g, 5, 188, 68, 152, 'EOT', '°C');
  _sysBars(g, 7, 192, 64, 145, ['T1', 'T2'], eot.map(r0), eot.map(v => v / 160), [[0.66, '#ff3030'], [0.56, '#ffcc00'], [0.12, '#ff3030']]);
  _sysBox(g, 78, 188, 68, 152, 'EOP', 'PSID');
  _sysBars(g, 80, 192, 64, 145, ['P1', 'P2'], eop.map(r0), eop.map(v => v / 140), [[0.82, '#ff3030'], [0.60, '#ffcc00'], [0.22, '#ffcc00'], [0.10, '#ff3030']]);
  const mgb = [rot ? 91 : 30, rot ? 43 : 0];
  _sysBox(g, 151, 188, 67, 152, 'MGB', '');
  _sysBars(g, 153, 192, 63, 145, ['T', 'P'], mgb.map(r0), [mgb[0] / 140, mgb[1] / 80], [[0.80, '#ff3030'], [0.24, '#ffcc00']]);
  // Fuel F · Fuel P · HYD P
  const ff = [F.f1, F.f2], fp = [F.f1 > 0 ? 17 : 0, F.f2 > 0 ? 18 : 0], hyd = [rot ? 2980 : 0, rot ? 2940 : 0];
  _sysBox(g, 5, 356, 72, 152, 'Fuel F', 'PPH');
  _sysBars(g, 7, 360, 68, 145, ['F1', 'F2'], ff.map(r0), ff.map(v => v / 800), []);
  _sysBox(g, 81, 356, 70, 152, 'Fuel P', 'PSI');
  _sysBars(g, 83, 360, 66, 145, ['P1', 'P2'], fp.map(r0), fp.map(v => v / 40), [[0.86, '#ff3030'], [0.58, '#ffcc00'], [0.10, '#ff3030']]);
  _sysBox(g, 155, 356, 63, 152, 'HYD P', 'PSI');
  _sysBars(g, 156, 360, 61, 145, ['P1', 'P2'], hyd.map(r0), hyd.map(v => v / 4000), [[0.82, '#ff3030'], [0.73, '#ffcc00'], [0.25, '#ffcc00'], [0.12, '#ff3030']]);
  // Fuel QTY
  _sysBox(g, 8, 524, 102, 98, 'Fuel QTY', 'LBS');
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = _f(9); g.fillText('L', 33, 548); g.fillText('R', 90, 548);
  g.font = _f(14); g.fillText(r0(fuelLeft()), 33, 564); g.fillText(r0(fuelRight()), 90, 564);
  g.textAlign = 'left'; g.font = _f(11); g.fillText('Aux', 28, 594); g.fillText('Total', 28, 613);
  g.textAlign = 'right'; g.font = _f(13); g.fillText(r0(fuel.aux), 96, 594); g.fillText(r0(fuelTotal()), 96, 613);
  // Battery · ACCP
  // 배터리 — 전기 계통(elecState)과 같은 값(충전 + · 방전 −)
  let bat = { a: 0, v: 25 };
  try { bat = elecState().bat; } catch (e) { _swallow(e); }
  _sysBox(g, 118, 524, 100, 50, 'Battery', '');
  g.textAlign = 'left'; g.font = _f(11); g.fillStyle = '#fff'; g.fillText('Amps', 126, 545); g.fillText('Volts', 126, 563);
  g.textAlign = 'right'; g.font = _f(13); g.fillText(String(bat.a), 210, 545); g.fillText(String(bat.v), 210, 563);
  _sysBox(g, 118, 588, 100, 34, 'ACCP', '');
  g.textAlign = 'left'; g.font = _f(11); g.fillText('PSI', 126, 612);
  g.textAlign = 'right'; g.font = _f(13); g.fillText(rot ? '2837' : '0', 210, 612);
}
function _sysTopBar(g, F) {
  const ff = F.f1 + F.f2;
  const hm = h => `${Math.floor(h)}+${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  const end = ff > 0 ? hm(fuelTotal() / ff) : '_+__';
  const s = Math.floor(sysFltSec), flt = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  let dn = S.alt;
  try { if (typeof simDensityAltFt === 'function') dn = simDensityAltFt(); } catch (e) { _swallow(e); }
  const item = (x, lbl, val, unit, col) => {
    g.textAlign = 'left'; g.font = _f(12); g.fillStyle = '#fff'; g.fillText(lbl, x, 22);
    let cx = x + g.measureText(lbl).width + 2;
    g.font = _f(15); g.fillStyle = col || '#fff'; g.fillText(val, cx, 22);
    cx += g.measureText(val).width + 1;
    if (unit) { g.font = _f(9); g.fillText(unit, cx, 22); }
  };
  item(226, 'FOD', '_+__', '', '#ff40ff');
  item(318, 'END', end, '');
  item(410, 'VSR', '____', 'FPM', '#ff40ff');
  item(505, 'FLT', flt, '');
  item(605, 'DNALT', String(Math.round(dn)), 'FT');
  item(715, 'CCG', '____', 'FT/NM', '#ff40ff');
  item(818, 'TOD', '__:__', '', '#ff40ff');
  item(892, 'MSA', '____', 'FT', '#ff40ff');
}
// 경고 칸 — 평소 흰 테두리, 걸리면 호박색으로 채운다
function _sysAnn(g, x, y, w, h, l1, l2, on) {
  g.fillStyle = on ? SYS_AMBER : '#000'; g.fillRect(x, y, w, h);
  g.strokeStyle = on ? SYS_AMBER : '#cfcfcf'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
  g.fillStyle = on ? '#000' : '#e8e8e8'; g.textAlign = 'center';
  g.font = _f(11);
  if (l2) { g.fillText(l1, x + w / 2, y + h / 2 - 2); g.fillText(l2, x + w / 2, y + h / 2 + 12); }
  else g.fillText(l1, x + w / 2, y + h / 2 + 4);
}
function _sysTank(g, x, y, w, h, frac) {
  g.fillStyle = '#000'; g.fillRect(x, y, w, h);
  const f = Math.max(0, Math.min(1, frac));
  g.fillStyle = SYS_GREEN; g.fillRect(x + 2, y + h - (h - 4) * f - 2, w - 4, (h - 4) * f);
  g.strokeStyle = '#e8e8e8'; g.lineWidth = 2.5; g.strokeRect(x, y, w, h);
}
function _sysEngine(g, cx, cy, n, pph) {
  // 엔진 그림(위가 좁은 통 + 배기) — 사진의 회색 외곽
  g.save(); g.translate(cx, cy);
  g.fillStyle = '#2a2d30'; g.strokeStyle = '#d8d8d8'; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-6, -64); g.lineTo(6, -64); g.lineTo(10, -52); g.lineTo(26, -42); g.lineTo(28, -10); g.lineTo(22, 6);
  g.lineTo(26, 30); g.lineTo(18, 50); g.lineTo(22, 64); g.lineTo(-22, 64); g.lineTo(-18, 50); g.lineTo(-26, 30);
  g.lineTo(-22, 6); g.lineTo(-28, -10); g.lineTo(-26, -42); g.lineTo(-10, -52); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = _f(12); g.fillText(`ENG ${n}`, 0, -30);
  g.font = _f(14); g.fillText(String(Math.round(pph)), 0, -10);
  g.font = _f(11); g.fillText('PPH', 0, 6);
  g.restore();
}
function _sysFuelPage(g, F) {
  const L = fuelLeft(), R = fuelRight(), T = fuelTotal(), M = fuelMainSplit();
  const r0 = v => String(Math.round(v));
  const ln = (pts, on = true, w = 3) => {
    g.strokeStyle = on ? SYS_LINE : '#555'; g.lineWidth = w; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.stroke();
  };
  const big = (x, y, l1, l2) => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(19); g.fillText(l1, x, y); g.fillText(l2, x, y + 22);
  };
  big(488, 92, 'Left', `${r0(L)} LBS`); big(592, 92, 'Total', `${r0(T)} LBS`);
  big(698, 92, 'Right', `${r0(R)} LBS`); big(815, 90, 'AUX', `${r0(fuel.aux)} LBS`);
  const tankLbl = (x, y, a, b) => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(13); g.fillText(a, x, y);
    g.font = _f(14); const w1 = g.measureText(b).width; g.fillText(b, x - 8, y + 20);
    g.font = _f(9); g.textAlign = 'left'; g.fillText('LBS', x - 8 + w1 / 2 + 1, y + 20);
  };
  const run1 = F.f1 > 0, run2 = F.f2 > 0;
  // 배관 — 엔진 1 · 2 와 APU
  ln([[312, 200], [312, 297], [361, 297]], run1); ln([[417, 297], [435, 297]], run1); ln([[491, 297], [528, 297]], run1);
  ln([[892, 200], [892, 297], [845, 297]], run2); ln([[787, 297], [770, 297]], run2); ln([[713, 297], [677, 297]], run2);
  ln([[870, 297], [870, 312], [905, 312], [905, 516]], run2);
  ln([[705, 330], [705, 322], [760, 322], [760, 330]]);                    // TP 배관
  ln([[705, 322], [705, 465], [648, 465]]);
  ln([[466, 498], [556, 498]]);                                             // 급유구 → F5
  g.strokeStyle = SYS_LINE; g.lineWidth = 3;
  g.beginPath(); g.moveTo(312, 215); g.lineTo(320, 215); g.stroke();     // 압력 탭
  g.beginPath(); g.moveTo(892, 215); g.lineTo(884, 215); g.stroke();
  g.fillStyle = '#fff'; g.font = _f(14); g.textAlign = 'left';
  g.fillText(`${F.f1 > 0 ? 17 : 0}`, 336, 222); g.font = _f(9); g.fillText('PSI', 354, 222);
  g.font = _f(14); g.fillText(`${F.f2 > 0 ? 18 : 0}`, 915, 220); g.font = _f(9); g.fillText('PSI', 933, 220);
  // 탱크
  _sysTank(g, 507, 146, 191, 64, M.fwd / FUEL_MAIN0.fwd);
  _sysTank(g, 507, 218, 67, 162, fuel.ft1 / FUEL_FT_FULL[1]);
  _sysTank(g, 628, 212, 68, 163, fuel.ft2 / FUEL_FT_FULL[2]);
  _sysTank(g, 507, 383, 191, 65, M.aft / FUEL_MAIN0.aft);
  _sysTank(g, 556, 450, 92, 62, M.f5 / FUEL_MAIN0.f5);
  tankLbl(466, 172, 'FWD', r0(M.fwd)); tankLbl(462, 236, 'FT 1', r0(fuel.ft1));
  tankLbl(745, 236, 'FT 2', r0(fuel.ft2)); tankLbl(464, 416, 'AFT', r0(M.aft)); tankLbl(520, 468, 'F5', r0(M.f5));
  // 펌프·밸브
  const pump = (x, y, r, txt, txt2, on) => {
    g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = on ? SYS_LINE : '#888'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(txt2 ? 10 : 11);
    if (txt2) { g.fillText(txt, x, y - 1); g.fillText(txt2, x, y + 11); } else g.fillText(txt, x, y + 4);
  };
  pump(542, 297, 14, 'BP', '', run1); pump(663, 297, 14, 'BP', '', run2); pump(602, 300, 21, 'TP', 'AUTO', true);
  g.strokeStyle = '#e8e8e8'; g.lineWidth = 2.5; g.strokeRect(714, 330, 92, 63);
  pump(739, 371, 16, 'TP1', '', true); pump(782, 371, 16, 'TP2', '', true);
  g.strokeStyle = '#e8e8e8'; g.strokeRect(400, 330, 90, 63);
  tankLbl(355, 352, 'EXT AUX1', '0'); tankLbl(856, 352, 'EXT AUX2', '0');
  // 경고 칸
  _sysAnn(g, 284, 231, 60, 37, 'MFSOV 1', 'CLOSE', false);
  _sysAnn(g, 863, 230, 60, 37, 'MFSOV 2', 'CLOSE', false);
  _sysAnn(g, 361, 278, 56, 38, 'PRESS 1', 'LOW', !run1);
  _sysAnn(g, 435, 278, 56, 38, 'FLTR 1', 'CLOG', false);
  _sysAnn(g, 713, 277, 57, 38, 'FLTR 2', 'CLOG', false);
  _sysAnn(g, 787, 277, 58, 38, 'PRESS 2', 'LOW', !run2);
  _sysAnn(g, 517, 330, 52, 33, 'FUEL 1', 'LOW', fuel.ft1 < FUEL_LOW_LBS);
  _sysAnn(g, 637, 330, 52, 33, 'FUEL 2', 'LOW', fuel.ft2 < FUEL_LOW_LBS);
  _sysAnn(g, 263, 562, 116, 19, 'FUEL IMBALANCE', '', Math.abs(L - R) > FUEL_IMB_LBS);
  // 엔진 · APU · 급유구
  _sysEngine(g, 312, 132, 1, F.f1);
  _sysEngine(g, 892, 130, 2, F.f2);
  g.save(); g.translate(910, 536);
  g.fillStyle = '#2a2d30'; g.strokeStyle = '#d8d8d8'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-28, -20); g.lineTo(28, -20); g.lineTo(24, 4); g.lineTo(12, 14); g.lineTo(12, 34); g.lineTo(-12, 34);
  g.lineTo(-12, 14); g.lineTo(-24, 4); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = _f(13); g.fillText('APU', 0, 2); g.restore();
  g.fillStyle = '#000'; g.beginPath(); g.arc(451, 498, 15, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e8e8e8'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'right'; g.font = _f(12); g.fillText('Refuel Port', 428, 503);
}

// ── CDU 의 Fuel 화면(Aircraft Systems → Fuel) — 연료를 넣고 빼고 정한다 ──
// 09-cdu.js renderAcSysPage 가 Fuel 일 때 이 칸을 그린다. 값은 SYSTEM 창과 같은 연료다.
function fuelCduHtml() {
  const btn = (txt, act, arg) => `<div class="nav-btn" data-act="${act}" data-arg='${JSON.stringify(arg)}' style="flex:1;min-width:0">${txt}</div>`;
  return `<div style="padding:10px 8px;color:#cde;font-size:12px">` +
    `<div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:12px">` +
    `<div>Left<div id="fuelc-l" style="font-size:20px;font-weight:bold;color:#fff"></div></div>` +
    `<div>Total<div id="fuelc-t" style="font-size:20px;font-weight:bold;color:#3ad13a"></div></div>` +
    `<div>Right<div id="fuelc-r" style="font-size:20px;font-weight:bold;color:#fff"></div></div></div>` +
    `<div style="text-align:center;margin-bottom:12px">Fuel Flow <b id="fuelc-ff" style="color:#fff"></b> PPH · END <b id="fuelc-end" style="color:#fff"></b></div>` +
    `<div style="color:#567;font-size:10px;margin:4px 0">연료 넣기·빼기(양쪽 반씩)</div>` +
    `<div style="display:flex;gap:6px;margin-bottom:8px">${btn('−100', 'fuelAdjust', [-100])}${btn('+100', 'fuelAdjust', [100])}</div>` +
    `<div style="color:#567;font-size:10px;margin:4px 0">합계로 정하기(LBS)</div>` +
    `<div style="display:flex;gap:6px;margin-bottom:8px">${[1000, 1500, 2000, FUEL_MAX].map(v => btn(String(v), 'fuelSetTotal', [v])).join('')}</div>` +
    `<div style="display:flex;gap:6px">${btn('RESET (1914)', 'fuelReset', [])}</div>` +
    `<div style="color:#567;font-size:10px;margin-top:12px">SYSTEM 창(탭 'SYSTEM')에 Fuel 계통도가 보입니다.</div></div>`;
}
function _fuelCduRefresh() {
  const el = document.getElementById('fuelc-t');
  if (!el) return;
  const F = fuelFlow(), ff = F.f1 + F.f2;
  const set = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };
  set('fuelc-l', String(Math.round(fuelLeft()))); set('fuelc-r', String(Math.round(fuelRight())));
  set('fuelc-t', String(Math.round(fuelTotal())) + ' LBS');
  set('fuelc-ff', String(Math.round(ff)));
  set('fuelc-end', ff > 0 ? `${Math.floor(fuelTotal() / ff)}+${String(Math.floor((fuelTotal() / ff % 1) * 60)).padStart(2, '0')}` : '—');
}

// ── 전기 계통(Electrical) ──
// 상부 콘솔(17-upper.js)의 스위치를 따른다.
//   GEN n   — 그 엔진이 돌고(NG > 50) GEN n 스위치 ON 이면 온라인(AC 115V)
//   APU GEN — APU CONTR ON + APU GEN 스위치 'APU GEN'
//   AC 1·2 버스 — 발전기 하나라도 있으면 둘 다(한쪽이 멎으면 가운데 연결선으로 넘겨 준다)
//   TRU n   — 제 AC 버스가 살아 있고 TRU n ON 이면 28V DC
//   DC 1·2 버스 — TRU 하나라도 있으면 둘 다(DC 연결), 없으면 BATT ON 일 때 배터리가 맡는다(방전)
const ELEC_AC_LOAD = 230, ELEC_DC_LOAD = 120;       // 버스 부하(A) — 살아 있는 발전기·TRU 가 나눠 진다
function elecState() {
  let P = null;
  try { P = engParams(); } catch (e) { P = null; }
  const sw = (id, on) => { try { return typeof ovhdGet === 'function' ? ovhdGet(id) === on : true; } catch (e) { return true; } };
  const ng = i => P ? (i === 1 ? P.e1.ng : P.e2.ng) : 0;
  const gen1 = ng(1) > 50 && sw('gen1', 'ON'), gen2 = ng(2) > 50 && sw('gen2', 'ON');
  const apu = sw('apuContr', 'ON') && sw('apuGen', 'APU GEN');
  const gpu = false;
  const nGen = (gen1 ? 1 : 0) + (gen2 ? 1 : 0) + (apu ? 1 : 0) + (gpu ? 1 : 0);
  const ac = nGen > 0;
  const tru1 = ac && sw('tru1', 'ON'), tru2 = ac && sw('tru2', 'ON');
  const nTru = (tru1 ? 1 : 0) + (tru2 ? 1 : 0);
  const batt = sw('batt', 'ON');
  const dc = nTru > 0 || batt;
  const genA = nGen ? ELEC_AC_LOAD / nGen : 0, truA = nTru ? ELEC_DC_LOAD / nTru : 0;
  const bat = !batt ? { a: 0, v: 25 } : nTru ? { a: 5, v: 28 } : { a: -45, v: 24 };
  return { gen1, gen2, apu, gpu, ac, tru1, tru2, dc, batt, battBus: batt || dc, nGen, genA, truA, bat,
           tie: apu || gpu || (gen1 !== gen2) };
}
// 둥근 계기(270° 호) — 값 → 바늘, 색 띠
function _sysGauge(g, cx, cy, r, frac, bands) {
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
  g.strokeStyle = '#3a4a3a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  bands.forEach(([f0, f1, col]) => {
    g.strokeStyle = col; g.lineWidth = 9;
    g.beginPath(); g.arc(cx, cy, r - 6, a0 + span * f0, a0 + span * f1); g.stroke();
  });
  const a = a0 + span * Math.max(0, Math.min(1, frac));
  g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10)); g.stroke();
  g.lineCap = 'butt';
  g.fillStyle = '#444'; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
}
function _sysElecPage(g) {
  const E = elecState();
  const ON = '#2ec82e', OFF = '#5a5a5a';
  // 사진(KUH MFD ELEC) 좌표로 그리고 큰 칸에 맞춰 줄인다
  g.save();
  const k = 0.535;
  g.translate(224 + 14 - 320 * k, 32 + 26 - 300 * k); g.scale(k, k);
  const ln = (pts, on) => {
    g.strokeStyle = on ? ON : OFF; g.lineWidth = 5; g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.stroke();
  };
  const box = (x0, y0, x1, y1, l1, l2, on) => {
    g.fillStyle = '#000'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = on ? ON : OFF; g.lineWidth = 5; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = on ? '#e8e8e8' : '#777'; g.textAlign = 'center'; g.font = _f(l2 ? 26 : 24, false);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (l2) { g.fillText(l1, cx, cy - 4); g.fillText(l2, cx, cy + 24); } else g.fillText(l1, cx, cy + 9);
  };
  const txt = (x, y, s, sz, col) => { g.fillStyle = col || '#fff'; g.textAlign = 'center'; g.font = _f(sz || 26, false); g.fillText(s, x, y); };
  // 배선
  ln([[496, 442], [536, 442], [536, 627]], E.gen1);
  ln([[766, 442], [733, 442], [733, 627]], E.apu);
  ln([[733, 577], [1345, 577]], E.tie);
  ln([[1310, 442], [1345, 442], [1345, 627]], E.gpu);
  ln([[1580, 442], [1540, 442], [1540, 627]], E.gen2);
  [[438, 'DIC 1'], [634, 'ESS 1']].forEach(([x]) => ln([[x, 692], [x, 742]], E.ac));
  [[1248], [1443], [1638]].forEach(([x]) => ln([[x, 692], [x, 742]], E.ac));
  ln([[733, 692], [733, 890], [772, 890]], E.ac);
  ln([[772, 948], [733, 948], [733, 1104]], E.tru1);
  ln([[1345, 692], [1345, 890], [1306, 890]], E.ac);
  ln([[1306, 948], [1345, 948], [1345, 1104]], E.tru2);
  ln([[496, 920], [536, 920], [536, 1104]], E.batt);
  ln([[536, 1036], [573, 1036]], E.battBus);
  ln([[890, 1137], [1188, 1137]], E.dc);
  [438, 634, 1248, 1443, 1638].forEach(x => ln([[x, 1170], [x, 1220]], E.dc));
  // 버스
  box(378, 627, 890, 692, 'AC 1', 'Primary Bus', E.ac);
  box(1188, 627, 1698, 692, 'AC 2', 'Primary Bus', E.ac);
  box(378, 742, 498, 782, 'DIC 1', '', E.ac); box(573, 742, 694, 782, 'ESS 1', '', E.ac);
  box(1188, 742, 1308, 782, 'DIC 2', '', E.ac); box(1383, 742, 1503, 782, 'ESS 2', '', E.ac); box(1578, 742, 1698, 782, 'N-ESS', '', E.ac);
  box(573, 1015, 694, 1057, 'BATT BUS', '', E.battBus);
  box(378, 1104, 890, 1170, 'DC 1', 'Primary Bus', E.dc);
  box(1188, 1104, 1698, 1170, 'DC 2', 'Primary Bus', E.dc);
  box(378, 1220, 498, 1260, 'SEC 1', '', E.dc); box(573, 1220, 694, 1260, 'ESS 1', '', E.dc);
  box(1188, 1220, 1308, 1260, 'SEC 2', '', E.dc); box(1383, 1220, 1503, 1260, 'ESS 2', '', E.dc); box(1578, 1220, 1698, 1260, 'N-ESS', '', E.dc);
  // APU GEN · AC GPU
  const src = (x, y, s, on) => {
    g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, 62, 0, Math.PI * 2); g.fill();
    g.strokeStyle = on ? ON : OFF; g.lineWidth = 4; g.stroke();
    txt(x, y + 9, s, 26, on ? '#e8e8e8' : '#888');
  };
  src(828, 442, 'APU GEN', E.apu); src(1248, 442, 'AC GPU', E.gpu);
  // 계기 — 발전기(0~300A: 녹 ~230 · 황 ~260 · 적) · TRU(0~400A: 녹 ~300 · 황 ~350 · 적) · 배터리(−100~+100A: 양 끝 적·황)
  const genB = [[0, 0.77, ON], [0.77, 0.87, '#e8d000'], [0.87, 1, '#e02020']];
  const truB = [[0, 0.75, ON], [0.75, 0.87, '#e8d000'], [0.87, 1, '#e02020']];
  const batB = [[0, 0.12, '#e02020'], [0.12, 0.25, '#e8d000'], [0.25, 0.75, ON], [0.75, 0.88, '#e8d000'], [0.88, 1, '#e02020']];
  const gauge = (x, y, title, frac, bands, lines) => {
    txt(x, y - 74, title, 26);
    _sysGauge(g, x, y, 60, frac, bands);
    lines.forEach((s, i) => txt(x - 6, y + 82 + i * 27, s, 30));
  };
  const genA = on => on ? E.genA : 0;
  gauge(438, 442, 'GEN 1', genA(E.gen1) / 300, genB, [`${Math.round(genA(E.gen1))}A`, `${E.gen1 ? 115 : 0}V`]);
  gauge(1638, 442, 'GEN 2', genA(E.gen2) / 300, genB, [`${Math.round(genA(E.gen2))}A`, `${E.gen2 ? 115 : 0}V`]);
  const tA = on => on ? E.truA : 0;
  gauge(828, 920, 'TRU 1', tA(E.tru1) / 400, truB, [`${Math.round(tA(E.tru1))}A`, `${E.tru1 ? 28 : 0}V`]);
  gauge(1248, 920, 'TRU 2', tA(E.tru2) / 400, truB, [`${Math.round(tA(E.tru2))}A`, `${E.tru2 ? 28 : 0}V`]);
  gauge(438, 920, 'BATT', (E.bat.a + 100) / 200, batB, [`${E.bat.a}A`, `${E.bat.v}V`, '25.0°C']);
  g.restore();
}

// ── CDU 의 계통 칸 — Fuel 은 연료 조정, Electrical 은 전원 상태(스위치는 UPPER 창) ──
function sysCduHtml(id) {
  if (id === 'asys_fuel') return fuelCduHtml();
  if (id === 'asys_elec') return `<div id="elecc" style="padding:10px 8px;color:#cde;font-size:12px"></div>`;
  return '';
}
function _elecCduRefresh() {
  const el = document.getElementById('elecc');
  if (!el) return;
  const E = elecState();
  const row = (k, on, v) => `<div style="display:flex;justify-content:space-between;padding:5px 4px;border-bottom:1px solid #1e2a33">` +
    `<span>${k}</span><b style="color:${on ? '#3ad13a' : '#888'}">${v}</b></div>`;
  const h = `<div style="color:#567;font-size:10px;margin-bottom:6px">전원 상태 — 스위치는 UPPER 창(GEN · APU · TRU · BATT)</div>` +
    row('GEN 1', E.gen1, E.gen1 ? `ON · ${Math.round(E.genA)}A` : 'OFF') +
    row('GEN 2', E.gen2, E.gen2 ? `ON · ${Math.round(E.genA)}A` : 'OFF') +
    row('APU GEN', E.apu, E.apu ? `ON · ${Math.round(E.genA)}A` : 'OFF') +
    row('AC 1 · AC 2 BUS', E.ac, E.ac ? (E.tie ? 'ON (TIE)' : 'ON') : 'OFF') +
    row('TRU 1', E.tru1, E.tru1 ? `ON · ${Math.round(E.truA)}A` : 'OFF') +
    row('TRU 2', E.tru2, E.tru2 ? `ON · ${Math.round(E.truA)}A` : 'OFF') +
    row('DC 1 · DC 2 BUS', E.dc, E.dc ? (E.tru1 || E.tru2 ? 'ON' : 'ON (BATT)') : 'OFF') +
    row('BATT', E.batt, `${E.bat.a}A · ${E.bat.v}V`) +
    `<div style="color:#567;font-size:10px;margin-top:12px">SYSTEM 창(탭 'SYSTEM')에 Electrical 계통도가 보입니다.</div>`;
  if (el.innerHTML !== h) el.innerHTML = h;
}

// 창이 보일 때(applyPanels 가 부른다)
function sysShow() { sysDraw(); }
try { appRegister({ fuelAdjust, fuelSetTotal, fuelReset, sysPageSet }); } catch (e) { _swallow(e); }
try { window.addEventListener('resize', () => { try { sysDraw(); } catch (e) { _swallow(e); } }); } catch (e) { _swallow(e); }
// 상부 콘솔 스위치가 바뀌면 곧바로 다시 그린다(발전기·TRU·배터리 → Electrical)
try { if (typeof ovhdOn === 'function') ovhdOn(() => { try { sysDraw(); } catch (e) { _swallow(e); } }); } catch (e) { _swallow(e); }
