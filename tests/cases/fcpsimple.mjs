// FCP SIMPLE — 실기 AFCS 조작 패널 모양으로 간추린 FCP(07-sim.js). 왼쪽 세로 탭 하나로 지금 FCP ⇄ SIMPLE.
export const name = 'FCP SIMPLE';

export async function run(page, t) {
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const bar = document.querySelector('#pfd-wrap .ctrl-bar');
    const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
    const turn = (k, side) => { const el = document.querySelector(`#fcp-simple [data-k="${k}"] .fks-${side}`); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
    const o = {};
    if (fcpSimpleOn) toggleFcpSimple();
    o.fullRows = vis(bar.querySelector('.ctrl-sub-row')) && !vis(document.getElementById('fcp-simple'));
    const h0 = bar.offsetHeight;
    document.getElementById('fcps-tog').click(); await wait(80);
    o.simple = fcpSimpleOn && vis(document.getElementById('fcp-simple')) && !vis(bar.querySelector('.ctrl-sub-row'));
    o.tog = document.getElementById('fcps-tog').textContent;
    o.lbls = [...document.querySelectorAll('#fcp-simple .fks-lbl')].map(e => e.textContent.trim()).filter(x => x && x !== ' ').join(',');
    o.saved = localStorage.getItem('fcpSimple') === '1';
    // 노브 — 돌리면 지금 FCP 와 같은 값이 움직인다
    const hdg0 = selHdg; turn('hdg', 'up'); o.hdg = (selHdg - hdg0 + 360) % 360;
    const alt0 = selAlt; turn('alta', 'up'); o.alt = selAlt - alt0;
    const crht0 = selCrht; turn('crht', 'dn'); o.crht = selCrht - crht0;
    const hht0 = selHht; turn('hht', 'up'); o.hht = selHht - hht0;
    window._qnhHpa = 1013; turn('baro', 'up'); o.baro = window._qnhHpa;
    document.querySelector('#fcp-simple [data-k="baro"] .fks-push').click(); o.std = window._qnhHpa;
    // 누름 · 버튼
    altHoldOn = false; document.getElementById('fks-alt').click(); o.altBtn = altHoldOn;
    fcpsSync(); o.altLit = document.getElementById('fks-alt').classList.contains('on');
    const nav0 = navApOn; document.getElementById('fks-navd').click(); o.navd = navApOn !== nav0; if (navApOn !== nav0) toggleNavAp();
    o.uplimOff = document.querySelector('#fcp-simple [data-k="uplim"]').classList.contains('fks-none');
    // 다시 누르면 지금 FCP
    document.getElementById('fcps-tog').click(); await wait(80);
    o.back = !fcpSimpleOn && vis(bar.querySelector('.ctrl-sub-row')) && bar.offsetHeight === h0;
    localStorage.removeItem('fcpSimple'); window._qnhHpa = 1013;
    return o;
  });
  t.ok(r.fullRows, '처음에는 지금 FCP');
  t.ok(r.simple && r.tog === 'FULL' && r.saved, `왼쪽 세로 탭을 누르면 SIMPLE — 탭 글씨는 FULL, 고른 것은 기억한다`);
  t.eq(r.lbls, 'IAS,HDG,VS,ALT.A,ALT,CR.HT,NAVD CPL,T-DOWN,T.D.HOV,H.HT,BARO,UPLIM,CRS,DH', '사진의 배치(위 · 아래 · 오른쪽 BARO/UPLIM · CRS/DH)');
  t.ok(r.hdg === 1 && r.alt === 100 && r.crht === -10 && r.hht === 10, `노브를 돌리면 HDG +1 · ALT.A +100 · CR.HT −10 · H.HT +10 (${r.hdg} · ${r.alt} · ${r.crht} · ${r.hht})`);
  t.ok(r.baro === 1014 && r.std === 1013, `BARO — 돌리면 1 hPa, 누르면 STD 1013 (${r.baro} → ${r.std})`);
  t.ok(r.altBtn && r.altLit, 'ALT 버튼 — ALT 유지가 걸리고 녹색으로 켜진다');
  t.ok(r.navd, 'NAVD CPL — NAV 결합(지금 FCP 의 NAV 와 같다)');
  t.ok(r.uplimOff, 'UPLIM · DH 는 아직 기능 없이 자리만');
  t.ok(r.back, '다시 누르면 지금 FCP 로 돌아오고 높이도 그대로');
}
