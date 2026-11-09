// HOCAS — FCP 2행 HOVER 칸 머리의 버튼. 켜면 HSI 왼쪽에 사이클릭·페달이 가운데인지·치우쳤는지 보인다.
import { SIM_SETUP_SRC } from './simmode.mjs';
export const name = 'HOCAS';

export async function run(page, t) {
  const r = await page.evaluate(`(() => {
    (${SIM_SETUP_SRC})();
    const grp = document.querySelector('.hover-group');
    const o = { lbls: [...grp.querySelectorAll('.ctrl-lbl')].map(e => e.textContent.trim()) };
    const shot = () => {
      const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, seen = [];
      proto.fillText = function (tx, ...a) { seen.push([String(tx), String(this.fillStyle)]); return orig.call(this, tx, ...a); };
      try { drawPFD(); } finally { proto.fillText = orig; }
      return seen;
    };
    o.off = shot().some(x => x[0] === 'HOCAS');
    const b = document.getElementById('hocas-btn');
    b.click(); o.on = hocasOn; o.cls = b.classList.contains('on');
    _ax(0, 0); _ax(1, 0); _ax(2, 0); joyPoll(2000);
    const c = shot(); o.title = c.some(x => x[0] === 'HOCAS');
    o.cyc0 = c.find(x => x[0].startsWith('CYC')); o.ped0 = c.find(x => x[0].startsWith('PED'));
    _ax(1, 0.5); _ax(0, -0.3); _ax(2, 0.6); joyPoll(2100);
    const d = shot(); o.cyc1 = d.find(x => x[0].startsWith('CYC')); o.ped1 = d.find(x => x[0].startsWith('PED'));
    _ax(0, 0); _ax(1, 0); _ax(2, 0); joyPoll(2200);
    b.click(); o.after = hocasOn; o.offAgain = shot().some(x => x[0] === 'HOCAS');
    toggleSimMode(false);
    return o;
  })()`);
  t.ok(r.lbls.includes('HOCAS') && !r.lbls.includes('HOVER'), `HOVER 글씨 대신 HOCAS 버튼이다 (${r.lbls.join(' · ')})`);
  t.eq(r.off, false, '평소에는 HSI 에 그리지 않는다');
  t.ok(r.on && r.cls && r.title, '누르면 켜지고 HSI 에 HOCAS 창이 뜬다');
  t.ok(r.cyc0 && r.cyc0[0] === 'CYC 0 · 0' && r.cyc0[1] === '#00ff88', `가운데면 0 · 초록 (${r.cyc0 && r.cyc0.join(' ')})`);
  t.ok(r.ped0 && r.ped0[0] === 'PED 0', `페달 가운데 (${r.ped0 && r.ped0[0]})`);
  t.ok(r.cyc1 && /^CYC F\d+ · L\d+$/.test(r.cyc1[0]) && r.cyc1[1] === '#ffb74d', `밀고 왼쪽으로 치우치면 F·L 과 호박색 (${r.cyc1 && r.cyc1.join(' ')})`);
  t.ok(r.ped1 && /^PED R\d+$/.test(r.ped1[0]), `오른 페달 (${r.ped1 && r.ped1[0]})`);
  t.ok(!r.after && !r.offAgain, '다시 누르면 꺼진다');
}
