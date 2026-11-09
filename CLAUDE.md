# shinesong — Claude 작업 지침

## 저장소 구분 (요청을 받으면 먼저 확인)
사용자는 두 저장소를 목적별로 나눠 쓴다. 요청이 **어느 저장소의 일인지 먼저 가린다.**

| 저장소 | 목적 | 해당 작업 예 |
|---|---|---|
| **thdenfl-source/shinesong** (이 저장소) | **모든 걸 합친 종합 시뮬레이터** | 조이스틱 직접 조종(SIM 모드), 비행 모델(토크·NR), 3D 조종석 시야·CHIN BUBBLE, 함정 착함 등 |
| **thdenfl-source/Flightsimulator** | **절차 훈련** | AIP 절차·공항 자료, CDU·FPL, HOVER PAGE, SHIP 접근 훈련 등 |

- 이 저장소는 Flightsimulator 에서 갈라져 나왔다 — 코드 구조(js/00~14, tests/)가 같고,
  Flightsimulator 에는 SIM 모드가 없다.
- 요청한 기능이 이 저장소에 없으면 Flightsimulator 에 있는지 확인하고 그쪽에서 작업한다
  (사용자가 저장소를 잘못 짚어 말하는 일이 있다).
- 두 저장소에 다 있는 기능(SHIP·PFD·CDU 등)이면 어느 쪽에 반영할지 사용자에게 묻는다.

## 항상 따를 규칙

### 작업 단위 완료 시 Push + PR 생성
**하나의 작업 단위(기능/수정 요청)가 끝났을 때** 아래 순서를 실행한다:

1. 변경 파일을 `git add` → `git commit` (의미 있는 단위로 커밋)
2. `git push -u origin claude/keen-darwin-9c4ek`
3. GitHub MCP(`mcp__github__create_pull_request`)로 PR 생성
   - owner: `thdenfl-source`
   - repo: `shinesong`
   - head: `claude/keen-darwin-9c4ek`
   - base: `main`
4. **PR 머지는 사용자가 직접 GitHub에서 수행한다. Claude는 절대 머지하지 않는다.**
   - 사용자가 GitHub에서 머지 → Actions 정상 트리거 → GitHub Pages 배포
   - Claude가 API로 머지하면 Actions가 트리거되지 않아 사이트에 미반영됨

#### PR 분할 기준 (남발 방지)
- **한 작업 요청 = 1 PR** 을 원칙으로 한다. 같은 요청에 대한 후속 미세 수정
  (오타·색상·굵기 조정 등)은 **새 PR을 만들지 말고 같은 브랜치에 커밋을 추가**한다.
- 직전 PR이 아직 머지되지 않았다면, 이어지는 수정은 그 PR에 커밋을 쌓는다.
- 서로 무관한 별개 기능일 때만 새 PR로 분리한다.

#### 후속 커밋 주의 (반영 누락 방지)
- 새 커밋을 푸시하기 전, **직전 PR이 이미 머지·종료됐는지 먼저 확인**한다.
  머지됐으면 **반드시 새 PR을 만든다.** (브랜치에만 쌓으면 main에 안 들어감)

### 테스트 실행 원칙 (시간 절약)
- 기본은 **고친 부분과 관련된 검사 묶음만** 돌린다(`node tests/run.mjs '<이름>'`, 몇 분). 통과하면 바로 PR 을 올려
  사용자가 직접 확인하게 한다. 전체 실행(약 40분)을 기다리지 않는다.
- 버튼·화면(index.html · data-act)을 건드렸으면 **'스모크' '액션 위임'** 도 함께 돌린다(1분 안팎) —
  버튼 연결이 빠진 것을 잡는다(파일 읽는 순서 때문에 appRegister 가 조용히 실패한 일이 있었다).
- 전체 실행은 비행 물리처럼 여러 기능에 두루 걸치는 큰 변경이거나 사용자가 요청할 때만 한다.
- 'SIM 모드' 는 주제별 다섯 묶음(`SIM 모드 · 1 …` ~ `· 5 …`)으로 나뉘어 있다 — 고친 주제의 묶음만 돌리고,
  다섯을 다 돌릴 때는 `JOBS=5 node tests/run.mjs 'SIM 모드'` 처럼 함께 돌린다(묶음마다 새 페이지라 서로 간섭하지 않는다).

### 캐시 버전 올리기
- 앱 파일을 고치면 `sw.js` 의 `CACHE`(vfr-flight-vNNN)와 `index.html` 스크립트 꼬리표(`js/…js?v=NNN`)를
  **같은 번호로 함께** 올린다 — `tests/check-swver.mjs` 가 둘이 다르면 실패시킨다.
  (배포 직후 새 index.html 이 브라우저 캐시의 옛 JS 와 섞여 버튼이 듣지 않는 일을 막는다)
  예: `sed -i "s/vfr-flight-v500/vfr-flight-v501/" sw.js && sed -i 's/\.js?v=500"/.js?v=501"/g' index.html`

