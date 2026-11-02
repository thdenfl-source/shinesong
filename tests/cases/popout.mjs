// 패널 새 창(다중 모니터) — 00-popout.js
//
// ⧉ 로 패널을 새 창에 옮겨 띄우면, 앱은 하나 그대로 돌고(상태가 갈라지지 않는다)
// 새 창 안의 탭·키보드가 본 창의 앱을 움직이며, 닫으면 제자리로 돌아오는지 본다.
export const name = '패널 새 창';

export async function run(page, t) {
  // 화면 배치 — 기본 3분할 PFD · CDU · MAP, 탭은 창마다 정해진 것만
  const tabs = await page.evaluate(() => {
    const txt = id => Array.from(document.getElementById(id).querySelectorAll('button'))
      .filter(b => getComputedStyle(b).display !== 'none').map(b => b.textContent.trim()).join('|');
    return { sel: [leftSel, midSel, rightSel].join('·'), tri: tripleMode,
             L: txt('left-tabs'), M: txt('mid-tabs'), R: txt('page-tabs') };
  });
  t.ok(tabs.tri && tabs.sel === 'pfd·cdu·map', `처음에는 3분할 PFD · CDU · MAP (${tabs.sel})`);
  t.ok(/^PFD\|⿰ 2분할\|⧉ POP UP$/.test(tabs.L), `PFD 창 탭: PFD · 2분할/3분할 · POP UP (${tabs.L})`);
  t.ok(tabs.M === 'CDU|MAP|3D|⧉ POP UP|⟳', `CDU 창 탭: CDU · MAP · 3D · POP UP · 새로고침 (${tabs.M})`);
  t.ok(tabs.R === 'CDU|MAP|3D|⛶ 3D Only|⧉ POP UP', `MAP 창 탭: CDU · MAP · 3D · 3D Only · POP UP (${tabs.R})`);
  const two = await page.evaluate(() => { toggleTriple(false); const o = [leftSel, rightSel].join('·'); toggleTriple(true); return o; });
  t.eq(two, 'pfd·map', '2분할은 PFD · MAP');
  const ctx = page.context();
  const pp = ctx.waitForEvent('page');
  await page.click('#mid-panel .po-btn');
  const pop = await pp;
  await page.waitForTimeout(1200);
  const a = await page.evaluate(() => {
    const L = document.getElementById('mid-panel');
    return { sides: popoutSides(), moved: L.ownerDocument !== document, pfdW: document.getElementById('cdu-wrap').getBoundingClientRect().width,
             cls: document.getElementById('app').className, divider: getComputedStyle(document.getElementById('divider-2')).display };
  });
  t.ok(a.sides.join() === 'mid' && a.moved, 'POP UP 을 누르면 가운데(CDU) 패널이 새 창으로 옮겨 간다');
  t.ok(a.pfdW > 100, `새 창에서도 CDU 가 그 창 크기로 그려진다 (${a.pfdW}px)`);
  t.ok(/po-mid/.test(a.cls) && a.divider === 'none', '본 창에서는 그 자리의 구분선이 사라지고 남은 패널이 나눠 갖는다');

  // 둘만 남은 본 창 — 남은 경계(좌|우)를 끌면 비율이 바뀐다
  const g = await page.evaluate(() => { const r = document.getElementById('divider-grip').getBoundingClientRect();
    const a = document.getElementById('app').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, ax: a.x, aw: a.width }; });
  await page.mouse.move(g.x, g.y); await page.mouse.down();
  await page.mouse.move(g.ax + g.aw * 0.3, g.y, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(300);
  const lw = await page.evaluate(() => document.getElementById('left-panel').getBoundingClientRect().width / document.getElementById('app').getBoundingClientRect().width);
  t.ok(Math.abs(lw - 0.3) < 0.05, `창 하나를 띄운 뒤 남은 두 창의 비율을 끌어 바꾼다 (좌 ${(lw * 100).toFixed(0)}%)`);

  await pop.click('#mid-tabs [data-sel="map"]');
  await page.waitForTimeout(500);
  const b = await page.evaluate(() => ({ sel: midSel, inPop: document.getElementById('map-wrap').ownerDocument !== document }));
  t.ok(b.sel === 'map' && b.inPop, '새 창의 탭을 누르면 본 창의 앱이 그 패널을 바꾼다(MAP 이 새 창으로)');
  await pop.click('#mid-tabs [data-sel="cdu"]');
  await page.waitForTimeout(300);

  const r0 = await page.evaluate(() => S.running);
  await pop.keyboard.press('Space');
  await page.waitForTimeout(200);
  const r1 = await page.evaluate(() => S.running);
  t.ok(r0 !== r1, '새 창에서 누른 키(스페이스 FLY/PAUSE)도 앱에 닿는다');
  if (r1) await page.evaluate(() => toggleSim());

  // 본 창의 그리기 주기가 멈춰도(새 창 전체화면으로 가려짐) 새 창이 시뮬을 대신 돌린다
  const pumped = await page.evaluate(async () => {
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;           // 본 창 rAF 를 멈춘 셈
    await new Promise(r => setTimeout(r, 400));
    const t0 = _simLastTick;
    await new Promise(r => setTimeout(r, 800));
    const t1 = _simLastTick;
    window.requestAnimationFrame = raf; requestAnimationFrame(simStep);
    return t1 - t0;
  });
  t.ok(pumped > 300, `본 창이 멈춰도 새 창이 시뮬을 이어 돌린다 (${pumped.toFixed(0)}ms 진행)`);

  await pop.close();
  await page.waitForTimeout(1200);
  const c = await page.evaluate(() => ({ sides: popoutSides(), back: document.getElementById('mid-panel').ownerDocument === document,
    order: Array.from(document.getElementById('app').children).map(x => x.id).filter(Boolean).join(','),
    btn: document.querySelector('#mid-panel .po-btn').textContent }));
  t.ok(c.sides.length === 0 && c.back, '새 창을 닫으면 패널이 본 창으로 돌아온다');
  t.ok(c.order.startsWith('left-panel,panel-divider,mid-panel'), `제자리(가운데)로 돌아온다 (${c.order})`);
  t.eq(c.btn, '⧉ POP UP', '버튼도 원래대로');
}
