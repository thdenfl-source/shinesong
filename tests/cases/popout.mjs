// 패널 새 창(다중 모니터) — 00-popout.js
//
// ⧉ 로 패널을 새 창에 옮겨 띄우면, 앱은 하나 그대로 돌고(상태가 갈라지지 않는다)
// 새 창 안의 탭·키보드가 본 창의 앱을 움직이며, 닫으면 제자리로 돌아오는지 본다.
export const name = '패널 새 창';

export async function run(page, t) {
  const ctx = page.context();
  const pp = ctx.waitForEvent('page');
  await page.click('#left-panel .po-btn');
  const pop = await pp;
  await page.waitForTimeout(1200);
  const a = await page.evaluate(() => {
    const L = document.getElementById('left-panel');
    return { sides: popoutSides(), moved: L.ownerDocument !== document, pfdW: document.getElementById('pfd').width,
             cls: document.getElementById('app').className, divider: getComputedStyle(document.getElementById('panel-divider')).display };
  });
  t.ok(a.sides.join() === 'left' && a.moved, '⧉ 를 누르면 좌측 패널이 새 창으로 옮겨 간다');
  t.ok(a.pfdW > 100, `새 창에서도 PFD 가 그 창 크기로 그려진다 (${a.pfdW}px)`);
  t.ok(/po-left/.test(a.cls) && a.divider === 'none', '본 창에서는 그 자리의 구분선이 사라지고 남은 패널이 나눠 갖는다');

  await pop.click('#left-tabs [data-sel="map"]');
  await page.waitForTimeout(500);
  const b = await page.evaluate(() => ({ sel: leftSel, inPop: document.getElementById('map-wrap').ownerDocument !== document }));
  t.ok(b.sel === 'map' && b.inPop, '새 창의 탭을 누르면 본 창의 앱이 그 패널을 바꾼다(MAP 이 새 창으로)');
  await pop.click('#left-tabs [data-sel="pfd"]');
  await page.waitForTimeout(300);

  const r0 = await page.evaluate(() => S.running);
  await pop.keyboard.press('Space');
  await page.waitForTimeout(200);
  const r1 = await page.evaluate(() => S.running);
  t.ok(r0 !== r1, '새 창에서 누른 키(스페이스 FLY/PAUSE)도 앱에 닿는다');
  if (r1) await page.evaluate(() => toggleSim());

  await pop.close();
  await page.waitForTimeout(1200);
  const c = await page.evaluate(() => ({ sides: popoutSides(), back: document.getElementById('left-panel').ownerDocument === document,
    order: Array.from(document.getElementById('app').children).map(x => x.id).filter(Boolean).join(','),
    btn: document.querySelector('#left-panel .po-btn').textContent }));
  t.ok(c.sides.length === 0 && c.back, '새 창을 닫으면 패널이 본 창으로 돌아온다');
  t.ok(c.order.startsWith('left-panel,panel-divider'), `제자리(맨 왼쪽)로 돌아온다 (${c.order})`);
  t.eq(c.btn, '⧉', '버튼도 원래대로');
}
