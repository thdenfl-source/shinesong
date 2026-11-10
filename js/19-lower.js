// ── LOWER CONSOLE(하부 콘솔) ── 탭의 'LOWER' 로 연다. 상부 콘솔(17-upper.js)과 같은 엔진·같은 저장소를 쓴다
// (스위치 id 가 서로 달라 ovhdGet · ovhdSet · ovhdOn 으로 함께 읽고 쓴다).
// 실기 하부 콘솔 그림(⑥~⑰)대로 — 왼쪽 열: ⑰ AHRS · ⑯ AFCAU · ⑮ 비디오 컨버터 · ⑭ 비상부주 · ⑬ 호이스트 · ⑫ CPI · ⑪ PA
//                                    오른쪽 열: ⑥ FUEL · ⑦ U/VHF-AM/FM · ⑧ VHF-FM · ⑨ AVCS · ⑩ MPP · NOSE WHEEL LOCK · PARKING BRAKE
// 조작 종류: lpb(눌러 두는 사각 버튼 — 들어가면 글씨가 켜진다) · key(누르는 동안만) · lamp(표시등) · disp(표시창) 와 상부 콘솔의 것들.

const LCON_W = 1000, LCON_H = 1400;
const _lit = id => () => { try { return ovhdGet(id) === 'ARMED' || ovhdGet(id) === 1 || ovhdGet(id) === 'IN'; } catch (e) { return false; } };
const LCON_PLATES = [
  // ── 왼쪽 열 ──
  // ⑰ AHRS 패널
  { x: 10, y: 10, w: 490, h: 260, items: [
    { t: 'lbl', x: 245, y: 24, text: 'AHRS' }, { t: 'lbl', x: 245, y: 46, text: '1   |   2' },
    { t: 'lpb', id: 'ahrs1Cut', x: 60, y: 62, title: 'ON/OFF', legend: 'CUT' },
    { t: 'lpb', id: 'ahrs1Comp', x: 135, y: 62, title: 'COMP', legend: 'COMP' },
    { t: 'lpb', id: 'ahrs2Cut', x: 355, y: 62, title: 'ON/OFF', legend: 'CUT' },
    { t: 'lpb', id: 'ahrs2Comp', x: 430, y: 62, title: 'COMP', legend: 'COMP' },
    { t: 'lpb', id: 'ahrs1Dg', x: 60, y: 128, title: 'TG/MG', legend: 'DG' },
    { t: 'dim', id: 'ahrs1Hiq', x: 135, y: 128, small: true, def: 5 }, { t: 'lbl', x: 135, y: 166, text: 'HIQ', small: true },
    { t: 'lpb', id: 'ahrsTrue', x: 245, y: 128, title: 'TRIM/TRUE', legend: 'TRUE' },
    { t: 'dim', id: 'ahrs2Hiq', x: 355, y: 128, small: true, def: 5 }, { t: 'lbl', x: 355, y: 166, text: 'HIQ', small: true },
    { t: 'lpb', id: 'ahrs2Dg', x: 430, y: 128, title: 'TG/MG', legend: 'DG' },
    { t: 'rot', id: 'fcpSel', x: 70, y: 224, small: true, title: 'FCP', pos: ['1', '2'], ang: [-55, 55], def: '1' },
    { t: 'rot', id: 'ahrsSel', x: 190, y: 224, small: true, title: 'AHRS', pos: ['1', 'N', '2', 'BACKUP'], ang: [-60, 0, 60, 135], def: 'N' },
    { t: 'rot', id: 'adcSel', x: 310, y: 224, small: true, title: 'ADC', pos: ['1', 'N', '2', 'BACKUP'], ang: [-60, 0, 60, 135], def: 'N' },
    { t: 'dim', id: 'ahrsDim', x: 420, y: 224, small: true, title: 'DIM', lo: 'OFF', hi: 'BRT', def: 7 },
  ]},
  // ⑯ 자동비행 조종 보조장치(AFCAU)
  { x: 10, y: 280, w: 490, h: 190, items: [
    { t: 'br', x: 18, y: 20, w: 274, text: 'AUTO TRIM' }, { t: 'br', x: 304, y: 20, w: 170, text: 'TRIM FEEL' },
    { t: 'lpb', id: 'atYaw', x: 60, y: 80, w: 64, h: 40, title: 'YAW', legend: 'OFF' },
    { t: 'lpb', id: 'atRoll', x: 150, y: 80, w: 64, h: 40, title: 'ROLL', legend: 'OFF' },
    { t: 'lpb', id: 'atPitch', x: 240, y: 80, w: 64, h: 40, title: 'PITCH', legend: 'OFF' },
    { t: 'lpb', id: 'tfCol', x: 345, y: 80, w: 64, h: 40, title: 'COL', legend: 'REL' },
    { t: 'lpb', id: 'tfCyc', x: 432, y: 80, w: 64, h: 40, title: 'CYC', legend: 'REL' },
    { t: 'lpb', id: 'ap1', x: 60, y: 156, w: 64, h: 40, title: 'AP1', legend: 'OFF' },
    { t: 'lpb', id: 'ap2', x: 150, y: 156, w: 64, h: 40, title: 'AP2', legend: 'OFF' },
    { t: 'lpb', id: 'rotAp1', x: 240, y: 156, w: 64, h: 40, title: 'ROT AP1', legend: 'ROT' },
    { t: 'lpb', id: 'rotAp2', x: 345, y: 156, w: 64, h: 40, title: 'ROT AP2', legend: 'ROT' },
    { t: 'lpb', id: 'bFltTst', x: 432, y: 156, w: 64, h: 40, title: 'B FLT TST', legend: 'OFF' },
  ]},
  // ⑮ 비디오 컨버터 제어패널
  { x: 10, y: 480, w: 490, h: 140, items: [
    { t: 'key', id: 'vcMap', x: 60, y: 45, label: 'MAP' }, { t: 'key', id: 'vcEsc', x: 132, y: 45, label: 'ESC' },
    { t: 'key', id: 'vcCom', x: 60, y: 100, label: 'COM' }, { t: 'key', id: 'vcTfc', x: 132, y: 100, label: 'TFC' },
    { t: 'dim', id: 'vcKnob', x: 245, y: 72, def: 5 },
    { t: 'key', id: 'vcClr', x: 358, y: 45, label: 'CLR' }, { t: 'key', id: 'vcFnc', x: 430, y: 45, label: 'FNC' },
    { t: 'key', id: 'vcWxr', x: 358, y: 100, label: 'WXR' }, { t: 'key', id: 'vcTws', x: 430, y: 100, label: 'TWS' },
  ]},
  // ⑭ 비상부주(EMERG FLOATS) 제어패널
  { x: 10, y: 630, w: 490, h: 200, items: [
    { t: 'tg', id: 'fltArmSw', x: 62, y: 92, title: 'EMERG\nFLOATS', pos: ['ARMED', 'OFF'], def: 'OFF' },
    { t: 'br', x: 130, y: 26, w: 110, text: 'LH' }, { t: 'br', x: 262, y: 26, w: 110, text: 'RH' }, { t: 'lbl', x: 251, y: 28, text: 'BTL', small: true },
    { t: 'lamp', x: 160, y: 62, label: '1', lit: () => _lit('fltTest')() }, { t: 'lamp', x: 212, y: 62, label: '2', lit: () => _lit('fltTest')() },
    { t: 'lamp', x: 292, y: 62, label: '1', lit: () => _lit('fltTest')() }, { t: 'lamp', x: 344, y: 62, label: '2', lit: () => _lit('fltTest')() },
    { t: 'lamp', x: 160, y: 106, label: '1', lit: () => _lit('fltTest')() }, { t: 'lamp', x: 212, y: 106, label: '2', lit: () => _lit('fltTest')() },
    { t: 'lamp', x: 292, y: 106, label: '1', lit: () => _lit('fltTest')() }, { t: 'lamp', x: 344, y: 106, label: '2', lit: () => _lit('fltTest')() },
    { t: 'lbl', x: 252, y: 62, text: 'FWD', small: true }, { t: 'lbl', x: 252, y: 106, text: 'AFT', small: true },
    { t: 'lpb', id: 'floatArm', x: 186, y: 162, w: 60, h: 40, legend: 'FLOAT\nARM' },
    { t: 'key', id: 'fltTest', x: 300, y: 162, w: 60, h: 40, label: 'TEST' },
    { t: 'guard', id: 'floatDeploy', x: 432, y: 120, title: 'FLOAT', pos: ['NORM', 'DEPLOY'], def: 'NORM' },
  ]},
  // ⑬ 호이스트 제어패널
  { x: 10, y: 840, w: 490, h: 190, items: [
    { t: 'guard', id: 'cableCut', x: 110, y: 120, title: 'CABLE CUT', hazard: true, pos: ['NORM', 'CUT'], def: 'NORM' },
    { t: 'tg', id: 'hoistOvr', x: 265, y: 120, title: 'PILOT\nOVERRIDE', pos: ['UP', 'OFF', 'DOWN'], def: 'OFF' },
    { t: 'tg', id: 'hoistEnable', x: 395, y: 120, title: 'HOIST\nENABLE', pos: ['ON', 'OFF'], def: 'OFF' },
  ]},
  // ⑫ CPI CONTROLLER 패널
  { x: 10, y: 1040, w: 490, h: 110, items: [
    { t: 'guard', id: 'cpiTransmit', x: 58, y: 66, title: 'TRANSMIT', hazard: true, pos: ['NORM', 'XMIT'], def: 'NORM' },
    { t: 'key', id: 'cpiTxTest', x: 160, y: 58, w: 58, label: 'TX/TEST' },
    { t: 'lpb', id: 'cpiReset', x: 245, y: 58, w: 62, h: 38, legend: 'TEST/\nRESET' },
    { t: 'key', id: 'cpiBeacon', x: 330, y: 58, w: 58, label: 'BEACON\nARM' },
    { t: 'guard', id: 'cpiArmed', x: 432, y: 66, title: 'ARMED', hazard: true, pos: ['NORM', 'ARM'], def: 'NORM' },
    { t: 'lbl', x: 245, y: 96, text: 'CPI CONTROLLER', small: true },
  ]},
  { x: 10, y: 1160, w: 490, h: 80, items: [] },
  { x: 10, y: 1250, w: 490, h: 70, items: [] },
  // ⑪ 대지방송장비(PA)
  { x: 10, y: 1330, w: 490, h: 60, items: [
    { t: 'dim', id: 'paVol', x: 45, y: 30, small: true, def: 5 },
    { t: 'key', id: 'pa1', x: 120, y: 30, w: 46, h: 28 }, { t: 'key', id: 'pa2', x: 175, y: 30, w: 46, h: 28 }, { t: 'key', id: 'pa3', x: 230, y: 30, w: 46, h: 28 },
    { t: 'key', id: 'pa4', x: 305, y: 30, w: 46, h: 28 }, { t: 'key', id: 'pa5', x: 360, y: 30, w: 46, h: 28 },
    { t: 'dim', id: 'paVol2', x: 445, y: 30, small: true, def: 5 },
  ]},
  // ── 오른쪽 열 ──
  // ⑥ FUEL 패널
  { x: 510, y: 10, w: 480, h: 280, items: [
    { t: 'lbl', x: 24, y: 70, text: 'F', small: true }, { t: 'lbl', x: 24, y: 86, text: 'U', small: true }, { t: 'lbl', x: 24, y: 102, text: 'E', small: true }, { t: 'lbl', x: 24, y: 118, text: 'L', small: true },
    { t: 'rot', id: 'xFeed', x: 240, y: 62, small: true, title: 'X-FEED', pos: ['ENG1', 'OFF', 'ENG2'], ang: [-70, 0, 70], def: 'OFF' },
    { t: 'tg', id: 'bp1', x: 85, y: 128, title: 'FT1', pos: ['BP1', 'OFF'], def: 'BP1' },
    { t: 'rot', id: 'xferSel', x: 240, y: 150, small: true, title: 'XFER', pos: ['OFF', 'LH', 'AUTO', 'RH'], ang: [-115, -65, 0, 70], def: 'AUTO' },
    { t: 'tg', id: 'bp2', x: 395, y: 128, title: 'FT2', pos: ['BP2', 'OFF'], def: 'BP2' },
    { t: 'tg', id: 'aux1Xfer', x: 85, y: 238, title: 'AUX1 XFER', pos: ['ON', 'AUTO', 'OFF'], side: true, def: 'AUTO' },
    { t: 'tg', id: 'f5Xfer', x: 240, y: 238, title: 'F5 XFER', pos: ['ON', 'AUTO', 'OFF'], side: true, def: 'AUTO' },
    { t: 'tg', id: 'aux2Xfer', x: 395, y: 238, title: 'AUX2 XFER', pos: ['ON', 'AUTO', 'OFF'], side: true, def: 'AUTO' },
  ]},
  // ⑦ U/VHF-AM/FM 제어패널
  { x: 510, y: 300, w: 480, h: 250, items: [
    { t: 'disp', x: 40, y: 22, w: 400, h: 70, text: '121.500  AM\nPRE 01   SQ ON' },
    { t: 'dim', id: 'uvhfVol', x: 60, y: 190, title: 'PUSH ON', def: 5 },
    ...[['1', '2', '3', '4'], ['5', '6', '7', '8'], ['9', '0', 'CLR', 'ENT']].flatMap((row, r) =>
      row.map((lb, c) => ({ t: 'key', id: `uvhfK${lb}`, x: 160 + c * 64, y: 132 + r * 44, w: 54, h: 32, label: lb }))),
    { t: 'dim', id: 'uvhfSel', x: 420, y: 190, title: 'PUSH ENTER', def: 5 },
  ]},
  // ⑧ VHF-FM 제어패널
  { x: 510, y: 560, w: 480, h: 120, items: [
    { t: 'disp', x: 28, y: 18, w: 210, h: 46, text: '30.000 FM' },
    ...[0, 1, 2, 3].map(i => ({ t: 'dim', id: `vhfK${i}`, x: 52 + i * 58, y: 92, small: true, def: 5 })),
    { t: 'key', id: 'vhfB1', x: 300, y: 40, w: 40, h: 28 }, { t: 'key', id: 'vhfB2', x: 352, y: 40, w: 40, h: 28 },
    { t: 'key', id: 'vhfB3', x: 404, y: 40, w: 40, h: 28 }, { t: 'key', id: 'vhfB4', x: 352, y: 88, w: 40, h: 28 },
    { t: 'key', id: 'vhfB5', x: 404, y: 88, w: 40, h: 28 },
  ]},
  // ⑨ AVCS 패널
  { x: 510, y: 690, w: 480, h: 120, items: [
    { t: 'lbl', x: 40, y: 62, text: 'AVCS' },
    { t: 'lpb', id: 'avcsStatus', x: 170, y: 72, w: 60, h: 46, title: 'STATUS', legend: '' },
    { t: 'lpb', id: 'avcsPower', x: 330, y: 72, w: 60, h: 46, title: 'POWER', legend: '' },
  ]},
  // ⑩ MPP 패널
  { x: 510, y: 820, w: 480, h: 290, items: [
    { t: 'lbl', x: 30, y: 140, text: 'MPP' },
    ...['RADAR', 'EGPWS', 'DMM', 'SPARE', 'SPARE'].map((n, i) =>
      ({ t: 'lpb', id: `mpp${i}`, x: 100 + i * 78, y: 70, w: 64, h: 46, title: n, legend: n === 'SPARE' ? '' : 'ON' })),
    { t: 'lpb', id: 'mpp5', x: 100, y: 150, w: 64, h: 46, title: 'SPARE', legend: '' },
    { t: 'lpb', id: 'mpp6', x: 178, y: 150, w: 64, h: 46, title: 'SPARE', legend: '' },
    { t: 'mom', id: 'xpdrIdent', x: 92, y: 248, title: 'ATC XPDR\nIDENT', pos: ['NORM', 'IDENT'], def: 'NORM', topLbl: '' },
    { t: 'lpb', id: 'com2', x: 205, y: 248, w: 64, h: 46, title: 'COM2', legend: '' },
    { t: 'br', x: 278, y: 196, w: 180, text: 'RADAR' },
    { t: 'lpb', id: 'radarScnr', x: 322, y: 248, w: 64, h: 46, title: 'SCNR', legend: '' },
    { t: 'lpb', id: 'radarTx', x: 412, y: 248, w: 64, h: 46, title: 'TX', legend: '' },
  ]},
  // NOSE WHEEL LOCK · PARKING BRAKE
  { x: 510, y: 1120, w: 480, h: 270, items: [
    { t: 'lbl', x: 120, y: 30, text: 'NOSE WHEEL LOCK' },
    { t: 'lv', id: 'noseLock', x: 120, y: 92, ys: [0, 120], pos: ['UNLOCK', 'LOCK'], def: 'LOCK' },
    { t: 'lbl', x: 200, y: 92, text: 'UNLOCK', small: true }, { t: 'lbl', x: 200, y: 212, text: 'LOCK', small: true },
    { t: 'lbl', x: 360, y: 30, text: 'PARKING BRAKE' },
    { t: 'lv', id: 'parkBrake', x: 360, y: 92, ys: [0, 120], pos: ['REL', 'ON'], def: 'REL' },
    { t: 'lbl', x: 285, y: 92, text: 'REL', small: true }, { t: 'lbl', x: 285, y: 212, text: 'ON', small: true },
    { t: 'lbl', x: 438, y: 144, text: 'EMER', small: true }, { t: 'lbl', x: 438, y: 160, text: 'PARK', small: true },
  ]},
];

consoleRegister('lcon', { wrap: 'lcon-wrap', plates: LCON_PLATES, W: LCON_W, H: LCON_H });
function lconShow() { consoleBuild('lcon'); consoleFit('lcon'); }
try {
  const w = document.getElementById('lcon-wrap');
  if (w && !w.classList.contains('page-hidden')) lconShow();
} catch (e) { _swallow(e); }

// ── 시뮬레이터 연동 ──
// PARKING BRAKE → SIM 파킹 브레이크(14-simmode.js simParkBrake — 스페이스 두 번으로도 바뀐다)
function lconSyncPark() {
  try { if (typeof simParkBrake !== 'undefined') simParkBrake = ovhdGet('parkBrake') === 'ON'; } catch (e) { _swallow(e); }
}
ovhdOn(id => {
  if (id === 'parkBrake') lconSyncPark();
  // FUEL 패널 · AFCAU AP1/AP2 → SYSTEM 창(Fuel · Aircraft Status · AFCS) 다시 그리기
  try { if (typeof sysDraw === 'function') sysDraw(); } catch (e) { _swallow(e); }
});
lconSyncPark();
