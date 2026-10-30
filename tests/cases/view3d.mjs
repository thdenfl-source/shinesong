// 3D 화면 — 수평 자세의 화질 · 3D 화면에 겹쳐 띄우는 계기(PFD 일부) · 3D 단독
export const name = '3D 화질·3D 계기';

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

  // 겹친 계기 칸의 자리·크기와, 그 칸의 캔버스에 실제로 무엇이 그려졌는가
  const OVINFO = `(() => {
    const ov = document.getElementById('pfd-ov'), c = document.getElementById('pfd-ov-cvs'), b = ov.getBoundingClientRect();
    const texts = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s, ...a) { if (this.canvas === c) texts.push(String(s)); return orig.call(this, s, ...a); };
    try { pfdOverlayDraw(true); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
    const host = ov.parentElement.getBoundingClientRect();
    return { show: ov.classList.contains('show'), host: ov.parentElement.id, x: b.x - host.x, y: b.y - host.y, w: b.width, h: b.height,
             hw: host.width, hh: host.height, hsi: texts.includes('HDG') && texts.includes('CRS'), cw: c.width, ch: c.height,
             main: cvs.parentElement.id, vw: innerWidth, vh: innerHeight };
  })()`;

  // ── MAP 단독 + 3D — 계기(PFD 일부 · FCP 없이)를 3D 화면 왼쪽 위에 겹쳐 띄운다(가로 1/4 · 세로 3/5) ──
  await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    if (_view3dOn) toggle3dMap();
    panelSolo('map'); await w(100);
  });
  const flat = await page.evaluate(OVINFO);
  await page.evaluate(async () => { toggle3dMap(); await new Promise(r => setTimeout(r, 300)); });
  const msolo = await page.evaluate(OVINFO);
  const top = await page.evaluate(() => document.getElementById('map-top-bar').getBoundingClientRect().bottom
                                       - document.getElementById('map-wrap').getBoundingClientRect().y);
  t.ok(!flat.show, 'MAP 단독이라도 2D 지도면 계기를 겹치지 않는다');
  t.ok(msolo.show && msolo.host === 'map-wrap' && msolo.hsi && msolo.main === 'pfd-wrap',
    'MAP 단독에서 3D 를 켜면 계기를 3D 화면에 겹쳐 그린다(PFD 창의 캔버스는 제자리 · 칸에 제 캔버스)');
  t.ok(Math.abs(msolo.w - msolo.vw / 4) < 2 && Math.abs(msolo.h - msolo.vh * 0.6) < 2 && msolo.x < 12 && msolo.y >= top,
    `왼쪽 위 — 가로는 화면의 1/4, 높이는 3/5 (${Math.round(msolo.w)}×${Math.round(msolo.h)} / 화면 ${msolo.vw}×${msolo.vh}, 지도 툴바 아래)`);
  t.ok(Math.abs(msolo.cw / msolo.ch - msolo.w / msolo.h) < 0.02,
    `계기는 FCP 없이 칸을 다 쓴다 — 칸과 같은 비율로 그린다 (${msolo.cw}×${msolo.ch})`);
  await page.evaluate(async () => { exitSolo(); await new Promise(r => setTimeout(r, 200)); if (_view3dOn) toggle3dMap(); });

  // ── 3D 창(탭의 3D)에도 같은 계기 — PFD 창이 함께 보여도 따로 그린다 ──
  await page.evaluate(async () => { selectPanel('right', 'm3d', true); await new Promise(r => setTimeout(r, 1200)); });
  const win = await page.evaluate(OVINFO);
  const winMore = await page.evaluate(() => {
    const ov = document.getElementById('pfd-ov').getBoundingClientRect(), fly = document.getElementById('fly3d-btn').getBoundingClientRect();
    const texts = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s, ...a) { if (this.canvas === cvs) texts.push(String(s)); return orig.call(this, s, ...a); };
    try { drawPFD(); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
    return { mainHsi: texts.includes('HDG'), mainW: cvs.width, clear: ov.right < fly.left };
  });
  t.ok(win.show && win.host === 'map3d-wrap' && win.hsi && win.x < 12 && win.y < 12,
    `3D 창에도 계기가 왼쪽 위에 겹쳐 뜬다 (${Math.round(win.w)}×${Math.round(win.h)} / 3D 창 ${Math.round(win.hw)}×${Math.round(win.hh)})`);
  t.ok(winMore.mainHsi && winMore.mainW > 0 && win.main === 'pfd-wrap',
    'PFD 창이 함께 보여도 그대로 그려진다(겹친 계기는 제 캔버스에 따로 그린다)');
  t.ok(winMore.clear && win.w >= Math.min(300, win.hw - 120) - 1 && win.cw >= 340,
    `좁은 3D 창에서는 읽을 만큼 키우되(340px 로 그려 줄임) 오른쪽 3D 버튼 줄은 가리지 않는다 (${Math.round(win.w)}px · 그림 ${win.cw}px)`);

  // ── 계기 ON/OFF — 3D 창의 버튼으로 보이고 감춘다(이 기기에 적어 둔다) ──
  const btn = await page.evaluate(() => {
    const b = document.getElementById('pfdov-btn');
    const o = { inside: !!(b && b.closest('#map3d')), txt0: b.textContent, on0: b.classList.contains('on') };
    b.click(); pfdOverlaySync();
    o.off = { txt: b.textContent, show: document.getElementById('pfd-ov').classList.contains('show'), pref: localStorage.getItem('pfdOverlay') };
    b.click(); pfdOverlaySync();
    o.on = { txt: b.textContent, show: document.getElementById('pfd-ov').classList.contains('show'), pref: localStorage.getItem('pfdOverlay') };
    return o;
  });
  t.ok(btn.inside && btn.txt0 === '계기 ON' && btn.on0, `3D 창에 계기 ON/OFF 버튼이 있다 (${btn.txt0})`);
  t.ok(btn.off.txt === '계기 OFF' && !btn.off.show && btn.off.pref === '0', '누르면 계기를 감춘다(계기 OFF)');
  t.ok(btn.on.txt === '계기 ON' && btn.on.show && btn.on.pref === '1', '다시 누르면 다시 보인다(계기 ON)');
  await page.evaluate(async () => { selectPanel('right', 'cdu', true); await new Promise(r => setTimeout(r, 300)); });
  const gone = await page.evaluate(OVINFO);
  t.ok(!gone.show, '3D 지도가 화면에 없으면 계기도 겹치지 않는다');

  // ── 창 선택 줄의 '⛶ 3D 단독' — 3D 지도를 창 가득, 계기를 왼쪽 위에 ──
  const before = await page.evaluate(() => ({ l: leftSel, m: midSel, r: rightSel, tri: tripleMode,
    inRow: !!document.querySelector('#left-tabs #m3d-solo-btn'), txt: document.getElementById('m3d-solo-btn').textContent }));
  await page.click('#m3d-solo-btn');
  await page.waitForTimeout(1500);
  const solo = await page.evaluate(() => {
    const d3 = document.getElementById('map3d').getBoundingClientRect();
    const half = document.getElementById('solo-half-btn'), hb = half.getBoundingClientRect();
    return { cur: _soloCurrent, left: leftSel, host: document.getElementById('map3d').parentElement.id,
             d3: { w: d3.width, h: d3.height }, vw: innerWidth, vh: innerHeight,
             half: { shown: getComputedStyle(half).display !== 'none', mid: Math.abs(hb.x + hb.width / 2 - innerWidth / 2) < 2, top: hb.y } };
  });
  const sov = await page.evaluate(OVINFO);
  t.ok(before.inRow && /3D 단독/.test(before.txt), `창 선택 줄(PFD·MAP·CDU·3D 탭 옆)에 '${before.txt}' 버튼이 있다`);
  t.ok(solo.cur === 'm3d' && solo.left === 'm3d' && solo.host === 'map3d-wrap' && solo.d3.w >= solo.vw - 2 && solo.d3.h >= solo.vh * 0.9,
    `누르면 3D 지도가 화면을 가득 채운다 (${Math.round(solo.d3.w)}×${Math.round(solo.d3.h)})`);
  t.ok(sov.show && sov.host === 'map3d-wrap' && sov.hsi &&
       Math.abs(sov.w - sov.vw / 4) < 2 && Math.abs(sov.h - sov.vh * 0.6) < 2 && sov.x < 12 && sov.y < 12,
    `계기가 왼쪽 위에 겹쳐 뜬다 — 가로 1/4 · 높이 3/5 (${Math.round(sov.w)}×${Math.round(sov.h)})`);
  t.ok(solo.half.shown && solo.half.mid && solo.half.top < 20,
    '빠져나가는 ✥ HALF 버튼이 위 가운데에 뜬다(오른쪽 위 3D 버튼과 겹치지 않게)');
  await page.click('#solo-half-btn');
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => ({ solo: _soloActive, l: leftSel, m: midSel, r: rightSel, tri: tripleMode,
    host: document.getElementById('map3d').parentElement.id }));
  const bov = await page.evaluate(OVINFO);
  t.ok(!back.solo && back.l === before.l && back.m === before.m && back.r === before.r && back.tri === before.tri &&
       !bov.show && back.host === 'map-wrap' && bov.main === 'pfd-wrap',
    `HALF 를 누르면 들어가기 전 배치(${before.l} · ${before.tri ? before.m + ' · ' : ''}${before.r})로 돌아온다`);
}
