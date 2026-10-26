// 3D 지도의 함정.
//
// 지도의 SHIP 모형(shipIcon 의 SVG)을 실제 크기 — 길이 100m · 폭 25m — 로 3D 에
// 세운다. 2D 와 같은 값(위치·침로·속도)을 쓰고, 3D 에서도 끌어 옮기고 두 번 눌러
// 설정창을 연다. 3D 가 제 창을 쓸 때는 SHIP 메뉴·설정창이 그 창 안에서 열린다.
export const name = '3D 함정';

export async function run(page, t) {
  // 3D 를 겹쳐 켜고 함정 레이어가 얹힐 때까지 기다린다(지도 load 이벤트)
  const open = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    S.lat = 37.0; S.lon = 126.0; S.hdg = 0; S.alt = 1000;     // 서해 바다 위
    if (followMode) toggleFollow();
    if (!_view3dOn) toggle3dMap();
    let n = 0;
    while (!_ship3dReady && n < 300) { await wait(50); n++; }
    return { ready: _ship3dReady, waited: n * 50,
             type: _ml3d && _ml3d.getLayer('ship-3d') ? _ml3d.getLayer('ship-3d').type : null };
  });
  if (!open.ready) { t.ok(false, `3D 지도에 함정 레이어가 얹히지 않았다 (${JSON.stringify(open)})`); return; }
  t.eq(open.type, 'fill-extrusion', '함정은 3D 로 세워 그린다(fill-extrusion)');

  // ── 모양과 크기 ──
  const geo = await page.evaluate(async () => {
    const feats = async () => ((await _ml3d.getSource('ship-3d').getData()).features || []);
    const offBefore = (await feats()).length;
    _ml3d.jumpTo({ center: [126.0, 37.0], zoom: 16, pitch: 0, bearing: 0 });
    if (shipVisible) shipToggleOn();
    shipToggleOn();                                // 배 표시 ON — 3D 가 보이면 3D 가운데에 놓는다
    const c3 = _ml3d.getCenter();
    const spawnOff = distance(shipLat, shipLon, c3.lat, c3.lng) * 1852;
    shipHdg = 0; updateShipMarker();
    // 함정 중심 기준의 앞(+)·오른쪽(+) m 로 되돌려 잰다
    const local = ([lon, lat]) => {
      const n = (lat - shipLat) * 111320, e = (lon - shipLon) * 111320 * Math.cos(shipLat * D2R);
      const h = shipHdg * D2R;
      return [n * Math.cos(h) + e * Math.sin(h), e * Math.cos(h) - n * Math.sin(h)];
    };
    const span = f => {
      const p = f.geometry.coordinates[0].map(local);
      const fw = p.map(q => q[0]), rt = p.map(q => q[1]);
      return { len: Math.max(...fw) - Math.min(...fw), beam: Math.max(...rt) - Math.min(...rt),
               fwdMax: Math.max(...fw), fwdMin: Math.min(...fw), h: f.properties.h, c: f.properties.c };
    };
    const fs = await feats();
    const hull = span(fs[0]), bridge = span(fs[1]), bow = span(fs[2]);
    const dashes = fs.slice(3).map(span);
    // 침로 090 — 함수가 동쪽을 향한다
    shipHdg = 90; updateShipMarker();
    const ring = (await feats())[0].geometry.coordinates[0];
    const east = Math.max(...ring.map(q => (q[0] - shipLon) * 111320 * Math.cos(shipLat * D2R)));
    const northAtBow = (() => {
      const q = ring.reduce((a, b) => (b[0] > a[0] ? b : a));
      return (q[1] - shipLat) * 111320;
    })();
    shipHdg = 0; updateShipMarker();
    return { offBefore, spawnOff, hull, bridge, bow, dashes, east, northAtBow, n: fs.length };
  });
  t.eq(geo.offBefore, 0, '배를 켜기 전에는 3D 에 아무것도 없다');
  t.ok(geo.spawnOff < 5, `3D 를 보고 있으면 3D 화면 가운데에 놓인다 (${geo.spawnOff.toFixed(1)}m)`);
  t.ok(Math.abs(geo.hull.len - 100) < 0.5 && Math.abs(geo.hull.beam - 25) < 0.5,
    `선체는 실제 크기다 (길이 ${geo.hull.len.toFixed(1)}m · 폭 ${geo.hull.beam.toFixed(1)}m)`);
  t.ok(Math.abs(geo.hull.fwdMax - 50) < 0.5 && Math.abs(geo.hull.fwdMin + 50) < 0.5,
    `함정 위치가 선체 한가운데다 (앞 ${geo.hull.fwdMax.toFixed(1)} · 뒤 ${geo.hull.fwdMin.toFixed(1)}m)`);
  t.ok(geo.hull.h === 7 && geo.bridge.h === 17 && geo.bow.h === 10,
    `갑판 7m · 함교 17m · 함수 구조물 10m (${geo.hull.h} · ${geo.bridge.h} · ${geo.bow.h})`);
  t.ok(Math.abs(geo.bridge.len - 26.3) < 0.5 && Math.abs(geo.bridge.beam - 11.1) < 0.5
       && geo.bridge.fwdMax < 12 && geo.bridge.fwdMin > -17,
    `함교는 지도 모형 그대로 배 가운데에 있다 (${geo.bridge.len.toFixed(1)} × ${geo.bridge.beam.toFixed(1)}m)`);
  t.ok(geo.bow.fwdMax > 40 && geo.bow.fwdMin > 30, `함수 구조물은 앞쪽에 있다 (${geo.bow.fwdMin.toFixed(0)}…${geo.bow.fwdMax.toFixed(0)}m)`);
  t.ok(geo.dashes.length === 8 && geo.dashes.every(d => d.h > 7 && d.h < 7.2 && d.beam < 1),
    `갑판 위 점선 중심선 (${geo.dashes.length}토막)`);
  t.ok(geo.hull.c === '#1a5fa8' && geo.bridge.c === '#2277bb', '색도 지도 모형과 같다');
  t.ok(Math.abs(geo.east - 50) < 0.5 && Math.abs(geo.northAtBow) < 0.5,
    `침로 090 이면 함수가 동쪽을 향한다 (동쪽 ${geo.east.toFixed(1)}m)`);

  // ── 실제로 그려지는가 ──
  const drawn = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    _ml3d.jumpTo({ center: [shipLon, shipLat], zoom: 18, pitch: 0, bearing: 0 });
    await wait(1500);
    const p = _ml3d.project([shipLon, shipLat]);
    const hit = _ml3d.queryRenderedFeatures([p.x, p.y], { layers: ['ship-3d'] });
    const r = _ml3d.getCanvas().getBoundingClientRect();
    return { n: hit.length, x: r.left + p.x, y: r.top + p.y + 30 };   // 함교보다 조금 뒤(함미 쪽)
  });
  t.ok(drawn.n > 0, `3D 지도에 그려져 집힌다 (${drawn.n}개)`);

  // ── 3D 에서 두 번 누르면 설정창, 끌면 옮긴다 ──
  await page.evaluate(() => { document.getElementById('ship-panel').style.display = 'none'; });
  await page.mouse.dblclick(drawn.x, drawn.y);
  await page.waitForTimeout(300);
  const dbl = await page.evaluate(() => ({
    panel: document.getElementById('ship-panel').style.display,
    host: document.getElementById('ship-panel').parentElement.id }));
  t.ok(dbl.panel === 'block' && dbl.host === 'map-wrap',
    `3D 의 함정을 두 번 누르면 설정창이 열린다 (${dbl.panel} · ${dbl.host})`);
  const before = await page.evaluate(() => ({ lat: shipLat, lon: shipLon, z: _ml3d.getCenter() }));
  await page.mouse.move(drawn.x, drawn.y);
  await page.mouse.down();
  await page.mouse.move(drawn.x + 60, drawn.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const drag = await page.evaluate(b => ({
    moved: distance(b.lat, b.lon, shipLat, shipLon) * 1852,
    east: (shipLon - b.lon) * 111320 * Math.cos(shipLat * D2R),
    mapMoved: distance(b.z.lat, b.z.lng, _ml3d.getCenter().lat, _ml3d.getCenter().lng) * 1852,
    dragging: shipDragging,
    mk: shipMarker ? distance(shipMarker.getLatLng().lat, shipMarker.getLatLng().lng, shipLat, shipLon) * 1852 : -1,
  }), before);
  t.ok(drag.moved > 10 && drag.east > 10,
    `3D 에서 끌면 함정이 옮겨 간다 — 열린 설정창 위를 지나가도 (동쪽 ${drag.east.toFixed(0)}m)`);
  t.ok(drag.mapMoved < 2, `끄는 동안 지도는 밀리지 않는다 (${drag.mapMoved.toFixed(1)}m)`);
  t.ok(!drag.dragging && drag.mk < 1, '2D 마커도 같은 자리로 따라간다');

  // ── 움직이면 3D 모형도 함께 간다 ──
  const mv = await page.evaluate(async () => {
    shipSpd = 20; shipHdg = 0; updateShipMarker();
    const lat0 = shipLat;
    S.running = true; let ts = 1000; S.lastT = ts;
    for (let i = 0; i < 60; i++) { ts += 50; simStep(ts); }   // 3초
    S.running = false;
    const ring = (await _ml3d.getSource('ship-3d').getData()).features[0].geometry.coordinates[0];
    const lats = ring.map(q => q[1]);
    const cLat = (Math.max(...lats) + Math.min(...lats)) / 2;      // 선체 앞뒤 끝의 한가운데
    shipSpd = 0; updateShipMarker();
    return { moved: (shipLat - lat0) * 111320, follow: Math.abs(cLat - shipLat) * 111320 };
  });
  t.ok(mv.moved > 25 && mv.moved < 35, `20kt 로 3초면 30m 북쪽으로 간다 (${mv.moved.toFixed(1)}m)`);
  t.ok(mv.follow < 0.5, `3D 모형도 그 자리로 함께 간다 (${mv.follow.toFixed(2)}m)`);

  // ── 3D 가 제 창을 쓸 때 — SHIP 버튼·메뉴·설정창이 그 창 안에서 열린다 ──
  const panel = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const vis = id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const host = id => document.getElementById(id).parentElement.id;
    document.getElementById('ship-panel').style.display = 'none';
    document.getElementById('ship-menu').classList.remove('open');
    if (_view3dOn) toggle3dMap();
    const btnOverlay = vis('ship3d-btn');
    // 3D 는 오른쪽 창 하나만 쓴다(3분할이면 가운데는 2D 지도)
    selectPanel('left', 'pfd', true);
    if (tripleMode) selectPanel('mid', 'map', true);
    selectPanel('right', 'm3d', true);
    await wait(100);
    const btn = vis('ship3d-btn');
    toggleShip3d();
    const menu = { host: host('ship-menu'), vis: vis('ship-menu') };
    shipTogglePanel();                             // 메뉴의 '설정창'
    const pnl = { host: host('ship-panel'), vis: vis('ship-panel') };
    shipTogglePanel();
    toggleShip3d();                                // 메뉴 닫기
    // 3D 창을 닫으면(오른쪽을 CDU 로) 메뉴·설정창이 2D 지도 창으로 돌아온다
    selectPanel('right', 'cdu', true);
    await wait(50);
    const back = { menu: host('ship-menu'), panel: host('ship-panel') };
    return { btnOverlay, btn, menu, pnl, back };
  });
  t.eq(panel.btnOverlay, false, '2D 위에 겹쳐 쓸 때는 3D 창의 SHIP 버튼을 따로 두지 않는다(아래 막대의 SHIP)');
  t.eq(panel.btn, true, '3D 가 제 창을 쓰면 그 창에 SHIP 버튼이 있다');
  t.ok(panel.menu.host === 'map3d' && panel.menu.vis, `SHIP 메뉴가 3D 창 안에서 열린다 (${panel.menu.host})`);
  t.ok(panel.pnl.host === 'map3d' && panel.pnl.vis, `설정창도 3D 창 안에서 열린다 (${panel.pnl.host})`);
  t.ok(panel.back.menu === 'map-wrap' && panel.back.panel === 'map-wrap', '3D 창을 닫으면 2D 지도 창으로 돌아온다');

  // ── SIM 1인칭에서 켜면 기수 앞에 놓는다 · 바다는 해수면이 바닥이다 ──
  const sim = await page.evaluate(() => {
    const was = simModeOn;
    simModeOn = true; S.lat = 37.0; S.lon = 126.0; S.hdg = 120;
    const p = _shipSpawn();
    simModeOn = was;
    const realElev = _tcElev;
    _tcElev = () => -50;                          // 수심 50m 바다
    const g = simTerrainFt();
    _tcElev = realElev;
    return { dist: distance(S.lat, S.lon, p[0], p[1]), brg: bearing(S.lat, S.lon, p[0], p[1]), g };
  });
  t.ok(Math.abs(sim.dist - 0.3) < 0.01 && Math.abs(sim.brg - 120) < 1,
    `SIM 에서는 기수 앞 0.3NM 에 놓는다 (${sim.dist.toFixed(2)}NM · ${sim.brg.toFixed(0)}°)`);
  t.eq(sim.g, 0, '바다 위에서는 해수면(0ft)이 바닥이다 — 수심만큼 내려가지 않는다');

  // ── 끄면 3D 에서도 사라진다 ──
  const off = await page.evaluate(async () => {
    if (shipVisible) shipToggleOn();
    return { n: (await _ml3d.getSource('ship-3d').getData()).features.length,
             trail: (await _ml3d.getSource('ship-trail-3d').getData()).geometry.coordinates.length };
  });
  t.ok(off.n === 0 && off.trail === 0, '배 표시를 끄면 3D 모형과 항적도 사라진다');
  t.eq(page.errors.length, 0, `페이지 오류 없음${page.errors.length ? ' — ' + page.errors[0] : ''}`);
}
