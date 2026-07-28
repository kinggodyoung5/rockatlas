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
- 원격 `origin/main`, `origin/codex/taxonomy-v2`: `f52165d` (이번 구현은 아직 푸시하지 않음)
- 로컬 `main`: 현재 작업 브랜치보다 26커밋 뒤이므로 “항상 동일”하다고 가정하지 않는다.
- 공개 주소: `https://kinggodyoung5.github.io/rockatlas/`
- GitHub Pages: `main` 푸시 시 `.github/workflows/deploy-pages.yml`로 자동 배포
- 백업 기준: `backup/pre-taxonomy-v2-20260719`

## 3. 사용자 소유 미커밋 데이터

- `src/data/catalog.json`은 이번 Codex 작업 전에 이미 수정되기 시작했고, 작업 도중 Studio에서 데이터가 추가됐다.
- 현재 총 89개: 공개 88개, 초안 1개.
- HEAD 대비 신규 밴드:
  - Korn: 공개
  - Slipknot: 초안
- 이 파일은 이번 구조 개선 작업에서 직접 편집하지 않았다.
- 코드 커밋 시 `catalog.json`을 자동으로 함께 스테이징하지 않는다. 사용자가 데이터까지 함께 기록해 달라고 할 때만 별도 검수 후 포함한다.
- Studio 저장과 동시에 카탈로그를 읽을 수 있으므로 최종 검증 전후 SHA-256이 다르면 최신 파일로 다시 생성·검증한다.

## 4. 이번 구조 개선 완료 내용

2026-07-28 구현과 로컬 검증을 완료하고 코드만 `3413fd6`으로 커밋했다. 아직 원격 푸시·`main` 병합·배포하지 않았다.

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

## 6. 남은 작업

1. `docs/PENDING_YOUTUBE_LINKS.md`의 직접 링크 후보 10개를 Studio에서 최종 확인한 뒤 사용자 데이터에 반영.
2. Slipknot 초안의 Wikidata, MusicBrainz, 공식 YouTube 채널과 대표곡 링크를 보완한 뒤 공개 여부 결정.
3. 이번 코드 개선은 `catalog.json`과 `.claude/settings.local.json`을 제외해 `3413fd6`으로 커밋했다.
4. 사용자 데이터는 동시 편집이 끝난 뒤 별도 검수·커밋한다.
5. 사용자 승인 전에는 `main` 푸시와 배포 금지.

## 7. 고정된 제품 방향

- 개발 지식이 없는 운영자의 추가·수정·검수 편의성이 최우선이다.
- 13개 상위 장르, 110개 세부 장르, 24개 분위기 체계를 유지한다.
- 밴드는 대표 장르 한 곳에만 표시하고 교차 장르는 상세·필터에 사용한다.
- 대표곡은 임베드하지 않고 곡 정보와 외부 링크로 제공한다.
- Studio 저장은 로컬에서만 가능하며 공개 정적 사이트는 읽기 전용이다.
- 기존 `#band=` 주소와 내부 ID는 유지한다.
- 댓글·회원가입·인기도 순위·YouTube 임베드 복원은 현재 범위가 아니다.
- 디자인·서버 원칙은 `docs/DESIGN_AND_SERVER_PRINCIPLES.md`를 따른다.

## 8. 종료·교체 전에 기록할 것

- 완료 내용과 커밋 ID
- 미커밋 파일과 소유자
- 실행한 검사와 실제 결과
- 중단 지점과 재현 가능한 오류
- 원격 푸시·`main` 배포 여부
- 다음 AI가 실행할 정확한 한 단계
