// PFD 소프트키(터치바) — PFD 아래 12칸(07-sim.js). OBS · Active NAV(FMS→NAV1→NAV2) · Hover Display 가 지금 FCP 와 같은 동작.
export const name = 'PFD 소프트키';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const o = {};
    const sk = id => document.getElementById('sk-' + id);
    o.lbls = [...document.querySelectorAll('#pfd-sk .pfd-sk span')].map(e => e.innerHTML.replace(/<br>/g, ' ').trim()).join('|');
    o.bar = sk('obs') && sk('obs').closest('.ctrl-bar') === document.querySelector('#pfd-wrap .ctrl-bar');
    // OBS — 지금 FCP 의 OBS 와 같다 · 켜지면 아래 녹색 바
    if (obsOn) toggleObs();
    sk('obs').click(); pfdSkSync();
    o.obs = obsOn && document.getElementById('obs-btn').classList.contains('on');
    o.obsBar = getComputedStyle(sk('obs').querySelector('i')).backgroundColor;
    sk('obs').click(); pfdSkSync(); o.obsOff = !obsOn && !sk('obs').classList.contains('on');
    // Active NAV — FMS → NAV1 → NAV2 → FMS
    setNavSrc('FMS'); pfdSkSync();
    const seq = [document.getElementById('sk-nav-src').textContent];
    for (let i = 0; i < 3; i++) { sk('nav').click(); seq.push(document.getElementById('sk-nav-src').textContent); }
    o.nav = seq.join('>'); o.navFcp = document.getElementById('nav-fms').classList.contains('active');
    // Hover Display — 80kt 아래에서 HSI ⇄ HOVER
    const spd0 = S.spd; S.spd = 40; updateHoverBtns(); pfdSkSync();
    o.hovOk = !sk('hov').classList.contains('off');
    sk('hov').click(); pfdSkSync(); o.hov = hoverPageOn && sk('hov').classList.contains('on');
    sk('hov').click(); pfdSkSync(); o.hovOff = !hoverPageOn;
    S.spd = 120; updateHoverBtns(); pfdSkSync(); o.hovFast = sk('hov').classList.contains('off');
    S.spd = spd0; updateHoverBtns(); pfdSkSync();
    // FCP SIMPLE 에서도 보인다
    if (!fcpSimpleOn) toggleFcpSimple(); await wait(50);
    o.inSimple = sk('obs').offsetParent !== null;
    toggleFcpSimple(); localStorage.removeItem('fcpSimple');
    return o;
  });
  t.eq(r.lbls, 'Map Range −|Map Range +|PFD Map Settings|Traffic Map|PFD Settings|OBS|Active NAV|Sensors|Hover Display|Hover Position|CAS|',
    'PFD 아래 소프트키 12칸 — 사진의 순서');
  t.ok(r.bar, 'FCP 맨 위 한 줄(PFD 바로 아래)');
  t.ok(r.obs && r.obsBar === 'rgb(34, 224, 34)' && r.obsOff, `OBS — 지금 FCP 의 OBS 와 같고 켜지면 아래 녹색 바 (${r.obsBar})`);
  t.ok(r.nav === 'FMS>NAV1>NAV2>FMS' && r.navFcp, `Active NAV — 누를 때마다 FMS → NAV1 → NAV2 → FMS (${r.nav})`);
  t.ok(r.hovOk && r.hov && r.hovOff, 'Hover Display — HSI ⇄ HOVER DISPLAY(지금 FCP 의 HOVER PAGE 와 같다)');
  t.ok(r.hovFast, 'Hover Display — 80kt 이상이면 흐리게(지금 FCP 처럼 누를 수 없다)');
  t.ok(r.inSimple, 'FCP SIMPLE 에서도 소프트키가 보인다');
}
