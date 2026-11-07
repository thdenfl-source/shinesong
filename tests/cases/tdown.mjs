// T/DOWN(전환 강하) — FCP HHT 오른쪽 버튼(SIM).
// 50kt·전파고도 200ft 이상에서 누르면 FMA 컬렉티브·피치 축이 TDOWN, 3° 로 내려가며 속도를 0 으로 모아
// HHT 높이에서 멈춘다. 롤 축은 HDG·NAV 그대로 — 45kt 밑 황색, 30kt 밑 decouple.
// 함께: ALT·CRHT 는 글자 버튼, HHT ▲▼.
import { SIM_SETUP_SRC, SIM_FLY_SRC } from './simmode.mjs';
export const name = 'T/DOWN';

export async function run(page, t) {
  const r = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const fly = ${SIM_FLY_SRC};
    const fma = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      const half = document.getElementById('pfd').width;   // 세 칸 모두(위쪽 줄)
      proto.fillText = function (tx, px, py, ...a) {
        if (px < half && py < 40) seen.push([String(tx).trim(), String(this.fillStyle)]);
        return orig.call(this, tx, px, py, ...a);
      };
      try { drawPFD(); } finally { proto.fillText = orig; }
      return seen;
    };
    const o = {};
    // FCP — ALT·CRHT 글자가 곧 버튼 · G/S 버튼 없음 · HHT ▲▼
    const altB = document.getElementById('alt-hold-btn'), crB = document.getElementById('crht-btn');
    o.lbl = { alt: altB.textContent.trim(), crht: crB.textContent.trim(), altIsLbl: altB.classList.contains('ctrl-lbl-btn'),
              gs: !!document.getElementById('gs-btn'), td: !!document.getElementById('tdown-btn') };
    altB.click(); o.altOn = [altHoldOn, altB.classList.contains('on')]; altB.click(); o.altOff = altHoldOn;
    crB.click(); o.crOn = crhtOn; crB.click();
    selHht = 50; applyDelta('hht', 10); o.hhtUp = selHht; applyDelta('hht', -10);
    // 조건 — 느리거나 낮으면 걸리지 않는다
    S.alt = 1000; S.spd = 40; tdownEngage(); o.slow = tdOn;
    S.spd = 100; S.alt = 150; tdownEngage(); o.low = tdOn;
    // 1000ft · 100kt · HDG 090 유지에서 누른다
    S.alt = 1000; S.spd = 100; S.hdg = 90; S.vs = 0; S.tq = tqRequired(); S.bnk = 0;
    selHdg = 90; hdgSelOn = true; rollApOn = true;
    const lat0 = S.lat, lon0 = S.lon;
    document.getElementById('tdown-btn').click();
    o.on = tdOn; o.btnOn = document.getElementById('tdown-btn').classList.contains('on');
    o.fma0 = fma().map(x => x[0]);
    let amber = null, decpl = null, hdgAt50 = null, maxVs = 0, path = [];
    for (let i = 0; i < 400; i++) {
      fly(1);
      maxVs = Math.max(maxVs, S.vs);
      if (hdgAt50 === null && S.spd < 50 && S.spd > 46) hdgAt50 = fma().find(x => x[0] === 'HDG');
      if (amber === null && S.spd < 44 && S.spd > 32) { amber = { f: fma().find(x => x[0] === 'HDG'), hdg: hdgSelOn, spd: S.spd }; }
      if (decpl === null && S.spd < 28) decpl = { hdg: hdgSelOn, roll: rollApOn, spd: S.spd };
      if (i === 60) path.push({ h: radarAltFt(), d: distance(lat0, lon0, S.lat, S.lon) });
      if (i === 120) path.push({ h: radarAltFt(), d: distance(lat0, lon0, S.lat, S.lon) });
      if (S.spd < 1 && Math.abs(radarAltFt() - selHht) < 5 && i > 60) { o.doneAt = i; break; }
    }
    fly(20);
    o.end = { ra: radarAltFt(), spd: S.spd, td: tdOn, sel: selSpd };
    o.fma1 = fma().map(x => x[0]);
    o.amber = amber; o.decpl = decpl; o.hdgAt50 = hdgAt50; o.maxVs = maxVs; o.path = path;
    // 한 번 더 누르면 풀린다
    tdownEngage(); o.off = tdOn;
    toggleSimMode(false);
    return o;
  })()`);
  t.ok(r.lbl.alt === 'ALT' && r.lbl.crht === 'CRHT' && r.lbl.altIsLbl, 'ALT·CRHT 는 IAS·HDG 처럼 글자 버튼이다');
  t.ok(r.altOn[0] && r.altOn[1] && !r.altOff, 'ALT 글자를 누르면 걸리고(켜진 모양) 한 번 더 누르면 풀린다');
  t.eq(r.crOn, true, 'CRHT 글자를 누르면 CRHT 가 걸린다');
  t.eq(r.lbl.gs, false, 'G/S 버튼은 없다(ILS 에서 스스로 잡는다)');
  t.eq(r.lbl.td, true, 'T/DOWN 버튼이 있다');
  t.eq(r.hhtUp, 60, `HHT ▲ 는 10ft 씩 올린다 (${r.hhtUp})`);
  t.eq(r.slow, false, '50kt 미만이면 걸리지 않는다');
  t.eq(r.low, false, '전파고도 200ft 미만이면 걸리지 않는다');
  t.ok(r.on && r.btnOn, 'T/DOWN 을 누르면 걸리고 버튼이 켜진다');
  t.ok(r.fma0.filter(s => s === 'TDOWN').length >= 2, `FMA 컬렉티브·피치 축이 TDOWN (${r.fma0.join(' ')})`);
  t.ok(r.fma0.includes('HDG'), '롤 축은 HDG 가 그대로 몬다');
  t.ok(r.maxVs < 100, `오르지 않는다 (최대 ${r.maxVs.toFixed(0)}fpm)`);
  const p = r.path;
  const ang = Math.atan2(p[0].h - p[1].h, (p[1].d - p[0].d) * 6076.1) * 180 / Math.PI;
  t.ok(ang > 2 && ang < 4.5, `약 3° 로 내려간다 (${ang.toFixed(2)}°)`);
  t.ok(r.hdgAt50 && r.hdgAt50[1] === '#00ff88', `45kt 위에서는 HDG 가 녹색 (${r.hdgAt50 && r.hdgAt50[1]})`);
  t.ok(r.amber && r.amber.hdg && r.amber.f && r.amber.f[1] === '#ffcc00',
    `45kt 밑이면 HDG 가 황색(성능 감소) (${r.amber && r.amber.spd.toFixed(0)}kt ${r.amber && r.amber.f && r.amber.f[1]})`);
  t.ok(r.decpl && !r.decpl.hdg && !r.decpl.roll, `30kt 밑이면 롤 축이 풀린다 (${r.decpl && r.decpl.spd.toFixed(0)}kt)`);
  t.ok(Math.abs(r.end.ra - 50) < 8, `HHT(50ft)에서 멈춘다 (RA ${r.end.ra.toFixed(0)}ft)`);
  t.ok(Math.abs(r.end.spd) < 3, `속도가 0 에 모인다 (${r.end.spd.toFixed(1)}kt · ${r.doneAt}s)`);
  t.ok(r.end.td && r.fma1.includes('TDOWN'), '멈춘 뒤에도 TDOWN 으로 제자리 비행');
  t.eq(r.off, false, '한 번 더 누르면 풀린다');

  await page.evaluate(() => {
    try { tdownRelease(); gaRelease(); } catch (e) {}
    if (simModeOn) toggleSimMode(false);
    navigator.getGamepads = () => [];
    joyAxes = {}; joyAxCancelCapture(); joyBinds = {}; joyReleaseAll();
    S.running = false; S.bnk = 0; S.pit = 0; S.vs = 0; hdgSelOn = false; rollApOn = false;
  });
}
