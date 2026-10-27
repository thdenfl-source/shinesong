// 흰수리 3D 모형 — 실제 크기(전장 20m)로 3D 지도에 그린다 · SIM 외부 시점
//
// 치수는 모형 자료로 직접 잰다. 도색은 위에서 내려다본 화면을 찍어 그 자리의 색으로
// 본다(엔진 덮개 빨강 · 노랑 띠 · 파란 꼬리 붐 · 흰 연료탱크).
export const name = '흰수리 3D 모형';

const HELI_MARK = 14;   // 이보다 작게 보이면 삼각형 표식도 띄운다(HELI3D_MARKER_PX)

// 화면을 찍어 주어진 화면 좌표들의 색을 읽는다(PNG 는 페이지 안에서 풀어 읽는다)
async function pixels(page, box, pts) {
  const png = (await page.screenshot({ clip: box })).toString('base64');
  return page.evaluate(async ({ png, pts }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + png;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return pts.map(([x, y]) => Array.from(g.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)));
  }, { png, pts });
}

export async function run(page, t) {
  // ── 치수 — 주로터 앞 끝에서 꼬리로터 뒤 끝까지 20m, 원점이 그 한가운데 ──
  const dim = await page.evaluate(() => {
    const b = _h3BuildBody();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < b.length; i += 10) {
      x0 = Math.min(x0, b[i]); x1 = Math.max(x1, b[i]);
      y0 = Math.min(y0, b[i + 1]); y1 = Math.max(y1, b[i + 1]);
      z0 = Math.min(z0, b[i + 2]); z1 = Math.max(z1, b[i + 2]);
    }
    const front = Math.max(x1, HELI3D_ROTOR.x + HELI3D_ROTOR.r);
    const rear = Math.min(x0, HELI3D_TAIL.x - HELI3D_TAIL.r);
    return { front, rear, len: front - rear, fuse: x1 - x0, width: y1 - y0, z0, z1,
             rotorD: HELI3D_ROTOR.r * 2, tailD: HELI3D_TAIL.r * 2, rotorZ: HELI3D_ROTOR.z,
             acLen: SIM_AC_LEN, tris: b.length / 30 };
  });
  t.ok(Math.abs(dim.len - 20) < 0.05, `전장(주로터 앞 끝 ~ 꼬리로터 뒤 끝)이 20m 다 (${dim.len.toFixed(2)}m)`);
  t.ok(Math.abs(dim.front - 10) < 0.05 && Math.abs(dim.rear + 10) < 0.05,
    `원점이 전장의 한가운데다 — 착함 판정(${dim.acLen}m)과 같은 자리 (앞 ${dim.front.toFixed(2)} · 뒤 ${dim.rear.toFixed(2)}m)`);
  t.ok(dim.fuse > 18 && dim.fuse < 19.5, `동체 길이는 그림의 비율대로 (${dim.fuse.toFixed(2)}m)`);
  t.ok(dim.rotorD > 13.5 && dim.rotorD < 15 && dim.tailD > 2.6 && dim.tailD < 3.3,
    `주로터 지름 ${dim.rotorD.toFixed(1)}m · 꼬리로터 ${dim.tailD.toFixed(1)}m`);
  t.ok(Math.abs(dim.z0) < 0.02, `바퀴 바닥이 지면(0m)이다 (${dim.z0.toFixed(2)}m)`);
  t.ok(dim.rotorZ > dim.z1 - 0.5 && dim.rotorZ < 6, `주로터는 엔진 덮개 위에 있다 (로터 ${dim.rotorZ}m · 동체 꼭대기 ${dim.z1.toFixed(2)}m)`);
  t.ok(dim.width > 4 && dim.width < 5, `좌우 폭(연료탱크 포함)이 그림과 맞다 (${dim.width.toFixed(2)}m)`);

  // ── 3D 지도에 얹힌다 ──
  const open = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    if (typeof simModeOn !== 'undefined' && simModeOn) toggleSimMode(false);
    if (mapHdgUp) toggleMapOrient();
    if (followMode) toggleFollow();
    S.lat = 37.0; S.lon = 126.0; S.hdg = 0; S.alt = 0; S.spd = 0; S.pit = 0; S.bnk = 0; bankTarget = 0;
    S.running = false;
    if (!_view3dOn) toggle3dMap();
    let n = 0;
    while (!(_ml3d && _ml3d.getLayer('heli-3d')) && n < 200) { await w(50); n++; }
    // 삼각형 표식은 지도가 다 뜬 뒤(load)에 생긴다 — 조금 더 기다려 본다
    n = 0; while (!_ml3dMarker && n < 100) { await w(50); n++; }
    return { layer: !!(_ml3d && _ml3d.getLayer('heli-3d')), shown: heli3dShown() };
  });
  t.ok(open.layer, '3D 지도에 흰수리 모형 레이어가 얹힌다');
  if (!open.layer) return;
  t.eq(open.shown, true, 'SIM 이 아닐 때는 모형을 그린다');

  // 위에서 내려다본 화면 — 기수가 화면 위(북)를 향한다
  const top = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    _ml3d.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    _ml3d.jumpTo({ center: [S.lon, S.lat], zoom: 20, pitch: 0, bearing: 0 });
    _update3dMarker(); _ml3d.triggerRepaint();
    await w(700);
    const b = document.getElementById('map3d').getBoundingClientRect();
    // 모형 좌표(앞 X · 오른쪽 Y, m) → 화면 좌표
    const at = (x, y) => {
      const p = _ml3d.project([S.lon + y / (111320 * Math.cos(S.lat * Math.PI / 180)), S.lat + x / 111320]);
      return [p.x, p.y];
    };
    return { box: { x: b.left, y: b.top, width: b.width, height: b.height },
             pts: { cowl: at(5.0, 0.55), yellow: at(-2.5, 0.5), blue: at(-5.5, 0), tank: at(0.3, 1.8), sea: at(0, 6.5) },
             len: heli3dScreenLen(), mk: _ml3dMarker ? _ml3dMarker.getElement().style.visibility : null };
  });
  const names = Object.keys(top.pts);
  const col = await pixels(page, top.box, names.map(k => top.pts[k]));
  const c = Object.fromEntries(names.map((k, i) => [k, col[i]]));
  const s = v => `rgb(${v.join(',')})`;
  t.ok(c.cowl[0] > 150 && c.cowl[1] < 100 && c.cowl[2] < 100, `엔진 덮개는 빨강이다 (${s(c.cowl)})`);
  t.ok(c.yellow[0] > 150 && c.yellow[1] > 110 && c.yellow[2] < 90, `동체 뒤쪽은 노랑 띠다 (${s(c.yellow)})`);
  t.ok(c.blue[2] > 90 && c.blue[2] > c.blue[0] + 40, `꼬리 붐은 파랑이다 (${s(c.blue)})`);
  t.ok(c.tank.every(v => v > 170), `연료탱크는 흰색이다 (${s(c.tank)})`);
  t.ok(!(c.sea[0] > 150 && c.sea[1] < 100), `모형 밖은 바탕 그대로다 (${s(c.sea)})`);
  t.ok(top.len > 100, `가까이 보면 실제 크기로 크게 보인다 (화면 ${top.len.toFixed(0)}px)`);
  // (타일을 못 받는 곳에서는 지도가 다 뜨지 않아 표식이 아직 없을 수 있다 — 그때는 거리만 본다)
  if (top.mk !== null) t.eq(top.mk, 'hidden', '모형이 충분히 크면 초록 삼각형 표식은 숨긴다');

  // 멀리서 보면 모형이 점만 해지므로 표식을 같이 띄운다
  const far = await page.evaluate(async () => {
    _ml3d.jumpTo({ center: [S.lon, S.lat], zoom: 12, pitch: 50, bearing: 0 });
    _update3dMarker();
    await new Promise(r => setTimeout(r, 200));
    return { len: heli3dScreenLen(), mk: _ml3dMarker ? _ml3dMarker.getElement().style.visibility : null };
  });
  t.ok(far.len < HELI_MARK && far.mk !== 'hidden', `멀면 삼각형 표식이 보인다 (모형 ${far.len.toFixed(1)}px · ${far.mk})`);

  // ── 자리·높이 — 지면 위 높이(AGL)만큼 떠서 그린다 ──
  const pose = await page.evaluate(() => {
    S.alt = 0; const g = heli3dPose();
    S.alt = 1000; const a = heli3dPose();
    S.alt = 0;
    return { g: g.agl, a: a.agl, da: a.alt - g.alt };
  });
  t.ok(pose.g === 0 && Math.abs(pose.a - 304.8) < 0.5 && Math.abs(pose.da - 304.8) < 0.5,
    `땅에 있으면 지면에, 1,000ft 면 304.8m 위에 그린다 (${pose.a.toFixed(1)}m)`);

  // ── SIM — 1인칭에서는 그리지 않고, EXT 를 누르면 뒤에서 따라가며 본다 ──
  const ext = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const btn = document.getElementById('ext-btn');
    const out = { off: { shown: getComputedStyle(btn).display } };
    S.alt = 1000; S.spd = 80; S.hdg = 40;
    toggleSimMode(true);
    S.alt = 1000; S.hdg = 40;
    await w(300);
    out.fp = { model: heli3dShown(), btn: getComputedStyle(btn).display, ext: simExtView };
    btn.click();
    await w(300);
    out.on = { ext: simExtView, cls: btn.classList.contains('on'), model: heli3dShown(), chin: _chinMaps.length,
               chinOn: document.getElementById('map3d').classList.contains('chin-on') };
    // 카메라 자리 — 헬기 뒤(기수 방향의 반대)에서 내려다본다
    heli3dExtCamera();
    const cam = _ml3d.transform.getCameraLngLat(), camAlt = _ml3d.transform.getCameraAltitude();
    const pose = heli3dPose();
    const dn = (pose.lat - cam.lat) * 111320, de = (pose.lon - cam.lng) * 111320 * Math.cos(pose.lat * Math.PI / 180);
    out.cam = { horiz: Math.hypot(dn, de), brg: (Math.atan2(de, dn) * 180 / Math.PI + 360) % 360,
                above: camAlt - pose.alt, pitch: _ml3d.getPitch(), bearing: (_ml3d.getBearing() + 360) % 360 };
    // 둘러보기 — 햇 ▶ 로 오른쪽 둘레로 돈다
    simLookHold(true); simLookDir = null;            // 누르고 있는 동안은 그 자리에 머문다
    simLook.yaw = 90; simLook.pitch = 0;
    heli3dExtCamera();
    out.look = (_ml3d.getBearing() + 360) % 360;
    simLookHold(false); simLookReset();
    // 한 번 더 누르면 1인칭으로 — CHIN 창이 돌아온다
    btn.click();
    await w(300);
    out.back = { ext: simExtView, model: heli3dShown(), chin: _chinMaps.length };
    // 외부 시점에서 SIM 을 나가면 다음에는 1인칭부터
    toggleExtView(true);
    toggleSimMode(false);
    await w(100);
    out.exit = { ext: simExtView, model: heli3dShown(), btn: getComputedStyle(btn).display };
    out.joy = JOY_ACTIONS.some(a => a.id === 'extView');
    S.alt = 0; S.spd = 0; S.running = false;
    return out;
  });
  t.eq(ext.off.shown, 'none', 'SIM 이 아닐 때는 EXT 버튼이 없다');
  t.ok(ext.fp.btn !== 'none' && !ext.fp.ext && !ext.fp.model, 'SIM 1인칭 — EXT 버튼이 보이고, 눈이 기체 안이라 모형은 그리지 않는다');
  t.ok(ext.on.ext && ext.on.cls && ext.on.model, 'EXT 를 누르면 외부 시점 — 모형을 그린다');
  t.ok(ext.on.chin === 0 && !ext.on.chinOn, '외부 시점에서는 CHIN 창을 닫는다');
  t.ok(ext.cam.horiz > 25 && ext.cam.horiz < 200 && Math.abs(((ext.cam.brg - 40 + 540) % 360) - 180) < 3,
    `카메라는 헬기 뒤에 있다 (${ext.cam.horiz.toFixed(0)}m · 헬기 쪽 방위 ${ext.cam.brg.toFixed(0)}°)`);
  t.ok(ext.cam.above > 3 && ext.cam.pitch < 90 && Math.abs(ext.cam.bearing - 40) < 1,
    `조금 위에서 기수 방향으로 내려다본다 (위 ${ext.cam.above.toFixed(0)}m · 기울기 ${ext.cam.pitch.toFixed(0)}°)`);
  t.ok(Math.abs(((ext.look - 130 + 540) % 360) - 180) < 1, `둘러보기(◀▶)로 헬기 둘레를 돈다 (카메라 방위 ${ext.look.toFixed(0)}°)`);
  t.ok(!ext.back.ext && !ext.back.model && ext.back.chin === 2, '다시 누르면 1인칭 — CHIN 창이 돌아온다');
  t.ok(!ext.exit.ext && ext.exit.model && ext.exit.btn === 'none', 'SIM 을 나가면 외부 시점도 풀리고 3D 지도에 모형이 보인다');
  t.ok(ext.joy, '조이스틱 버튼에 「외부 시점」을 배정할 수 있다');
}
