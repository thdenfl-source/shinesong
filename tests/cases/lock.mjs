// 시작 잠금 — 비밀번호를 넣어야 시뮬을 쓸 수 있다.
//
// 다른 검사는 잠금을 풀어 둔 채로 연다(lib/env.mjs). 여기서는 새 탭으로 처음 여는 것처럼
// 열어, 덮개가 앱을 막는지·틀리면 안 열리는지·맞으면 열리고 그 탭에서는 다시 묻지 않는지 본다.
export const name = '시작 잠금';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/env.mjs';

const ready = p => p.waitForFunction(
  () => typeof S === 'object' && S !== null && typeof leafMap === 'object', null, { timeout: 20000 });
const state = p => p.evaluate(() => {
  const ov = document.getElementById('gate-overlay');
  let saved = null;
  try { saved = sessionStorage.getItem('vfrUnlocked'); } catch (e) { saved = null; }
  return { locked: window.gateLocked, shown: getComputedStyle(ov).display !== 'none',
           z: +getComputedStyle(ov).zIndex, msg: document.getElementById('gate-msg').textContent, saved };
});

export async function run(page, t) {
  const url = page.url();
  const browser = page.context().browser();
  const tab = await browser.newPage();
  await tab.goto(url); await ready(tab);
  const s0 = await state(tab);
  t.ok(s0.locked && s0.shown && s0.z > 100000, `처음 열면 비밀번호 화면이 앱을 덮는다 (z ${s0.z})`);

  // 잠겨 있는 동안 키보드는 뒤의 앱에 닿지 않는다(트림·단축키 등)
  const leak = await tab.evaluate(() => {
    let got = 0; const f = () => got++;
    document.addEventListener('keydown', f);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    document.removeEventListener('keydown', f);
    return got;
  });
  t.eq(leak, 0, '잠겨 있는 동안 키보드는 앱에 닿지 않는다');

  await tab.fill('#gate-pw', 'wrong-pass'); await tab.press('#gate-pw', 'Enter');
  const s1 = await state(tab);
  t.ok(s1.locked && s1.shown && /맞지 않습니다/.test(s1.msg) && s1.saved !== '1',
    `틀리면 열리지 않는다 (${s1.msg})`);
  t.eq(await tab.inputValue('#gate-pw'), '', '틀린 글자는 지운다');

  // 맞는 비밀번호는 저장소에 적지 않는다 — 돌리는 사람이 환경 변수로 준다(VFR_GATE_PW).
  // 없으면 그 탭이 열린 것처럼 표시만 해 두고 그다음(새로고침·새로 열기)을 본다.
  const PW = process.env.VFR_GATE_PW;
  if (PW) {
    await tab.fill('#gate-pw', PW); await tab.click('#gate-ok');
    const s2 = await state(tab);
    t.ok(!s2.locked && !s2.shown && s2.saved === '1', '맞는 비밀번호면 열린다');
  } else {
    await tab.evaluate(() => sessionStorage.setItem('vfrUnlocked', '1'));
  }

  await tab.reload(); await ready(tab);
  const s3 = await state(tab);
  t.ok(!s3.locked && !s3.shown, '같은 탭에서 새로고침하면 다시 묻지 않는다');
  await tab.close();

  const tab2 = await browser.newPage();
  await tab2.goto(url); await ready(tab2);
  const s4 = await state(tab2);
  t.ok(s4.locked && s4.shown, '앱을 새로 열면 다시 묻는다');
  await tab2.close();

  // 비밀번호 글자는 앱 파일 어디에도 없다(SHA-256 값만 둔다)
  if (PW) {
    const files = ['index.html', ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
    t.ok(files.every(f => !fs.readFileSync(path.join(ROOT, f), 'utf8').includes(PW)),
      '비밀번호 글자는 앱 파일에 적혀 있지 않다(SHA-256 값만)');
  }
}
