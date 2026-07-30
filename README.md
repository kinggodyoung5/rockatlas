# ROCK ATLAS — 락밴드 탐험지도

서양 록 밴드를 대표 장르, 세부 장르, 분위기와 관계를 따라 발견하는 한국어 탐험형 웹사이트입니다. 순위보다 “다음 음악으로 가는 길”을 만드는 것을 목표로 합니다.

## 지금 구현된 범위

- 13개 상위 장르와 111개 세부 장르
- 24개 분위기를 최대 3개 조합하는 느낌 탐색기
- 133개 밴드, 대표곡 402개, 편집 관계 229개
- 장르별 탐색, 전체 밴드 검색·필터·정렬, 밴드 상세 화면
- 밴드별 대표 장르 한 곳 노출과 보조 장르·세부 장르 교차 탐색
- 밴드마다 실제 성향에 맞는 방향만 최대 4개 보여주는 히치하이킹 추천과 검수된 관계 지도
- 앨범·연도·한 줄 안내가 있는 대표곡 외부 링크와 공식 YouTube 채널
- 즐겨찾기, 최근 탐험, 자동 저장·공유되는 여행 경로, 반응형 UI와 기본 키보드 접근성
- 코드 없이 콘텐츠와 디자인을 관리하는 로컬 Studio
- Gemini 결과를 붙여넣어 중복·필수값·분류를 검사하고 비공개 초안으로 일괄 추가하는 새 밴드 검수함

분위기 점수와 자동 유사도는 객관적인 음악 평가나 영향 관계가 아니라 운영자가 고칠 수 있는 편집 신호입니다. 검수된 영향 관계와 자동 추천을 UI에서 구분합니다.

## 실행 방법

Node.js 20.19 이상 또는 22.12 이상을 권장합니다.

```bash
npm install
npm run dev
```

배포용 확인:

```bash
npm run validate:taxonomy
npm run validate:data
npm run audit:moods
npm run build
npm run preview
```

## 콘텐츠 운영 Studio

```bash
npm run studio
```

터미널에 표시된 주소에 `?studio=1`을 붙여 엽니다. 예: `http://127.0.0.1:5173/?studio=1`.

Windows에서는 프로젝트 폴더의 `운영자페이지-열기.bat`를 더블클릭하면 5173 포트로 서버를 시작하고 Studio 화면을 자동으로 엽니다. 함께 있는 `운영자페이지-바로가기.url`은 서버가 이미 켜져 있을 때 사용합니다.

프로젝트 전체 작업본과 Git 이력을 로컬에 백업하려면 `프로젝트-백업-만들기.bat`를 더블클릭합니다. 프로젝트 폴더 옆의 `rock-atlas-backups` 폴더에 작업본 ZIP과 Git 이력 묶음이 함께 만들어집니다. 작업본 ZIP에는 `.env.local`이 포함될 수 있으므로 공개 업로드하면 안 됩니다.

Studio에서 할 수 있는 작업:

- 기존 밴드 수정, 신규 초안, CSV 일괄 입력, 전체 JSON 백업·복원
- Gemini Gem용 짧은 고정 지침 생성, JSON 붙여넣기·파일 선택, 자동 정리·검사, 안전한 일괄 초안 추가
- 13장르 대표·보조 분류, 세부 장르, 24개 분위기 점수 편집
- 장르 카드 이름·설명·색상·순서 편집
- 멤버·대표곡·관계·출처·이미지·검수 상태 관리
- Wikidata·MusicBrainz 후보 검색과 선택
- 메인 문구, 폰트 업로드, 굵기·이탤릭, 색상, 히어로 이미지 관리
- 링크·이미지 상태 검사, 휴지통, 최근 20회 백업·복구
- 운영 요약 대시보드와 데이터·분류·테스트·빌드를 실행하는 안전한 배포 준비센터

개발 지식이 없는 운영자를 위한 가장 짧은 추가 절차는 **Gem 지침 최초 1회 등록 → 채팅에 밴드명 입력 → 결과 붙여넣기 → 자동 검사 → 초안 추가 → 전체 저장**입니다. 상세한 사용법과 자동 안전장치는 `docs/BAND_INTAKE_WORKFLOW.md`에 있습니다.

Studio 저장 API와 외부 검색 프록시는 로컬 Vite 서버에서만 동작합니다. GitHub Pages에 배포된 정적 사이트에서 데이터 파일을 직접 수정할 수는 없습니다. 로컬 Studio에서 저장한 뒤 변경 파일을 Git 커밋·푸시하면 자동 배포됩니다.

## 분류 원칙

- 밴드는 목록에서 `taxonomyV2.primaryGenreId` 한 곳에만 등장합니다.
- 겹치는 성향은 `secondaryGenreIds`와 `subgenreIds`로 저장합니다.
- 분위기는 0~5 편집 점수이며 의미 있는 값만 저장합니다.
- 장르당 최소 밴드 수를 강제하지 않습니다. 데이터가 없는 장르도 체계상 유지할 수 있습니다.
- 인기도 점수와 활동 상태 추정은 만들지 않습니다.
- 기존 `primaryGenre`, `genreIds`, 표시용 `subgenres`는 안전한 롤백을 위해 보존합니다.

13개 상위 장르와 24개 분위기의 기준 데이터는 `src/data/taxonomy.v2.json`에 있습니다. 마이그레이션 원칙은 `docs/TAXONOMY_V2_MIGRATION.md`에서 확인할 수 있습니다.

## 주요 구조

```text
src/
  components/                 공개 탐색 화면, 상세, Studio
  data/catalog.json           133개 밴드 원본 카탈로그와 자동 연결 대기 관계
  data/taxonomy.v2.json       13장르·111세부장르·24분위기
  data/siteContent.json       Studio가 관리하는 화면 문구·테마
  lib/explorerRoute.ts        GitHub Pages 호환 URL 상태
  lib/bandSimilarity.ts       설명 가능한 자동 유사도 점수
  lib/hitchhiking.ts          방향별 추천·여행 경로·공유 주소
  config/hitchhiking.ts       방향 후보군과 분위기 가중치의 단일 설정
  lib/bandIntake.ts           AI 조사 JSON 정리·검사·강제 초안 엔진
  types/music.ts              밴드·트랙·관계 데이터 타입
  types/taxonomy.ts           새 분류 타입
scripts/
  validate-taxonomy.ts        새 분류와 밴드 연결 검사
docs/
  TAXONOMY_V2_MIGRATION.md    안전한 병행 전환 원칙
  BAND_INTAKE_WORKFLOW.md     비개발자용 새 밴드 검수함 사용법
  NEXT_STEPS.md               다음 개발·검수 순서
PROJECT_STATUS.md             현재 작업 상태와 안전 기준선
```

## 데이터와 저작권

`SourceRef`는 정보 출처·접근일·교차 확인 메모를 저장하고, `ImageCredit`은 원본 URL·저작자·라이선스·검수 상태를 저장합니다. 133개 대표 이미지는 Wikimedia Commons 원본 페이지의 저작자·라이선스 메타데이터를 기준으로 검수되어 있습니다.

공개 상세 화면은 YouTube 임베드를 사용하지 않습니다. 대표곡은 앨범·연도·감상 안내와 외부 링크로 표시하며, 아티스트 공식 채널도 연결합니다. 기존 임베드 검수 기록은 운영 메타데이터로만 보존합니다.

## 배포

`vite.config.ts`의 `base: './'` 설정으로 GitHub Pages 하위 경로에서 동작합니다. `.github/workflows/deploy-pages.yml`은 `main` 푸시 때 검사·빌드·배포를 수행합니다. Studio의 배포 준비센터는 검사와 빌드만 실행하며 커밋·푸시·배포는 하지 않습니다.

댓글, 로그인, 기기 간 동기화 같은 서버 기능은 포함하지 않았습니다. 즐겨찾기와 최근 탐험 기록은 현재 브라우저의 `localStorage`에 저장됩니다.
