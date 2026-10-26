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
    const of = k => fs.filter(f => f.properties.k === k);
    const hull = span(of('hull')[0]), bridge = span(of('bridge')[0]), bow = span(of('bow')[0]);
    const dashes = of('dash').map(span);
    // 비행갑판 표시
    const lineup = span(of('lineup')[0]), wall = span(of('lineup-wall')[0]);
    const tdF = of('td')[0], td = span(tdF);
    const holeR = (() => {
      const h = tdF.geometry.coordinates[1].map(local);
      const cf = (Math.max(...h.map(q => q[0])) + Math.min(...h.map(q => q[0]))) / 2;
      return Math.max(...h.map(q => Math.hypot(q[0] - cf, q[1])));
    })();
    const xs = of('x').map(span), shoulder = span(of('shoulder')[0]), limit = span(of('limit')[0]);
    const marks = { lineup, wall, td, holeR, tdRings: tdF.geometry.coordinates.length, xs, shoulder, limit };
    // 침로 090 — 함수가 동쪽을 향한다
    shipHdg = 90; updateShipMarker();
    const ring = (await feats())[0].geometry.coordinates[0];
    const east = Math.max(...ring.map(q => (q[0] - shipLon) * 111320 * Math.cos(shipLat * D2R)));
    const northAtBow = (() => {
      const q = ring.reduce((a, b) => (b[0] > a[0] ? b : a));
      return (q[1] - shipLat) * 111320;
    })();
    shipHdg = 0; updateShipMarker();
    return { offBefore, spawnOff, hull, bridge, bow, dashes, marks, east, northAtBow, n: fs.length };
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
  t.ok(geo.dashes.length === 3 && geo.dashes.every(d => d.h > 7 && d.h < 7.2 && d.beam < 1 && d.fwdMin > 10),
    `함교 앞 갑판에는 지도 모형의 점선 중심선 (${geo.dashes.length}토막)`);
  // ── 비행갑판 표시 ──
  const m = geo.marks;
  t.ok(m.lineup.c === '#ffd200' && m.lineup.beam < 0.5 && Math.abs(m.lineup.fwdMax + 15.8) < 0.1
       && m.lineup.fwdMin < -48 && m.lineup.h > 7 && m.lineup.h < 7.1,
    `노란 정렬선이 함교 뒷면에서 함미까지 갑판 중심선을 따라간다 (${m.lineup.fwdMax.toFixed(1)} → ${m.lineup.fwdMin.toFixed(1)}m)`);
  t.ok(m.wall.c === '#ffd200' && m.wall.h === 17 && Math.abs(m.wall.fwdMax + 15.8) < 0.1 && m.wall.len < 0.2,
    `함교 뒷면 한가운데를 위에서 갑판까지 노란 세로선이 내려온다 (높이 ${m.wall.h}m)`);
  t.ok(m.td.c === '#ffffff' && m.tdRings === 2 && Math.abs(m.td.len - 10) < 0.1 && Math.abs(m.td.beam - 10) < 0.1
       && Math.abs(m.holeR - 4.4) < 0.05,
    `흰 착함 원 (지름 ${m.td.len.toFixed(1)}m · 선 굵기 ${(5 - m.holeR).toFixed(1)}m)`);
  t.ok(m.xs.length === 2 && m.xs.every(x => x.c === '#ffffff' && Math.abs((x.fwdMax + x.fwdMin) / 2 + 31) < 0.1),
    '원 한가운데에 흰 X');
  t.ok(m.shoulder.c === '#ffffff' && Math.abs(m.shoulder.fwdMin - m.td.fwdMax) < 0.01 && m.shoulder.beam >= 9.9,
    `어깨선은 원 앞쪽에 맞닿은 흰 가로선이다 (원 앞 ${m.td.fwdMax.toFixed(1)} · 어깨선 ${m.shoulder.fwdMin.toFixed(1)}m)`);
  {
    const sc = (m.shoulder.fwdMax + m.shoulder.fwdMin) / 2, lc = (m.limit.fwdMax + m.limit.fwdMin) / 2;
    t.ok(m.limit.c === '#ffffff' && Math.abs(lc - sc - 2) < 0.01 && m.limit.beam > m.shoulder.beam,
      `전방한계선은 어깨선 2m 앞의 흰 가로선이다 (${(lc - sc).toFixed(1)}m 앞 · 길이 ${m.limit.beam.toFixed(0)}m)`);
  }
  t.ok([m.lineup, m.td, m.shoulder, m.limit].every(q => q.h > 7 && q.h < 7.1),
    '표시는 갑판에 칠한 것이라 5cm 만 나온다');
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

  // ── 착함 — 함정 위에서는 갑판이 바닥이고, 앉으면 함정과 함께 간다 ──
  const land = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window._pad = { index: 0, id: 'T', mapping: '', buttons: [], axes: [0, 0, 0, -1] };
    navigator.getGamepads = () => [window._pad];
    joyStop(); joyOn = true; joyAxSaved = true; joyCancelCapture(); joyAxCancelCapture();
    for (const k in _joyNeutral) delete _joyNeutral[k];
    joyAxes = { coll: { i: 3, inv: false, abs: true } };      // 레버식 컬렉티브(축 3) — 맨 아래
    joyPoll(1000);
    const realElev = _tcElev;
    _tcElev = () => -50;                                     // 수심 50m 바다
    if (!shipVisible) shipToggleOn();
    shipLat = 37.0; shipLon = 126.0; shipHdg = 0; shipSpd = 0; updateShipMarker();
    // 함정 기준 앞(+)·오른쪽(+) m
    const at = (fwd, right) => [shipLat + fwd / 111320, shipLon + right / (111320 * Math.cos(shipLat * D2R))];
    const rel = () => {
      const n = (S.lat - shipLat) * 111320, e = (S.lon - shipLon) * 111320 * Math.cos(shipLat * D2R);
      const h = shipHdg * D2R;
      return { fwd: n * Math.cos(h) + e * Math.sin(h), right: e * Math.cos(h) - n * Math.sin(h) };
    };
    const floorAt = (fwd, right) => { [S.lat, S.lon] = at(fwd, right); simTerrainFt(); return simFloorFt(); };
    const floors = { stern: floorAt(-35, 0), bridge: floorAt(-3, 0), bow: floorAt(40, 0),
                     side: floorAt(-35, 20), far: floorAt(-80, 0),
                     tdX: floorAt(-31, 0), lineup: floorAt(-40, 0), shoulder: floorAt(-25.8, 0) };
    let ts = 1000;
    const fly = sec => {
      S.running = true; S.lastT = ts;
      for (let i = 0; i < sec * 20; i++) { ts += 50; joyPoll(ts); simStep(ts); }
      S.running = false;
    };
    // 함미 갑판 위 100ft 에서 레버를 내려 내려앉는다
    if (!simModeOn) toggleSimMode(true);
    [S.lat, S.lon] = at(-35, 0); S.hdg = 0; S.alt = 100; S.spd = 0; S.vs = 0;
    simAcc = 0; _simVs1 = 0; simLat = 0; S.pit = pitchFromSpd(0); simTrimHoldSpeed();
    fly(10);
    const landed = { alt: S.alt, vs: S.vs, deck: simOnDeck(), ...rel() };
    // 1인칭 시점 — 눈은 갑판 위 8m, 가까운 클립면이 몇 m 라 갑판·함교가 잘리지 않는다.
    // 눈높이 바닥은 실제 시간(0.4초)에 걸쳐 갑판으로 옮겨 가므로 잠깐 화면을 돌린다.
    for (let i = 0; i < 20; i++) { _applyFollow(); await wait(60); }
    const tr = _ml3d.transform, cl = tr.getCameraLngLat();
    const view = { sim: simModeOn, alt: tr.getCameraAltitude(), near: tr._helper._nearZ / tr._helper._pixelPerMeter,
                   off: distance(cl.lat, cl.lng, S.lat, S.lon) * 1852,
                   rend: _ml3d.queryTerrainElevation([S.lon, S.lat]) };
    // 함정이 15kt 로 가도 갑판 위 그 자리에 앉아 있다
    shipSpd = 15;
    const lat0 = shipLat;
    fly(10);
    const ride = { ...rel(), shipMoved: (shipLat - lat0) * 111320, alt: S.alt };
    // 일시정지 중에도 함정은 가고, 앉아 있는 헬기도 함께 간다
    S.running = false; S.lastT = ts;
    for (let i = 0; i < 40; i++) { ts += 50; simStep(ts); }
    const paused = rel();
    // 함정이 침로를 바꾸면 헬기도 함정 중심을 축으로 함께 돈다
    shipSetMode('CRS');
    const hdg0 = S.hdg, shdg0 = shipHdg;
    ['0', '9', '0', 'ENT'].forEach(shipKey);
    const turned = { ...rel(), dHdg: normAS(S.hdg - hdg0), dShip: normAS(shipHdg - shdg0) };
    // 레버를 올려 뜬다 — 뜨는 순간 함정 속도로 날고 있다(튀지 않는다)
    _pad.axes[3] = 0.6;
    S.running = true; S.lastT = ts;
    let n = 0;
    while (simOnDeck() && n < 400) { ts += 50; joyPoll(ts); simStep(ts); n++; }
    const p0 = [S.lat, S.lon], s0 = [shipLat, shipLon];
    for (let i = 0; i < 20; i++) { ts += 50; joyPoll(ts); simStep(ts); }   // 뜬 뒤 1초
    S.running = false;
    const lift = { frames: n, heli: distance(p0[0], p0[1], S.lat, S.lon) * 1852,
                   ship: distance(s0[0], s0[1], shipLat, shipLon) * 1852, alt: S.alt };
    // 함정과 같은 속도로 날다 갑판에 닿으면 갑판 위에서는 거의 서 있다
    shipHdg = 0; shipSpd = 10; updateShipMarker();
    [S.lat, S.lon] = at(-35, 0); S.hdg = 0; S.spd = 10; simLat = 0;
    S.alt = simFloorFt() + 0.3; S.vs = -200; _simVs1 = -200; simAcc = 0;
    _pad.axes[3] = -1;
    S.running = true; S.lastT = ts; ts += 50; joyPoll(ts); simStep(ts); S.running = false;
    const touch = { deck: simOnDeck(), spd: S.spd };
    // 정리
    _tcElev = realElev; shipSpd = 0; updateShipMarker();
    toggleSimMode(false);
    return { floors, landed, view, ride, paused, turned, lift, touch };
  });
  const DECK_FT = 7 / 0.3048;
  t.ok(Math.abs(land.floors.stern - DECK_FT) < 0.01 && Math.abs(land.floors.bridge - 17 / 0.3048) < 0.01
       && Math.abs(land.floors.bow - 10 / 0.3048) < 0.01,
    `함정 위에서는 그 부분의 윗면이 바닥이다 (갑판 ${land.floors.stern.toFixed(1)} · 함교 ${land.floors.bridge.toFixed(1)} · 함수 ${land.floors.bow.toFixed(1)}ft)`);
  t.ok(land.floors.side === 0 && land.floors.far === 0, '함정 옆·뒤 바다는 해수면(0ft)이 바닥이다');
  t.ok([land.floors.tdX, land.floors.lineup, land.floors.shoulder].every(f => Math.abs(f - 7 / 0.3048) < 0.01),
    '착함 원·X·정렬선·어깨선 위도 갑판 높이 그대로다(칠한 선이다)');
  t.ok(Math.abs(land.landed.alt - DECK_FT) < 0.6 && land.landed.vs === 0 && land.landed.deck,
    `레버를 내리면 함미 갑판에 내려앉는다 (${land.landed.alt.toFixed(1)}ft · 갑판 ${DECK_FT.toFixed(1)}ft)`);
  {
    const drawn = Number.isFinite(land.view.rend) ? land.view.rend : 0;   // 그려진 수면
    t.ok(land.view.sim && Math.abs(land.view.alt - drawn - 15) < 0.5 && land.view.off < 0.5,
      `갑판에서는 눈이 갑판 위 8m 다 (수면 위 ${(land.view.alt - drawn).toFixed(1)}m · 헬기 자리에서 ${land.view.off.toFixed(2)}m)`);
    t.ok(land.view.near < 6,
      `가까운 클립면이 ${land.view.near.toFixed(1)}m 라 발밑 갑판과 함교가 잘리지 않는다 (종전 133m)`);
  }
  t.ok(Math.abs(land.ride.fwd - land.landed.fwd) < 1 && Math.abs(land.ride.right) < 1
       && land.ride.shipMoved > 70 && Math.abs(land.ride.alt - DECK_FT) < 0.6,
    `함정이 15kt 로 가도 갑판 그 자리에 앉아 있다 (함정 ${land.ride.shipMoved.toFixed(0)}m 이동 · 갑판 위 ${land.ride.fwd.toFixed(1)}m)`);
  t.ok(Math.abs(land.paused.fwd - land.landed.fwd) < 1,
    `일시정지 중에도 함께 간다 (갑판 위 ${land.paused.fwd.toFixed(1)}m)`);
  t.ok(Math.abs(land.turned.fwd - land.landed.fwd) < 1 && Math.abs(land.turned.right) < 1
       && Math.abs(land.turned.dHdg - land.turned.dShip) < 0.01 && Math.abs(land.turned.dShip) > 30,
    `함정이 침로를 바꾸면 함께 돈다 (함정 ${land.turned.dShip.toFixed(0)}° · 헬기 ${land.turned.dHdg.toFixed(0)}°)`);
  t.ok(land.lift.frames < 400 && land.lift.alt > DECK_FT + 1,
    `레버를 올리면 갑판에서 뜬다 (${(land.lift.frames * 0.05).toFixed(1)}초 · ${land.lift.alt.toFixed(0)}ft)`);
  t.ok(Math.abs(land.lift.heli - land.lift.ship) < land.lift.ship * 0.3,
    `뜬 직후에는 함정 속도로 날고 있다 (1초에 헬기 ${land.lift.heli.toFixed(1)}m · 함정 ${land.lift.ship.toFixed(1)}m)`);
  t.ok(land.touch.deck && Math.abs(land.touch.spd) < 1,
    `함정과 나란히 날다 닿으면 갑판 위에서는 서 있다 (갑판 기준 ${land.touch.spd.toFixed(1)}kt)`);

  // ── 끄면 3D 에서도 사라진다 ──
  const off = await page.evaluate(async () => {
    if (shipVisible) shipToggleOn();
    return { n: (await _ml3d.getSource('ship-3d').getData()).features.length,
             trail: (await _ml3d.getSource('ship-trail-3d').getData()).geometry.coordinates.length };
  });
  t.ok(off.n === 0 && off.trail === 0, '배 표시를 끄면 3D 모형과 항적도 사라진다');
  t.eq(page.errors.length, 0, `페이지 오류 없음${page.errors.length ? ' — ' + page.errors[0] : ''}`);
}
