# ROCK ATLAS 전면 개선 작업계획서 (2026-11-16)

> 이 문서는 앱 전체를 원점에서 재검토한 결과와, 그에 따른 구현 계획이다.
> 구현 담당 모델은 이 문서만 읽고 작업을 시작할 수 있어야 한다.
> 매 작업 전 루트의 `CLAUDE.md`·`PROJECT_STATUS.md`를 먼저 읽는 규칙은 그대로 유효하다.
> 이 문서의 수치는 전부 2026-11-16 기준 `src/data/catalog.json` 실측값이다. 작업 시작 시 부록 C의 명령으로 다시 측정한다.

## 0. 이 문서를 쓰는 방법

### 0.1 작업 단위
- 작업은 `P0-1`처럼 **단계-번호** ID로 부른다. 커밋 메시지와 `PROJECT_STATUS.md` 기록에 이 ID를 적는다.
- 각 작업에는 **대상 파일 / 변경 내용 / 완료 조건**이 있다. 완료 조건을 전부 만족해야 끝난 것이다.
- 단계는 P0 → P8 순서를 권장한다. 단계 안의 작업은 독립적이면 순서를 바꿔도 된다. 의존 관계는 각 작업에 적었다.

### 0.2 반드시 지킬 저장소 규칙
1. 작업 전 `PROJECT_STATUS.md` 전체, 현재 브랜치, `git status`, 최근 커밋, `git diff`를 확인한다.
2. 커밋되지 않은 변경은 운영자 또는 다른 에이전트의 것이다. 덮어쓰거나 되돌리지 않는다.
3. `main` 병합·배포는 운영자의 명시적 승인 없이는 하지 않는다. 개발 브랜치는 `codex/taxonomy-v2`다.
4. 커밋 메시지에 AI 공동 작성자(Co-Authored-By) 줄을 넣지 않는다. 운영자가 그렇게 정했다.
5. **`catalog.json` 직접 수정 주의**: 운영자가 Studio(`npm run studio`)를 켜 둔 상태면 자동 저장이 스크립트 수정을 덮어쓴다. 일괄 수정 전후로 파일 상단 `updatedAt`과 `git diff --stat`을 비교해 내 변경이 살아 있는지 확인한다. 가능하면 운영자에게 Studio를 닫아 달라고 한다.
6. 사실 정보(연도, 멤버, 영향 관계, 영상 ID)는 추측으로 쓰지 않는다. 외부 출처로 확인하고, 확인 못 한 것은 비워 두거나 "확인 필요"로 남긴다.
7. 작업 단위가 끝날 때마다 `PROJECT_STATUS.md`에 새 섹션을 추가한다(완료, 미완료, 검증 결과, Git 상태, 다음 단계).

### 0.3 매 작업 공통 검증 명령
```bash
npx tsc -b
npm run validate:data
npm run validate:taxonomy
npm test
npm run build
```
- `validate:data`는 현재 Wintersun 때문에 오류 1건이 난다(P0-1). 그 전까지는 "오류가 이 1건뿐인지"를 확인한다.
- UI를 바꾼 작업은 `npm run dev`로 실제 화면을 데스크톱(1280px)과 모바일(375px)에서 확인한다.

### 0.4 기술 환경 요약
- React 19 + TypeScript + Vite 7, 스타일은 `src/index.css` 단일 파일(1,409줄) + Tailwind 4.
- 정적 사이트(GitHub Pages). 서버·DB 없음. 사용자 상태는 `localStorage`.
- 데이터 원본: `src/data/catalog.json`(밴드 308, 약 6만 줄), `src/data/taxonomy.v2.json`(장르 13, 세부장르 140, 무드 24), `src/data/siteContent.json`(문구·테마).
- 공개 데이터는 `scripts/generate-public-data.ts`가 만든다: 목록용 축약 인덱스(`src/data/generated/public-band-index.json`) + 밴드별 상세(`public/data/bands/<id>.json`) + 공유용 HTML(`public/bands/<id>/index.html`).
- 로컬 전용 편집기 Studio는 Vite 플러그인 `server/studioApi.ts`가 제공하는 `/api/studio/*`를 쓴다.
- 라우팅: 목록 화면은 쿼리(`?view=bands|moods|genre`), 밴드 상세는 해시(`#band=<id>`). `src/lib/explorerRoute.ts`, `src/App.tsx`.

## 1. 현재 상태 실측 (2026-11-16)

### 1.1 규모
| 항목 | 값 |
|---|---|
| 전체 밴드 | 308 (공개 243, 초안 65) |
| 공개 밴드의 대표곡 | 741곡 |
| 공개 밴드 간 관계(방향별) | 654건 (보류 관계 27건 별도) |
| 국가 | 미국 114, 영국 83, 핀란드 8, 캐나다 8, 독일 6, 아일랜드 6, 그 외 18 |
| 결성 연대 | 60s 25, 70s 32, 80s 54, 90s 65, 00s 52, 10s 15 |
| 장르별 공개 밴드 | 인디 32, 하드/글램 27, 얼터너티브 27, 팝/소프트 25, 전통 메탈 19, 모던 메탈 19, 클래식 17, 펑크 17, 프로그 15, 포스트펑크 14, 포크/심포닉 메탈 12, 슈게이즈 12, 익스트림 메탈 7 |

### 1.2 품질 지표 (공개 243팀 기준)
| 지표 | 현재 | 문제 |
|---|---|---|
| 분류 검수 완료(`taxonomyV2.reviewStatus === 'reviewed'`) | 60팀 (183팀 초안) | 추천 알고리즘의 입력이 미검수 |
| 출처가 달린 관계 | 약 21% (654건 중 출처 없음 517건) | 화면은 "역사로 확인된 관계들"이라고 표시 |
| `reviewStatus: 'draft'`인 관계가 공개 노출 | 364건 | 검수 안 된 관계가 구분 없이 표시 |
| 관계 0개 밴드 | 15팀 | 탐색 막다른 길 |
| 관계 1개 밴드 | 71팀 | 〃 |
| 공식 표시된 대표곡(`source.official`) | 339/741 (46%) | 402곡이 비공식 또는 미표시 |
| 대표곡 2곡뿐인 밴드 | 36팀 (Beatles, Nirvana, Led Zeppelin 등 핵심 밴드 포함) | 최소 3곡 기준 미달 |
| 소개(`summary`) 90자 미만 | 25팀 | 대부분 초기에 넣은 핵심 밴드 |
| 소리 설명(`style`) 90자 미만 | 37팀 | 〃 |
| 과거 멤버가 0명인 2005년 이전 결성 밴드 | 46팀 | Megadeth와 같은 문제 |
| 시대 태그 1개뿐 | 186팀 | 장르 변화 서술 없음 (정상일 수도 있음) |
| 이미지 권리 미검수인데 공개 | 1팀 (`wintersun`) | **배포 검증 실패 원인** |
| 원본 크기 이미지를 그대로 로드 | 59팀 | 수 MB 이미지가 카드에 로드됨 |
| 썸네일 폭 | 500px 49, 960px 87, 1280px 48 | 카드와 상세가 같은 URL 사용 |

### 1.3 표기 불일치
| 항목 | 현황 |
|---|---|
| 소문자 밴드명 | 7팀: `wintersun`, `steppenwolf`, `sonata-arctica`, `extreme`, `limp-bizkit`, `beach-house`, `blink-182`(blink-182는 공식 표기가 소문자) |
| 출신지 `origin` | 영문 "Oakland, US" 형식 112팀 / 한글 "로스앤젤레스, 미국" 형식 131팀 |
| 밴드 `activeYears` | "–present" 22팀, 나머지 "–현재" |
| 멤버 `activeYears` | "present" 351건 / "현재" 353건 / 없음 19건 (전체 1,328건) |
| 관계 설명 어미 | "~습니다" 16건, 나머지 "~다" 또는 명사형(189건) |
| 관계 설명 15자 미만 | 31건 ("헤비 리프의 원형" 같은 구절) |
| 앨범명이 "Single" | 4곡 (Misfits 2, Bauhaus 2) |
| `tags`와 `subgenres` 불일치 | 211팀 (`tags`는 구 체계 잔재, 검색에만 쓰임) |
| 국가 코드 `XW` | 1팀 (`generation-axe`) |
| `reviewedBy`가 AI 표기 | 70팀 ("Claude (AI 검수)", "자동 검수 (AI)" 등) |
| 쓰이지 않는 세부장르 | 25개 (djent, heartland-rock 등 — 초안 밴드가 공개되면 일부 해소) |

### 1.4 성능
| 항목 | 값 |
|---|---|
| 메인 번들 `index-*.js` | 618 KB (그중 목록 인덱스 JSON 540 KB) |
| Studio 전용 `catalog-data-*.js` | 2.1 MB (공개 화면에서는 로드 안 됨) |
| CSS | 120 KB 단일 파일 |
| 모든 밴드 보기 | 카드 243개를 한 번에 렌더 |

### 1.5 화면 검토 결과 (홈, 밴드 상세, 모든 밴드, 느낌으로 찾기, 모바일)
- **좋은 점**: 홈의 은하 이미지와 "히치하이커를 위한 안내서" 콘셉트, 장르 카드 일러스트, 히치하이킹 방향 선택은 양산형과 확실히 구분된다. 장르 색 체계가 일관된다.
- **약한 점**
  1. "모든 밴드 보기"는 드롭다운 5개가 나열된 일반 필터 화면이다. 모바일에서는 필터가 첫 화면을 다 차지한다.
  2. 밴드 상세의 큰 이미지가 로드되기 전까지 빈 검은 상자다.
  3. 밴드 로딩 중에는 테마 없는 맨 화면(`route-loading`)으로 전체가 바뀐다.
  4. 콘셉트 문구가 홈에만 있고 안쪽 화면은 일반 문서 톤이다.
  5. 밴드 상세에 **출처 목록이 표시되지 않는다**. `band.sources`를 갖고 있지만 공식 YouTube 링크만 쓴다.
  6. "대표곡으로 보는 발자취" 타임라인은 결성 연도 + 대표곡 2~4곡의 연도뿐이다. 음반·사건이 없다.
  7. "결성 시대" 필터가 결성 연도가 아니라 시대 태그로 걸러진다(P0-4 버그).

## 2. 네 가지 목표와 현재의 간극

| 목표 | 현재 강점 | 간극 | 해결 단계 |
|---|---|---|---|
| 양산형처럼 보이지 않기 | 홈 콘셉트, 장르 카드, 히치하이킹 | 목록·필터·로딩 화면이 평범, 콘셉트가 안쪽까지 안 이어짐 | P5 |
| 알고리즘으로 취향 찾기 | 히치하이킹 9방향, 느낌으로 찾기 | 입력(무드 점수) 미검수 183팀, 개인 취향 미반영, 막다른 길 86팀 | P2, P3 |
| 최대한 정확한 정보 | Wikidata·MusicBrainz 교차검증, 이미지 권리 기록 | 관계 출처 21%, 출처 미표시, 표기 불일치, 검수 등급 미구분 | P0, P1, P2 |
| 지식을 얻고 즐기는 아카이브 | 밴드별 소개·소리·멤버·대표곡 가이드 | 음반·연표 없음, 장르 해설 없음, 세부장르 설명 없음, 계보 시각화 없음 | P4, P7 |

## 3. 이미 합의된 설계 결정 (다시 논의하지 않는다)

운영자와의 논의에서 정해진 내용이다. 구현 시 이 방향을 따른다.

1. **히치하이킹과 관계 지도는 질문이 다르다.**
   - 히치하이킹 = "다음엔 뭘 들을까?" (취향·유사도 기반, 한 걸음씩)
   - 관계 지도 = "이 밴드는 어디서 왔고 어디로 이어졌나?" (역사·사실 기반, 계보)
   - 관계 지도에 유사도 선을 섞지 않는다. 유사도는 히치하이킹과 Studio 후보 추천의 몫이다.
2. **멤버가 겹친다고 음악이 비슷한 것은 아니다.** 멤버 연결은 "닮음"의 근거로 쓰지 않고, 사람 이름을 붙인 별도 종류의 선으로만 보여준다. 히치하이킹·유사도 계산에서 제외한다.
3. **`evolution`(화면 표기 "세대 전환")은 의미가 섞여 있어 정리한다.** 사람이 이어진 경우만 남겨 "멤버로 이어짐"으로 바꾸고, 장르사 해석형은 재판정한다(P2-2).
4. **유사도 점수는 사실처럼 보이면 안 된다.** 공개 화면에서는 근거(공유 무드·세부장르)를 함께 보여주고, 사실 관계와 시각적으로 구분한다.
5. **자동 탐지는 후보까지만.** 멤버 공유·유사도 후보는 Studio에서 사람이 확인해 승격한다. 동명이인 실제 사례: The Clash의 Mick Jones ≠ Foreigner의 Mick Jones.
6. **Massive Attack처럼 록이 아닌 팀은 넣지 않는다.** 범위는 `docs/DATA_SCOPE.md`를 따른다.
7. **무드 카드에는 아이콘을 넣지 않는다.** 그룹별 색상만 쓴다(운영자가 아이콘 시안을 거절함).
8. **YouTube 임베드 복원, 인기도 점수, 장르당 최소 밴드 수는 계획에서 제외**(`docs/NEXT_STEPS.md`).

## 4. 단계별 작업

---

## P0. 배포 차단 요소와 즉시 수정 (반나절)

### P0-1. Wintersun 이미지 권리 오류 해결 — 운영자 결정 필요
- **현상**: `wintersun`이 `image.credit.reviewStatus: 'needs-review'`인데 `published`. `validate:data`가 오류를 내고, `.github/workflows/deploy-pages.yml`이 이 검증을 실행하므로 **지금 `main`에 푸시하면 배포가 실패한다.**
- **현재 값**: `sourceUrl: https://commons.wikimedia.org/wiki/File:Wintersun_Rockharz_2019_22.jpg`, `creator: S. Bollmann`, `license: Attribution`.
- **작업**: Commons API로 해당 파일의 실제 라이선스·저작자·`licenseUrl`·`displayUrl`·`originalUrl`을 조회해 채우고, `fileName`, `credit.reviewedAt`, `credit.reviewStatus: 'verified'`를 설정한다. `sources`에 같은 URL의 `Wikimedia Commons` 항목이 있어야 한다(검증 규칙).
- **주의**: 운영자가 직접 추가·공개한 밴드다. 라이선스가 불명확하면 승인하지 말고 운영자에게 알린다.
- **완료 조건**: `npm run validate:data`가 "무결성 오류 없음".

### P0-2. 커밋되지 않은 작업 정리 — 운영자 결정 필요
- `src/data/catalog.json`, `PROJECT_STATUS.md`(섹션 43), `docs/POSTER_DRAFTS_2026-10-25.md`가 커밋되지 않은 상태다(다른 에이전트의 포스터 초안 35팀 추가분).
- 이후 모든 데이터 작업이 이 위에 쌓이므로, 운영자 승인을 받아 먼저 커밋한다. 승인 없이는 커밋하지 않는다.

### P0-3. 밴드명 대소문자 수정
- 대상과 올바른 표기: `wintersun` → Wintersun, `steppenwolf` → Steppenwolf, `sonata-arctica` → Sonata Arctica, `extreme` → Extreme, `limp-bizkit` → Limp Bizkit, `beach-house` → Beach House. `blink-182`는 공식 표기가 소문자이므로 유지한다.
- 바꿀 필드: `name`, `image.wikipediaTitle`(위키백과 문서명과 일치해야 함), `image.alt`, 모든 `sources[].label`, `tracks[].source.label`, 그리고 **다른 밴드의 관계 설명(`relations[].note`) 안에 소문자로 적힌 이름**(예: "wintersun의 기타리스트…").
- 보류 관계(`pendingRelations[].sourceBandName`)도 확인한다.
- **완료 조건**: 공개 밴드 중 이름이 소문자로 시작하는 것은 `blink-182`뿐.

### P0-4. "결성 시대" 필터 버그
- **현상**: `src/components/AllBandsPage.tsx`의 필터 라벨은 "결성 시대"인데 조건은 `band.eraTags.some((tag) => tag.era === eraId)`다. 시대 태그는 "대표 활동 시기"라서 결성 연도와 다르다(예: Dire Straits는 1977년 결성인데 시대 태그는 1980s).
- **수정**: 필터 조건을 결성 연도 기준으로 바꾼다 — `Math.floor(band.formed / 10) * 10 === Number(eraId.slice(0, 4))`. 라벨은 "결성 시대" 유지.
- `MoodFinderPage.tsx`의 "시대" 필터는 의미가 "활동 시대"이므로 `eraTags` 기준을 유지하되 라벨을 "활동 시대"로 바꾼다.
- 테스트: `src/lib/explorerRoute.test.ts` 옆에 필터 함수를 순수 함수로 분리해 단위 테스트를 추가한다(`src/lib/catalogFilters.ts` 신설 권장 — P5-1에서도 쓴다).
- **완료 조건**: 1970년대 필터에 Dire Straits가 나오고, 1980년대 필터에는 안 나온다.

### P0-5. 관계 섹션 문구를 실제 수준에 맞게
- **현상**: `src/data/siteContent.json`의 `bandDetailCopy.relationTitle`이 "역사로 확인된 관계들", `relationDescription`이 "역사적 사실로 확인된 관계들입니다."다. 출처가 달린 관계는 21%뿐이다.
- **수정(임시)**: 제목 "이어진 밴드들", 설명 "편집부가 정리한 영향·장면·멤버 관계입니다. 출처가 확인된 관계에는 표시가 붙습니다." 정도로 바꾼다. P2-4에서 등급 표시가 들어가면 문구를 다시 맞춘다.
- `siteContent.json`은 Studio 디자인 편집기에서도 바뀌므로, 기본값을 정의한 곳(`src/data/siteContent.ts`)도 함께 고친다.

### P0-6. 관계 종류 표시 이름 통일
- `src/components/RelationMap.tsx`는 `evolution: '세대 전환'`, `src/components/StudioPage.tsx`는 `evolution: '계보의 확장'`이다.
- `src/lib/relationLabels.ts`를 만들어 한 곳에서 내보내고 두 컴포넌트가 가져다 쓴다. P2-1에서 종류가 바뀔 때 이 파일만 고치면 되게 한다.

---

## P1. 데이터 표기 정규화 (1일)

목표: 표기 불일치를 스크립트로 한 번에 정리하고, 다시 생기지 않게 검증에 넣는다.

### P1-1. 정규화 스크립트 신설
- **파일**: `scripts/normalize-catalog.ts`, `package.json`에 `"normalize:check"`, `"normalize:write"` 추가.
- `--check`는 위반 목록만 출력하고 위반이 있으면 종료 코드 1. `--write`는 수정한다.
- 정규화 규칙:
  1. **활동 기간 표기**: 밴드와 멤버의 `activeYears`에서 `present`(대소문자 무관) → `현재`. 구분자는 en dash(`–`)로 통일. 쉼표 뒤 공백 1칸.
  2. **출신지 표기**: `"<도시>, <국가>"` 한글 형식으로 통일한다. 영문 "City, CC" 112건은 `src/lib/countryNames.ts`의 국가명과 도시 한글 표기 사전으로 변환한다. 도시 사전은 `scripts/data/city-names-ko.json`에 둔다. **사전에 없는 도시는 자동 변환하지 말고 목록으로 출력**해 사람이 채운다(음역 오류 방지). 미국은 "도시, 주, 미국"이 아니라 "도시, 미국"으로 통일하되 기존에 주가 적힌 것은 유지한다.
  3. **관계 설명 어미**: "~습니다."로 끝나는 16건을 "~다."로 바꾼다. 자동 치환은 위험하므로 대상 목록(부록 A-7)을 보고 문장 단위로 다시 쓴다.
  4. **앨범명 "Single"**: `album: "Single"` 4건은 `album`을 지우고 필요하면 `guide`에 싱글임을 적는다. 타입상 `album`은 선택 필드다. `BandDetail.tsx`는 `track.album ?? '싱글·수록 음반 정보 확인 중'`을 쓰므로, 싱글 여부를 표현할 필드가 필요하면 P4-1의 `releaseType`과 함께 처리한다.
  5. **국가 코드 `XW`**: `generation-axe`는 다국적 프로젝트다. `countryNames.ts`가 `XW`를 어떻게 표시하는지 확인하고 "다국적"으로 나오게 한다.
  6. **`reviewedBy`**: "Claude (AI 검수)", "자동 검수 (AI)" 등 변형을 `ROCK ATLAS editorial (AI 보조)` 하나로 통일한다. 운영자가 직접 공개한 "Studio operator"는 건드리지 않는다. 화면에 노출되는 필드는 아니지만 P4-6에서 "검수 정보"를 표시할 때 쓰인다.
- **완료 조건**: `npm run normalize:check`가 위반 0건. 도시 사전 미등록 목록이 비어 있음.

### P1-2. `tags` 필드 정리
- **현상**: `tags`는 구 체계 잔재다. 211팀에서 `subgenres`와 다르다. 쓰이는 곳은 `AllBandsPage.tsx`의 검색 문자열과 Studio의 구 유사도 계산(`suggestionScore`의 fallback)뿐이다.
- **수정**: `tags`를 `taxonomyV2.subgenreIds`의 한글 이름으로 재생성하지 말고, **검색 전용 별칭 필드로 용도를 바꾼다**. 즉 `tags`에는 "한글 밴드명, 흔한 별칭, 대표 키워드"를 넣는다(예: Metallica → ["메탈리카", "빅4"]). 한글 이름 검색이 지금 안 되는 문제(P5-3)를 같이 해결한다.
- 한글 밴드명은 Wikidata 한국어 라벨에서 가져온다(`/api/studio/external-search` 응답의 `name`이 한국어 라벨이다). 스크립트 `scripts/collect-korean-names.ts`로 일괄 수집 후 사람이 훑어본다.
- **완료 조건**: "메탈리카", "너바나"로 검색하면 해당 밴드가 나온다.

### P1-3. 검증 규칙 추가
- `scripts/validate-catalog.ts`에 추가:
  - 공개 밴드 이름이 소문자로 시작하면 경고(허용 목록: `blink-182`).
  - `activeYears`에 `present`가 있으면 오류.
  - `origin`이 ASCII 문자로 시작하면 경고.
  - 공개 밴드의 대표곡이 3곡 미만이면 경고(P4-2 완료 후 오류로 승격).
  - 관계 설명이 15자 미만이면 경고.
- `.github/workflows/deploy-pages.yml`에 `npm run normalize:check` 단계를 추가한다.

---

## P2. 관계 모델 개편 (3~4일) — 정확성의 핵심

### P2-1. 스키마 변경
**파일**: `src/types/music.ts`

```ts
export type RelationKind =
  | 'sounds-like'     // 닮은 사운드
  | 'influenced-by'   // 영향을 받음
  | 'influenced'      // 영향을 줌
  | 'shared-scene'    // 같은 장면
  | 'member-link'     // 멤버로 이어짐 (evolution 대체)

/** member-link 전용: 어떤 식으로 사람이 이어졌는가 */
export type MemberLinkType = 'successor' | 'moved' | 'shared' | 'session'
//  successor = 후신·파생 밴드 (Joy Division → New Order)
//  moved     = 핵심 멤버의 이적·독립 (Metallica → Megadeth)
//  shared    = 동시 겸업 (Wintersun ↔ Megadeth)
//  session   = 세션·임시 참여 (계보선으로 쓰지 않음, 기록만)

export interface Relation extends ReviewRecord {
  targetBandId: string
  kind: RelationKind
  strength: 1 | 2 | 3
  note: string
  source?: SourceRef
  mirroredFrom?: string
  /** member-link일 때 필수: 연결 고리가 되는 사람들 */
  people?: string[]
  /** member-link일 때 필수 */
  linkType?: MemberLinkType
}
```

- **근거 등급은 새 필드를 만들지 않고 기존 필드로 판정한다**: `source?.url`이 있으면 "출처 확인", 없으면 "편집부 정리". 판정 함수 `relationEvidence(relation): 'sourced' | 'editorial'`를 `src/lib/relationLabels.ts`에 둔다.
- `reviewStatus`(관계 단위)는 지금 364건이 `draft`인 채 공개된다. 의미를 "출처 확인 여부"와 겹치지 않게 정리한다: `reviewed` = 사람이 문장을 확인함, `draft` = 자동 생성 후 미확인. 공개 화면에서 `draft` 관계는 **숨기지 않되** "미검수" 등급으로 표시한다(숨기면 관계가 절반으로 줄어든다). P2-6에서 일괄 검수한다.

**함께 고칠 곳** (전부 `evolution` 문자열을 검색해서 확인):
| 파일 | 변경 |
|---|---|
| `src/lib/bandIntake.ts` | `relationKinds` 배열, 1019행 근처 "출처 필요 종류" 필터에 `member-link` 포함, 붙여넣기 JSON의 구 값 `evolution`은 `member-link`로 받아들이되 경고 |
| `src/lib/relationSync.ts` | 역방향 종류 표: `member-link` ↔ `member-link`. `people`·`linkType`도 미러링 |
| `scripts/audit-relations.ts` | `compatibleReverseKinds` |
| `scripts/validate-catalog.ts` | `member-link`인데 `people`이 비었으면 오류 |
| `scripts/generate-public-data.ts` | `compactBand`의 관계 축약에 `linkType` 포함(`people`은 상세에만) |
| `src/lib/hitchhiking.ts` | `isNaturalHitchhikingTransition`의 `editorialRelation`에서 `member-link` 제외. `recommendHitchhikingBands`의 `relation ? 8 : 0` 가산점도 `member-link`는 0 |
| `src/lib/bandSimilarity.ts` | `manuallyConnected` 가산점(10)에서 `member-link` 제외 |
| `src/components/RelationMap.tsx`, `StudioPage.tsx` | 라벨은 P0-6의 공용 파일 사용. Studio 관계 행에 `people`(쉼표 입력)·`linkType`(선택) 입력란 추가, `member-link`일 때만 표시 |
| `docs/GEMINI_BAND_TEMPLATE.md`, `docs/GEMINI_*.md` | 관계 종류 설명 갱신 |
| 테스트 | `relationSync.test.ts`, `bandIntake.test.ts`, `hitchhiking.test.ts`에 `member-link` 케이스 추가 |

### P2-2. `evolution` 22쌍 이관
현재 `evolution` 관계는 22쌍(방향별 43건)이다. 아래 표대로 옮긴다. 초안 밴드에 걸린 것(Dio, Audioslave 등)도 같이 처리한다.

**A. `member-link`로 이관 (16쌍)** — `people`은 반드시 출처로 확인 후 입력
| 쌍 | linkType | people (확인 후 입력) |
|---|---|---|
| Joy Division → New Order | successor | Bernard Sumner, Peter Hook, Stephen Morris |
| Nirvana → Foo Fighters | successor | Dave Grohl |
| Oasis → Beady Eye | successor | Liam Gallagher, Gem Archer, Andy Bell, Chris Sharrock |
| Oasis → Noel Gallagher's High Flying Birds | successor | Noel Gallagher |
| Soundgarden → Audioslave | successor | Chris Cornell |
| Rage Against the Machine → Audioslave | successor | Tom Morello, Tim Commerford, Brad Wilk |
| The Police → Sting | successor | Sting |
| Metallica → Megadeth | moved | Dave Mustaine |
| Black Sabbath → Dio | moved | Ronnie James Dio |
| Rainbow → Dio | moved | Ronnie James Dio |
| Van Halen → Chickenfoot | moved | Sammy Hagar, Michael Anthony |
| Racer X → Mr. Big | moved | Paul Gilbert |
| Racer X → Judas Priest | moved | Scott Travis |
| Ride → Oasis | moved | Andy Bell |
| Wintersun ↔ Megadeth | shared | Teemu Mäntysaari |
| Extreme ↔ Generation Axe | shared | Nuno Bettencourt |

**B. 재판정 (6쌍)** — 사람이 이어진 것이 아니므로 `member-link`가 될 수 없다
| 쌍 | 현재 설명 | 처리 |
|---|---|---|
| Guns N' Roses → Nirvana | "1990년대 주류 록의 세대교체 지점" | 관계 삭제. 내용은 두 밴드의 시대 태그 설명에 반영 |
| Metallica → Rammstein | "스래시 이후 산업 메탈로 넓어진 분기" | 영향 근거(람슈타인 멤버의 발언 등)를 찾으면 `influenced`, 없으면 삭제 |
| Nine Inch Nails → Rammstein | "산업 록의 주류화에서 유럽 산업 메탈로" | 근거 확인 후 `influenced` 또는 `shared-scene`(1990년대 인더스트리얼) |
| Death → Children of Bodom | "초기 데스 메탈에서 멜로딕·테크니컬로" | Alexi Laiho의 영향 언급 확인 후 `influenced` |
| The Clash → The Cure | "영국 펑크에서 포스트펑크로" | 근거 확인 후 `influenced` 또는 삭제 |
| Yes → Porcupine Tree | "고전 프로그와 현대 프로그의 비판적 계승" | Steven Wilson의 Yes 리믹스 작업 등 근거가 있으면 `influenced` |

- 이관 스크립트: `scripts/migrate-evolution-relations.ts`. 위 표를 데이터로 갖고, 양방향 모두 갱신하고, 표에 없는 `evolution`이 하나라도 남으면 실패한다.
- **완료 조건**: 카탈로그에 `"kind": "evolution"`이 0건. `validate:data`, `audit:relations` 통과.

### P2-3. 멤버 공유 자동 탐지 (Studio 도구)
- **목적**: 사람이 입력하지 않은 사실 연결을 찾아 `member-link` 후보로 제시한다.
- **파일**: `src/lib/memberOverlap.ts`(순수 함수 + 테스트), `scripts/collect-member-links.ts`(CLI 보고), Studio에 "멤버 연결 후보" 패널(`src/components/MemberLinkPanel.tsx`).
- **알고리즘**
  1. 이름 정규화: 소문자, 발음 기호 제거(NFD), 영숫자만. 따옴표 별명은 제거한 형태도 함께 키로 쓴다(`Joakim "Jolly" Karlsson`).
  2. 같은 키가 두 밴드 이상에 나오면 후보.
  3. 이미 두 밴드 사이에 `member-link` 관계가 있으면 제외.
  4. 익명·집합 이름은 제외 목록에 둔다: `Nameless Ghouls`, `Vessel`, `II`, `III`, `IV` 등.
- **후보 상태**: Studio에서 "후신 / 이적 / 겸업 / 세션 / 동명이인"을 고른다. 앞의 세 개는 `member-link` 관계를 양방향으로 만든다. "세션"과 "동명이인"은 `src/data/member-link-decisions.json`에 기록해 다시 후보로 뜨지 않게 한다.
- **이미 확인된 동명이인**: Mick Jones (The Clash / Foreigner).
- **현재 자동 탐지 결과 47건**(공개 밴드 기준, 초안 포함 시 더 많다). 주요 건: Rainbow↔Deep Purple(Blackmore, Glover, Airey), Whitesnake↔Deep Purple(Lord, Paice), Rainbow↔Whitesnake(Cozy Powell), Whitesnake↔Def Leppard(Vivian Campbell), Primal Scream↔The Jesus and Mary Chain(Bobby Gillespie), Primal Scream↔The Stone Roses(Mani), Primal Scream↔My Bloody Valentine(Kevin Shields), Sepultura→Slipknot(Eloy Casagrande), Motörhead→Scorpions(Mikkey Dee), Alter Bridge↔Slash(Myles Kennedy), Chickenfoot↔Red Hot Chili Peppers(Chad Smith), Wintersun↔Ensiferum(Jari Mäenpää), Wintersun↔Nightwish(Kai Hahto, Jukka Koskinen), The Used→Rancid(Branden Steineckert), Steel Panther→Korn(Ray Luzier), Extreme→Dream Theater(Mike Mangini), Dream Theater→Avenged Sevenfold(Mike Portnoy, 세션), Whitesnake→Generation Axe(Steve Vai, 세션에 가까움), DragonForce→Skid Row(ZP Theart), Pantera↔Anthrax(Charlie Benante, 재결성 투어 멤버), Generation Axe↔Pantera(Zakk Wylde, 〃).
- **완료 조건**: Rainbow, Whitesnake의 관계가 0개에서 각 3개 이상으로 늘어난다. 동명이인이 관계로 만들어지지 않는다.

### P2-4. 공개 화면의 관계 표시 개편
**파일**: `src/components/RelationMap.tsx`, `src/index.css`(`.relation-*`)

- 관계를 **세 묶음**으로 나눠 표시한다.
  1. **영향의 흐름**: `influenced-by`(이 밴드에게 영향을 준 선배) / `influenced`(이 밴드가 영향을 준 후배). 두 열 또는 "← 선배 | 후배 →" 구성.
  2. **같은 장면·닮은 소리**: `shared-scene`, `sounds-like`.
  3. **멤버로 이어진 밴드**: `member-link`. 카드에 사람 이름과 `linkType` 라벨(후신 / 이적 / 겸업)을 표시. "소리가 비슷하다는 뜻은 아닙니다" 한 줄 안내.
- 각 카드에 **근거 표시**: 출처가 있으면 "출처" 링크 아이콘(누르면 `source.url` 새 탭, `source.label` 툴팁), 없으면 표시 없음. 미검수(`reviewStatus === 'draft'`)는 흐린 "미검수" 표식.
- "그다음: A · B" 줄은 유지하되, 같은 묶음 종류의 다음 밴드를 우선한다.
- 상세 데이터에는 `note`가 있지만 목록 인덱스(`publicBandById`)에는 없다. `RelationMap`은 상세로 받은 `band.relations`를 쓰므로 문제없다. 대상 밴드 정보(`bandById[item.targetBandId]`)는 인덱스에서 온다.
- **완료 조건**: Metallica 페이지에서 Megadeth가 "멤버로 이어진 밴드 · 이적 · Dave Mustaine"으로 보이고, Iron Maiden·Black Sabbath가 "영향을 준 선배"에 묶인다.

### P2-5. 유사도 기반 관계 후보 (Studio 전용)
- 공개 화면에는 내보내지 않는다. Studio "관계 연결" 섹션의 "가까운 밴드 후보"를 P3-2의 새 점수로 교체하고, 후보 카드에 근거(공유 세부장르·무드)와 "관계가 0~1개인 밴드 우선" 필터를 둔다.
- 후보를 관계로 추가할 때 종류 기본값은 `sounds-like`, 설명은 빈칸으로 두고 운영자가 쓰게 한다. 지금은 `공통 요소: …` 문구가 자동으로 들어가 그대로 공개되는 경우가 있다.

### P2-6. 관계 품질 보강 (데이터 작업)
우선순위 순서:
1. **관계 0개 15팀**: steel-panther, rainbow, whitesnake, rascal-flatts, jesus-and-mary-chain, bring-me-the-horizon, the-libertines, the-vaccines, hoobastank, beck, kings-of-convenience, peach-pit, mumford-sons, semisonic, ajr → 각 3개 이상.
2. **관계 1개 71팀**(부록 A-2) → 각 3개 이상.
3. **15자 미만 설명 31건** → 근거가 드러나는 한 문장으로 다시 쓴다. 예: "헤비 리프의 원형" → "토니 아이오미의 다운튜닝 리프가 초기 스래시 리프 작법의 출발점이 됐다."
4. **출처 없는 `influenced`·`influenced-by` 160건** → 인터뷰·공식 이력·위키백과 문장으로 출처를 단다. 못 찾으면 `shared-scene` 또는 `sounds-like`로 낮추거나 삭제한다.
5. **`draft` 364건** → 문장 확인 후 `reviewed`.
- 작업 방식: 밴드 단위로 WebSearch 확인 → 양방향 추가(방향마다 문장을 다르게) → `audit:relations`.
- 약한 근거의 예(재검토 대상): Metallica "영향을 받음" Lynyrd Skynyrd — 근거가 "Tuesday's Gone 커버" 하나다. 커버 한 곡은 영향 관계가 아니므로 삭제하거나 `sounds-like`가 아닌 별도 메모로 옮긴다.
- **완료 조건**: 관계 0개 밴드 0팀, 1~2개 밴드 20팀 이하, 영향 관계의 출처 보유율 80% 이상, 15자 미만 설명 0건.

---

## P3. 분류와 추천 품질 (3~4일)

### P3-1. 분류 검수 183팀
- **문제**: 무드 점수가 히치하이킹·느낌으로 찾기·유사도의 유일한 입력인데 183팀이 미검수다.
- **도구 먼저**: `scripts/audit-mood-coverage.ts`를 확장해 이상치를 뽑는다.
  1. 같은 세부장르 집합을 가진 밴드들과 무드 점수가 크게 다른 밴드(평균 대비 차이 합 상위).
  2. 3점 이상 무드가 1~2개뿐인 밴드(7팀) — 히치하이킹 방향이 1개 이하로 나올 위험.
  3. 방향 진입 조건을 하나만 겨우 통과하는 밴드(`availableHitchhikingDirections` 결과 길이 1).
  4. 대표 장르의 `quickMoodIds` 3개 중 하나도 3점 이상이 아닌 밴드.
- **Studio 일괄 검수 화면**: `StudioTaxonomyEditor.tsx` 옆에 "분류 검수 대기열"을 추가한다. 장르별로 밴드를 표 형태로 나열하고 무드 점수를 한 화면에서 비교·수정한 뒤 "검수 완료"를 누른다. 같은 장르 밴드를 나란히 봐야 점수 기준이 일정해진다.
- **기준 문서**: `docs/TAXONOMY_V2_WORKFLOW.md`에 무드별 점수 기준(1~5가 각각 무엇을 뜻하는지, 기준 밴드 예시)을 추가한다. 예: `massive-heavy` 5 = Meshuggah·Gojira, 3 = Thin Lizzy·AC/DC, 1 = Coldplay.
- **완료 조건**: 공개 밴드의 `taxonomyV2.reviewStatus`가 전부 `reviewed`. 방향이 1개뿐인 밴드 0팀.

### P3-2. 유사도 점수 v2
**파일**: `src/lib/bandSimilarity.ts`, `src/lib/bandSimilarity.test.ts`

- **현재 방식의 약점**: 공유 세부장르·무드에 일괄 가중치를 줘서 흔한 태그("기타 리프와 솔로 중심", "얼터너티브 록")가 겹쳐도 높은 점수가 나온다. 같은 국가 +4점은 음악적 근거가 아니다.
- **새 방식** (시제품에서 검증한 구성):
  ```
  score(a, b) =
      Σ[둘 다 3점 이상인 무드 m]  idf(m) × (min(a_m, b_m) − 2) × 0.9
    + Σ[공유 세부장르 s]          idf(s) × 1.4
    + (같은 대표 장르 ? 1.5 : 대표·보조 교차 ? 0.8 : 0)
    + (|결성연도 차| ≤ 12 ? 1 − 차/12 : 0)
  idf(x) = ln(공개 밴드 수 / x를 가진 밴드 수)
  ```
  - 무드의 "가진 밴드 수"는 3점 이상 기준.
  - **세부장르가 하나도 안 겹치면 점수와 무관하게 후보에서 제외**한다(시제품에서 Kings of Convenience–Eagles, Coldplay–Rascal Flatts 같은 오답의 원인이었다).
  - 같은 국가 가산점은 없앤다.
  - `idf` 테이블은 밴드 목록이 바뀔 때만 다시 계산하도록 모듈 수준에서 메모이즈한다.
- **상호 상위 k 규칙**: `mutualNeighbors(bands, k = 5)` — A의 상위 5에 B가 있고 B의 상위 5에 A가 있을 때만 "서로 가까운 밴드"로 인정. Studio 후보와 P7 은하 지도에서 쓴다.
- **반환 형태**: `{ band, score, sharedMoods: MoodId[], sharedSubgenres: SubgenreId[], reasons: string[] }`. `reasons` 문자열은 기존 호출부(`hitchhiking.ts`의 `similarity.reasons[0]`) 호환을 위해 유지한다.
- **시제품 결과**(회귀 테스트로 고정할 것): Megadeth 상위 = Metallica, Motörhead, Anthrax, Slayer / The Strokes 상위 = Arctic Monkeys, The Vaccines, The Libertines / Coldplay 상위 = Snow Patrol, Starsailor, Keane.
- `scoreBandSimilarity`는 `hitchhiking.ts`에서 `similarity.score * 0.9`로 합산된다. 점수 범위가 0~100에서 0~약 30으로 바뀌므로 **히치하이킹 점수식의 계수를 다시 맞춘다**(`score * 0.9` → `score * 3` 정도에서 시작해 기존 테스트 `hitchhiking.test.ts`가 통과하는 값으로 조정).

### P3-3. 히치하이킹 개선
**파일**: `src/lib/hitchhiking.ts`, `src/components/HitchhikingPanel.tsx`, `src/config/hitchhiking.ts`

1. **추천 이유를 더 구체적으로**: 지금 카드에는 `reasons[0]`(무드 점수)과 `reasons[2]`(연속성 이유)만 나온다. "Metallica보다 무게감 +1.2 · 같은 스래시 메탈" 형태로 **출발 밴드와의 차이**를 보여준다. `directionGain`을 문장으로 바꾼다.
2. **막다른 길 방지**: 방향을 골랐는데 후보가 3개 미만이면 방향 버튼 자체를 숨기는 현재 로직은 유지한다. 대신 방향이 0개인 밴드는 테스트(`hitchhiking.test.ts`)가 막고 있으므로, P3-1에서 방향 1개인 밴드를 없앤다.
3. **이미 다녀온 밴드**: 지금은 점수 −24로 뒤로 미룬다. 경로에 있는 밴드는 카드에 "이미 지나온 곳" 표시를 붙인다.
4. **반대 방향 쌍**: "더 무겁게"의 반대인 "더 가볍게", "더 빠르게"의 반대 "더 느리게"가 없다. `slow-calm`·`warm-comforting` 기반의 "더 잔잔하게" 방향을 추가한다(`HITCHHIKING_DIRECTIONS`에 항목 추가, `siteContent.json`의 `hitchhikingDirections`에 문구 추가, `HitchhikingPanel`의 아이콘 맵에 아이콘 추가). 방향은 최대 4개만 노출되므로 UI 변경은 없다.
5. **여정 요약**: 경로가 4단계 이상이면 "출발 대비 무게 +2, 속도 −1" 같은 요약을 경로 줄 아래에 보여준다. 공유 문구에도 넣는다.
6. `member-link` 제외(P2-1).
- **완료 조건**: 기존 테스트 통과 + 새 방향·이유 문장 테스트 추가. Coldplay에서 "더 잔잔하게"가 나온다.

### P3-4. 느낌으로 찾기 개선
**파일**: `src/components/MoodFinderPage.tsx`

1. **결과가 화면 맨 아래에 있다**: 무드 24개 카드 아래로 스크롤해야 결과가 보인다. 무드를 하나 고르면 결과 영역으로 가는 고정 버튼("결과 N팀 보기")을 띄우거나, 데스크톱에서는 좌측 무드 / 우측 결과 2단 구성으로 바꾼다.
2. **일치도 계산**: `average * 0.7 + minimum * 0.3`. 유지하되, 결과 카드에 선택한 무드별 점수를 작은 막대로 보여준다(지금은 "% 일치"와 무드 이름만).
3. **빼기 조건**: "이건 빼고" 무드를 1개 고를 수 있게 한다(해당 무드 3점 이상인 밴드 제외). 라우트에 `exclude` 파라미터 추가(`explorerRoute.ts`).
4. **무드 조합 프리셋**: "비 오는 밤", "운전할 때", "운동할 때" 같은 이름 붙은 조합 6~8개를 상단에 둔다. `taxonomy.v2.json`에 `moodPresets: [{ id, name, moodIds, excludeMoodIds? }]` 추가, Studio에서 편집 가능하게.
5. P0-4에서 정한 대로 시대 필터 라벨을 "활동 시대"로.

### P3-5. 내 취향 프로필 (신규, 서버 없이)
- **목적**: 누적 행동으로 개인화한다. 지금 `localStorage`에는 저장한 밴드(`rock-atlas:favorites`), 방문 기록(`rock-atlas:history`, 최대 12), 여정(`rock-atlas:hitchhiking-journey`)이 있다.
- **파일**: `src/lib/tasteProfile.ts`(+테스트), `src/components/TasteProfilePage.tsx`, 라우트 `?view=profile`(`explorerRoute.ts`의 `ExplorerView`에 추가), 헤더 메뉴에 "내 취향".
- **계산**
  - 입력 가중치: 저장한 밴드 1.0, 여정에 있는 밴드 0.5, 방문만 한 밴드 0.2.
  - 방문 기록 상한을 12 → 60으로 늘린다(`MAX_HISTORY`). 화면에 보이는 "최근 탐험" 칩은 6개 유지.
  - 무드 벡터 = 입력 밴드 무드 점수의 가중 평균. 장르 분포 = 대표 장르 가중 합. 시대 분포 = 결성 연대.
- **화면**
  1. 무드 레이더(상위 8개 무드) 또는 가로 막대. 외부 차트 라이브러리 없이 SVG로 직접 그린다.
  2. "당신의 취향 한 줄": 상위 무드 2개 + 상위 장르 → 문장 템플릿.
  3. "아직 안 가본 추천" 12팀: 프로필 벡터와 코사인 유사도 상위, 이미 본 밴드 제외, 같은 대표 장르는 최대 4팀으로 제한해 다양성 확보.
  4. "취향 밖으로 한 걸음" 3팀: 프로필과 가장 다른 장르 중에서, 공유 무드가 1개 이상 있는 밴드.
  5. 저장한 밴드 전체 목록(지금은 홈 `JourneyBar`에 5개만 보인다), 내보내기/가져오기(JSON 파일) 버튼.
- **입력이 3팀 미만일 때**: P3-6의 시작 화면으로 안내.
- **공유**: 프로필을 URL로 공유(`?view=profile&p=<밴드 id 목록 압축>`). 받는 사람은 읽기 전용으로 본다.
- **완료 조건**: 밴드 5팀을 저장하면 프로필 화면에 무드 그래프와 추천 12팀이 나오고, 새로고침해도 유지된다.

### P3-6. 시작 화면 "3팀 고르기"
- 홈 히어로의 "아무 밴드나 만나기" 옆에 "취향으로 시작하기" 버튼.
- 장르별 대표 밴드(`taxonomy.v2.json`의 `featuredBandIds` — 지금 전부 빈 배열이므로 P4-5에서 채운다)에서 20~24팀을 그리드로 보여주고 3팀 이상 고르게 한다.
- 고른 밴드를 저장 목록에 넣고 P3-5 프로필의 추천으로 이동.
- 고를 밴드가 없는 사용자를 위해 "잘 모르겠어요 → 느낌으로 찾기" 링크.

---

## P4. 콘텐츠 깊이 (지속 작업, 초기 5~7일)

### P4-1. 음반과 연표 스키마
**파일**: `src/types/music.ts`, `scripts/validate-catalog.ts`, `scripts/generate-public-data.ts`(상세에만 포함), `StudioPage.tsx`(입력란), `BandDetail.tsx`(표시), `docs/GEMINI_BAND_TEMPLATE.md`

```ts
export interface Album {
  title: string
  year: number
  /** 정규 / EP / 라이브 / 편집 */
  type: 'studio' | 'ep' | 'live' | 'compilation'
  /** 입문 추천 음반 표시 */
  essential?: boolean
  /** 한 줄 해설: 이 음반이 왜 중요한가 */
  note?: string
  source?: SourceRef   // MusicBrainz release-group 권장
}

export interface Milestone {
  year: number
  /** 결성 / 멤버 변동 / 해체 / 재결합 / 사건 / 수상 */
  type: 'formed' | 'lineup' | 'hiatus' | 'reunion' | 'event' | 'award'
  text: string
  source?: SourceRef
}

export interface Band {
  // ...
  albums?: Album[]
  milestones?: Milestone[]
}

export interface Track {
  // ...
  /** 음반 미수록 싱글 등 */
  releaseType?: 'album' | 'single' | 'ep' | 'live'
}
```

- **수집**: 정규 음반 목록과 발매 연도는 MusicBrainz release-group API(`type=album`, 보조 타입 없음)로 가져온다. 밴드의 MBID는 이미 `sources`에 있다. 스크립트 `scripts/collect-albums.ts`가 후보 JSON을 만들고, 사람이 `essential`과 `note`를 단다. MusicBrainz는 초당 1회 제한이므로 요청 사이 1.2초 대기, 응답 캐시(`scripts/.cache/`)를 둔다.
- **범위**: 정규 음반 전체를 넣되 화면에는 `essential` 3~5장을 먼저 보이고 "전체 디스코그래피 펼치기"로 나머지를 본다.
- **화면**: "02 / FOOTPRINT" 타임라인을 `milestones` + `albums` + 대표곡을 연도순으로 합친 연표로 교체한다. 항목 종류별 표식(음반 ● / 사건 ◆ / 대표곡 ♪). 대표곡은 수록 음반 아래에 들여쓴다.
- **검증**: 대표곡의 `album`이 `albums[].title`에 있는지 경고(오타 탐지).
- **완료 조건**: 우선 핵심 50팀(각 장르 상위 인지도)에 음반·연표를 채우고, 나머지는 필드가 없어도 기존 화면이 그대로 나온다.

### P4-2. 대표곡 보강
1. **2곡뿐인 36팀**(부록 A-3)에 1곡 이상 추가해 최소 3곡으로. Beatles, Stones, Led Zeppelin, Nirvana 등 핵심 밴드가 대부분이다.
2. **`source.official`이 false이거나 없는 402곡**을 재확인한다. 많은 경우 실제로는 공식 채널인데 플래그만 빠졌다. `scripts/collect-video-candidates.ts --strict`(oEmbed로 업로더 확인)를 돌려 채널명이 아티스트 공식·VEVO·Topic·레이블이면 `official: true`와 `channelType`을 채운다.
3. **공식 영상이 없는 곡**은 Topic 채널(자동 생성 공식 음원)을 우선한다.
4. YouTube Data API 일일 쿼터(검색 100회 수준)가 자주 소진된다. 검색 대신 **채널 업로드 목록 조회**(`playlistItems`, 쿼터 1)로 바꾸면 훨씬 덜 쓴다: 밴드의 공식 채널 ID가 이미 `sources`에 있으므로 그 채널의 업로드 재생목록에서 제목 매칭한다. `server/studioApi.ts`의 `youtube-search`에 `channelId` 모드를 추가한다.
5. 초기에 넣은 곡의 `source.note`에 "검색 근거로 공식 채널 업로드로 추정(…자동 검수 미실행…)" 같은 내부 메모가 남아 있다. 화면에는 안 나오지만 정리한다.
- **완료 조건**: 대표곡 3곡 미만 밴드 0팀, 공식 표시 비율 85% 이상.

### P4-3. 소개·소리 설명 보강
- `summary` 90자 미만 25팀, `style` 90자 미만 37팀(부록 A-5, A-6)을 다시 쓴다. 대부분 Beatles·Nirvana·Metallica 같은 핵심 밴드인데 가장 짧다.
- **문체 기준**(Megadeth 수정 때 정한 것): 편집자 해석("복수심", "라이벌 의식")보다 사실 중심. 1문장째 = 언제 어디서 누가, 장르사에서의 위치. 2문장째 = 대표 음반과 구체적 성과. `~다`체.
- `summary`는 120~220자, `style`은 100~200자를 목표로 한다.
- 같은 문장 구조 반복을 피한다: 최근 일괄 추가분은 "…년 …에서 결성된 밴드로, …" 패턴이 대부분이다. 3팀에 1팀은 다른 구조로 시작한다.

### P4-4. 멤버 보강
- 과거 멤버가 0명인 2005년 이전 결성 밴드 46팀(부록 A-8)을 확인한다. 실제로 원년 멤버 그대로인 밴드(U2, Radiohead, Coldplay 등)는 그대로 두고, 중요한 과거 멤버가 빠진 밴드(Iron Maiden의 Paul Di'Anno, Metallica의 Cliff Burton·Jason Newsted, Pearl Jam의 드러머들, Judas Priest의 K.K. Downing, Bon Jovi의 Richie Sambora, The Cure 등)를 채운다.
- 고인 표시: `Member`에 `deceased?: number`(사망 연도)를 추가하고 화면에 "(1962–1986)" 형태가 아니라 "· 2016년 별세"처럼 표시한다. 선택 필드.
- 화면의 "현재 / 후기 라인업" 제목은 해체한 밴드에 어색하다. `isStillActive(band.activeYears)`가 false면 "마지막 라인업"으로 바꾼다.

### P4-5. 장르 해설
**파일**: `src/types/taxonomy.ts`, `src/data/taxonomy.v2.json`, `GenreExplorerPage.tsx`, `StudioTaxonomyEditor.tsx`

```ts
export interface TaxonomyGenre {
  // ...
  /** 3~5문단 해설: 어디서 시작됐고 어떻게 갈라졌나 */
  history?: string
  /** 입문 순서 추천: 이 순서로 들어보세요 */
  starterBandIds?: string[]     // 3~5팀
  /** 핵심 음반 3~5장 */
  keyAlbums?: { bandId: string; title: string; year: number; note: string }[]
}

export interface TaxonomySubgenre {
  // ...
  /** 한두 문장 정의 */
  description?: string
  /** 대표 밴드 */
  exampleBandIds?: string[]
}
```

- 지금 세부장르 140개에는 설명이 전혀 없다(`id`, `name`, `englishName`뿐). "슈게이즈가 뭔지" 사이트 안에서 알 수 없다.
- **장르 페이지**: 히어로 아래에 접이식 "이 장르 이야기"(history), "여기서 시작하세요"(starterBandIds 카드), "핵심 음반". 세부장르 칩에 마우스를 올리거나 누르면 정의가 보인다.
- **용어 사전 페이지**: `?view=glossary` — 세부장르 140개와 무드 24개의 정의를 장르별로 묶어 보여주고, 각 항목에서 해당 밴드 목록으로 이동.
- `featuredBandIds`(지금 전부 빈 배열)를 채워 장르 카드와 P3-6에서 쓴다.
- 쓰이지 않는 세부장르 25개(부록 A-9)는 초안 65팀이 공개된 뒤 다시 세고, 그래도 0팀이면 삭제하지 말고 사전에서 "수록 밴드 없음"으로 표시하지 않게 숨긴다.
- **작성 원칙**: 장르 해설은 사실 서술 위주, 연도와 기점 음반을 명시, 출처(위키백과 장르 문서 등)를 `sources` 배열로 남긴다.

### P4-6. 출처와 검수 정보 표시
- **현상**: 밴드마다 Wikipedia·Wikidata·MusicBrainz·Commons 출처를 갖고 있는데 화면에 안 나온다. "정확한 정보"를 내세우려면 보여줘야 한다.
- **수정**: `BandDetail.tsx` 맨 아래에 "출처와 검수" 구역 추가.
  - 외부 링크: Wikipedia, MusicBrainz, Wikidata(`sources`에서 `publisher`별 1개씩).
  - "마지막 검수: 2026-09-29" (`reviewedAt`).
  - 이미지 저작자·라이선스(지금 사진 위에 작게 있음)를 여기에도 온전히 표기.
  - **"잘못된 정보 알리기"** 링크: `siteContent.suggestionLinkUrl`(외부 폼)에 밴드명을 쿼리로 붙인다. 폼이 사전 입력을 지원하지 않으면 링크만 둔다.
- 이미지 저작자 표기에서 HTML 잔재나 과도하게 긴 문자열이 있는지 확인한다(예: Metallica가 "Library of Congress Life"로 표시됨 — 원문 확인 필요).

### P4-7. 읽을거리 추가 (선택, 우선순위 낮음)
- **오늘의 밴드**: 날짜를 시드로 한 결정적 선택(같은 날 모두 같은 밴드). 홈 히어로 아래 한 줄.
- **연대기 페이지** `?view=timeline`: 가로축 연도, 장르별 줄에 밴드 결성 시점을 점으로. 장르가 언제 폭발했는지 보인다. P7의 계보도와 좌표 계산을 공유한다.
- **국가별 보기**: 모든 밴드 보기의 국가 필터를 지도 대신 국기 없는 텍스트 칩으로(국가 16개).
- **"알고 계셨나요"**: 밴드별 `trivia?: string[]` — 출처 필수. 채워진 밴드에만 표시.

---

## P5. 화면과 정체성 (4~5일)

### P5-1. 모든 밴드 보기 재설계
**파일**: `AllBandsPage.tsx`, `src/lib/catalogFilters.ts`(신설), `src/index.css`(`.catalog-*`)

- 드롭다운 5개 → **칩 기반 필터 바**.
  - 1줄째: 검색창 + 정렬(이름 / 결성 오래된 순 / 최신 순).
  - 2줄째: 장르 칩 13개(장르 색 점 포함, 가로 스크롤). 장르를 고르면 그 아래에 해당 장르의 세부장르 칩이 펼쳐진다.
  - 3줄째: 연대 칩(60s~10s), 국가는 "국가 ▾" 하나의 팝오버.
  - 선택된 조건은 "적용된 필터" 줄에 제거 가능한 칩으로 모아 보여준다.
- **모바일**: 검색창과 "필터 (2)" 버튼만 노출하고, 버튼을 누르면 아래에서 올라오는 시트에 칩들이 나온다. 첫 화면에 밴드 카드가 보여야 한다.
- **보기 방식 전환**: 카드 격자 / 촘촘한 목록(이름·장르·연도·국가 한 줄). 243팀 이상을 훑기엔 목록이 낫다. 선택은 `localStorage`에 저장.
- **알파벳 점프**: 이름순 정렬일 때 A–Z 색인.
- **렌더링**: 카드 243개(공개 전환 후 308개)를 한 번에 그리지 않는다. 처음 48개만 그리고 스크롤 끝에서 48개씩 추가(IntersectionObserver). 필터가 바뀌면 처음부터.
- 필터 로직은 `catalogFilters.ts`의 순수 함수로 빼고 테스트한다(P0-4 포함).
- **완료 조건**: 375px 화면에서 스크롤 없이 첫 밴드 카드가 보인다. 필터 상태가 URL에 그대로 반영된다(기존 `routeToSearch` 유지).

### P5-2. 이미지 로딩
**파일**: `BandImage.tsx`, `scripts/generate-public-data.ts`, `src/types/music.ts`

- **문제 1**: 59팀이 원본 URL(수 MB)을 `displayUrl`로 쓴다(부록 A-4). 카드 격자에서도 그대로 로드된다.
- **문제 2**: 카드(폭 약 400px)와 상세(폭 약 600px)가 같은 URL을 쓴다. 1280px 썸네일 48팀이 카드에 로드된다.
- **수정**
  1. Commons 썸네일 URL 규칙으로 폭별 URL을 만든다: `https://upload.wikimedia.org/wikipedia/commons/thumb/<a>/<ab>/<파일명>/<폭>px-<파일명>`. 원본 URL `…/commons/<a>/<ab>/<파일명>`에서 변환 가능하다. 유틸 `src/lib/commonsImage.ts`의 `commonsThumb(originalUrl, width)`.
  2. 단, Commons는 **원본보다 큰 폭이나 일부 형식(SVG, 작은 원본)에서 썸네일을 만들지 않는다**. 변환 URL이 404면 원본으로 되돌아가야 한다. 빌드 시 검증하지 말고 `onError`에서 `originalUrl`로 한 번 재시도한다. 임의 폭은 Commons가 거부할 수 있으므로 표준 폭(320, 500, 960, 1280)만 쓴다.
  3. `<img srcSet>`: 카드 = 320w/500w, 상세 = 500w/960w/1280w, `sizes` 지정.
  4. `width`/`height` 속성 또는 `aspect-ratio`로 자리 확보(레이아웃 밀림 방지). 로딩 중에는 장르 색 그라데이션 + 밴드 이니셜 자리표시.
  5. `decoding="async"` 추가. 상세의 첫 이미지만 `fetchPriority="high"`.
- 로고 이미지를 쓰는 밴드(Mother Love Bone 등)는 `object-fit: contain`이 필요하다. `BandImage`에 `image.kind?: 'photo' | 'logo'`를 추가한다.
- **완료 조건**: 모든 밴드 보기 첫 화면에서 로드되는 이미지 총량이 2 MB 이하(지금은 원본 이미지 때문에 수십 MB 가능). 개발자 도구 Network로 확인.

### P5-3. 통합 검색
- **현상**: 검색은 모든 밴드 보기 안에서만, 영문 이름·출신지·태그·멤버 이름으로만 된다. 한글 밴드명, 곡명, 세부장르로는 못 찾는다.
- **수정**
  1. 헤더에 검색 아이콘 → 오버레이(단축키 `/` 또는 Ctrl+K).
  2. 검색 대상: 밴드(영문·한글·별칭), 멤버, 대표곡 제목, 음반 제목(P4-1), 세부장르, 무드.
  3. 인덱스: `generate-public-data.ts`가 `public/data/search-index.json`을 만든다 — `[{ t: 'band'|'member'|'track'|'album'|'subgenre'|'mood', label, sub, bandId? , target }]`. 오버레이를 처음 열 때 fetch.
  4. 매칭: 소문자·발음 기호 제거 후 접두 일치 우선, 그다음 부분 일치. 한글 초성 검색은 하지 않는다.
  5. 결과는 종류별로 묶어 최대 5개씩. 곡을 누르면 해당 밴드 상세의 대표곡 위치로.
- **완료 조건**: "너바나", "Smells Like", "슈게이즈", "Dave Grohl" 검색이 각각 올바른 결과를 낸다.

### P5-4. 밴드 상세 화면 다듬기
**파일**: `BandDetail.tsx`, `src/index.css`(`.detail-*`)

1. **로딩 화면**: `App.tsx`에서 `selectedBandId && bandLoading`일 때 테마 래퍼 없이 `<main className="route-loading">`만 반환한다. 테마 래퍼(`appClassName`, `themeStyle`) 안에서 **인덱스의 축약 데이터로 히어로를 먼저 그리고**, 상세가 도착하면 나머지를 채운다. 인덱스에 이름·이미지·요약·장르가 이미 있다.
2. **구역 내비게이션**: 상세가 길다(소개, 소리, 발자취, 멤버, 히치하이킹, 관계). 상단 고정 미니 탭(소리 · 발자취 · 멤버 · 히치하이킹 · 이어진 밴드)으로 이동.
3. **대표 분위기 표시**: 지금은 이름만 나열한다. 점수 막대(1~5)로 보여주면 밴드의 성격이 한눈에 보이고, 각 무드를 누르면 "느낌으로 찾기"의 해당 무드로 이동.
4. **세부장르 해시태그**를 누르면 해당 세부장르로 걸러진 목록으로 이동(지금은 눌러도 반응 없음).
5. **"주요 멤버 N명"**: 과거 멤버까지 합친 수라 Megadeth는 17명으로 나온다. "현재 4명 · 거쳐간 멤버 13명"으로.
6. **콘셉트 문구**: 구역 제목을 안내서 화법으로 통일. 예: "01 / SOUND 어떤 음악을 하나요?"는 유지, "03 / PEOPLE 주요 멤버" → "03 / CREW 이 밴드의 사람들". 문구는 전부 `siteContent.json`의 `bandDetailCopy`로 옮겨 Studio에서 고칠 수 있게 한다(지금은 일부가 컴포넌트에 하드코딩).
7. **이전·다음 이동**: 목록에서 들어온 경우 같은 목록의 이전/다음 밴드로 가는 화살표(키보드 ←/→).
8. **밴드를 찾지 못한 경우**(`#band=없는id`): 지금은 오류 문구와 버튼만. 비슷한 id 제안과 홈 링크를 준다.

### P5-5. 접근성
- `src/index.css`에 `:focus-visible` 규칙이 2개뿐이다. 버튼·카드·칩·링크 전체에 일관된 포커스 링(`outline: 2px solid var(--orange); outline-offset: 2px`)을 준다.
- 카드 안의 중첩 버튼(카드 전체 버튼 + 하트 버튼)의 탭 순서와 이름 확인.
- 색 대비: 회색 보조 텍스트(`#8b888e` 계열)가 어두운 배경에서 4.5:1을 넘는지 측정하고 미달이면 밝게.
- `prefers-reduced-motion`은 1곳에 있다. 새로 넣는 애니메이션(시트, 오버레이, 계보도)도 같은 미디어 쿼리 안에 둔다.
- 히치하이킹 방향·후보 변경 시 `aria-live="polite"` 영역으로 결과 수를 알린다.
- 모달·시트: 포커스 가두기, Esc로 닫기, 닫으면 여는 버튼으로 포커스 복귀. `SharePanel.tsx`가 이미 하는지 확인하고 공용 훅 `useDialog`로 뺀다.

### P5-6. 콘셉트를 안쪽 화면까지
- 홈의 "히치하이커를 위한 안내서" 화법을 다른 화면에 이어 쓴다. 단, 정보 문장(소개·관계 설명)은 건조하게 유지하고 **틀(제목, 빈 상태, 버튼, 안내문)만** 콘셉트로 쓴다.
  - 빈 상태: "이 조건에 맞는 밴드를 찾지 못했습니다." → "이 좌표에는 아직 등록된 밴드가 없습니다."
  - 로딩: "밴드 항해 기록을 불러오는 중입니다…"(이미 있음)와 같은 톤으로 통일.
  - 404: "지도에 없는 곳입니다."
- 밴드마다 **항목 번호**를 부여한다(예: `RA-0182`). 안내서의 항목처럼 보이고, 공유 시 식별자가 된다. 번호는 `catalog.json`에 `entryNo`로 고정 저장한다(목록 순서로 매기면 밴드 추가 시 바뀐다).
- 히치하이킹 여정 공유 이미지: 지금은 URL만 공유된다. 여정을 한 장의 카드 이미지(Canvas로 생성)로 저장할 수 있게 한다. 선택 작업.

---

## P6. 성능·SEO·기술 부채 (3~4일)

### P6-1. 번들과 인덱스 축소
- **메인 번들 618 KB 중 540 KB가 목록 인덱스 JSON**이다(`public-band-index.json`이 import로 번들에 포함).
- `compactBand`(`scripts/generate-public-data.ts`)에서 화면이 안 쓰는 필드를 뺀다:
  - `genreIds`, `primaryGenre`(구 8장르 체계 — P6-4 이후 제거), `subgenres`(한글 이름 — `taxonomyV2.subgenreIds`로 대체 가능), `image.credit`(빈 값), `tracks: []`, `sources: []`, `style: ''`, `members[].role: ''`.
  - 단 `Band` 타입을 그대로 쓰고 있어 필드를 빼면 타입이 깨진다. `BandSummary` 타입을 새로 정의하고, 목록 컴포넌트(`BandCard`, `AllBandsPage`, `MoodFinderPage`, `GenreExplorerPage`, `HitchhikingPanel`, `RelationMap`, `JourneyBar`)가 `BandSummary`를 받게 바꾼다. 상세만 `Band`.
  - 멤버 이름은 검색에만 쓰이므로 P5-3의 검색 인덱스로 옮기고 요약에서는 뺀다.
- 인덱스를 번들에 넣지 말고 `fetch('./data/band-index.json')`로 분리하는 방안은 **첫 화면이 인덱스에 의존**(장르별 밴드 수, 히어로의 밴드 수)하므로 신중히. 권장: 번들에는 남기되 축약으로 250 KB 이하(gzip 60 KB 이하)를 목표로 한다.
- **완료 조건**: `index-*.js` 400 KB 이하. `scripts/validate-build-output.ts`에 크기 상한 검사를 추가한다.

### P6-2. 검색엔진과 공유
- **현상**: 정적 페이지 `public/bands/<id>/index.html`은 메타 태그만 있고 즉시 `#band=<id>`로 리다이렉트한다. 본문이 없어 검색엔진이 내용을 읽지 못한다. 해시 라우팅이라 밴드별 고유 URL도 검색에 안 잡힌다.
- **수정**
  1. 공유 페이지에 **실제 본문을 넣는다**: 이름, 요약, 소리 설명, 멤버, 대표곡, 관계를 정적 HTML로. `<meta http-equiv="refresh">`를 없애고, JS가 있으면 앱으로 이동하는 스크립트만 남긴다(검색 로봇은 본문을 읽고 사람은 앱으로 간다). 단, 로봇과 사람에게 다른 내용을 보이는 게 되지 않도록 본문은 앱 화면과 같은 정보여야 한다.
  2. JSON-LD `MusicGroup` 구조화 데이터 추가(`name`, `foundingDate`, `foundingLocation`, `genre`, `member`, `sameAs`에 Wikipedia·Wikidata·MusicBrainz URL).
  3. `sitemap.xml`과 `robots.txt`를 `generate-public-data.ts`가 생성(`public/`에). 장르 13개 URL도 포함.
  4. 장르 페이지도 정적 공유 페이지 `public/genres/<id>/index.html`을 만든다.
  5. `siteUrl`이 스크립트에 하드코딩돼 있다(`https://kinggodyoung5.github.io/rockatlas/`). `vite.config.ts`의 `base`와 한 곳에서 관리한다.
- **완료 조건**: 공유 페이지를 JS 없이 열어도 밴드 정보가 읽힌다. `sitemap.xml`에 공개 밴드 전부가 있다.

### P6-3. 테스트와 CI
- 새 순수 함수(`catalogFilters`, `memberOverlap`, `tasteProfile`, `commonsImage`, `relationLabels`, 유사도 v2)는 전부 단위 테스트를 둔다.
- `hitchhiking.test.ts`의 "모든 공개 밴드에서 방향마다 후보 3개 이상" 테스트는 밴드를 공개할 때마다 깨질 수 있다(Thin Lizzy 사례). Studio의 "운영 준비도" 체크(`completeness()` in `StudioPage.tsx`)에 **"히치하이킹 방향 1개 이상"** 항목을 추가해 공개 전에 알 수 있게 한다. `StudioHitchhikingPreview.tsx`가 이미 미리보기를 하므로 그 결과를 체크에 연결한다.
- CI에 `normalize:check`(P1-3) 추가.
- 링크 점검: `LinkHealthPanel.tsx`가 Studio에서 수동으로 한다. 분기 1회 실행을 `PROJECT_STATUS.md`의 정기 작업으로 적는다.

### P6-4. 구 장르 체계 제거
- `GenreId`(8개: `classic-rock`, `hard-rock` …)와 `primaryGenre`, `genreIds`, `subgenres`(한글 문자열), `eraTags[].genreIds`는 분류 v2 이전 체계다. 화면은 대부분 `taxonomyV2`를 쓰고 구 필드는 fallback으로만 남아 있다.
- **단계적 제거**
  1. 모든 밴드에 `taxonomyV2`가 있음을 검증(`validate:taxonomy`가 이미 함)한 뒤 `Band.taxonomyV2`를 필수로 바꾼다.
  2. 컴포넌트의 fallback 분기(`taxonomyGenre?.color ?? genre.color` 등)를 제거한다.
  3. `eraTags[].subgenres`를 세부장르 id 배열로 바꾸는 마이그레이션(`eraTags[].subgenreIds`). 지금은 한글 이름 문자열이라 세부장르 이름을 바꾸면 어긋난다.
  4. `genres.json`, `src/data/genres.ts`, `GenreId` 타입, `legacyGenreByTaxonomy`(`StudioPage.tsx`) 삭제.
- 위험이 크므로 **P2·P3이 끝난 뒤** 별도 브랜치에서 한다. 마이그레이션 전 `scripts/create-local-backup.ps1`로 백업.

### P6-5. 기타 정리
- `src/index.css` 1,409줄 단일 파일을 영역별로 나눈다(`styles/base.css`, `home.css`, `catalog.css`, `detail.css`, `studio.css`). Studio 스타일은 Studio 청크에서만 로드되게 한다.
- `StudioPage.tsx` 803줄: 섹션별 컴포넌트로 분리(이미 `StudioBandBasics` 등 일부 분리됨).
- 외부 폰트: Pretendard(jsDelivr), Black Han Sans(Google Fonts). `font-display: swap` 확인, 가능하면 서브셋 파일을 저장소에 넣어 외부 의존을 없앤다.
- `docs/NEXT_STEPS.md`가 "133개 공개 밴드" 시점에 멈춰 있다. 이 문서를 가리키도록 갱신한다.
- 다른 에이전트의 `docs/PENDING_RELATIONS.md`, `docs/PENDING_YOUTUBE_LINKS.md`가 최신인지 확인하고 낡았으면 삭제 또는 갱신.

---

## P7. 계보도와 두 밴드 잇기 (4~6일) — P2 완료 후

### P7-1. 계보도 (밴드 상세 안)
- **질문**: "이 밴드는 어디서 왔고 어디로 이어졌나?"
- **위치**: 밴드 상세의 관계 구역 위에 "계보로 보기 / 목록으로 보기" 전환. 기본은 목록(P2-4), 계보도는 선택.
- **데이터**: `influenced-by`·`influenced`(방향 있는 화살표), `member-link`(사람 이름이 붙은 선). `shared-scene`·`sounds-like`는 계보도에 넣지 않는다(결정 3.1).
- **배치**
  - 가로축 = 결성 연도. 중심 밴드를 기준으로 선배는 왼쪽, 후배는 오른쪽.
  - 1단계(직접 연결)와 2단계(그 밴드의 영향 관계)까지. 2단계는 흐리게, 최대 12개.
  - 세로 위치는 겹치지 않게 단순 배치(같은 연대 묶음 안에서 순서대로). 물리 시뮬레이션 불필요.
  - `member-link`는 점선 + 사람 이름 라벨, 색은 중립.
- **구현**: 의존성 추가 없이 SVG로 직접 그린다(`src/components/LineageMap.tsx`, 좌표 계산은 `src/lib/lineageLayout.ts` 순수 함수 + 테스트). 노드를 누르면 그 밴드로 이동(`onTravelBand(target, 'connection')`).
- **모바일**: 가로 스크롤 가능한 캔버스, 중심 밴드가 처음에 가운데.
- **시안**: 2026-10-25 논의에서 원형 배치(중심 밴드 주위에 1단계, 바깥에 2단계) 시안을 보여줬다. 운영자는 계보(시간 흐름)가 보이는 쪽을 원했으므로 **가로축 연도 배치**를 기본으로 한다.
- **완료 조건**: Metallica에서 Black Sabbath·Iron Maiden·Motörhead가 왼쪽, Trivium·Avenged Sevenfold가 오른쪽, Megadeth가 "Dave Mustaine" 라벨의 점선으로 보인다.

### P7-2. 두 밴드 잇기
- **기능**: 밴드 두 팀을 고르면 관계를 따라 가장 짧은 경로를 보여준다. "Wet Leg에서 Black Sabbath까지 4단계".
- **파일**: `src/lib/bandPath.ts`(BFS, 테스트), `src/components/PathFinderPage.tsx`, 라우트 `?view=path&from=<id>&to=<id>`.
- **그래프**: 공개 밴드의 모든 관계(양방향). 간선 가중치는 종류별로: 영향 1, 멤버 1, 같은 장면 1.5, 닮은 사운드 2. 가중 최단 경로(다익스트라, 노드 300개라 단순 구현으로 충분).
- **화면**: 경로를 카드 사슬로 표시, 각 연결에 관계 설명. "다른 경로 보기"(두 번째로 짧은 경로). 경로가 없으면 "아직 이어지지 않았습니다 — 두 밴드 모두 관계가 적습니다"와 각 밴드의 관계 수.
- 밴드 상세에 "다른 밴드와 이어보기" 버튼.
- 공유 URL이 곧 결과다.
- **전제**: P2-6으로 관계 0개 밴드가 없어야 재미있다.

### P7-3. 록 은하 지도 (전체 보기) — 후순위
- 홈의 우주 콘셉트와 가장 잘 맞지만 가장 어렵다. P7-1·P7-2가 자리 잡은 뒤에 한다.
- **구성**: 모든 밴드를 점으로, 장르별 성단. 점 크기 = 관계 수. 선 = 사실 관계만(유사도 선 없음).
- **배치는 빌드 시 미리 계산**한다. 브라우저에서 물리 시뮬레이션을 돌리지 않는다. `scripts/generate-galaxy-layout.ts`가 좌표 JSON을 만든다(`d3-force`를 devDependency로만 사용). 런타임은 Canvas 2D로 그린다.
- **상호작용**: 확대·이동, 장르 필터, 밴드 검색 → 해당 점으로 이동, 점 선택 시 이웃만 강조.
- 2026-10-25 시안(SVG + d3-force 런타임)은 243팀에서 동작했지만 관계가 적은 밴드가 외롭게 떠 있었다. P2-6 이후에 다시 평가한다.

---

## P8. 운영과 지속성 (상시)

### P8-1. 초안 65팀 공개 절차
- 초안 65팀(2차 30팀 + 포스터 35팀)이 대기 중이다. 공개 전 체크:
  1. Studio 운영 준비도 7/7.
  2. 히치하이킹 방향 1개 이상(P6-3에서 체크 항목으로 추가).
  3. 대표곡의 `official: false` 건 확인 — 2차 30팀 중 Bloc Party "Like Eating Glass", Greta Van Fleet "Safari Song", Testament "The New Order", Explosions in the Sky 2곡, Faith No More 2곡은 대체 영상이다(`source.note`에 사유).
  4. 공개 후 `npm test`(히치하이킹 전수 테스트)와 `validate:data`.
- 초안이 공개되면 이 문서의 수치(관계 0개 밴드 등)가 바뀐다. 다시 측정한다.

### P8-2. 정기 점검 (분기 1회)
| 점검 | 방법 |
|---|---|
| 링크 생존 | Studio의 링크 점검 패널, `npm run review:videos` |
| 멤버 변동 | `scripts/audit-band-facts.ts` — Wikidata의 현 멤버와 비교. 최근 사례: Mastodon(Brent Hinds 2025 탈퇴·사망), In Flames(Tanner Wayne 2025 탈퇴), Megadeth(Kiko Loureiro 2023 탈퇴) |
| 활동 상태 | `activeYears`가 "현재"인데 해체한 밴드 |
| 표기 | `npm run normalize:check` |
| 관계 | `npm run audit:relations` |

- 밴드에 `factsCheckedAt`(사실 재확인 일자)을 두고 1년 넘은 밴드를 Studio 대시보드에 띄운다.

### P8-3. 수록 범위와 균형
- 익스트림 메탈 7팀, 슈게이즈 12팀, 포크/심포닉 메탈 12팀으로 적다. 반대로 인디 32팀.
- 결성 2010년 이후 15팀뿐(초안에 10팀 대기).
- 미국·영국이 81%. `docs/DATA_SCOPE.md`의 "서양 록" 범위 안에서 독일·북유럽·호주·캐나다·아일랜드를 보강할지 운영자가 정한다.
- 여성 프런트 밴드, 1950~60년대 초 로큰롤(Chuck Berry·Buddy Holly 계열은 솔로라 범위 밖일 수 있음) 등 빈 구간을 `docs/DATA_SCOPE.md`에 "의도적으로 제외"인지 "아직 미수록"인지 구분해 적는다.

### P8-4. 데이터 파일 구조 (장기)
- `catalog.json` 한 파일(6만 줄)에 모든 밴드가 있어 Studio 자동 저장과 스크립트·에이전트 수정이 충돌한다(실제로 여러 번 문제가 됐다).
- 장기 방안: 밴드별 파일(`src/data/bands/<id>.json`)로 쪼개고 빌드 시 합친다. Git diff도 읽기 쉬워진다.
- Studio 저장 API(`server/studioApi.ts`의 `/api/studio/catalog`)와 `catalog-history.json` 구조를 같이 바꿔야 해서 작업이 크다. P6-4와 같은 시기에 검토한다.

---

## 5. 권장 일정

| 순서 | 단계 | 기간 | 선행 조건 |
|---|---|---|---|
| 1 | P0 즉시 수정 | 0.5일 | 운영자 결정(P0-1, P0-2) |
| 2 | P1 표기 정규화 | 1일 | P0 |
| 3 | P2 관계 모델 개편 (P2-1~P2-4) | 3일 | P1 |
| 4 | P5-2 이미지 로딩, P5-1 목록 재설계 | 2일 | — (P2와 병행 가능) |
| 5 | P3-1 분류 검수 도구 + 검수 | 2일 + 데이터 작업 | — |
| 6 | P3-2~P3-4 추천 개선 | 2일 | P3-1, P2-1 |
| 7 | P4-6 출처 표시, P4-2 대표곡, P4-3 소개 | 3일 | P1 |
| 8 | P2-6 관계 보강 (데이터) | 지속 | P2-1~P2-5 |
| 9 | P3-5~P3-6 취향 프로필 | 3일 | P3-2 |
| 10 | P4-1 음반·연표, P4-5 장르 해설 | 5일 + 데이터 작업 | — |
| 11 | P5-3~P5-6 검색·상세·접근성·콘셉트 | 4일 | P4-1(검색 대상) |
| 12 | P6 성능·SEO·부채 | 4일 | 위 전부 |
| 13 | P7 계보도·두 밴드 잇기 | 5일 | P2-6 |

- **가장 먼저 체감되는 묶음**: P0 + P1 + P2-4 + P4-6 + P5-2. 정확성의 겉모습과 속도가 같이 좋아진다.
- **데이터 작업**(P2-6, P3-1, P4-1~P4-5)은 코드 작업과 별개로 계속 진행한다. 한 번에 20~30팀 단위로 끊고 매번 검증·기록한다.

## 6. 운영자 결정이 필요한 사항

구현 전에 운영자에게 물어야 하는 것들이다. 임의로 정하지 않는다.

1. **P0-1**: Wintersun 이미지 — 권리 검수를 대신 진행해도 되는가, 다른 사진으로 바꿀 것인가.
2. **P0-2**: 커밋되지 않은 포스터 초안 35팀 작업을 커밋해도 되는가.
3. **P1-1**: 출신지 표기를 한글("로스앤젤레스, 미국")로 통일하는 데 동의하는가. 미국의 주 표기를 넣을 것인가.
4. **P2-4**: 미검수(`draft`) 관계 364건을 공개 화면에 계속 보일 것인가(권장: 보이되 표식), 검수 전까지 숨길 것인가.
5. **P3-3**: 새 방향 "더 잔잔하게" 추가 여부와 이름.
6. **P3-5**: 헤더 메뉴에 "내 취향"을 추가할 것인가. 메뉴 항목이 늘어난다.
7. **P4-1**: 음반을 정규 음반 전체로 넣을지, 핵심 3~5장만 넣을지.
8. **P5-6**: 항목 번호(`RA-0182`) 도입 여부.
9. **P8-3**: 적은 장르(익스트림 메탈 등)와 비영미권 보강 방향.
10. **P8-1**: 초안 65팀을 이 계획의 어느 시점에 공개할 것인가. 권장: P1(표기 정규화) 직후. 정규화 스크립트가 초안에도 적용되므로.

## 7. 하지 말 것

- 유사도 점수만으로 공개 화면에 "관계"를 만들지 않는다.
- 멤버 공유를 "비슷한 밴드"의 근거로 쓰지 않는다.
- 출처 없이 영향 관계를 새로 쓰지 않는다. 불확실하면 `shared-scene`으로 낮추거나 쓰지 않는다.
- 운영자가 Studio에서 직접 공개한 밴드의 상태·문장을 묻지 않고 바꾸지 않는다.
- 무드 카드에 아이콘·이모지를 넣지 않는다.
- 외부 차트·그래프 라이브러리를 런타임 의존성으로 추가하지 않는다(번들 크기). 필요한 시각화는 SVG/Canvas로 직접 그리거나 빌드 시 계산한다.
- YouTube 임베드, 인기도 점수, 로그인·서버 기능은 이 계획의 범위 밖이다.
- 한 번에 큰 리팩터링(P6-4, P8-4)을 다른 작업과 섞지 않는다.

---

## 부록 A. 대상 목록 (2026-11-16 실측, 공개 밴드 id)

### A-1. 관계 0개 (15)
steel-panther, rainbow, whitesnake, rascal-flatts, jesus-and-mary-chain, bring-me-the-horizon, the-libertines, the-vaccines, hoobastank, beck, kings-of-convenience, peach-pit, mumford-sons, semisonic, ajr

### A-2. 관계 1개 (71)
wintersun, machine-head, manowar, the-prodigy, the-used, placebo, the-kooks, accept, primal-scream, the-national, steppenwolf, sonata-arctica, evanescence, limp-bizkit, alice-cooper, sepultura, the-xx, simple-plan, creedence-clearwater-revival, arch-enemy, cannibal-corpse, toto, eagles, alter-bridge, generation-axe, sting, twin-xl, jonas-brothers, mr-big, mamas-gun, mew, shinedown, vampire-weekend, the-subways, paramore, alabama-shakes, the-bravery, florence-the-machine, kasabian, the-verve, train, cage-the-elephant, nothing-but-thieves, the-calling, nickelback, daughtry, kent, two-door-cinema-club, theory-of-a-deadman, jimi-hendrix-experience, cream, dire-straits, thin-lizzy, genesis, tame-impala, bad-religion, misfits, pulp, royal-blood, bauhaus, echo-and-the-bunnymen, the-smashing-pumpkins, stone-temple-pilots, pavement, blind-guardian, sabaton, opeth, dimmu-borgir, mastodon, gojira, disturbed

### A-3. 대표곡 2곡뿐 (36)
nothing-but-thieves, the-fray, the-calling, snow-patrol, soundgarden, anthrax, rage-against-the-machine, the-beatles, the-rolling-stones, the-who, led-zeppelin, pink-floyd, king-crimson, yes, porcupine-tree, ramones, the-clash, sex-pistols, pixies, sonic-youth, nirvana, pearl-jam, alice-in-chains, black-sabbath, iron-maiden, tool, slayer, death, the-cure, nine-inch-nails, rammstein, steely-dan, lynyrd-skynyrd, mogwai, my-bloody-valentine, bon-jovi

### A-4. 원본 크기 이미지를 `displayUrl`로 쓰는 밴드 (59)
the-used, rainbow, rascal-flatts, extreme, the-xx, interpol, scorpions, the-doors, the-kinks, creedence-clearwater-revival, godspeed-you-black-emperor, rush, kiss, r-e-m, david-bowie, kings-of-convenience, mr-big, the-feeling, pantera, system-of-a-down, mew, shinedown, the-bravery, the-rolling-stones, sonic-youth, iron-maiden, tool, slayer, lynyrd-skynyrd, travis, imagine-dragons, oasis, queen, kent, coldplay, judas-priest, two-door-cinema-club, green-day, bon-jovi, deep-purple, avenged-sevenfold, fleetwood-mac, jimi-hendrix-experience, cream, dire-straits, the-black-keys, thin-lizzy, rancid, pulp, royal-blood, siouxsie-and-the-banshees, bauhaus, echo-and-the-bunnymen, stone-temple-pilots, cocteau-twins, within-temptation, dimmu-borgir, gojira, disturbed

### A-5. 소개(`summary`) 90자 미만 (25)
mazzy-star, the-smiths, ensiferum, neon-trees, the-beatles, the-rolling-stones, the-who, led-zeppelin, king-crimson, porcupine-tree, ramones, the-clash, sonic-youth, nirvana, pearl-jam, alice-in-chains, black-sabbath, iron-maiden, metallica, tool, slayer, nine-inch-nails, rammstein, coldplay, kodaline

### A-6. 소리 설명(`style`) 90자 미만 (37)
the-vaccines, alice-cooper, the-clash, children-of-bodom, lynyrd-skynyrd, my-bloody-valentine, oasis, queen, one-republic, kent, coldplay, judas-priest, two-door-cinema-club, bon-jovi, kodaline, avenged-sevenfold, the-black-keys, thin-lizzy, bad-religion, misfits, rancid, pulp, depeche-mode, siouxsie-and-the-banshees, bauhaus, echo-and-the-bunnymen, the-smashing-pumpkins, stone-temple-pilots, pavement, cocteau-twins, blind-guardian, sabaton, within-temptation, opeth, mastodon, gojira, disturbed

### A-7. "~습니다"체 관계 설명 (16, `출발>대상`)
led-zeppelin>deep-purple, black-sabbath>deep-purple, iron-maiden>avenged-sevenfold, metallica>avenged-sevenfold, one-republic>the-script, coldplay>kodaline, coldplay>the-script, deep-purple>led-zeppelin, deep-purple>black-sabbath, kodaline>coldplay, kodaline>the-script, avenged-sevenfold>metallica, avenged-sevenfold>iron-maiden, the-script>one-republic, the-script>kodaline, the-script>coldplay

### A-8. 과거 멤버가 없는 2005년 이전 결성 밴드 (46, 확인 대상)
rascal-flatts, the-national, the-libertines, beach-house, beck, alter-bridge, sting, kings-of-convenience, ride, kings-of-leon, starsailor, the-1975, the-bravery, the-strokes, semisonic, u2, blur, the-killers, muse, anthrax, porcupine-tree, radiohead, pearl-jam, iron-maiden, metallica, tool, the-cure, nine-inch-nails, rammstein, mogwai, my-bloody-valentine, travis, coldplay, judas-priest, green-day, theory-of-a-deadman, bon-jovi, the-black-keys, bad-religion, rancid, blind-guardian, sabaton, opeth, dimmu-borgir, gojira, disturbed

### A-9. 공개 밴드가 쓰지 않는 세부장르 (25)
sleaze-rock, trip-hop, experimental-alternative, math-rock, celtic-metal, death-doom, grindcore, blackened-death-metal, deathcore, rock-and-roll, heartland-rock, surf-rock, rockabilly, psychedelic-pop, krautrock, avant-garde-metal, melodic-hardcore, riot-grrrl, folk-punk, lo-fi-rock, post-metal, stoner-metal, drone-metal, blackgaze, djent

### A-10. 앨범명이 "Single"인 대표곡 (4)
misfits: Halloween, Last Caress / bauhaus: Bela Lugosi's Dead, Ziggy Stardust

## 부록 B. 주요 파일 지도

| 영역 | 파일 |
|---|---|
| 타입 | `src/types/music.ts`, `src/types/taxonomy.ts` |
| 앱 셸·라우팅 | `src/App.tsx`, `src/lib/explorerRoute.ts`, `src/hooks/useExplorerState.ts` |
| 홈 | `src/components/DiscoveryHome.tsx`, `JourneyBar.tsx` |
| 목록 | `AllBandsPage.tsx`, `GenreExplorerPage.tsx`, `MoodFinderPage.tsx`, `BandCard.tsx`, `BandImage.tsx` |
| 상세 | `BandDetail.tsx`, `HitchhikingPanel.tsx`, `RelationMap.tsx`, `SharePanel.tsx` |
| 추천 | `src/lib/hitchhiking.ts`, `src/config/hitchhiking.ts`, `src/lib/bandSimilarity.ts` |
| 데이터 | `src/data/catalog.json`, `taxonomy.v2.json`, `siteContent.json`, `publicBands.ts`, `bands.ts`(Studio용 전체) |
| 생성·검증 | `scripts/generate-public-data.ts`, `validate-catalog.ts`, `validate-taxonomy.ts`, `validate-build-output.ts`, `audit-relations.ts`, `audit-mood-coverage.ts`, `audit-band-facts.ts` |
| Studio | `StudioPage.tsx`, `StudioTaxonomyEditor.tsx`, `BandIntakePanel.tsx`, `server/studioApi.ts`, `src/lib/bandIntake.ts`, `relationSync.ts` |
| 스타일 | `src/index.css` |
| 배포 | `.github/workflows/deploy-pages.yml` |

## 부록 C. 수치 재측정 명령

작업 시작 시 아래를 돌려 이 문서의 수치와 비교한다.

```bash
node -e "
const c=require('./src/data/catalog.json');const pub=c.bands.filter(b=>b.reviewStatus==='published');const ids=new Set(pub.map(b=>b.id));
const deg=pub.map(b=>b.relations.filter(r=>ids.has(r.targetBandId)).length);
let rel=0,src=0,draft=0;for(const b of pub)for(const r of b.relations){if(!ids.has(r.targetBandId))continue;rel++;if(r.source&&r.source.url)src++;if(r.reviewStatus==='draft')draft++}
let tr=0,off=0;for(const b of pub)for(const t of b.tracks){tr++;if(t.source&&t.source.official)off++}
console.log({total:c.bands.length,published:pub.length,rel0:deg.filter(x=>x===0).length,rel1:deg.filter(x=>x===1).length,relations:rel,sourced:src,relDraft:draft,tracks:tr,official:off,
 tracksLt3:pub.filter(b=>b.tracks.length<3).length,taxDraft:pub.filter(b=>b.taxonomyV2.reviewStatus!=='reviewed').length,
 lowercase:pub.filter(b=>/^[a-z]/.test(b.name)).length,originAscii:pub.filter(b=>/^[A-Za-z]/.test(b.origin)).length,
 evolution:pub.reduce((n,b)=>n+b.relations.filter(r=>r.kind==='evolution').length,0)})"
npm run audit:relations
npm run audit:moods
```

## 부록 D. 완료 시 목표 수치

| 지표 | 현재 | 목표 |
|---|---|---|
| `validate:data` 오류 | 1 | 0 |
| 분류 검수 완료 | 60/243 | 전부 |
| 관계 0개 밴드 | 15 | 0 |
| 관계 2개 이하 밴드 | 139 | 20 이하 |
| 영향 관계의 출처 보유율 | 약 21% | 80% 이상 |
| `evolution` 관계 | 43건 | 0 (member-link로 이관) |
| 대표곡 3곡 미만 밴드 | 36 | 0 |
| 공식 표시 대표곡 | 46% | 85% 이상 |
| 소개 90자 미만 | 25 | 0 |
| 표기 위반(`normalize:check`) | 미측정 | 0 |
| 메인 번들 | 618 KB | 400 KB 이하 |
| 음반·연표 보유 밴드 | 0 | 핵심 50팀 이상 |
| 세부장르 정의 | 0/140 | 수록 밴드가 있는 세부장르 전부 |
