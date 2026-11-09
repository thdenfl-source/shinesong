// 조종간 중립 — 연결 직후 0 만 오는 첫 프레임으로 가운데를 잡지 않는다 · 스프링이 돌려놓은 자리를 가운데로 ·
// '조종간 중립 맞추기' 로 지금 자리를 가운데로.
export const name = '조종간 중립';

export async function run(page, t) {
  const r = await page.evaluate(() => {
    const o = {};
    const pad = { index: 7, id: 'CENTER TEST', mapping: '', buttons: Array.from({ length: 4 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
    navigator.getGamepads = () => [pad];
    for (const k in _joyNeutral) delete _joyNeutral[k];
    joyOn = true; joyActiveIdx = -1; joyAxSaved = true;
    joyAxes = { roll: { i: 0, inv: false }, pitch: { i: 1, inv: false }, yaw: { i: 2, inv: false }, coll: { i: 3, inv: false } };
    // ① 연결할 때 조종간이 밀려 있었다(가운데로 0.3 이 잡혔다) — SIM 을 켜면 지금 자리(손 뗀 자리)로 다시 잡는다
    pad.axes = [0, 0.3, 0, 0]; joyPoll(1000); pad.axes = [0.02, 0.0, -0.03, 0]; joyPoll(1050);
    o.wrong = joyAxVal('pitch');
    if (simModeOn) toggleSimMode(false); toggleSimMode(true); joyPoll(1100);
    o.simOn = [joyAxVal('roll'), joyAxVal('pitch'), joyAxVal('yaw')];
    toggleSimMode(false);
    // ② 오래 그대로 쥔 입력은 저절로 지우지 않는다(스프링 없는 조종간 — 10% 를 10초)
    _joyNeutral[7] = [0, 0, 0, 0]; pad.axes = [0.02, 0.1, -0.03, 0];
    let ts = 2000; for (let i = 0; i < 200; i++) { ts += 50; joyPoll(ts); }
    o.held = joyAxVal('pitch');
    // ③ 조종간 중립 맞추기
    pad.axes = [0.05, 0.13, 0.04, 0]; joyRecenter(); o.manual = [joyAxVal('roll'), joyAxVal('pitch'), joyAxVal('yaw')];
    o.act = !!JOY_ACT_BY_ID.center;
    navigator.getGamepads = () => [];
    for (const k in _joyNeutral) delete _joyNeutral[k];
    joyAxes = {};
    return o;
  });
  t.ok(r.wrong < -0.1, `연결할 때 밀려 있던 자리가 가운데로 잡히면 손을 떼도 치우쳐 읽힌다 (${r.wrong.toFixed(2)})`);
  t.ok(r.simOn.every(v => v === 0), `SIM 을 켜면 사이클릭·페달 가운데를 지금 자리로 다시 잡는다 (${r.simOn.join(' · ')})`);
  t.ok(r.held > 0.01, `오래 그대로 쥔 입력(10% · 10초)도 저절로 지우지 않는다 (${r.held.toFixed(3)})`);
  t.ok(r.manual.every(v => v === 0), `'조종간 중립 맞추기' 는 지금 자리를 가운데로 (${r.manual.join(' · ')})`);
  t.eq(r.act, true, '조이스틱 버튼에 배정할 수 있다');
}
