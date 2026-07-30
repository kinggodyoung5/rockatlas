# ROCK ATLAS 현재 작업 상태

> Codex와 Claude가 교대로 작업할 때 가장 먼저 읽는 인수인계 문서다. 과거 상세 기록은 `docs/PROJECT_HISTORY.md`를 참고한다.

## 1. 작업 시작 규칙

1. 이 파일을 끝까지 읽는다.
2. 현재 브랜치, `git status --short`, 최근 커밋, `git diff`를 확인한다.
3. 미커밋 변경은 운영자 또는 다른 AI의 작업으로 보고 삭제·되돌리기·덮어쓰기를 하지 않는다.
4. `catalog.json`이 미커밋이면 HEAD와 밴드 ID를 비교해 새 데이터가 있는지 먼저 확인한다.
5. 문서와 실제 파일/Git이 다르면 실제 상태를 기준으로 문서를 갱신한다.
6. 운영자 승인 없이 `main` 병합·배포를 하지 않는다.

## 2. 현재 기준

- 갱신: 2026-07-28 KST · Codex
- 작업 브랜치: `codex/taxonomy-v2`
- 카탈로그 검수 커밋: `9e4d28f` (`data: review and publish recovered band catalog`)
- 원격 `main`, `codex/taxonomy-v2`: 카탈로그 검수 커밋과 이 상태 문서 커밋까지 동기화
- 공개 주소: <https://kinggodyoung5.github.io/rockatlas/>
- 배포: `main` 푸시 후 `.github/workflows/deploy-pages.yml`
- 백업 기준: `backup/pre-taxonomy-v2-20260719`
- `.claude/settings.local.json`은 개인 설정이므로 Git에 포함하지 않는다.

## 3. 2026-07-28 카탈로그 전면 검수

- Studio에서 복구·추가된 카탈로그를 기준으로 총 133개 밴드를 검수했다.
- 기존 초안 25개를 모두 공개 상태로 전환했다.
- 25개 밴드에 Wikimedia Commons 이미지, 저작자, 라이선스, 원본 파일 링크를 채웠다.
- 25개 밴드의 Wikidata·MusicBrainz·공식 YouTube 채널을 대조했다.
- 초안과 기존 공개 밴드에서 검색 링크만 있던 대표곡을 모두 직접 영상 링크로 교체했다.
- 현재 402곡 모두 직접 YouTube 링크가 있다.
- LANY `Malibu Nights`의 접근 제한 영상을 정상 공식 오디오로 교체했다.
- Mamas Gun의 존재하지 않는 것으로 확인된 `Red Light Green Light`, `Looking For John`을 공식 발매곡 `This Is The Day`, `Looking For Moses`로 수정했다.
- U2 `I Still Haven't Found What I'm Looking For`, The Cranberries `Ode to My Family`의 잘못된 제목을 바로잡았다.
- Kings of Convenience의 비어 있던 세부 장르와 시대별 세부 장르를 보완했다.
- Florence + the Machine, Cage the Elephant의 누락된 MusicBrainz 식별자를 채웠다.
- Studio 이력에는 대량 변경 직전 133개 카탈로그 원본이 자동 백업되어 있다.

## 4. 검증 결과

- `validate:data`: 밴드 133, 트랙 402, Wikidata 133/133, MusicBrainz 133/133, Commons 이미지 133/133, 공식 YouTube 133/133, 오류·경고 0.
- `validate:taxonomy`: 13개 상위 장르, 110개 세부 장르, 24개 분위기, 133/133 통과.
- Vitest: 5개 파일, 17개 테스트 통과.
- 프로덕션 빌드: 공개 목록 133개, 상세 JSON 133개, 공유 페이지 133개 생성 및 검증 통과.
- 브라우저 확인:
  - 전체 밴드 화면에 133개 표시.
  - Twin XL 이미지와 `Good`, `Lemonade`, `Problematic` 표시.
  - Mamas Gun 이미지와 수정된 `This Is The Day`, `Looking For Moses` 표시.
- 신규·수정 대표곡 79개 중 oEmbed 실검사에서 78개 통과, 접근 제한 1개는 정상 공식 오디오로 교체 후 통과.
- Commons 직접 이미지 일괄 요청은 요청 제한(HTTP 429)이 있었으나 각 파일은 Commons API에서 파일·저작자·라이선스 정보를 개별 확인했다.

## 5. 이번 변경 파일

- `src/data/catalog.json`: 133개 전체 공개 및 검수 정보 반영.
- `scripts/collect-image-candidates.ts`: 초안만 수집하고 결과 파일로 저장하는 옵션 추가.
- `scripts/search-youtube-videos.ts`: 초안/직접 링크 누락 필터와 결과 파일 저장 옵션 추가.
- `PROJECT_STATUS.md`: 깨진 인코딩을 정리하고 현재 상태로 재작성.
- `.claude/settings.local.json`: 사용자 개인 파일, 커밋 제외.

## 6. 커밋·배포 상태

- 카탈로그 검수 커밋 `9e4d28f`를 `main`과 `codex/taxonomy-v2`에 푸시했다.
- GitHub Pages 실행 `30369179158`: 성공.
- 공개 사이트에서 전체 133개 목록, Twin XL·Mamas Gun 노출, Twin XL 이미지와 3곡을 확인했다.
- 상태 문서 후속 커밋도 두 원격 브랜치에 동기화했다.
- 다음 정확한 단계: 새 운영자 요청이 들어오면 이 문서와 최신 Git 상태를 확인하고 시작한다.

## 7. 고정 제품 방향

- 개발 지식이 없는 운영자가 Studio에서 밴드 추가·수정·검수할 수 있어야 한다.
- 13개 상위 장르, 110개 세부 장르, 24개 분위기 체계를 유지한다.
- 밴드는 대표 장르 한 곳에만 표시하고 교차 장르·분위기는 상세와 필터에서 사용한다.
- 대표곡은 임베드하지 않고 곡 설명과 직접 외부 링크를 제공한다.
- 공개 사이트는 읽기 전용이고 Studio 저장은 로컬에서만 허용한다.
- 기존 `#band=` 주소와 밴드별 공유 페이지를 유지한다.
- 디자인·서버 원칙은 `docs/DESIGN_AND_SERVER_PRINCIPLES.md`를 따른다.

## 8. 다음 개발 후보

- 이번 카탈로그 검수 이후 별도 확정된 다음 기능은 없다.
- 새 작업을 시작할 때 운영자 요청과 Git 상태를 우선 확인한다.
- 대량 밴드 추가 시 후보 수집 → 검수 → Studio 저장 → 데이터 검사 → 빌드 → 커밋 순서를 유지한다.

## 9. 2026-07-28 모바일 장르 카드·Studio 디자인 반영

- YouTube Data API의 `search.list`는 반환 결과 수와 무관하게 요청 1회 비용이 같으므로 후보 8개 설정을 유지했다.
- 모바일 장르 카드에서 숨겨졌던 간략 설명을 13px·최대 2줄로 표시하도록 수정했다.
- 운영자가 Studio에서 저장한 히치하이킹 문구 줄바꿈과 클래식/루츠 록 이미지 위치 변경을 보존했다.
- 업로드 검사, Vitest 17개, 프로덕션 빌드와 공개 데이터 생성 검증이 통과했다.
- 운영자가 이번 변경의 커밋·배포를 명시적으로 승인했다.

## 10. 2026-07-30 Claude 점검·수정 (Codex 대규모 개편 이후)

Codex의 공개 데이터 분리(`generate-public-data.ts`, `publicBands.ts`, 공유 페이지, Vitest 도입)와 133개 카탈로그 전면 검수 이후, 운영자가 제기한 3건의 확인사항과 3건의 수정사항을 처리했다.

**확인사항 (조사만, 코드 변경 없음)**

1. 개러지록(Garage Rock) 세부 장르가 없다 — `taxonomy.v2.json`에는 `garage-punk`, `garage-rock-revival`만 있고 순수 `garage-rock`은 존재하지 않는다. 실제 분류 공백이며, 추가 여부는 운영자 결정이 필요하다.
2. "밴드가 나중에 등록되면 자동으로 연결됩니다" 안내는 실제로 동작하지 않는다 — `bandIntake.ts`가 존재하지 않는 타겟 밴드의 관계를 걸러낼 때 데이터를 어디에도 저장하지 않고, 유일한 후속 장치는 사람이 손으로 관리하는 `docs/PENDING_RELATIONS.md`뿐이다. 안내 문구가 과장돼 있다.
3. 포스트펑크-고딕 장르 설명과 킬러스·카이저칩스 음악의 괴리 — 두 밴드가 속한 `post-punk-revival` 세부 장르가 `post-punk-goth-new-wave` 상위 그룹에 묶여 있는데, 그룹 설명 문구는 진짜 어둡고 음울한 나머지 세부 장르(고딕 록, 다크웨이브, 콜드웨이브)를 기준으로 쓰여 있다. 밴드 분류 자체는 정확하며, 상위 그룹 설명·묶음 구조의 문제다.

**수정사항 (구현 완료)**

1. 관계 양방향 자동 동기화 — `src/types/music.ts`에 `Relation.mirroredFrom?: string` 추가, `StudioPage.tsx`에 `syncMirroredRelation()`을 구현해 `addRelation`/`updateRelation`/관계 삭제 시 상대 밴드에 반대 방향 관계(`influenced-by` ↔ `influenced`, 나머지는 대칭)를 자동 생성·삭제한다. 운영자가 직접 입력한 관계(`mirroredFrom` 없음)는 절대 건드리지 않는다. 브라우저에서 Twin XL → Jonas Brothers 관계 추가/종류 변경 시 상대측에 자동 미러가 정확히 생성됨을 확인했다.
2. 분위기(mood) 유사 표현 인식 개선 — `bandIntake.ts`의 기존 문자열 전체 바이그램 비교를 단어 단위 토큰화(`tokenizeMoodLabel`)와 단어별 최적 매칭(`wordSetSimilarity`)으로 교체해, 어순이 바뀌거나 표현만 다른 문구(예: "음울하고 어두운" ≈ "어둡고 음침한")를 더 잘 잡아낸다. `bandIntake.test.ts`에 관련 테스트 4건 추가, 전체 21개 테스트 통과.
3. 모바일 지도 공유 후 뒤로가기 오류 수정 — `App.tsx`의 `popstate` 핸들러가 라우트만 갱신하고 공유 패널 상태(`shareOpen`)는 그대로 두던 문제였다. 밴드 페이지에서 공유 패널을 연 채로 브라우저 뒤로가기를 누르면 URL은 바뀌지만 `overflow:hidden` 오버레이가 화면에 남아 뒤로가기가 안 되는 것처럼 보였다. `onPopState`에 `setShareOpen(false)`를 추가해 해결. 브라우저에서 재현 후 수정을 확인했다.

**검증 결과**

- `npx tsc -b`: 통과.
- `npm test`: Vitest 5개 파일, 21개 테스트 통과 (기존 17개 + 신규 분위기 테스트 4개).
- `npm run validate:data`: 밴드 133, 트랙 402, 관계 227, 오류 없음.
- `npm run validate:taxonomy`: 13개 상위 장르, 110개 세부 장르, 24개 분위기, 133/133 통과.
- `npm run build`: 공개 목록 133개, 상세 JSON 133개, 공유 페이지 133개 생성 및 검증 통과.
- 브라우저 확인: 양방향 관계 동기화, 지도 공유 후 뒤로가기 모두 실제 동작 확인.
- 테스트 중 `catalog.json`에 남았던 임시 테스트 데이터(Twin XL → Jonas Brothers 관계)는 원래 관계(Twin XL → LANY, shared-scene)로 되돌렸다.

**다음 단계**: 위 3건의 확인사항(개러지록 추가 여부, pending-relations 문구/기능 보완, 포스트펑크-고딕 그룹 재구성 여부)은 운영자 결정 대기 중. 커밋·배포는 운영자 승인 후 진행한다.

## 11. 2026-07-30 확인사항 후속 조치 (운영자 결정 반영)

운영자가 섹션 10의 확인사항 3건에 대해 결정을 내려 후속 구현을 완료했다.

1. **개러지록 세부 장르 추가** — `taxonomy.v2.json`에 `garage-rock`(개러지 록)을 신설해 `indie-britpop-garage` 그룹의 `garage-rock-revival` 옆에 추가했다. 다른 상위 장르에도 "리바이벌/파생 장르는 있는데 기본 장르가 없는" 유사 공백이 있는지 110개 세부 장르 전체를 점검했고, `garage-rock` 외에는 발견되지 않았다(레거시 v1 `genres.json`에만 남아있던 "부기 록"은 현재 어떤 밴드도 사용하지 않아 제외).
2. **자동 보류(pending relations) 시스템 구현** — 안내 문구만 있고 실제로는 관계 데이터를 버리던 기존 동작을 실제로 동작하는 시스템으로 교체했다.
   - `src/types/music.ts`: `PendingRelation` 타입 추가.
   - `src/lib/bandIntake.ts`: 대상 밴드가 아직 없는 관계를 버리지 않고 `IntakeCandidate.pendingRelations`로 보존.
   - `src/components/StudioPage.tsx`: `resolvePendingRelations()`로 새 밴드가 추가될 때마다(일괄 검수함·CSV·수동 새 밴드 저장 모두) 보류 목록을 검사해 대상 밴드가 존재하면 양쪽에 정방향·역방향 관계를 자동 생성. 카탈로그 저장 시 `pendingRelations`를 `catalog.json` 최상위에 함께 저장.
   - `src/components/DataManagerPanel.tsx`: "보류 중인 관계" 진단 패널 추가로 대기 중인 항목을 운영자가 볼 수 있게 함.
   - `server/studioApi.ts`: `/api/studio/catalog` PUT이 `pendingRelations`도 함께 저장하도록 확장.
   - 브라우저에서 A→B(B 미존재) 관계로 밴드 A를 먼저 추가 → "보류 중인 관계 1" 확인 → 밴드 B 추가 → 보류 0으로 감소, A는 `influenced-by → B`, B는 자동 생성된 `influenced ← A`를 정확히 보유함을 실제로 검증했다(테스트 데이터는 저장하지 않고 폐기).
3. **포스트펑크/고딕/뉴웨이브 그룹 설명 수정** — 운영자가 제안한 문구로 교체: 카드 설명(`vibeDescription`) "80년대 감성의 스타일리시한 사운드, 세련된 도시의 록.", 상세 설명(`description`) "펑크의 거친 에너지에 전자음과 댄서블한 리듬을 얹어, 어두운 감성부터 신나는 팝 멜로디까지." 어둡고 음울한 서브장르(고딕 록·다크웨이브·콜드웨이브)와 밝고 신나는 포스트펑크 리바이벌(킬러스·카이저칩스 등)을 모두 포괄하는 문구로, 실제 포스트펑크 장르사(조이 디비전 계열의 음울함과 뉴웨이브 계열의 화려함이 공존)와도 부합한다.

**검증 결과**: `tsc -b`, `npm test`(5개 파일 21개 통과), `validate:data`(133개 밴드 오류 없음), `validate:taxonomy`(111개 세부 장르, 오류 없음), `npm run build`(공개 목록·상세 JSON·공유 페이지 각 133개) 모두 통과. 브라우저에서 개러지록 세부 장르 노출, 포스트펑크 그룹 카드·상세 설명, 보류 관계 자동 연결을 모두 확인했다.
