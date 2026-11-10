// SYSTEM 창 — MFD 계통 화면(js/18-system.js). CDU 의 Aircraft Systems 버튼이 화면을 고르고,
// 지금 갖춘 Fuel 화면은 연료 모델(엔진마다 토크로 먹고 집합 탱크를 채워 둔다)을 그린다.
export const name = 'SYSTEM 창';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(res => setTimeout(res, ms));
    fuelReset();
    selectPanel('right', 'sysp', true); await wait(200);
    const texts = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (s, ...a) { seen.push(String(s)); return orig.call(this, s, ...a); };
      try { sysDraw(); } finally { proto.fillText = orig; }
      return seen;
    };
    const w = document.getElementById('sysp-wrap'), c = w.querySelector('canvas');
    const o = { shown: !w.classList.contains('page-hidden') && !!c && c.width > 100 };
    const t0 = texts().map(s => s.trim());
    o.fuel = ['Fuel', 'Left', 'Total', 'Right', '956 LBS', '1914 LBS', '958 LBS', 'FWD', 'FT 1', 'FT 2', 'AFT', 'F5',
              'MFSOV 1', 'PRESS 1', 'FLTR 1', 'FUEL 1', 'FUEL IMBALANCE', 'APU', 'Refuel Port', 'TGT', 'NG', 'Fuel QTY', 'Battery', 'ACCP']
      .filter(s => !t0.includes(s));
    // CDU 의 계통 버튼이 SYSTEM 화면을 고른다
    selectPanel('mid', 'cdu', true); await wait(100);
    CDU_ACT.switchMode('ACSYS'); await wait(50);
    document.querySelector('#mainContentArea [data-act="acSysOpen"][data-arg=\'["asys_elec"]\']').click(); await wait(50);
    o.elecPage = sysPage; o.elecTxt = texts().includes('Electrical');
    CDU_ACT.switchMode('ACSYS'); await wait(50);
    document.querySelector('#mainContentArea [data-act="acSysOpen"][data-arg=\'["asys_fuel"]\']').click(); await wait(80);
    o.fuelPage = sysPage;
    // CDU Fuel 칸 — 넣고 빼고 정하기
    const click = (act, arg) => document.querySelector(`#mainContentArea [data-act="${act}"][data-arg='${arg}']`).click();
    o.cduT0 = document.getElementById('fuelc-t').textContent;
    click('fuelAdjust', '[100]'); await wait(30); o.plus = Math.round(fuelTotal());
    click('fuelSetTotal', '[1000]'); await wait(30); o.set1000 = [Math.round(fuelLeft()), Math.round(fuelRight())];
    o.cduT1 = document.getElementById('fuelc-t').textContent;
    click('fuelReset', '[]'); await wait(30); o.reset = Math.round(fuelTotal());
    // 연료 소모 — 시뮬 시계가 돌 때만, 배속을 따라
    const keep = { run: S.running, sp: simSpeed };
    const f = fuelFlow(); o.ff = [Math.round(f.f1), Math.round(f.f2)];
    S.running = false; _sysT = 0; sysTick(); await wait(300); sysTick(); o.stopped = fuelTotal();
    S.running = true; simSpeed = 8; _sysT = 0; sysTick(); await wait(500); sysTick();
    o.burn = 1914 - fuelTotal(); o.expect = (f.f1 + f.f2) * 8 * 0.5 / 3600;
    o.ft1 = fuel.ft1;
    S.running = keep.run; simSpeed = keep.sp;
    // FUEL LOW — 집합 탱크가 낮으면 호박색 칸
    fuelSetTotal(200); const fills = [];
    const proto = CanvasRenderingContext2D.prototype, orig = proto.fillRect;
    proto.fillRect = function (x, y, w, h) { fills.push([this.fillStyle, Math.round(x), Math.round(y)]); return orig.call(this, x, y, w, h); };
    try { sysDraw(); } finally { proto.fillRect = orig; }
    o.lowAmber = fills.some(a => a[0] === '#ffb000' && a[1] === 517 && a[2] === 330);
    fuelReset(); CDU_ACT.switchMode('HOME');
    selectPanel('right', 'map', true); selectPanel('mid', 'cdu', true);
    return o;
  });
  t.ok(r.shown, 'SYSTEM 탭으로 창이 열리고 캔버스에 그린다');
  t.eq(r.fuel.length, 0, `Fuel 화면의 글자가 다 있다${r.fuel.length ? ' (없음: ' + r.fuel.join(', ') + ')' : ''}`);
  t.ok(r.elecPage === 'asys_elec' && r.elecTxt && r.fuelPage === 'asys_fuel', 'CDU 의 계통 버튼이 SYSTEM 창의 화면을 고른다');
  t.ok(r.cduT0 === '1914 LBS' && r.plus === 2014 && r.set1000.join() === '500,500' && r.cduT1 === '1000 LBS' && r.reset === 1914,
    `CDU Fuel 칸 — +100 · 1000 으로 정하기(양쪽 반씩) · RESET (${r.cduT0} → ${r.plus} → ${r.set1000.join('/')} → ${r.reset})`);
  t.ok(r.ff[0] > 200 && r.ff[1] > 200, `엔진마다 연료 흐름(pph): ${r.ff.join(' · ')}`);
  t.ok(r.stopped === 1914, '시뮬 시계가 멈춰 있으면 연료가 줄지 않는다');
  t.ok(r.burn > r.expect * 0.6 && r.burn < r.expect * 1.6 && Math.abs(r.ft1 - 266) < 0.5,
    `돌면 흐름 × 배속만큼 준다(${r.burn.toFixed(2)} lbs · 예상 ${r.expect.toFixed(2)}) · 집합 탱크는 가득 유지(FT1 ${r.ft1.toFixed(1)})`);
  t.ok(r.lowAmber, '집합 탱크가 낮으면 FUEL 1 LOW 칸이 호박색');

  // ── Electrical — 상부 콘솔 스위치를 따른다 ──
  const e = await page.evaluate(async () => {
    localStorage.removeItem('ovhdState'); ovhdReset();
    selectPanel('right', 'sysp', true); await new Promise(res => setTimeout(res, 150));
    sysPageSet('asys_elec');
    const pick = st => ({ gen1: st.gen1, gen2: st.gen2, apu: st.apu, ac: st.ac, tru1: st.tru1, tru2: st.tru2, dc: st.dc,
                          tie: st.tie, genA: Math.round(st.genA), truA: Math.round(st.truA), bat: st.bat.a + '/' + st.bat.v });
    const o = { norm: pick(elecState()) };
    const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
    proto.fillText = function (x, ...a) { seen.push(String(x)); return orig.call(this, x, ...a); };
    try { sysDraw(); } finally { proto.fillText = orig; }
    o.missing = ['Electrical', 'GEN 1', 'GEN 2', 'APU GEN', 'AC GPU', 'AC 1', 'AC 2', 'Primary Bus', 'DIC 1', 'ESS 1', 'N-ESS',
                 'BATT', 'BATT BUS', 'TRU 1', 'TRU 2', 'DC 1', 'DC 2', 'SEC 1', 'SEC 2', '115A', '60A', '28V', '25.0°C'].filter(x => !seen.includes(x));
    ovhdSet('gen2', 'OFF'); o.oneGen = pick(elecState());
    ovhdSet('tru1', 'OFF'); ovhdSet('tru2', 'OFF'); o.noTru = pick(elecState());
    ovhdSet('apuContr', 'ON'); ovhdSet('apuGen', 'APU GEN'); o.apu = pick(elecState());
    ovhdSet('gen1', 'OFF'); ovhdSet('apuContr', 'OFF'); o.noGen = pick(elecState());
    ovhdSet('batt', 'OFF'); o.dead = pick(elecState());
    ovhdReset(); localStorage.removeItem('ovhdState'); sysPageSet('asys_fuel');
    selectPanel('right', 'map', true);
    return o;
  });
  t.eq(e.missing.length, 0, `Electrical 화면의 글자가 다 있다${e.missing.length ? ' (없음: ' + e.missing.join(', ') + ')' : ''}`);
  t.ok(e.norm.gen1 && e.norm.gen2 && e.norm.ac && e.norm.tru1 && e.norm.tru2 && e.norm.dc && !e.norm.tie &&
       e.norm.genA === 115 && e.norm.truA === 60 && e.norm.bat === '5/28',
    `정상(GEN·TRU·BATT ON) — 발전기 115A 씩 · TRU 60A 씩 · 배터리 충전 (${JSON.stringify(e.norm)})`);
  t.ok(!e.oneGen.gen2 && e.oneGen.ac && e.oneGen.tie && e.oneGen.genA === 230,
    `GEN 2 OFF — GEN 1 이 230A 로 두 버스를 맡고 가운데 연결선이 켜진다`);
  t.ok(e.noTru.dc && e.noTru.bat === '-45/24', 'TRU 둘 다 OFF — DC 는 배터리가 맡는다(방전 −45A · 24V)');
  t.ok(e.apu.apu && e.apu.genA === 115, 'APU GEN 이 들어오면 부하를 나눈다');
  t.ok(!e.noGen.ac && !e.noGen.tru1 && e.noGen.dc, '발전기가 다 없으면 AC 가 죽고 DC 는 배터리로');
  t.ok(!e.dead.dc, 'BATT 까지 OFF 면 DC 도 죽는다');
}
