# ROCK ATLAS 현재 작업 상태

> Codex와 Claude가 교대로 작업할 때 가장 먼저 읽는 단일 현황 문서다. 과거 상세 기록은 `docs/PROJECT_HISTORY.md`에 보존한다.

## 1. 시작할 때 반드시 확인

1. 이 파일 전체를 읽는다.
2. 현재 브랜치, `git status --short`, 최근 커밋, `git diff`를 확인한다.
3. 미커밋 변경은 사용자 또는 다른 AI의 작업으로 간주하고 덮어쓰거나 되돌리지 않는다.
4. `catalog.json`이 미커밋이면 HEAD와 밴드 ID를 비교해 신규 데이터를 먼저 식별한다.
5. 문서와 실제 파일이 다르면 Git과 파일을 기준으로 이 문서를 갱신한다.
6. 사용자 승인 없이 `main` 병합·배포를 하지 않는다.

## 2. 현재 기준선

- 갱신: 2026-07-28 KST · Codex
- 작업 브랜치: `codex/taxonomy-v2`
- 이번 구현 커밋: `3413fd6` (`Improve public loading, sharing, and studio safety`)
- 데이터 커밋: `5c56824` (`data: add Korn and Slipknot draft`)
- Studio 안전 보완 커밋: `2aa3ffb` (`fix: block unsafe Studio sessions and preserve drafts`)
- 원격 `origin/main`, `origin/codex/taxonomy-v2`에 `2aa3ffb`까지 반영
- 로컬 `main`: 현재 작업 브랜치보다 26커밋 뒤이므로 “항상 동일”하다고 가정하지 않는다.
- 공개 주소: `https://kinggodyoung5.github.io/rockatlas/`
- GitHub Pages: `main` 푸시 시 `.github/workflows/deploy-pages.yml`로 자동 배포
- 백업 기준: `backup/pre-taxonomy-v2-20260719`

## 3. 최신 데이터 상태

- 현재 총 89개: 공개 88개, 초안 1개.
- 이번에 추가·커밋한 밴드:
  - Korn: 공개
  - Slipknot: 초안
- 구조 개선 중에는 파일을 편집하지 않았고, 최종 검증 후 `5c56824`로 별도 커밋했다.
- `.claude/settings.local.json`은 개인 설정이므로 Git에서 제외했다.

## 4. 이번 구조 개선 완료 내용

2026-07-28 구현과 로컬 검증을 완료하고 `main`과 `codex/taxonomy-v2`에 푸시·배포했다.

- 링크·이미지 전체 검사:
  - 600개 단일 요청 실패 문제를 120개 배치, 진행률 표시, 중단 가능 방식으로 변경.
- 공유:
  - 1200×630 기본 OG 이미지 추가.
  - 메인 Open Graph/Twitter 메타데이터 추가.
  - 빌드 시 공개 밴드별 `/bands/<id>/index.html` 공유 메타 페이지 자동 생성.
  - 상세 화면에 “이 밴드 공유” 추가.
- 테스트:
  - Vitest 추가, 현재 4개 파일·13개 테스트.
  - Gemini JSON 복구, 분위기 별칭, 악센트 ID, 주소, 이미지 위치, 유사도 검사.
  - GitHub Pages 배포 전에 `npm test` 자동 실행.
- 공개 데이터 성능:
  - 운영 원본 `catalog.json`은 하나로 유지.
  - 빌드 시 경량 공개 목록과 밴드별 상세 JSON을 자동 생성.
  - 홈은 경량 목록만 로드하고 상세 진입 시 해당 밴드 JSON만 로드.
  - 전체 카탈로그 청크는 Studio/영상 검수 진입 때만 동적 로드되며 메인 HTML에서 선로드하지 않음.
- 이미지:
  - Studio 업로드 시 용도별 자동 축소·WebP 압축, 원본/결과 용량 표시.
  - 기존 로고·워드마크·히어로 최적화 사본 생성 및 사이트 설정 연결.
- 유지보수:
  - Studio 서버를 `vite.config.ts`에서 `server/studioApi.ts`로 분리.
  - 밴드 기본 편집과 taxonomy 편집을 별도 컴포넌트로 분리.
  - Studio 데이터 변환 도우미를 `src/lib/studioBandUtils.ts`로 분리.
  - 새 밴드 ID 생성 시 악센트를 제거해 `Mötley Crüe → motley-crue` 형태로 생성. 기존 공개 ID는 링크 보호를 위해 그대로 둔다.

## 5. 최근 검증 결과

- `validate:data`: 오류 0, 경고 16. 공개 데이터의 기존 검색 폴백 10건과 Slipknot 초안의 미완성 외부 식별자·대표곡 경고다.
- `validate:taxonomy`: 89/89 통과.
- `validate:uploads`: 통과.
- Vitest: 4개 파일·13개 테스트 통과.
- 최신 프로덕션 빌드와 빌드 산출물 검사 통과.
- 생성 공개 목록: 88개, 약 181KB 원본.
- 생성 상세 JSON: 88개, 합계 약 582KB. 상세 진입 시 한 파일만 요청.
- 생성 공유 페이지: 88개 모두 존재하며 밴드별 제목·주소 검사 통과.
- 메인 `dist/index.html`에서 `catalog-data` 선로드 없음.
- 브라우저:
  - 홈 15개 탐색 카드, 가로 넘침 0.
  - Korn 상세: 대표곡 3개, 멤버 6명, 상세 지연 로딩 정상.
  - 밴드 공유 주소: `/bands/korn/`.
  - Studio: 총 89개와 Slipknot 초안 표시, 디자인/데이터 영역 정상, 콘솔 오류 없음.
  - 모바일 375px: 가로 넘침 0.
- 링크 검사 표본: 홈과 공유 이미지 모두 HTTP 200·정상 판정.
- `git diff --check`: 공백 오류 없음.
- 최종 검증 전후 `catalog.json` SHA-256:
  `F0132707F049F98841BC8ECAE0C56FE9DFC761C1F1428264DD18F4AE3BAFD471`로 동일.
- GitHub Pages 실행 `30361693781`: 성공.
- 공개 홈과 `/bands/korn/`: HTTP 200, 새 OG 이미지·Korn 메타데이터 확인.

## 6. 남은 작업

1. `docs/PENDING_YOUTUBE_LINKS.md`의 직접 링크 후보 10개를 Studio에서 최종 확인한 뒤 사용자 데이터에 반영.
2. Slipknot 초안의 Wikidata, MusicBrainz, 공식 YouTube 채널과 대표곡 링크를 보완한 뒤 공개 여부 결정.
3. Slipknot을 공개하기 전 불완전한 Wikipedia 주소와 외부 식별자·공식 채널·이미지 권리를 보완한다.

## 7. Studio 저장 안전장치 긴급 보완

- 2026-07-28 일반 미리보기 화면에서 Studio가 열려 저장되지 않은 밴드가 사라지는 문제가 확인됐다.
- 공개 사이트와 API 없는 로컬 미리보기에서는 Studio 버튼을 숨기고, `?studio=1` 직접 진입도 차단한다.
- `/api/studio/capability`가 JSON으로 쓰기 가능 상태를 확인한 경우에만 편집 화면을 연다.
- 모든 Studio JSON 요청은 HTML 화면이 돌아오면 내부 파싱 오류 대신 운영자 실행 파일 안내를 표시한다.
- 편집 중 카탈로그·현재 밴드를 브라우저 자동 복구본으로 보존하고, 다음 실행에서 복구 버튼을 제공한다.
- 검수함 Gemini 원문은 초안 추가 직후 지우지 않고 실제 저장이 확인될 때까지 보존한다.
- 과거 `4174` 주소의 원문 복구를 위해 `이전-검수함-복구-4174.bat`을 추가했다.
- 자동 이력과 다운로드 폴더 조사 결과 파일로 남은 최대 밴드 수는 89개다. 과거 원문이 `4174` 브라우저 저장공간에 남아 있는지가 마지막 복구 가능성이다.
- 검증: Vitest 5파일·16테스트 통과, 프로덕션 빌드 통과, 5173/4174 Studio capability와 YouTube JSON 검색 정상.
- GitHub Pages 실행 `30364120123`: 빌드·배포 성공, 공개 번들에 Studio 차단 안내 포함 확인.

## 8. 고정된 제품 방향

- 개발 지식이 없는 운영자의 추가·수정·검수 편의성이 최우선이다.
- 13개 상위 장르, 110개 세부 장르, 24개 분위기 체계를 유지한다.
- 밴드는 대표 장르 한 곳에만 표시하고 교차 장르는 상세·필터에 사용한다.
- 대표곡은 임베드하지 않고 곡 정보와 외부 링크로 제공한다.
- Studio 저장은 로컬에서만 가능하며 공개 정적 사이트는 읽기 전용이다.
- 기존 `#band=` 주소와 내부 ID는 유지한다.
- 댓글·회원가입·인기도 순위·YouTube 임베드 복원은 현재 범위가 아니다.
- 디자인·서버 원칙은 `docs/DESIGN_AND_SERVER_PRINCIPLES.md`를 따른다.

## 9. 종료·교체 전에 기록할 것

- 완료 내용과 커밋 ID
- 미커밋 파일과 소유자
- 실행한 검사와 실제 결과
- 중단 지점과 재현 가능한 오류
- 원격 푸시·`main` 배포 여부
- 다음 AI가 실행할 정확한 한 단계
