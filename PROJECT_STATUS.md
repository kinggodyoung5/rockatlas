# ROCK ATLAS 작업 인수인계 및 프로젝트 현황

> 이 문서는 Codex와 Claude가 번갈아 작업하는 환경의 단일 인수인계 기준이다.
> 작업을 시작하는 AI는 사용자에게 별도 인수인계 문구를 요구하지 말고 이 파일 전체와 Git 상태를 먼저 확인한다.

## 0. 현재 상태 요약

- 마지막 갱신: 2026-07-21 KST · Claude
- 로컬 폴더: `C:\Users\SH\Documents\Codex\rock-atlas`
- 공개 기준 브랜치: `main` (GitHub Pages는 `main` 푸시 시 GitHub Actions로 자동 배포 — `.github/workflows/deploy-pages.yml`)
- 현재 개발 브랜치: `codex/taxonomy-v2` — `main`은 이 브랜치의 **순수 조상**(divergence 없음, `git merge-base --is-ancestor main codex/taxonomy-v2` = true)이라 병합 시 fast-forward로 안전하게 처리됨
- 원격 백업 브랜치: `backup/pre-taxonomy-v2-20260719`
- 원격 백업 태그: `pre-taxonomy-v2-20260719`
- 2026-07-21 있었던 일: 사용자가 GitHub Desktop에서 브랜치를 `main`으로 전환 → 우발적 stash-pop 충돌로 5개 파일에 충돌 마커가 그대로 섞여 저장됨. Claude가 stash의 각 파일 blob(git object, 충돌 마커 없는 원본)을 직접 추출해 무손실 복구. 이 과정에서 사용자가 Studio로 별도 추가한 3번째 밴드 **Kodaline**도 함께 발견·보존됨(자동 검수 파이프라인이 실제로 잘 작동한 사례 — 대표곡 2곡 자동 검증까지 완료된 상태였음).
- 커밋 3개로 정리 후 푸시 완료: `793bff3`(입고 자동화), `0e087bb`(데이터 검수), `2caa7c1`(문서). `codex/taxonomy-v2`·`main` 모두 `origin`에 동기화됨.
- **`main`에 fast-forward 병합 + 푸시 완료 → GitHub Pages 배포 성공(Actions 확인됨).** 공개 사이트가 taxonomy v2 최신 버전으로 갱신됨.
- 번들 최적화 완료: `catalog.json`을 별도 청크로 분리해 500KB 경고 해소, vendor/데이터/앱코드 캐시 분리 (커밋 `7338d35`, main 배포 완료)
- **멤버 활동연도·대표곡 감상 안내 알파벳순 보강 진행 중 — A~D, G~L, M~N 완료** (11·13·15번 항목 참고). 카탈로그에 E·F로 시작하는 밴드는 아직 없음.
- **중요 버그 수정(2026-07-21)**: 상세 페이지가 `member.activeYears`를 애초에 렌더링하지 않아서, 위 배치들에서 데이터를 넣어도 화면엔 안 보이고 있었음 — `BandDetail.tsx`에 표시 로직 추가로 해결. 지금까지 넣은 모든 활동연도가 즉시 사이트에 노출됨.
- **다음 배치: O부터.**
- `npm run validate:data` 결과: **오류 0건** (49개 밴드 전체 통과)
- 로컬 미커밋 변경 없음 (전부 커밋·푸시 완료, main 배포는 다음 확인 후 진행)

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

## 16. 작업 재개 시 첫 행동

1. `git status`·`git diff`로 위 미커밋 변경이 그대로인지 확인
2. `npm run validate:data`로 오류 0건 유지되는지 확인
3. 다음 알파벳 배치(O부터)를 이어서 진행 — 멤버 활동연도, 대표곡 감상 안내, 이미지 URL 실제 접속 확인, status·role 언어 오기재 여부(해체·사망으로 활동이 끝난 밴드는 `current`로 방치되기 쉬우니 매 밴드마다 명시적으로 확인할 것)
4. **데이터만 넣고 끝내지 말 것 — 실제 브라우저에서 상세 페이지를 열어 화면에 반영되는지 반드시 확인.** (2026-07-21에 `activeYears` 렌더링 누락을 두 배치 지나서야 발견한 전례가 있음)
5. `main` 병합·GitHub Pages 배포는 사용자가 명시적으로 요청할 때만 진행(단, 이번 세션에서 사용자가 "최신 버전으로 반영해달라"고 명시했으므로 이후에도 유사한 요청이 있으면 동일하게 처리 가능)
