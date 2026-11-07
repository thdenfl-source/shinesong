// G/A(복행) — FCP FORCE TRIM 아래 버튼.
// 누르면 컬렉티브·피치 축이 GA 가 되고, 25초(전진 20kt 이상이면 17초)에 걸쳐 Vy 까지
// (Vy~VNE 면 지금 속도, VNE 넘으면 VNE) 속도 기준을 옮기며 선택 상승률(기본 1000fpm)로 오른다.
// 시간이 다 되면 컬렉티브 VS · 피치 IAS 로 넘어간다. 롤 축은 손대지 않는다.
import { SIM_SETUP_SRC, SIM_FLY_SRC } from './simmode.mjs';
export const name = 'G/A';

export async function run(page, t) {
  const r = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const fly = ${SIM_FLY_SRC};
    const fma = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (txt, ...a) { seen.push(String(txt).trim()); return orig.call(this, txt, ...a); };
      try { drawPFD(); } finally { proto.fillText = orig; }
      return seen;
    };
    const o = {};
    // 제자리(0kt) 1000ft · 오른쪽으로 10° 기운 채 누른다
    S.spd = 0; S.alt = 1000; S.vs = 0; S.bnk = 10; simTrim.roll = 10; S.tq = tqRequired();   // 트림으로 10° 기울여 둔 상태
    hdgSelOn = false;
    document.getElementById('ga-btn').click();
    o.on = gaOn; o.btnOn = document.getElementById('ga-btn').classList.contains('on');
    o.dur = _gaDur; o.tgt = _gaSpdTgt; o.vy = simVyKt();
    o.fma0 = fma();
    let minAlt = S.alt, maxVs = 0;
    for (let i = 0; i < 24; i++) {
      fly(1); minAlt = Math.min(minAlt, S.alt); maxVs = Math.max(maxVs, S.vs);
      if (i === 3) o.at4 = { vs: S.vs, cmd: simAfcsVsCmd(), spd: S.spd };
      if (i === 7) o.at8 = { vs: S.vs, cmd: simAfcsVsCmd(), spd: S.spd };
      if (i === 19) o.at20 = { vs: S.vs, cmd: simAfcsVsCmd(), spd: S.spd };
    }
    o.mid = { ga: gaOn, spd: S.spd };
    fly(2);
    o.end = { ga: gaOn, vsm: vsModeOn, sel: selSpd, iasOn: simIasOn, hdg: hdgSelOn, bnk: S.bnk };
    o.fma1 = fma();
    fly(15);
    o.vsSteady = S.vs; o.minAlt = minAlt - 1000; o.maxVs = maxVs;
    // VS ▼ 로 내려도 300fpm 아래로는 가지 않는다
    for (let i = 0; i < 20; i++) applyDelta('vs', -100);
    o.vsMin = selVS;
    // 전진 중(60kt)이면 17초 · 목표 Vy
    gaRelease(); S.spd = 60; S.bnk = 0; simTrim.roll = 0; gaEngage(); o.fwd = { dur: _gaDur, tgt: _gaSpdTgt };
    // Vy~VNE 사이(100kt) 면 지금 속도 그대로
    gaRelease(); S.spd = 100; gaEngage(); o.keep = _gaSpdTgt;
    // VNE 넘으면 VNE
    gaRelease(); S.spd = simVne() + 10; gaEngage(); o.over = { tgt: _gaSpdTgt, vne: simVne() };
    // ALT 를 걸면 GA·VS 가 풀린다
    toggleAltHold(); o.altTake = { ga: gaOn, vsm: vsModeOn };
    if (altHoldOn) toggleAltHold();
    gaRelease();
    // SIM 모드가 아니면 걸리지 않는다
    toggleSimMode(false); gaEngage(); o.offSim = gaOn;
    o.joy = { gs: !!JOY_ACT_BY_ID.gs, gspdLbl: JOY_ACT_BY_ID.gspd.label };
    return o;
  })()`);
  t.eq(r.on, true, 'G/A 버튼을 누르면 GA 가 걸린다');
  t.eq(r.btnOn, true, '버튼이 켜진 모양이 된다');
  t.eq(r.dur, 25, `제자리에서는 25초에 걸쳐 진행한다 (${r.dur})`);
  t.eq(r.tgt, r.vy, `제자리에서는 목표 속도가 Vy 다 (${r.tgt} / Vy ${r.vy})`);
  const n0 = r.fma0.filter(s => s === 'GA').length;
  t.ok(n0 >= 2, `FMA 컬렉티브·피치 축이 GA 로 보인다 (GA ${n0}개)`);
  t.ok(r.at4.cmd < 100, `상승률은 천천히 붙는다(8초 램프) — 4초 째 명령 ${r.at4.cmd.toFixed(0)}fpm`);
  t.ok(r.at8.cmd < 400 && r.at8.spd > 5, `속도 우선 — 8초 째 속도 ${r.at8.spd.toFixed(0)}kt 가 붙는 동안 상승은 ${r.at8.cmd.toFixed(0)}fpm 에 머문다`);
  t.ok(r.at20.cmd > r.at8.cmd + 300, `속도가 붙을수록 상승을 늘린다 (8초 ${r.at8.cmd.toFixed(0)} → 20초 ${r.at20.cmd.toFixed(0)}fpm · ${r.at20.spd.toFixed(0)}kt)`);
  t.eq(r.joy.gs, false, '조이스틱 배정 목록에 ILS 강하선 G/S 는 없다(자동)');
  t.ok(/G\/S/.test(r.joy.gspdLbl) && /GSPD/.test(r.joy.gspdLbl), `조이스틱 G/S 는 지상속도(GSPD) 동작이다 (${r.joy.gspdLbl})`);
  t.eq(r.mid.ga, true, `24초 째에는 아직 GA 다 (${r.mid.spd.toFixed(0)}kt)`);
  t.eq(r.end.ga, false, '25초가 지나면 GA 가 끝난다');
  t.eq(r.end.vsm, true, '컬렉티브는 VS 모드로 넘어간다');
  t.eq(r.end.sel, r.vy, `피치는 IAS(Vy) 로 넘어간다 (${r.end.sel})`);
  t.eq(r.end.iasOn, true, 'IAS 가 걸려 있다');
  t.ok(r.fma1.includes('VS 1000') && r.fma1.includes('IAS') && !r.fma1.includes('GA'),
    `FMA 가 VS 1000 · IAS 로 바뀐다 (${r.fma1.filter(s => /^(VS|IAS|GA)/.test(s)).join(' / ')})`);
  t.eq(r.end.hdg, false, '롤 축은 커플되지 않는다(HDG 는 조종사 몫)');
  t.ok(r.end.bnk > 5, `기울어 있던 뱅크가 그대로다 (${r.end.bnk.toFixed(1)}°)`);
  t.ok(r.minAlt > -30, `고도가 시작 고도 아래로 빠지지 않는다 (최저 ${r.minAlt.toFixed(0)}ft)`);
  t.ok(r.vsSteady > 700 && r.vsSteady < 1300, `VS 모드에서 약 1000fpm 으로 계속 오른다 (${r.vsSteady.toFixed(0)}fpm)`);
  t.eq(r.vsMin, 300, `VS 는 최저 300fpm 까지만 내려간다 (${r.vsMin})`);
  t.eq(r.fwd.dur, 17, `전진 20kt 이상이면 17초 (${r.fwd.dur})`);
  t.eq(r.fwd.tgt, r.vy, '60kt 면 목표는 Vy');
  t.eq(r.keep, 100, `Vy~VNE 사이면 지금 속도를 지킨다 (${r.keep})`);
  t.eq(r.over.tgt, r.over.vne, `VNE 를 넘으면 VNE 가 기준 (${r.over.tgt})`);
  t.ok(!r.altTake.ga && !r.altTake.vsm, 'ALT 를 걸면 GA·VS 가 풀린다');
  t.eq(r.offSim, false, 'SIM 모드가 아니면 걸리지 않는다');

  await page.evaluate(() => {
    try { gaRelease(); } catch (e) {}
    if (simModeOn) toggleSimMode(false);
    navigator.getGamepads = () => [];
    joyAxes = {}; joyAxCancelCapture(); joyBinds = {}; joyReleaseAll();
    S.running = false; S.bnk = 0; S.pit = 0; S.vs = 0;
  });
}
