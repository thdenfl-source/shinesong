// 3D 화면 — 수평 자세의 화질 · 3D 단독에 겹쳐 띄우는 PFD
export const name = '3D 화질·3D 단독 PFD';

export async function run(page, t) {
  await page.evaluate(() => { if (!_view3dOn) toggle3dMap(); });
  await page.waitForTimeout(2500);

  // ── 꼭 수평 자세(카메라 피치 90°)에서도 화질이 떨어지지 않는다 ──
  // 120kt 수평 자세 그대로이면 화질이 낮게 나오고 1° 만 들거나 숙여도 되돌아왔다.
  // maplibre 가 그 자리에서 고를 타일(화질)을 직접 셈해 견준다.
  const lod = await page.evaluate(() => {
    if (!simModeOn) toggleSimMode(true);
    if (S.running) toggleSim();
    window._tcElev = () => null;
    const tiles = pit => {
      S.alt = 1000; S.spd = 120; S.pit = pit; S.bnk = 0; S.hdg = 90;
      _ml3dSimCamera();
      const src = _ml3d.style.tileManagers['satellite'].getSource();
      const ids = _ml3d.coveringTiles({ tileSize: src.tileSize, minzoom: src.minzoom, maxzoom: src.maxzoom,
                                        terrain: _ml3d.terrain, roundZoom: src.roundZoom,
                                        calculateTileZoom: src.calculateTileZoom });
      return { pitch: _ml3d.getPitch(), n: ids.length, z17: ids.filter(i => i.overscaledZ >= 17).length,
               top: Math.max(...ids.map(i => i.overscaledZ)) };
    };
    const o = { level: tiles(0), up: tiles(1), down: tiles(-1), guard: !!_ml3d.style.tileManagers['satellite'].getSource().calculateTileZoom._lodGuard };
    toggleSimMode(false);
    return o;
  });
  t.ok(lod.guard, '3D 지도에 수평 시선 화질 보정이 걸려 있다');
  t.ok(Math.abs(lod.level.pitch - 90) < 1e-6 && lod.level.n >= lod.up.n && lod.level.z17 >= lod.up.z17 && lod.level.top === lod.up.top,
    `수평 자세(카메라 90°)에서도 1° 들었을 때만큼 고운 타일을 고른다 ` +
    `(수평 ${lod.level.n}장 · 고화질 ${lod.level.z17} / 1° 들면 ${lod.up.n}장 · ${lod.up.z17} / 1° 숙이면 ${lod.down.n}장 · ${lod.down.z17})`);

  // ── 3D 단독 — PFD(FCP 없이)를 왼쪽 위에 겹쳐 띄운다(가로 1/4 · 세로 3/5) ──
  const ov = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const box = () => { const b = document.getElementById('pfd-ov').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const o = {};
    // 3D 를 끈 MAP 단독 — 겹치지 않는다
    if (_view3dOn) toggle3dMap();
    panelSolo('map'); await w(100); pfdOverlaySync();
    o.flat = { show: document.getElementById('pfd-ov').classList.contains('show'), parent: cvs.parentElement.id };
    // 3D 를 켠다
    toggle3dMap(); await w(300); pfdOverlaySync();
    const texts = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s, ...a) { if (this.canvas === cvs) texts.push(String(s)); return orig.call(this, s, ...a); };
    try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
    const fcp = document.querySelector('.ctrl-bar');
    o.on = { show: document.getElementById('pfd-ov').classList.contains('show'), parent: cvs.parentElement.id,
             box: box(), cw: cvs.width, ch: cvs.height, vw: innerWidth, vh: innerHeight,
             hsi: texts.includes('HDG') && texts.includes('CRS'), fcp: fcp ? fcp.getBoundingClientRect().height : 0,
             topbar: document.getElementById('map-top-bar').getBoundingClientRect().bottom };
    // 단독을 풀면 PFD 창으로 돌아간다
    exitSolo(); await w(200);
    o.off = { show: document.getElementById('pfd-ov').classList.contains('show'), parent: cvs.parentElement.id };
    if (_view3dOn) toggle3dMap();
    return o;
  });
  t.ok(!ov.flat.show && ov.flat.parent === 'pfd-wrap', 'MAP 단독이라도 2D 지도면 PFD 를 겹치지 않는다');
  t.ok(ov.on.show && ov.on.parent === 'pfd-ov', '3D 단독이면 PFD 를 3D 화면에 겹쳐 띄운다');
  t.ok(Math.abs(ov.on.box.w - ov.on.vw / 4) < 2 && Math.abs(ov.on.box.h - ov.on.vh * 0.6) < 2 && ov.on.box.x < 12 && ov.on.box.y >= ov.on.topbar,
    `왼쪽 위 — 가로는 화면의 1/4, 높이는 3/5 (${Math.round(ov.on.box.w)}×${Math.round(ov.on.box.h)} / 화면 ${ov.on.vw}×${ov.on.vh}, 지도 툴바 아래)`);
  t.ok(ov.on.hsi && ov.on.fcp === 0 && Math.abs(ov.on.ch - ov.on.box.h) < 4,
    `계기(ADI·HSI)만 그린다 — FCP 없이 칸을 다 쓴다 (${ov.on.cw}×${ov.on.ch})`);
  t.ok(!ov.off.show && ov.off.parent === 'pfd-wrap', '단독을 풀면 PFD 가 제자리(PFD 창)로 돌아간다');

  // ── 창 선택 줄의 '⛶ 3D 단독' — 3D 지도를 창 가득, PFD 를 왼쪽 위에 ──
  const before = await page.evaluate(() => ({ l: leftSel, m: midSel, r: rightSel, tri: tripleMode,
    inRow: !!document.querySelector('#left-tabs #m3d-solo-btn'), txt: document.getElementById('m3d-solo-btn').textContent }));
  await page.click('#m3d-solo-btn');
  await page.waitForTimeout(1500);
  const solo = await page.evaluate(() => {
    const ov = document.getElementById('pfd-ov'), b = ov.getBoundingClientRect();
    const d3 = document.getElementById('map3d').getBoundingClientRect();
    const half = document.getElementById('solo-half-btn'), hb = half.getBoundingClientRect();
    return { cur: _soloCurrent, left: leftSel, host: document.getElementById('map3d').parentElement.id,
             d3: { w: d3.width, h: d3.height }, vw: innerWidth, vh: innerHeight,
             ov: { show: ov.classList.contains('show'), parent: ov.parentElement.id, x: b.x, y: b.y, w: b.width, h: b.height },
             canvas: cvs.parentElement.id, btn: document.getElementById('m3d-solo-btn').textContent,
             half: { shown: getComputedStyle(half).display !== 'none', mid: Math.abs(hb.x + hb.width / 2 - innerWidth / 2) < 2, top: hb.y } };
  });
  t.ok(before.inRow && /3D 단독/.test(before.txt), `창 선택 줄(PFD·MAP·CDU·3D 탭 옆)에 '${before.txt}' 버튼이 있다`);
  t.ok(solo.cur === 'm3d' && solo.left === 'm3d' && solo.host === 'map3d-wrap' && solo.d3.w >= solo.vw - 2 && solo.d3.h >= solo.vh * 0.9,
    `누르면 3D 지도가 화면을 가득 채운다 (${Math.round(solo.d3.w)}×${Math.round(solo.d3.h)})`);
  t.ok(solo.ov.show && solo.ov.parent === 'map3d-wrap' && solo.canvas === 'pfd-ov' &&
       Math.abs(solo.ov.w - solo.vw / 4) < 2 && Math.abs(solo.ov.h - solo.vh * 0.6) < 2 && solo.ov.x < 12 && solo.ov.y < 12,
    `PFD(계기만)가 왼쪽 위에 겹쳐 뜬다 — 가로 1/4 · 높이 3/5 (${Math.round(solo.ov.w)}×${Math.round(solo.ov.h)})`);
  t.ok(solo.half.shown && solo.half.mid && solo.half.top < 20,
    '빠져나가는 ✥ HALF 버튼이 위 가운데에 뜬다(오른쪽 위 3D 버튼과 겹치지 않게)');
  await page.click('#solo-half-btn');
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => ({ solo: _soloActive, l: leftSel, m: midSel, r: rightSel, tri: tripleMode,
    canvas: cvs.parentElement.id, host: document.getElementById('map3d').parentElement.id,
    show: document.getElementById('pfd-ov').classList.contains('show') }));
  t.ok(!back.solo && back.l === before.l && back.m === before.m && back.r === before.r && back.tri === before.tri &&
       back.canvas === 'pfd-wrap' && !back.show && back.host === 'map-wrap',
    `HALF 를 누르면 들어가기 전 배치(${before.l} · ${before.tri ? before.m + ' · ' : ''}${before.r})로 돌아오고 PFD 도 제자리다`);
}
