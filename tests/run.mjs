#!/usr/bin/env node
// VFR Flight Simulator — 회귀 테스트 러너
//   실행:  node tests/run.mjs            (전체)
//          node tests/run.mjs 홀딩 NAV   (이름으로 일부만)
// 필요:   npm i -D playwright   (라이브러리는 vendor/ 사본을 그대로 쓴다)
import { chromium } from 'playwright';
import { openApp, buildEnv } from './lib/env.mjs';
import * as smoke from './cases/smoke.mjs';
import * as coords from './cases/coords.mjs';
import * as chartcal from './cases/chartcal.mjs';
import * as hold from './cases/hold.mjs';
import * as nav from './cases/nav.mjs';
import * as actions from './cases/actions.mjs';
import * as gspd from './cases/gspd.mjs';
import * as dialog from './cases/dialog.mjs';
import * as chartview from './cases/chartview.mjs';
import * as procdata from './cases/procdata.mjs';
import * as simspd from './cases/simspd.mjs';
import * as tascalc from './cases/tascalc.mjs';
import * as brg from './cases/brg.mjs';
import * as fpwpt from './cases/fpwpt.mjs';
import * as maprot from './cases/maprot.mjs';
import * as map3d from './cases/map3d.mjs';
import * as dmearc from './cases/dmearc.mjs';
import * as dme from './cases/dme.mjs';
import * as fporder from './cases/fporder.mjs';
import * as wptcrs from './cases/wptcrs.mjs';
import * as brglbl from './cases/brglbl.mjs';
import * as directto from './cases/directto.mjs';
import * as crssync from './cases/crssync.mjs';
import * as locsta from './cases/locsta.mjs';
import * as susp from './cases/susp.mjs';
import * as layout from './cases/layout.mjs';
import * as gslope from './cases/gslope.mjs';
import * as joystick from './cases/joystick.mjs';
import * as geosearch from './cases/geosearch.mjs';
import * as simmode from './cases/simmode.mjs';
import * as ga from './cases/ga.mjs';
import * as tdown from './cases/tdown.mjs';
import * as bbtrim from './cases/bbtrim.mjs';
import * as physics2 from './cases/physics2.mjs';
import * as hocas from './cases/hocas.mjs';
import * as pfdmsg from './cases/pfdmsg.mjs';
import * as joycenter from './cases/joycenter.mjs';
import * as ship3d from './cases/ship3d.mjs';
import * as heli3d from './cases/heli3d.mjs';
import * as ralt from './cases/ralt.mjs';
import * as startapt from './cases/startapt.mjs';
import * as hdgref from './cases/hdgref.mjs';
import * as sound from './cases/sound.mjs';
import * as view3d from './cases/view3d.mjs';
import * as runway from './cases/runway.mjs';
import * as apptune from './cases/apptune.mjs';
import * as lock from './cases/lock.mjs';
import * as popout from './cases/popout.mjs';
import * as upper from './cases/upper.mjs';
import * as system from './cases/system.mjs';
import * as lower from './cases/lower.mjs';

const SUITES0 = [smoke, actions, coords, chartcal, hold, nav, gspd, dialog, chartview, procdata, simspd, tascalc, brg, fpwpt, maprot, map3d, dmearc, dme, fporder, wptcrs, brglbl, directto, crssync, locsta, susp, layout, gslope, joystick, geosearch, simmode, ga, tdown, bbtrim, physics2, hocas, joycenter, ship3d, heli3d, ralt, startapt, hdgref, sound, view3d, runway, apptune, lock, popout, upper, system, lower, pfdmsg];
// 여러 묶음으로 나뉜 검사(suites 를 내보내는 파일)는 펼친다
const SUITES = SUITES0.flatMap(m => m.suites ? m.suites : [m]);
const filter = process.argv.slice(2);

function makeT() {
  const rows = [];
  const T = {
    ok(cond, msg) { rows.push({ pass: !!cond, msg }); },
    eq(a, b, msg) { rows.push({ pass: a === b, msg: msg + (a === b ? '' : `  (실제 ${JSON.stringify(a)} ≠ 기대 ${JSON.stringify(b)})`) }); },
  };
  return [T, rows];
}

const EXE = process.env.CHROMIUM_PATH;   // 시스템 크로미움을 쓸 때
const browser = await chromium.launch({
  ...(EXE ? { executablePath: EXE } : {}),
  args: ['--no-sandbox'],
});

let total = 0, failed = 0;
try {
  buildEnv();   // Leaflet 등 사전 점검(문제가 있으면 여기서 명확히 실패)
  // JOBS=n 이면 n 개 묶음을 함께 돌린다(페이지가 따로라 서로 간섭하지 않는다 · 기본 1)
  const picked = SUITES.filter(s => !filter.length || filter.some(f => s.name.includes(f)));
  const jobs = Math.max(1, parseInt(process.env.JOBS || '1', 10) || 1);
  const runOne = async s => {
    const page = await openApp(browser, {});
    const [T, rows] = makeT();
    let err = null;
    try { await s.run(page, T); } catch (e) { err = e; }
    await page.close();
    const bad = rows.filter(r => !r.pass).length + (err ? 1 : 0);
    total += rows.length + (err ? 1 : 0); failed += bad;
    console.log(`\n${bad ? '✗' : '✓'} ${s.name}  (${rows.length - rows.filter(r => !r.pass).length}/${rows.length})`);
    rows.forEach(r => { if (!r.pass) console.log(`    ✗ ${r.msg}`); });
    if (process.env.VERBOSE) rows.forEach(r => { if (r.pass) console.log(`    ✓ ${r.msg}`); });
    if (err) console.log(`    ✗ 예외: ${err.message}`);
  };
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, picked.length || 1) }, async () => {
    while (next < picked.length) await runOne(picked[next++]);
  }));
} finally {
  await browser.close();
}

console.log(`\n${failed ? '실패' : '통과'}: ${total - failed}/${total}`);
process.exit(failed ? 1 : 0);
