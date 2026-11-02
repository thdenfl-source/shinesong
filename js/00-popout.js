// ─────────────────────────────────────────────────────────────
// 00-popout.js — 패널을 따로 창(팝업)으로 띄운다(다중 모니터 배치)
//
// 화면의 세 패널(좌·중·우)을 각각 '⧉' 버튼으로 새 창에 옮겨 띄울 수 있다. 새 창은 앱을
// 하나 더 여는 것이 아니라 그 패널(의 DOM)을 그대로 옮겨 간 것이다 — 시뮬·상태·조이스틱은
// 이 창(본 창) 하나가 돌리고, 새 창은 그 화면을 보여 주고 입력을 받을 뿐이다. 그래서 창이
// 몇 개든 비행 상태가 어긋나지 않는다. 새 창을 닫거나 '⧉ 복귀' 를 누르면 패널이 제자리로 돌아온다.
//
// 그러려면 세 가지를 이어 준다.
//  1) 이벤트 — 앱·라이브러리가 document·window 에 건 입력 이벤트(키·클릭·포인터·휠·리사이즈)를
//     새 창의 document·window 에도 똑같이 건다(아래에서 등록을 받아 적어 둔다 — 그래서 이 파일은
//     라이브러리보다 먼저 불러야 한다).
//  2) 요소 찾기 — document.getElementById·querySelector(All) 가 새 창으로 옮겨 간 요소도 찾게 한다.
//  3) 화면 — 이 창의 스타일을 새 창에 그대로 옮겨 싣는다.
// 한계: 시뮬·3D 지도의 그리기 주기는 본 창이 돈다 — 본 창을 최소화하면 브라우저가 멈춰 세운다.
// 본 창은 다른 모니터에 띄워 두거나 한 패널을 남겨 두고 쓴다.
// ─────────────────────────────────────────────────────────────
(function () {
  const W = window, D = document;
  const wins = [];                       // { side, win, panel, ph, timer }
  const MIRROR = new Set(['keydown', 'keyup', 'keypress', 'click', 'dblclick', 'contextmenu',
    'pointerdown', 'pointerup', 'pointermove', 'pointercancel',
    'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchend', 'touchmove', 'touchcancel',
    'wheel', 'resize']);
  const reg = { doc: [], win: [] };
  const capOf = o => !!(o === true || (o && o.capture));

  // 1) document·window 에 거는 입력 이벤트를 받아 적고, 열린 새 창에도 똑같이 건다
  function patch(target, list, popTarget) {
    const add = target.addEventListener, rem = target.removeEventListener;
    target.addEventListener = function (type, fn, opt) {
      add.call(this, type, fn, opt);
      if (!fn || !MIRROR.has(type)) return;
      list.push([type, fn, opt]);
      wins.forEach(w => { try { popTarget(w).addEventListener(type, fn, opt); } catch (e) { /* 닫히는 중 */ } });
    };
    target.removeEventListener = function (type, fn, opt) {
      rem.call(this, type, fn, opt);
      if (!MIRROR.has(type)) return;
      const i = list.findIndex(r => r[0] === type && r[1] === fn && capOf(r[2]) === capOf(opt));
      if (i >= 0) list.splice(i, 1);
      wins.forEach(w => { try { popTarget(w).removeEventListener(type, fn, opt); } catch (e) { /* 닫히는 중 */ } });
    };
  }
  patch(D, reg.doc, w => w.win.document);
  patch(W, reg.win, w => w.win);

  // 2) 새 창으로 옮겨 간 요소도 찾는다(본 창을 먼저 본다)
  const gid = D.getElementById.bind(D), qs = D.querySelector.bind(D), qsa = D.querySelectorAll.bind(D);
  const live = () => wins.filter(w => !w.win.closed);
  D.getElementById = function (id) {
    const el = gid(id); if (el || !wins.length) return el;
    for (const w of live()) { const e = w.win.document.getElementById(id); if (e) return e; }
    return null;
  };
  D.querySelector = function (sel) {
    const el = qs(sel); if (el || !wins.length) return el;
    for (const w of live()) { const e = w.win.document.querySelector(sel); if (e) return e; }
    return null;
  };
  D.querySelectorAll = function (sel) {
    const list = qsa(sel); if (!wins.length) return list;
    const out = Array.from(list);
    live().forEach(w => out.push(...w.win.document.querySelectorAll(sel)));
    return out;
  };

  const PANEL_ID = { left: 'left-panel', mid: 'mid-panel', right: 'right-panel' };
  const TITLE = { left: '좌측 패널', mid: '가운데 패널', right: '우측 패널' };

  function syncAppClasses() {
    const app = gid('app'); if (!app) return;
    ['left', 'mid', 'right'].forEach(s => app.classList.toggle('po-' + s, wins.some(w => w.side === s)));
    app.classList.toggle('po-any', wins.length > 0);
    wins.forEach(w => {
      try {
        const root = w.win.document.getElementById('app');
        if (root) root.className = app.className + ' po-root';
      } catch (e) { /* 닫히는 중 */ }
      const b = w.panel.querySelector('.po-btn');
      if (b) { b.textContent = '⧉ 복귀'; b.title = '이 패널을 본 창으로 되돌린다'; }
    });
    ['left', 'mid', 'right'].forEach(s => {
      if (wins.some(w => w.side === s)) return;
      const p = gid(PANEL_ID[s]); const b = p && p.querySelector('.po-btn');
      if (b) { b.textContent = '⧉'; b.title = '이 패널을 새 창으로 띄운다(다중 모니터에 따로 배치)'; }
    });
  }
  function relayout() {
    try { if (typeof applyPanels === 'function') applyPanels(); } catch (e) { console.warn('[popout]', e); }
    const kick = () => { try { W.dispatchEvent(new Event('resize')); } catch (e) { /* 무시 */ } };
    kick(); setTimeout(kick, 60); setTimeout(kick, 300);
  }

  function popoutOpen(side) {
    if (!PANEL_ID[side]) return false;
    const have = wins.find(w => w.side === side);
    if (have) { try { have.win.focus(); } catch (e) { /* 무시 */ } return true; }
    if (side === 'mid' && typeof tripleMode !== 'undefined' && !tripleMode) return false;
    const panel = gid(PANEL_ID[side]);
    if (!panel) return false;
    const r = panel.getBoundingClientRect();
    const feat = `popup=yes,width=${Math.max(480, Math.round(r.width))},height=${Math.max(420, Math.round(r.height))}`;
    const win = W.open('', 'shinesong-' + side, feat);
    if (!win) {
      try { uiAlert('새 창이 막혔습니다 — 브라우저 주소창 오른쪽의 팝업 차단을 이 사이트에 허용해 주세요.'); }
      catch (e) { alert('팝업이 차단되었습니다.'); }
      return false;
    }
    const doc = win.document;
    doc.open();
    doc.write('<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<base href="' + String(location.href).replace(/"/g, '&quot;') + '">' +
      '<title>' + TITLE[side] + ' — Flight Simulator</title></head>' +
      '<body><div id="app"></div></body></html>');
    doc.close();
    // 3) 스타일을 그대로 옮겨 싣는다
    Array.from(D.head.querySelectorAll('style, link[rel="stylesheet"]')).forEach(n => doc.head.appendChild(doc.importNode(n, true)));
    const st = doc.createElement('style');
    st.textContent =
      'html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#000;}' +
      '#app.po-root{position:absolute;inset:0;display:flex !important;flex-direction:row;}' +
      '#app.po-root > #left-panel,#app.po-root > #mid-panel,#app.po-root > #right-panel' +
      '{display:flex !important;flex:1 1 0 !important;width:100% !important;min-width:0;}';
    doc.head.appendChild(st);
    doc.body.className = D.body.className;
    // 패널을 옮긴다(제자리 표시를 남겨 두고)
    const ph = D.createComment('popout:' + side);
    panel.parentNode.insertBefore(ph, panel);
    doc.getElementById('app').appendChild(panel);
    const rec = { side, win, panel, ph, timer: null };
    wins.push(rec);
    reg.doc.forEach(([t, f, o]) => doc.addEventListener(t, f, o));
    reg.win.forEach(([t, f, o]) => win.addEventListener(t, f, o));
    win.addEventListener('pagehide', () => popoutClose(side));
    rec.timer = setInterval(() => { if (win.closed) popoutClose(side); }, 500);
    syncAppClasses();
    relayout();
    return true;
  }

  function popoutClose(side) {
    const i = wins.findIndex(w => w.side === side);
    if (i < 0) return false;
    const rec = wins[i];
    wins.splice(i, 1);
    clearInterval(rec.timer);
    try {
      if (rec.ph.parentNode) { rec.ph.parentNode.insertBefore(rec.panel, rec.ph); rec.ph.remove(); }
      else { const app = gid('app'); if (app) app.appendChild(rec.panel); }
    } catch (e) { console.warn('[popout] 되돌리기 실패', e); }
    try { if (!rec.win.closed) rec.win.close(); } catch (e) { /* 무시 */ }
    syncAppClasses();
    relayout();
    return true;
  }

  function popoutToggle(side) {
    return wins.some(w => w.side === side) ? popoutClose(side) : popoutOpen(side);
  }

  // 3분할을 끄면 가운데 패널은 본 창으로 되돌린다(2분할에는 가운데 자리가 없다)
  setInterval(() => {
    if (typeof tripleMode !== 'undefined' && !tripleMode && wins.some(w => w.side === 'mid')) popoutClose('mid');
  }, 500);
  // 본 창을 닫으면 새 창도 닫는다(혼자 남은 새 창은 움직이지 않는다)
  W.addEventListener('pagehide', () => { wins.slice().forEach(w => { try { w.win.close(); } catch (e) { /* 무시 */ } }); });

  // 조이스틱 — 새 창에 포커스가 있으면 본 창에 패드가 안 올라오는 브라우저가 있어 새 창 쪽도 본다
  function popoutGamepads() {
    const out = [];
    live().forEach(w => {
      try { const g = w.win.navigator.getGamepads && w.win.navigator.getGamepads(); if (g) out.push(...Array.from(g).filter(Boolean)); }
      catch (e) { /* 무시 */ }
    });
    return out;
  }
  function popoutSides() { return wins.map(w => w.side); }

  W.popoutOpen = popoutOpen; W.popoutClose = popoutClose; W.popoutToggle = popoutToggle;
  W.popoutGamepads = popoutGamepads; W.popoutSides = popoutSides;
})();
