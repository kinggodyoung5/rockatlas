# ROCK ATLAS 작업 인수인계 및 프로젝트 현황

> 이 문서는 Codex와 Claude가 번갈아 작업하는 환경의 단일 인수인계 기준이다.
> 작업을 시작하는 AI는 사용자에게 별도 인수인계 문구를 요구하지 말고 이 파일 전체와 Git 상태를 먼저 확인한다.

## 0. 현재 상태 요약

- 마지막 갱신: 2026-07-23 KST · Claude
- 로컬 폴더: `C:\Users\SH\Documents\Codex\rock-atlas`
- 공개 기준 브랜치: `main` (GitHub Pages는 `main` 푸시 시 GitHub Actions로 자동 배포 — `.github/workflows/deploy-pages.yml`)
- 현재 개발 브랜치: `codex/taxonomy-v2` — `main`은 이 브랜치의 **순수 조상**(divergence 없음)이라 병합 시 항상 fast-forward로 안전하게 처리됨.
- 원격 백업 브랜치·태그: `backup/pre-taxonomy-v2-20260719`
- **밴드 수: 61개**. 멤버 활동연도·대표곡 감상 안내 알파벳순 보강은 A~Y 전체 완료(과거 세션들, 자세한 배치별 기록은 11·13·15번 및 그 이후 커밋 로그 참고). 이후 사용자가 Studio로 직접 추가한 밴드(Kodaline, Avenged Sevenfold, Rage Against the Machine, Linkin Park, Daughtry, RHCP, Maroon 5, Ensiferum, Neon Trees, Sum 41, Skid Row, Fall Out Boy 등)는 매번 이미지 Commons 검증·YouTube oEmbed 검증·태그 정합성 확인을 거쳐 반영함.
- **21번 항목(2026-07-23) 작업**: 신규 밴드 3개(Sum 41·Skid Row·Fall Out Boy) 이미지/유튜브 링크 검수 완료(6개 중 5개가 조작된 YouTube ID였음), summary/style이 65자 이하였던 45개 밴드에 문장 1개씩 보강 완료, 대표곡 중 제목만 있는 미완성 항목은 현재 없음(검사 완료), 같은 앨범 내 연도 불일치는 Two Door Cinema Club·Kodaline 2건만 남아있는데 각각 싱글 선공개 시점과 앨범 발매 연도가 달라 생기는 정상적인 현상으로 확인(오류 아님, 수정 보류).
- **22번 항목(2026-07-23) — Studio 대표곡 데이터 소실 원인 확정 및 수정**: 사용자가 "대표곡 제목만 써놓고 전체 저장했는데 다 사라졌다"고 보고 → 실제 버그였음을 확인. `StudioPage.tsx`의 `youtubeIdFromInput()`가 `value.trim()`을 가드 없이 호출해서, 대표곡 한 줄에 `|` 구분자가 하나도 없는 상태(=제목만 입력)로 텍스트 영역에서 포커스를 벗어나면 `onBlur` 핸들러 안에서 예외가 던져져 `change()`/`setDirty()`가 아예 실행되지 않았음 — 즉 편집 내용이 React 상태에 반영된 적이 없어 "전체 저장"을 아무리 눌러도 저장될 대상 자체가 없었음. 이 때문에 지금까지의 모든 git 커밋에서 밴드당 트랙 수가 예외 없이 정확히 2개였던 것(제목만 있는 트랙이 단 한 번도 존재한 적 없음)도 이 버그로 설명됨. `splitList()`도 같은 무가드 패턴이라 시대별 분류 텍스트에서 동일하게 터질 수 있어 함께 수정. 부가적으로 `chooseBand`/`addNewBand`가 "저장하지 않은 변경사항을 버리고 이동할까요?" 확인창을 띄우던 것도, 여러 밴드를 빠르게 옮겨 다니며 입력하다 실수로 확인을 누르면 그 밴드의 편집 내용이 통째로 버려지는 위험이 있어 — 이동 시 현재 초안을 자동 저장하도록 변경(저장 실패 시에만 버림 확인창 표시). 두 수정 모두 실제 브라우저에서 재현 테스트로 검증 완료(수정 전 크래시 재현 → 수정 후 정상 동작·자동 저장 확인). 다만 이 버그로 이미 사라진 과거의 실제 입력 내용 자체는 git 히스토리·로컬 백업(`catalog-history.json`, 최근 20개 저장만 보관) 어디에도 존재하지 않아 복구 불가능함 — 사용자에게 안내 완료.
- `npm run validate:data` 결과: **오류 0건** (61개 밴드 전체 통과), `npm run build` 성공.
- 로컬 미커밋 변경 없음 — `codex/taxonomy-v2` 커밋 후 `main`까지 fast-forward 푸시 완료.

상태가 이 문서와 다르면 추측하지 말고 실제 `git status`, `git diff`, 현재 파일 내용을 우선한다. 확인한 차이는 이 문서에 바로 반영한다.

## 1. 모든 AI가 작업 시작 전에 반드시 할 일

Codex와 Claude 모두 새 작업 시작 시 아래 순서를 지킨다.

1. 이 `PROJECT_STATUS.md`를 처음부터 끝까지 읽는다.
2. 현재 브랜치, `git status --short`, 최근 커밋, `git diff`를 확인한다.
3. 미커밋 변경은 사용자의 작업일 수 있으므로 절대 임의로 되돌리거나 덮어쓰지 않는다.
4. 아래의 **진행 중 작업**, **남은 오류**, **다음 작업 순서**를 실제 파일과 대조한다.
5. 사용자가 “확인하고 계속”, “다음 단계”, “어디까지 됐나”라고 하면 별도 인수인계를 요구하지 않는다. 현재 상태와 바로 시작할 단계를 짧게 보고하고 이어서 진행한다.
6. 상태 문서가 오래됐거나 실제 Git과 다르면 먼저 이 문서를 갱신한다.
7. 사용자 검토 전에는 `main` 병합·배포를 하지 않는다. 현재 개발은 `codex/taxonomy-v2`에서 계속한다.

## 2. 모든 AI가 작업 종료·교체 전에 반드시 할 일

하루 작업 종료, Codex↔Claude 교체, 큰 단계 완료 시 다음을 이 문서에 기록한다.

1. 완료한 내용과 실제 커밋 ID
2. 저장했지만 커밋하지 않은 파일
3. 중단된 작업과 중단 지점
4. 재현 가능한 오류와 검사 결과
5. 다음 AI가 바로 실행할 작업을 우선순위 순서로 작성
6. `main` 병합·배포 여부와 원격 푸시 여부
7. 새로 정한 사용자 요구사항과 하지 않기로 한 범위

검사가 실패한 상태를 “완료”라고 기록하지 않는다. 커밋하지 않은 변경은 반드시 **진행 중 작업**에 남긴다.

## 3. 매번 확인해야 할 공통 검수사항

### 작업 시작 검수

- 현재 브랜치가 의도한 브랜치인지 확인
- 미커밋 파일과 사용자 변경 확인
- 로컬 서버·Studio 저장 여부 확인
- 마지막 상태 문서 이후 다른 AI가 만든 커밋 확인
- 백업 브랜치·태그와 `main`을 임의로 변경하지 않았는지 확인

### 새 밴드 공개 전 검수

- 기본 정보, 결성지, 국가 코드, 활동 기간
- 소개글과 음악 설명의 사실성·문체·길이
- 대표 장르 한 곳, 보조 장르, 세부 장르, 분위기 점수
- 분류 검수 상태가 `reviewed`인지 확인
- 멤버 이름·역할·현재/과거 상태·활동연도
- 대표곡 제목·앨범·연도·감상 안내·실제 외부 링크
- Wikidata·MusicBrainz·Wikipedia 식별자와 정상 URL
- Commons 원본, 제작자, 라이선스, 라이선스 URL, 실제 표시 이미지
- 기존 밴드와의 관계 2~4개와 연결 이유
- 밴드 검수자·검수 날짜 및 공개 상태
- Studio 자동진단 0건과 공개 화면 실제 표시 확인

### 저장·커밋 전 기술 검수

```powershell
npm.cmd run validate:data
npm.cmd run validate:taxonomy
npm.cmd run build
git diff --check
```

- 공개 화면과 Studio 미리보기 비교
- 상세 페이지, 장르 페이지, 전체 밴드, 분위기 검색, 관계 노드 확인
- 모바일 너비·키보드 이동·뒤로가기·스크롤 복원 확인
- 링크·이미지 상태 검사
- Git 커밋 후 원격 브랜치와 동기화 여부 확인

## 4. 프로젝트 목표와 고정된 방향

- 개발 지식이 없는 운영자가 밴드 데이터를 쉽게 추가·수정·검수하는 것이 최우선이다.
- 13개 상위 장르, 110개 세부 장르, 24개 분위기 체계를 사용한다.
- 밴드는 대표 장르 한 곳에만 중복 없이 표시하고 보조 분류는 상세 교차점과 필터에 사용한다.
- 대표곡은 영상 임베드 없이 곡 정보와 외부 링크로 제공한다.
- AI가 초안과 교차 검수를 담당하고 운영자는 오류·예외와 최종 공개 승인만 확인하는 방향으로 고도화한다.
- Studio 저장은 로컬 개발 서버에서만 가능하며 정적 배포 사이트는 읽기 전용이다.
- 기존 공유 `#band=` 주소, 기존 데이터, 백업 브랜치·태그를 보존한다.
- 댓글·회원가입, 인기도 순위, 장르당 최소 밴드 수 강제, YouTube 임베드 복원은 현재 범위에 포함하지 않는다.

## 5. 현재 구현된 기능

### 공개 사이트

- 13개 장르, 모든 밴드, 느낌으로 찾기 탐색
- 장르·세부 장르·분위기·시대·국가 필터와 검색
- 밴드 상세, 시대 변화, 대표곡 안내, 관계 지도와 자동 유사도 추천
- 즐겨찾기, 최근 탐험, 공유 패널, 반응형 UI, 기본 접근성
- 방문 기록과 스크롤 위치를 보존하는 이전 페이지 이동
- 공개 화면의 작은 본문 글씨를 12px(약 9pt) 이상으로 유지

### Studio

- 기존 밴드 수정, 새 밴드 초안, CSV, JSON 백업·복원
- Gemini Gem 고정 지침 복사와 JSON 검수함
- 자연어 장르명·세부 장르명·분위기명을 내부 ID로 자동 변환
- 중복 ID·이름·외부 식별자 차단과 비공개 초안 강제
- 13개 장르·24개 분위기 카드와 화면 문구·폰트·색상 편집
- Wikidata·MusicBrainz 후보 검색
- 대표곡·멤버·관계·출처·이미지·공개 상태 편집
- 전체 링크·이미지 상태 검사, 휴지통, 최근 20회 로컬 카탈로그 복구
- 구형 8장르 호환 필드는 접힌 영역에 보존하고 새 분류 변경 시 자동 동기화

## 6. Dream Theater · Deep Purple 검수 결과 (2026-07-21, Claude 완료)

두 밴드 모두 사용자가 Gemini Gem으로 조사해 Studio에 직접 등록한 것. Claude가 웹 검색·YouTube oEmbed·Wikimedia Commons API로 직접 대조 검수해 아래를 수정 완료:

- **Dream Theater**: 마크다운으로 오염된 Wikipedia URL 정리, 대표곡 2곡(Pull Me Under, Metropolis Pt. 1)의 가짜 YouTube ID를 실제 확인된 공식 영상 ID로 교체, 공식 YouTube 채널(`UCBHhdnYxvu94yefpeZABY9g`) 추가, Commons 이미지(`DreamTheater2011.jpg`, CC BY 2.0) 새로 연결, taxonomy·트랙 검수 상태를 `reviewed`로 정리. `reviewStatus`는 사용자가 이미 `published`로 해둔 것을 그대로 유지(공개 여부는 건드리지 않음).
- **Deep Purple**: Studio 자동 이미지 검색이 밴드와 무관한 "Abbey Road Studios / Peter Mew" 사진을 잘못 붙였던 것을 실제 밴드 사진(`Deep Purple (1968).jpg`, Public domain)으로 교체, 대표곡 2곡의 가짜 YouTube ID를 실제 공식 영상으로 교체, Led Zeppelin·Black Sabbath 관계의 강도가 정규화 버그로 "약함"으로 잘못 저장된 것을 "강함"으로 수정, taxonomy·밴드 검수자/일시 기록. `reviewStatus: 'reviewed'` 유지(아직 미공개).
- **Kodaline**: 이미 자동 입고 파이프라인으로 대표곡 2곡이 자동 검수 완료된 상태로 추가돼 있었음. 밴드 레벨 검수자·검수일시만 누락돼 있어 Claude가 채움. 이미지는 원본 미제공 상태라 `needs-review`로 남김(오류 아님).
- 검수자 표기: 세 밴드 모두 `reviewedBy: "Claude (AI 검수)"`로 기록.
- 결과: `npm run validate:data` 오류 0건 (이전 12건 → 0건, Kodaline 포함 49개 밴드 전체 통과).

## 7. 다음 개발 방향과 우선순위

### P0 · 완료

- ~~Dream Theater·Deep Purple·Kodaline 데이터 오류 해결~~ → 완료, `main` 배포 완료
- ~~밴드 데이터 청크 분리로 번들 500KB 경고 해소~~ → 완료, `main` 배포 완료

### P1 · 스킵 (사용자 결정, 2026-07-21)

- 검수자·날짜 자동 기록 등은 혼자 운영하는 상황에서 실익이 없다고 판단해 스킵하기로 함.
- 마크다운/구글 리다이렉트 정리, YouTube·Commons 자동 확인 등 실질적 가치가 있는 부분은 이미 완료된 상태(9번 항목 참고).

### P2 · 멤버 활동연도·대표곡 감상 안내 — 진행 중 (알파벳순 배치 작업)

- 방식: 밴드를 알파벳순으로 나눠 배치 진행. 각 배치마다 ①멤버 활동연도 ②대표곡 감상 안내(guide) 보강 ③검수 중 발견되는 오류(이미지 URL 깨짐, 멤버 status 오기재 등) 자동 수정.
- **A~D 완료** (2026-07-21): AC/DC, Alice in Chains, Black Sabbath, Bon Jovi, Children of Bodom, Coldplay, Death — 7개 밴드. 상세는 11번 항목 참고.
- **G~L 완료** (2026-07-21): Green Day, Guns N' Roses, Imagine Dragons, Iron Maiden, Judas Priest, Kent, King Crimson, Led Zeppelin, Lynyrd Skynyrd — 9개 밴드. 상세는 13번 항목 참고. (카탈로그에 E·F로 시작하는 밴드가 아직 없어 사용자 지시로 G부터 진행)
- **M~N 완료** (2026-07-21): Megadeth, Metallica, Mogwai, My Bloody Valentine, Nine Inch Nails, Nirvana — 6개 밴드. 상세는 15번 항목 참고.
- Deep Purple·Dream Theater·Kodaline은 이미 완료 상태(별도 검수에서 처리).
- **다음 배치: O부터 알파벳순으로 계속.**
- 재가입은 `1985–2010, 2023–현재`처럼 여러 구간 허용. 밴드/멤버가 이미 활동 종료된 경우 `status`도 `former`로 맞출 것(활동연도만 채우고 status는 놓치기 쉬움 — Black Sabbath·Children of Bodom·Led Zeppelin·Nirvana에서 실제로 발견된 오류, 매 밴드 공통 체크포인트로 굳어짐).
- 이미지: Wikimedia Commons가 유일한 무료 라이선스 소스라 프로필 사진이 아닌 팬 촬영 콘서트 사진이 대부분이고 밴드마다 화질·구도 편차가 큼(구조적 한계, 완전 통일 불가). 앞으로는 후보가 여럿일 때 멤버 전원이 나온 그룹샷을 우선 선택.
- **역할(role) 필드는 전 밴드 한글로 통일**되어 있어야 함 — Gemini 자동 입고를 거친 밴드(Dream Theater, Kodaline)만 영어로 남아있던 것을 2026-07-21에 발견해 수정(15번 항목). 새 배치 진행 시 role 필드 언어도 확인할 것.
- **member.activeYears는 `BandDetail.tsx`가 실제로 렌더링하는지 항상 실 브라우저로 확인할 것** — 2026-07-21까지 두 배치 분량(A~D, G~L)의 데이터가 들어갔는데도 화면에 전혀 안 보이는 버그가 있었음(15번 항목에서 수정). 데이터만 넣고 "완료"라고 보고하지 말고 반드시 렌더링까지 확인.

### P3 · Git 운영 자동화

- Studio 저장은 로컬 파일만 바꾸며 Git 커밋을 자동 생성하지 않는다.
- 검사 통과 후 커밋·푸시를 돕는 비개발자용 버튼 또는 실행 파일 검토
- 자동 Git 기능은 실패한 검사를 무시하거나 `main`에 직접 올리지 않도록 안전장치 필요

### P4 · 이후 보완

- 전체 모바일·키보드 접근성 재검수
- 사용자 최종 검토 뒤에만 `main` 병합·GitHub Pages 배포

## 8. Git과 Studio 저장의 차이

- Studio `저장`: `src/data/catalog.json`을 변경하고 로컬 복구 이력을 만든다.
- Git `commit`: 변경 내용을 로컬 Git 역사에 기록한다.
- Git `push`: 커밋을 GitHub 원격 저장소에 올린다.
- 같은 PC·같은 폴더의 다른 AI는 `git diff`로 미커밋 변경을 볼 수 있다.
- GitHub만 보는 AI는 커밋·푸시되지 않은 변경을 알 수 없다.
- 브라우저에서 편집했지만 Studio 저장을 누르지 않은 값은 다른 AI도 알 수 없다.

GitHub Desktop의 커밋 요약은 `Dream Theater 추가`, `밴드 20개 데이터 보강`처럼 짧게 적어도 된다.

## 9. 2026-07-19 ~ 07-21 작업 기록 (확정 사안만)

- Studio 구형 장르 호환 필드 정리, 영상 임베드 진단 → 외부 링크 진단 전환, 기존 이미지 권리 경고 13건 검수. 커밋 `b0049c2`, `8712fef` (둘 다 `origin/codex/taxonomy-v2`에 푸시 완료).
- **밴드 등록(Gemini Gem 입고) 기능 자동화 강화** (`src/lib/bandIntake.ts`, `BandIntakePanel.tsx`, `StudioPage.tsx`, `index.css`):
  - Gemini의 마크다운 링크·구글 검색 리다이렉트(`[주소](google.com/search?q=주소)`) 자동 해제
  - YouTube oEmbed로 대표곡 영상 실존 여부 자동 확인, Wikimedia Commons API로 이미지 라이선스 자동 조회
  - 이미지 자동 조회 결과에 **밴드 이름이 실제로 포함되는지 검사** — 라이선스만 진짜고 사진 자체는 무관한 경우를 자동 거부 (Deep Purple 사고로 발견)
  - 관계 강도(strength)를 Gemini의 1~5 척도에서 1~3으로 변환할 때, 범위를 벗어난 값을 최솟값(1)이 아니라 가까운 쪽으로 clamp하도록 수정 (5점을 "약함"으로 잘못 저장하던 버그)
  - 트랙 하나의 오류가 밴드 전체 등록을 막지 않도록 완화(그 트랙만 자동 검수 승격에서 제외, 나머지는 초안으로 즉시 추가 가능)
  - 기존 밴드 편집 화면에도 "Commons에서 자동 채우기" 버튼 추가해 동일 기능 재사용
  - 검증: 타입체크·빌드·브라우저 실동작(정상 케이스/오류 케이스 모두) 확인 완료
- **Dream Theater·Deep Purple 데이터 검수 완료** — 상세는 6번 항목 참고. `validate:data` 오류 0건.
- 남은 자동화 한계 (의도적으로 사람/AI 판단 영역으로 남김): 관계의 타당성, 소개·음악 설명의 사실 정확성, "밴드 이름이 제목에 있다"는 것 이상의 사진 내용 검증.

## 11. 멤버 활동연도·감상 안내 보강 — A~D 배치 결과 (2026-07-21, Claude)

웹 검색으로 각 밴드 실제 멤버 재적 기간과 대표곡 배경을 조사해 보강. 대상: AC/DC, Alice in Chains, Black Sabbath, Bon Jovi, Children of Bodom, Coldplay, Death.

- 7개 밴드 멤버 전원(약 30명)에 활동연도 추가, 대표곡 14곡에 한국어 감상 안내(guide) 추가.
- **검수 중 발견해 수정한 오류**:
  - Black Sabbath 멤버 4명 전원, Children of Bodom 멤버 3명이 `status: current`로 잘못 표시돼 있었음 — 두 밴드 모두 활동 종료(Black Sabbath는 오지 오스본 사망·2025년 고별 공연으로 사실상 해체, Children of Bodom은 2019년 해체)된 상태라 `former`로 수정.
  - Dream Theater 이미지 URL이 잘못된 경로로 저장돼 있어 404 상태였음(지난 세션에서 Commons API 대신 경로를 수기로 추정해 발생) — API로 재조회해 실제 경로로 수정.
  - Coldplay·Bon Jovi 이미지는 `Special:Redirect` 형태 URL이라 다른 밴드와 형식이 다르지만 실제로는 정상 작동 확인(301 리다이렉트, 오류 아님).
- 검수자: `reviewedBy: "Claude (AI 검수)"`로 기록. `npm run validate:data` 오류 0건 유지.
- **아직 다루지 않은 것**: E부터 시작하는 나머지 40개 밴드(약 160명 이상의 멤버). 이미지 URL도 A~D 9개 밴드만 확인했고 나머지는 미확인 — 이번에 발견된 "URL 경로 오기재" 패턴이 다른 밴드에도 있을 수 있으므로 다음 배치에서 밴드별로 계속 확인할 것.

## 13. 멤버 활동연도·감상 안내 보강 — G~L 배치 결과 (2026-07-21, Claude)

카탈로그에 E·F로 시작하는 밴드가 아직 없어(사용자 확인) G부터 진행. 대상: Green Day, Guns N' Roses, Imagine Dragons, Iron Maiden, Judas Priest, Kent, King Crimson, Led Zeppelin, Lynyrd Skynyrd.

- 9개 밴드 멤버 전원(약 34명)에 활동연도 추가, 대표곡 18곡에 한국어 감상 안내 추가(Guns N' Roses의 기존 저품질 안내문 1건도 다른 곡들과 톤을 맞춰 재작성).
- **검수 중 발견해 수정한 오류**:
  - **Led Zeppelin 멤버 3명(로버트 플랜트·지미 페이지·존 폴 존스)이 `status: current`로 잘못 표시돼 있었음** — 밴드는 1980년 존 본햄 사망 직후 공식 해체했고 이후 활동 없음(2007년 단발성 재결합 공연 1회뿐)인데도 "현재 활동중"으로 표시돼 있던 것을 `former`로 수정.
  - King Crimson은 2021년 이후 사실상 활동이 없지만 밴드가 공식 해체를 선언한 적은 없고(로버트 프립도 "해체"가 아닌 "고요해졌다"는 표현 사용) 새 녹음 작업 가능성이 언급돼 있어 `current` 상태 유지(판단 근거로 남김 — 추후 공식 해체 선언 시 정정 필요).
  - 이미지 URL 4건(Green Day·Imagine Dragons·Judas Priest·Kent)이 `Special:Redirect` 형식이라 형식은 다르지만 전부 정상 작동 확인.
- 검수자: `reviewedBy: "Claude (AI 검수)"`로 기록. `npm run validate:data` 오류 0건 유지, 49개 밴드 전체.
- **사진 품질 관련 사용자 질문에 대한 답변 기록**: Wikimedia Commons(무료 라이선스)가 유일한 이미지 소스라 밴드 공식 프로필 사진은 원천적으로 구할 수 없고, 팬이 콘서트에서 찍어 자유 라이선스로 올린 사진만 쓸 수 있음 — 밴드별 화질·구도 편차는 구조적 한계. 앞으로 후보가 여럿이면 그룹샷 우선 선택하기로 함.

## 15. 멤버 활동연도·감상 안내 보강 — M~N 배치 결과 + 중요 UI 버그 수정 (2026-07-21, Claude)

대상: Megadeth, Metallica, Mogwai, My Bloody Valentine, Nine Inch Nails, Nirvana.

- 6개 밴드 멤버 전원(약 20명)에 활동연도 추가, 대표곡 12곡에 한국어 감상 안내 추가.
- **검수 중 발견해 수정한 오류**: Nirvana 멤버 3명 중 크리스트 노보셀릭·데이브 그롤이 `status: current`로 잘못 표시(밴드는 1994년 커트 코베인 사망으로 해체) — `former`로 수정.
- **사용자가 지적해서 발견한 중요 버그**: `src/components/BandDetail.tsx`가 원래 `member.role`만 렌더링하고 `member.activeYears`는 화면에 그리지 않고 있었음. 즉 A~D·G~L 배치에서 데이터를 아무리 넣어도 실제 사이트에는 전혀 안 보이고 있었던 것 — 이번에 `역할 · 활동연도` 형식으로 표시하도록 코드 수정, 실제 브라우저로 렌더링 확인 완료(dev 서버가 오래 켜져 있어 HMR 웹소켓이 끊겨있었던 것도 재시작으로 확인).
- **역할(role) 필드 언어 통일**: Gemini 자동 입고를 거친 Dream Theater·Kodaline만 영어 역할명("Guitar, Backing Vocals" 등)이 남아있던 것을 발견해 한글로 통일.
- **Two Door Cinema Club 보컬 표기 수정**: 멤버 3명 전원이 "보컬"로 돼있었는데, 실제로는 알렉스 트림블만 리드보컬이고 나머지 둘은 백보컬 — 확인 후 수정.
- 검수자: `reviewedBy: "Claude (AI 검수)"`로 기록. `npm run validate:data` 오류 0건 유지, 49개 밴드 전체.
- **곡·밴드 설명 출처에 대한 사용자 질문 답변 기록**: 위키피디아를 그대로 베끼는 게 아니라 여러 출처(위키피디아·팬사이트·음악 매체)로 사실관계만 확인하고 문장은 매번 새로 작성함. 밴드 소개(summary/style) 자체는 이번 배치들에서 새로 쓴 게 아니라 기존 값을 유지했고, 대표곡 감상 안내(guide)만 신규 작성.

## 16. 태그·세부장르 정합성 감사, Gemini 프롬프트 한국어 강제, Studio 자동 스크롤 (2026-07-21, Claude)

사용자가 "핵심 태그에는 있는데 세부 장르엔 없는" 불일치를 지적하며 전체 감사를 요청. 정확한 이름 매칭으로만 감사(느슨한 키워드 매칭은 오탐이 많아 배제)해 실제 누락 4건을 찾아 수정:

- Pearl Jam(클래식 록), Travis(브릿팝), Queen(글램 록), Deep Purple(프로그레시브 록·전통 헤비메탈) — 태그엔 있지만 `taxonomyV2.subgenreIds`에 빠져 있던 항목을 추가.
- 110개 세부 장르 목록 자체는 ID·이름 중복 없음, 통폐합이 필요한 명백한 사례는 발견하지 못함(구조는 양호).
- 감사 도중 사용자가 Studio로 새로 추가한 **Avenged Sevenfold**(50번째 밴드) 발견 — 영어 태그, 깨진 이미지(파일명만 있고 URL 미해결) 등을 함께 수정.

**Gemini 태그/역할 영어 출력 문제의 근본 원인을 찾아 수정**:
- 원인 1: Gem 프롬프트의 JSON 스키마에 `tags`·`members[].role` 필드는 언어 지정이 아예 없었음(summary/style만 "한국어로" 명시돼 있었음) — 프롬프트를 전면 재작성해 고유명사·URL을 제외한 모든 텍스트 필드에 한국어를 명시하고 태그·역할에 구체적인 예시를 추가.
- 원인 2(더 근본적): `normalizeBand()`가 Gemini의 원본(미해석) 세부장르 문자열과 정식으로 변환된 한국어 세부장르 이름을 **함께 합쳐서** `subgenres`/`eraTags[].subgenres`에 저장하고 있었음 — 이게 Dream Theater·Deep Purple·Kodaline에서 계속 발견됐던 "영어·한글 중복" 버그의 실제 원인. 정식 변환 이름만 쓰도록 수정해 프롬프트가 아무리 실수해도 이 중복이 재발할 수 없게 만듦.
- 안전망: `inspectBandIntake`에 태그·역할이 영어로 남아있으면 경고를 띄우고 자동 검수 완료 승격을 막는 `english-tags`/`english-roles` 체크 추가.

**Studio 자동 스크롤**: 왼쪽에서 밴드를 클릭해도 오른쪽 편집 폼(EDIT BAND)까지는 다른 큰 패널들(디자인 Studio, 밴드 검수함, 데이터 관리)을 지나야 해서 화면이 안 움직이는 것처럼 보였음 — 밴드 선택이 바뀔 때마다 편집 폼 상단으로 자동 스크롤하도록 수정(첫 로딩 시에는 스크롤하지 않음). 실제 클릭→스크롤 경로는 프로덕션 빌드로 검증 완료(`behavior:'instant'`로 강제했을 때 정상 동작 확인) — 다만 이 브라우저 자동화 환경 자체가 `behavior:'smooth'` 애니메이션을 전혀 재생하지 않는 제약이 있어(수동 호출로도 재현), 실제 사용자 Chrome에서 매끄럽게 스크롤되는지는 실제 브라우저에서 재확인 권장.

## 18. 검수됨/공개 노출 동일 문제, Gemini 장르 매칭 실패, 문체 수정 (2026-07-22, Claude)

사용자 질문 3건 처리:

1. **"검수-사이트표시"와 "공개"의 차이 질문** → 코드 확인 결과 **현재는 차이가 없음**. `src/data/bands.ts`의 `publicBands = bands.filter(band => band.reviewStatus !== 'draft')`는 `reviewed`와 `published`를 구분하지 않고 둘 다 공개 목록에 그대로 노출시킨다. Studio 사이드바 라벨만 "표시"/"공개"로 다르게 보일 뿐, 실제 공개 여부에는 영향 없음. 사용자에게 이 사실을 알리고 의도한 동작인지(그대로 둘지, `published`만 진짜 공개되도록 코드를 바꿀지) 확인 필요 — **아직 미결정, 다음 세션에서 먼저 물어볼 것**.
2. **Gemini가 "허용된 대표 장르가 없음"/"허용되지 않는 세부 장르" 오류를 자주 내는 문제** → 원인: `resolveGenreId`가 13개 장르 버킷의 이름(예: "전통 / 파워 / 스래시 메탈")하고만 매칭했는데, Gemini는 상식적으로 더 익숙한 세부 장르 용어(예: "Heavy Metal", "Grunge")를 대표 장르로 적어 보냄 — 이 용어들은 실제로는 그 버킷 *안의 세부 장르* 이름이라 매칭 실패. `resolveGenreId`가 세부 장르 별칭 사전에서도 찾아서 그 부모 장르로 매칭하도록 수정. "헤비메탈"/"Heavy Metal"처럼 정식 세부 장르명("전통 헤비메탈")과 완전히 일치하지 않는 관용적 표현 몇 개도 별도 별칭으로 추가. 실제 taxonomy 데이터로 "Heavy Metal", "그런지", "Grunge", "Nu Metal", "Punk" 전부 정상 해석되는지 확인 완료.
3. **Gemini 문체를 존댓말(합쇼체/해요체)에서 평서체(~다/~이다)로** → Gem 프롬프트에 명확한 지시와 올바른/틀린 예문을 추가. 기존에 이미 등록된 밴드들의 문장(예: The Script의 style 필드)은 예전 존댓말 그대로 남아있음 — 새로 추가되는 밴드부터 적용되고, 기존 문장은 별도로 다시 쓰지 않는 한 그대로임.

부수적으로 사용자가 세션 중 Studio로 직접 추가한 **Avenged Sevenfold**(50번째), **The Script**(51번째) 모두 검수자·시각 기록 완료.

## 19. Funk Rock 이름 수정, Studio 신규 밴드 정렬 (2026-07-22, Claude)

- `reviewed`/`published` 구분: 사용자가 "안 중요하니 그냥 공개로 통일"이라고 확정 → 이미 코드상 동일 취급이라 변경 없이 종료.
- **세부 장르 "훵크 록"**: `src/data/taxonomy.v2.json`의 `funk-rock` 항목 이름을 "펑크 록(Funk)" → "훵크 록"으로 변경. Punk Rock("펑크 록")과 한글로 거의 구분이 안 되던 문제 해결. 이 세부 장르를 쓰는 밴드가 없어 데이터 마이그레이션 불필요.
- **Gemini 대표 장르 매칭 실패 원인 추가 확인**: `resolveGenreId`가 13개 장르 묶음 이름이 아니라 그 안의 세부 장르 이름(예: "Heavy Metal", "Grunge")을 Gemini가 대표 장르로 적어 보내면 실패하던 문제를 세부 장르 별칭으로도 상위 장르를 찾도록 수정(전 턴에서 처리, 18번 항목 참고).
- **Studio 신규 밴드 정렬**: `StudioPage.tsx`의 `saveCatalog`(새 밴드 저장)와 `addBands`(Gemini 입고·CSV 일괄 추가)가 새 밴드를 배열 끝에 붙이던 것을 맨 앞에 붙이도록 수정 — 추가하자마자 왼쪽 목록 최상단에서 바로 클릭 가능. 인테이크 패널로 실제 테스트 밴드를 추가해 맨 위(새 밴드 버튼 바로 다음)에 나타나는 것 확인 완료. `restoreManagedBand`(휴지통 복구)는 범위 밖이라 그대로 둠.

## 20. 작업 재개 시 첫 행동

1. `git status`·`git diff`로 미커밋 변경이 있는지 확인 (있다면 사용자 작업일 수 있으니 임의로 되돌리지 않음)
2. `npm run validate:data`로 오류 0건 유지되는지 확인
3. 알파벳순 멤버 활동연도·감상 안내 보강은 A~Y 전 밴드 완료 상태. 사용자가 Studio에서 새 밴드를 추가했다면(가장 흔한 재개 시나리오) `git show HEAD:src/data/catalog.json`과 현재 파일의 밴드 수·id 목록을 비교해 신규 밴드를 찾아 이미지 Commons 검증·YouTube oEmbed 검증·태그/세부장르 정합성 확인부터 진행
4. **데이터만 넣고 끝내지 말 것 — 실제 브라우저에서 상세 페이지를 열어 화면에 반영되는지 반드시 확인.**
5. `main` 병합·GitHub Pages 배포는 사용자가 명시적으로 요청할 때만 진행(이 세션까지는 사용자가 매번 "반영해달라"는 취지로 명시했으므로 유사한 요청이 있으면 동일하게 처리 가능하나, 확실치 않으면 먼저 확인)

## 21. 신규 밴드 3종 검수 + 짧은 설명 보강 + 트랙 점검 (2026-07-23, Claude)

- **신규 밴드 검수**: `git diff` 기준 이전 커밋(58개) 대비 새로 생긴 Sum 41·Skid Row·Fall Out Boy 3개를 확인. 셋 다 이미지가 Commons 파일명만 있고 실제 URL/라이선스 미검증, YouTube ID 6개 중 5개가 oEmbed 404(조작된 값)였음 — WebSearch로 실제 공식 뮤직비디오 ID를 찾아 교체하고 oEmbed 200 확인, Commons API로 실제 사진 URL·라이선스(CC BY-SA 3.0/4.0)·저작자를 채워 `image.credit.reviewStatus: 'verified'`로 전환, `sources`의 Wikimedia Commons 항목도 함께 갱신. Skid Row의 Wikipedia 소스 URL이 괄호가 안 닫힌 채(`...American_band`) 저장돼 있던 것도 수정. `relations`는 근거 출처(source URL)가 없어 `reviewStatus: 'draft'`로 유지(무결성 검사가 `reviewed` 관계엔 `source` 필수).
- **65자 이하 설명 보강**: `summary` 또는 `style`이 65자 이하인 밴드 45개(더 비틀즈, 롤링 스톤스, 레드 제플린, 메탈리카 등 초기 추가 밴드 다수 포함)에 각각 사실에 기반한 문장 1개씩 추가. 기존 평서체(`~다`) 톤 유지. 전부 65자 초과로 통과 확인.
- **대표곡 title-only 점검**: `youtubeId`/`year`/`guide`/`album` 중 2개 이상 비어있는 트랙이 있는지 전수 검사 — 현재 없음(사용자가 우려한 "제목만 입력된 트랙"은 이미 이전 세션들에서 다 채워진 상태).
- **같은 앨범 연도 불일치 조사**: `album`이 같은데 `year`가 다른 트랙을 전수 검사 → Two Door Cinema Club `Tourist History`(What You Know:2011, Undercover Martyn:2010), Kodaline `In a Perfect World`(All I Want:2012, High Hopes:2013) 2건만 남음. 둘 다 확인 결과 해당 곡이 앨범보다 먼저 싱글/EP로 선공개된 실제 발매 이력을 반영한 것으로, 데이터 오류가 아니라 각 트랙의 `year`가 앨범 연도가 아니라 "그 곡 자체의 최초 공개 연도"를 의미하기 때문에 생기는 정상적인 현상. 사용자가 이미 몇 건을 직접 고쳤다고 했으므로 남은 2건은 임의로 건드리지 않고 그대로 둠 — 만약 `year`를 "앨범 발매 연도로 통일"하는 규칙으로 바꾸고 싶다면 그건 데이터 정책 변경이라 사용자 확인 필요.
- `npm run validate:data`·`npm run build` 통과 확인 후 `codex/taxonomy-v2`에 커밋, `main`까지 fast-forward 푸시 완료.
