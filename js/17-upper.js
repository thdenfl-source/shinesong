// ── UPPER CONSOLE (상부 콘솔) ──
// 실기 상부 콘솔(오버헤드 패널)의 스위치를 창 하나에 그대로 옮긴 것. 탭의 'UPPER' 로 연다.
// 지금은 스위치 상태만 갖고 바뀔 때 알린다 — 시뮬레이터와의 연동은 ovhdOn() 으로 하나씩 붙인다.
//
//   ovhdGet(id)          지금 값(위치 이름 — 예 'OFF' · 'ON' · 'A/C LOW', 연속 노브는 0~10 의 수)
//   ovhdSet(id, v)       값을 바꾼다(그림·저장·알림까지)
//   ovhdOn(fn)           바뀔 때마다 fn(id, value, prev) — 연동은 여기에 건다
//   window 'ovhd' 이벤트  같은 내용(detail: { id, value, prev })
//
// 화면은 1000×950 의 설계 크기로 그리고 창에 맞춰 통째로 줄이고 키운다(사진의 비율 그대로).
// 조작: 토글은 레버 위쪽을 누르면 한 칸 위로, 아래쪽은 아래로 · 노브는 왼쪽 절반을 누르면
// 반시계, 오른쪽 절반은 시계 방향(마우스 휠도 된다) · 덮개 스위치는 덮개를 먼저 연다.

const OVHD_W = 1000, OVHD_H = 950;
const OVHD_KEY = 'ovhdState';

// 연속 노브(밝기 · 온도) — 0~10, 양 끝만 글자
const DIM = { steps: 11, from: -135, to: 135 };

// ── 패널 구성 ── 판(plate) 여섯 장 · 좌표는 판 안에서(px, 설계 크기)
//   t: 'tg' 토글(pos 위→아래 · side 는 가운데 위치 글자를 옆에) · 'rot' 노브 · 'dim' 연속 노브
//      'guard' 덮개 토글 · 'pb' 누름 버튼 · 'th' T-핸들 · 'mom' 스프링 복귀 토글 · 'br' 묶음 머리글 · 'lbl' 글자
const OVHD_PLATES = [
  { x: 10, y: 10, w: 290, h: 300, items: [
    { t: 'rot', id: 'wiper', x: 140, y: 165, title: 'WINDSLD\nWIPER',
      pos: ['WASH', 'OFF', 'LOW', 'HI'], ang: [-55, 0, 45, 85], def: 'OFF' },
  ]},
  { x: 310, y: 10, w: 330, h: 300, items: [
    { t: 'br', x: 18, y: 42, w: 135, text: 'VAPOR VENT' },
    { t: 'tg', id: 'vapor1', x: 45, y: 112, title: 'NO1 ENG', pos: ['OFF', 'ON'], def: 'OFF', topLbl: '' },
    { t: 'tg', id: 'vapor2', x: 125, y: 112, title: 'NO2 ENG', pos: ['OFF', 'ON'], def: 'OFF', topLbl: '' },
    { t: 'lbl', x: 85, y: 88, text: 'OFF', small: true },
    { t: 'mom', id: 'chipTest', x: 85, y: 228, title: 'CHIP DETECTOR', pos: ['NORM', 'TEST'], def: 'NORM', red: true, topLbl: '' },
    { t: 'br', x: 172, y: 42, w: 145, text: 'TRAINING' },
    { t: 'guard', id: 'trng1', x: 208, y: 165, title: 'NO1 ENG', sub: 'TRNG', num: '1', pos: ['OFF', 'TRNG'], def: 'OFF' },
    { t: 'guard', id: 'trng2', x: 282, y: 165, title: 'NO2 ENG', sub: 'TRNG', num: '2', pos: ['OFF', 'TRNG'], def: 'OFF' },
  ]},
  { x: 650, y: 10, w: 340, h: 300, items: [
    { t: 'br', x: 20, y: 30, w: 300, text: 'ECS' },
    { t: 'rot', id: 'ecsMode', x: 110, y: 112, pos: ['A/C HI', 'A/C LOW', 'OFF', 'VENT', 'HEAT'],
      ang: [-95, -55, 0, 55, 95], def: 'OFF' },
    { t: 'dim', id: 'heatTemp', x: 265, y: 127, title: 'HEAT TEMP', lo: 'LOW', mid: 'MED', hi: 'HI', def: 5 },
    { t: 'br', x: 20, y: 192, w: 300, text: 'AIR FLOW' },
    { t: 'tg', id: 'acSel', x: 75, y: 265, title: 'A/C', pos: ['CKPT', 'ALL', 'CABIN'], side: true, def: 'ALL' },
    { t: 'tg', id: 'heatVent', x: 175, y: 265, title: 'HEAT/VENT', pos: ['CKPT', 'ALL'], def: 'ALL' },
    { t: 'tg', id: 'airSel', x: 275, y: 265, title: 'AIR SEL', pos: ['EXT AIR', 'CABIN AIR'], def: 'EXT AIR' },
  ]},
  { x: 10, y: 320, w: 320, h: 620, items: [
    { t: 'dim', id: 'instLtsCplt', x: 75, y: 112, title: 'INST LTS\nCPLT', lo: 'OFF', hi: 'BRT', def: 0 },
    { t: 'rot', id: 'formLts', x: 235, y: 112, title: 'FORMATION\nLTS', pos: ['OFF', '1', '2', '3', '4', '5'],
      ang: [-120, -80, -40, 0, 40, 80], def: 'OFF' },
    { t: 'tg', id: 'cabinLts', x: 170, y: 228, title: 'CABIN LTS', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'tg', id: 'heels', x: 265, y: 228, title: 'HEELS', pos: ['OFF', 'ARM', 'ON'], side: true, def: 'OFF' },
    { t: 'tg', id: 'stowSel', x: 55, y: 332, title: 'STOW SEL', pos: ['LDG', 'SRCH'], def: 'LDG' },
    { t: 'tg', id: 'srchLt', x: 160, y: 332, title: 'SRCH LT', pos: ['NORM', 'OFF'], def: 'NORM' },
    { t: 'tg', id: 'navLts', x: 265, y: 332, title: 'NAV LTS', pos: ['NORM', 'OFF'], def: 'NORM' },
    { t: 'br', x: 105, y: 388, w: 175, text: 'POSITION LTS' },
    { t: 'tg', id: 'display', x: 50, y: 445, title: 'DISPLAY', pos: ['DAY', 'NIGHT'], def: 'DAY' },
    { t: 'rot', id: 'posLts', x: 160, y: 450, small: true, pos: ['1', '2', '3', '4', '5'],
      ang: [-80, -40, 0, 40, 80], def: '3' },
    { t: 'tg', id: 'posMode', x: 265, y: 445, pos: ['STEADY', 'OFF', 'FLASH'], side: true, red: true, def: 'STEADY' },
    { t: 'br', x: 20, y: 518, w: 280, text: 'ANTI COLLISION LTS' },
    { t: 'tg', id: 'acolSel', x: 65, y: 572, pos: ['UPPER', 'BOTH', 'LOWER'], side: true, red: true, def: 'BOTH' },
    { t: 'tg', id: 'acolMode', x: 165, y: 572, pos: ['DIM', 'OFF', 'BRT'], side: true, red: true, def: 'OFF' },
    { t: 'tg', id: 'acolNorm', x: 265, y: 572, pos: ['NORM', 'IR'], def: 'NORM' },
  ]},
  { x: 340, y: 320, w: 310, h: 620, items: [
    { t: 'br', x: 20, y: 22, w: 270, text: 'APU' },
    { t: 'tg', id: 'apuContr', x: 60, y: 100, title: 'CONTR', pos: ['OFF', 'ON'], def: 'OFF', big: true },
    { t: 'th', id: 'apuFire', x: 200, y: 128, title: 'FIRE EXTGH' },
    { t: 'tg', id: 'gen1', x: 60, y: 248, title: 'GEN1', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'tg', id: 'gen2', x: 155, y: 248, title: 'GEN2', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'tg', id: 'apuGen', x: 250, y: 248, title: 'APU GEN', pos: ['OFF', 'APU GEN'], def: 'OFF' },
    { t: 'tg', id: 'tru1', x: 60, y: 350, title: 'TRU1', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'tg', id: 'tru2', x: 155, y: 350, title: 'TRU2', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'tg', id: 'batt', x: 250, y: 350, title: 'BATT', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'pb', id: 'embRst1', x: 60, y: 448, title: 'EMB RST1' },
    { t: 'pb', id: 'embRst2', x: 155, y: 448, title: 'EMB RST2' },
    { t: 'tg', id: 'airSour', x: 250, y: 445, title: 'AIR SOUR', pos: ['ENG', 'OFF', 'APU'], side: true, red: true, def: 'ENG' },
    { t: 'guard', id: 'fireExtRes', x: 72, y: 568, title: 'FIRE EXTGH', sub: 'RESERVE', hazard: true, pos: ['OFF', 'MAIN'], def: 'OFF' },
    { t: 'rot', id: 'fireDet', x: 220, y: 572, small: true, title: 'FIRE DETECTOR',
      pos: ['OPER', 'ENG1', 'MGB', 'ENG2', 'APU'], ang: [-100, -50, 0, 50, 100], def: 'OPER' },
  ]},
  { x: 660, y: 320, w: 330, h: 620, items: [
    { t: 'br', x: 25, y: 20, w: 280, text: 'CONSOLE LTS' },
    { t: 'dim', id: 'consUpper', x: 95, y: 100, small: true, title: 'UPPER', lo: 'OFF', hi: 'BRT', def: 0 },
    { t: 'dim', id: 'consLower', x: 235, y: 100, small: true, title: 'LOWER', lo: 'OFF', hi: 'BRT', def: 0 },
    { t: 'br', x: 25, y: 152, w: 280, text: 'INST LTS' },
    { t: 'dim', id: 'instStby', x: 95, y: 234, small: true, title: 'STBY', lo: 'OFF', hi: 'BRT', def: 0 },
    { t: 'dim', id: 'instPlt', x: 235, y: 234, small: true, title: 'PLT', lo: 'OFF', hi: 'BRT', def: 0 },
    { t: 'br', x: 25, y: 288, w: 280, text: 'ENG ANTI ICE' },
    { t: 'tg', id: 'engAi1', x: 95, y: 348, title: 'NO1', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'tg', id: 'engAi2', x: 235, y: 348, title: 'NO2', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'br', x: 25, y: 398, w: 190, text: 'WINDSHIELD ANTI ICE' },
    { t: 'tg', id: 'wsCplt', x: 65, y: 464, title: 'CPLT', pos: ['OFF', 'ON'], def: 'OFF', paddle: true },
    { t: 'tg', id: 'wsPlt', x: 170, y: 464, title: 'PLT', pos: ['OFF', 'ON'], def: 'OFF', paddle: true },
    { t: 'tg', id: 'wireCutter', x: 275, y: 464, title: 'WIRE\nCUTTER', pos: ['OFF', 'ON'], def: 'OFF' },
    { t: 'tg', id: 'emergPump', x: 65, y: 580, title: 'EMERG\nPUMP', pos: ['OFF', 'AUTO', 'ON'], side: true, red: true, def: 'AUTO', tiny: true },
    { t: 'tg', id: 'pitotHeat', x: 170, y: 580, title: 'PITOT\nHEAT', pos: ['OFF', 'AUTO', 'ON'], side: true, paddle: true, def: 'AUTO', tiny: true },
    { t: 'tg', id: 'battHeat', x: 275, y: 580, title: 'BATT\nHEAT', pos: ['OFF', 'AUTO', 'ON'], side: true, red: true, def: 'AUTO', tiny: true },
  ]},
];

// ── 상태 ──
const _ovhdDefs = {};
OVHD_PLATES.forEach(p => p.items.forEach(it => { if (it.id) _ovhdDefs[it.id] = it; }));
const ovhdState = {};     // id → 값
const _ovhdGuard = {};    // 덮개 열림(id → true)
const _ovhdFns = [];
(function ovhdLoad() {
  Object.values(_ovhdDefs).forEach(d => {
    if (d.t === 'pb') ovhdState[d.id] = 0;
    else if (d.t === 'th') ovhdState[d.id] = 'IN';
    else ovhdState[d.id] = d.def;
  });
  try {
    const s = JSON.parse(localStorage.getItem(OVHD_KEY) || '{}');
    Object.keys(s).forEach(k => {
      const d = _ovhdDefs[k];
      if (!d || d.t === 'pb' || d.t === 'mom') return;             // 누름 버튼·스프링 스위치는 되살리지 않는다
      if (d.t === 'dim' ? (Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 10)
                        : d.t === 'th' ? ['IN', 'PULLED'].includes(s[k]) : d.pos.includes(s[k])) ovhdState[k] = s[k];
    });
  } catch (e) { _swallow(e); }
})();
function _ovhdSave() {
  try {
    const o = {};
    Object.keys(ovhdState).forEach(k => { const d = _ovhdDefs[k]; if (d.t !== 'pb' && d.t !== 'mom') o[k] = ovhdState[k]; });
    localStorage.setItem(OVHD_KEY, JSON.stringify(o));
  } catch (e) { _swallow(e); }
}
function ovhdGet(id) { return ovhdState[id]; }
function ovhdOn(fn) { if (typeof fn === 'function') _ovhdFns.push(fn); }
function ovhdSet(id, v) {
  const d = _ovhdDefs[id];
  if (!d) return;
  const prev = ovhdState[id];
  if (prev === v) return;
  ovhdState[id] = v;
  _ovhdSave();
  _ovhdPaint(id);
  _ovhdFns.forEach(fn => { try { fn(id, v, prev); } catch (e) { _swallow(e); } });
  try { window.dispatchEvent(new CustomEvent('ovhd', { detail: { id, value: v, prev } })); } catch (e) { _swallow(e); }
}
// 모두 처음 값으로(덮개도 닫는다)
function ovhdReset() {
  Object.keys(_ovhdGuard).forEach(k => delete _ovhdGuard[k]);
  Object.values(_ovhdDefs).forEach(d => {
    ovhdSet(d.id, d.t === 'pb' ? 0 : d.t === 'th' ? 'IN' : d.def);
    _ovhdPaint(d.id);
  });
}

// ── 그리기 ──
const _esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _nl = s => _esc(s).replace(/\n/g, '<br>');
function _ovhdItemHtml(it) {
  const at = `left:${it.x}px;top:${it.y}px`;
  const title = it.title ? `<div class="ov-title">${_nl(it.title)}${it.sub ? `<div class="ov-sub">${_esc(it.sub)}</div>` : ''}</div>` : '';
  switch (it.t) {
    case 'br':
      return `<div class="ov-br" style="left:${it.x}px;top:${it.y}px;width:${it.w}px"><span>${_esc(it.text)}</span></div>`;
    case 'lbl':
      return `<div class="ov-lbl${it.small ? ' sm' : ''}" style="${at}">${_esc(it.text)}</div>`;
    case 'tg': case 'mom': {
      const n = it.pos.length;
      const top = it.topLbl !== undefined ? it.topLbl : it.pos[0];
      const cls = ['ov-tg', it.red ? 'red' : '', it.big ? 'big' : '', it.paddle ? 'paddle' : '', it.tiny ? 'tiny' : ''].join(' ');
      return `<div class="${cls}" data-ov="${it.id}" style="${at}">${title}` +
        `<div class="ov-pl top">${_esc(top)}</div>` +
        `<div class="ov-bez"><div class="ov-lever"></div></div>` +
        (n === 3 && it.side ? `<div class="ov-pl side">${_esc(it.pos[1])}</div>` : '') +
        `<div class="ov-pl bot">${_esc(it.pos[n - 1])}</div></div>`;
    }
    case 'guard': {
      return `<div class="ov-guard${it.hazard ? ' hazard' : ''}" data-ov="${it.id}" style="${at}">${title}` +
        `<div class="ov-gbody"><div class="ov-pl top">${_esc(it.pos[0])}</div>` +
        `<div class="ov-bez"><div class="ov-lever"></div></div><div class="ov-pl bot">${_esc(it.pos[1])}</div>` +
        `<div class="ov-cover" data-ov-cover="${it.id}">${it.num ? `<b>${_esc(it.num)}</b>` : ''}</div></div></div>`;
    }
    case 'rot': case 'dim': {
      const lbls = it.t === 'rot'
        ? it.pos.map((p, i) => _ovhdRotLbl(p, it.ang[i], it.small ? 44 : 58)).join('')
        : [[it.lo, DIM.from], [it.mid, 0], [it.hi, DIM.to]].filter(a => a[0]).map(a => _ovhdRotLbl(a[0], a[1], it.small ? 38 : 50)).join('');
      return `<div class="ov-rot${it.small ? ' sm' : ''}${it.t === 'dim' ? ' dim' : ''}" data-ov="${it.id}" style="${at}">${title}` +
        `<div class="ov-knob"><div class="ov-ptr"></div></div>${lbls}</div>`;
    }
    case 'pb':
      return `<div class="ov-pb" data-ov="${it.id}" style="${at}">${title}<div class="ov-btn"></div></div>`;
    case 'th':
      return `<div class="ov-th" data-ov="${it.id}" style="${at}">${title}` +
        `<div class="ov-thbar"><i></i><span>APU</span><i></i></div></div>`;
  }
  return '';
}
function _ovhdRotLbl(txt, ang, r) {
  const a = ang * Math.PI / 180;
  return `<div class="ov-rl" style="left:${(Math.sin(a) * r).toFixed(1)}px;top:${(-Math.cos(a) * r).toFixed(1)}px">${_esc(txt)}</div>`;
}
function ovhdBuild() {
  const wrap = document.getElementById('ovhd-wrap');
  if (!wrap || wrap.dataset.built) return;
  wrap.dataset.built = '1';
  wrap.innerHTML = `<div id="ovhd-stage" style="width:${OVHD_W}px;height:${OVHD_H}px">` +
    OVHD_PLATES.map(p => `<div class="ov-plate" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">` +
      '<i class="ov-screw a"></i><i class="ov-screw b"></i><i class="ov-screw c"></i><i class="ov-screw d"></i>' +
      p.items.map(_ovhdItemHtml).join('') + '</div>').join('') +
    `</div><button id="ovhd-reset" type="button" title="모든 스위치를 처음 위치로">RESET</button>`;
  Object.keys(_ovhdDefs).forEach(_ovhdPaint);
  wrap.addEventListener('pointerdown', _ovhdDown);
  wrap.addEventListener('pointerup', _ovhdUp);
  wrap.addEventListener('pointercancel', _ovhdUp);
  wrap.addEventListener('pointerleave', _ovhdUp);
  wrap.addEventListener('wheel', _ovhdWheel, { passive: false });
  wrap.querySelector('#ovhd-reset').addEventListener('click', ovhdReset);
  try { new ResizeObserver(ovhdFit).observe(wrap); } catch (e) { window.addEventListener('resize', ovhdFit); }
  ovhdFit();
}
// 창에 맞춰 설계 크기를 통째로 줄이고 키운다(가운데 정렬)
function ovhdFit() {
  const wrap = document.getElementById('ovhd-wrap'), st = document.getElementById('ovhd-stage');
  if (!wrap || !st) return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!(W > 0 && H > 0)) return;
  const k = Math.min(W / OVHD_W, H / OVHD_H);
  st.style.transform = `translate(${((W - OVHD_W * k) / 2).toFixed(1)}px, ${((H - OVHD_H * k) / 2).toFixed(1)}px) scale(${k.toFixed(4)})`;
}
function _ovhdEl(id) { return document.querySelector(`#ovhd-wrap [data-ov="${id}"]`); }
function _ovhdPaint(id) {
  const el = _ovhdEl(id), d = _ovhdDefs[id];
  if (!el || !d) return;
  const v = ovhdState[id];
  if (d.t === 'tg' || d.t === 'mom' || d.t === 'guard') {
    const n = d.pos.length, i = d.pos.indexOf(v);
    el.dataset.p = n === 2 ? (i === 0 ? 'up' : 'dn') : (i === 0 ? 'up' : i === 1 ? 'mid' : 'dn');
    if (d.t === 'guard') el.classList.toggle('open', !!_ovhdGuard[id]);
  } else if (d.t === 'rot') {
    el.querySelector('.ov-knob').style.transform = `rotate(${d.ang[Math.max(0, d.pos.indexOf(v))]}deg)`;
  } else if (d.t === 'dim') {
    el.querySelector('.ov-knob').style.transform = `rotate(${DIM.from + (DIM.to - DIM.from) * v / (DIM.steps - 1)}deg)`;
  } else if (d.t === 'pb') {
    el.classList.toggle('pressed', !!v);
  } else if (d.t === 'th') {
    el.classList.toggle('pulled', v === 'PULLED');
  }
}

// ── 조작 ──
let _ovhdMom = null;      // 누르고 있는 스프링 스위치·누름 버튼
function _ovhdDown(e) {
  const cover = e.target.closest('[data-ov-cover]');
  if (cover) {                                        // 덮개 — 열고 닫는다(닫으면 스위치를 제자리로 밀어 넣는다)
    const id = cover.dataset.ovCover;
    _ovhdGuard[id] = !_ovhdGuard[id];
    if (!_ovhdGuard[id]) ovhdSet(id, _ovhdDefs[id].pos[0]);
    _ovhdPaint(id);
    e.preventDefault(); return;
  }
  const el = e.target.closest('[data-ov]');
  if (!el) return;
  const id = el.dataset.ov, d = _ovhdDefs[id];
  if (!d) return;
  e.preventDefault();
  const v = ovhdState[id];
  if (d.t === 'tg' || d.t === 'mom' || d.t === 'guard') {
    if (d.t === 'guard' && !_ovhdGuard[id]) return;   // 덮개가 닫혀 있으면 스위치에 손이 닿지 않는다
    const bez = el.querySelector('.ov-bez').getBoundingClientRect();
    const up = e.clientY < bez.top + bez.height / 2;
    const i = d.pos.indexOf(v), j = Math.max(0, Math.min(d.pos.length - 1, i + (up ? -1 : 1)));
    ovhdSet(id, d.pos[j]);
    if (d.t === 'mom') _ovhdMom = id;
  } else if (d.t === 'rot' || d.t === 'dim') {
    const kb = el.querySelector('.ov-knob').getBoundingClientRect();
    _ovhdTurn(id, e.clientX < kb.left + kb.width / 2 ? -1 : 1);
  } else if (d.t === 'pb') {
    ovhdSet(id, 1); _ovhdMom = id;
  } else if (d.t === 'th') {
    ovhdSet(id, v === 'PULLED' ? 'IN' : 'PULLED');
  }
}
function _ovhdUp() {
  if (!_ovhdMom) return;
  const id = _ovhdMom, d = _ovhdDefs[id];
  _ovhdMom = null;
  ovhdSet(id, d.t === 'pb' ? 0 : d.def);               // 손을 떼면 스프링으로 돌아온다
}
function _ovhdTurn(id, dir) {
  const d = _ovhdDefs[id], v = ovhdState[id];
  if (d.t === 'dim') ovhdSet(id, Math.max(0, Math.min(DIM.steps - 1, v + dir)));
  else {
    const i = d.pos.indexOf(v);
    ovhdSet(id, d.pos[Math.max(0, Math.min(d.pos.length - 1, i + dir))]);
  }
}
function _ovhdWheel(e) {
  const el = e.target.closest('.ov-rot');
  if (!el) return;
  e.preventDefault();
  _ovhdTurn(el.dataset.ov, e.deltaY > 0 ? -1 : 1);
}

// 창이 처음 보일 때 만든다(applyPanels 가 부른다)
function ovhdShow() { ovhdBuild(); ovhdFit(); }
// 저장된 배치로 이미 떠 있으면(이 파일이 applyPanels 보다 늦게 읽힌다) 곧바로 만든다
try {
  const w = document.getElementById('ovhd-wrap');
  if (w && !w.classList.contains('page-hidden')) ovhdShow();
} catch (e) { _swallow(e); }
