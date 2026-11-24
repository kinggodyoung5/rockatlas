# taxonomy v2 개발 워크플로

각 단계는 시작 전에 목표 적합성, 구현 가능성, 데이터 손실 위험, 예상 유지비를 다시 검토한다. 조건을 만족하지 못하면 다음 단계로 넘어가지 않는다.

## 0. 안전 기준선 — 완료

- `main`을 변경 전 상태로 유지
- 원격 백업 브랜치와 태그 생성
- `codex/taxonomy-v2`에서만 개편
- 기존 카탈로그·8장르·밴드 URL 삭제 금지

통과 조건: 원격에서 변경 전 커밋으로 즉시 돌아갈 수 있을 것.

## 1. 중앙 분류 데이터 — 완료

- 13개 상위 장르
- 110개 세부 장르
- 24개 분위기, 4개 그룹
- ID·순서·교차 참조 자동 검사

통과 조건: 중복 ID, 끊어진 세부 장르·분위기 참조가 없을 것.

## 2. 밴드 데이터 병행 마이그레이션 — 완료

- 46개 기존 밴드에 `taxonomyV2` 추가
- 대표 장르 한 곳과 보조 장르 분리
- 세부 장르 안정 ID와 분위기 0~5 편집 점수 저장
- 기존 필드는 롤백용으로 보존

분위기는 MusicBrainz 커뮤니티 태그, 기존 장르·태그·설명을 후보 신호로 활용했다. 외부 데이터만으로 곡의 분위기를 객관적으로 확정하는 것은 어렵기 때문에 밴드 단위 편집 초안으로만 저장하며 Studio 검수를 전제로 한다.

통과 조건: 46/46 밴드에 유효한 대표 장르가 있고 점수 범위가 0~5일 것.

## 3. 운영 Studio — 완료

- 밴드별 대표·보조 장르, 세부 장르, 24분위기 수정
- 초안/검수됨 상태와 메모
- 13장르 카드 표시명·설명·색상·순서 수정
- 새 분류 파일 전용 로컬 저장 API

통과 조건: 기존 8장르 파일을 덮어쓰지 않고 새 분류만 저장할 것.

## 4. 공개 탐색 UI — 완료

- 메인 15개 카드
- 장르 상세와 실제 데이터가 있는 세부 장르 필터
- 전체 밴드 검색·필터·정렬
- 분위기 최대 3개 조합 탐색
- GitHub Pages 호환 쿼리 주소와 기존 밴드 해시 주소 병행

통과 조건: 밴드는 대표 장르 한 곳에만 노출되고 빈 장르·빈 결과도 오류 없이 표시될 것.

## 5. 상세·추천 통합 — 완료

- 새 장르·세부 장르·대표 분위기를 상세 화면에 표시
- 편집자가 검수한 관계와 자동 유사도 추천을 구분
- 추천 이유를 장르·세부 장르·분위기 신호로 설명

통과 조건: 자동 유사도가 검수된 영향 관계처럼 보이지 않을 것.

## 6. 통합 QA — 진행 중

- TypeScript, taxonomy, catalog, production build
- 브라우저 데스크톱·모바일 확인
- 뒤로 가기, URL 복원, 빈 결과, Studio 저장 확인
- 접근성 기본선과 번들 크기 검토

통과 조건: 기능 오류가 없고 사용자가 결과물을 직접 점검할 수 있을 것.

## 7. 검토와 병합 — 대기

- 작업 브랜치 원격 백업
- 사용자에게 로컬 검토 화면과 변경 요약 제시
- 승인 뒤에만 `main` 병합·GitHub Pages 배포

배포 후에도 변경 전 백업 브랜치와 태그를 유지한다.

## 8. 무드 점수 기준 (개선 계획 P3-1)

무드 점수는 히치하이킹 방향, 느낌으로 찾기 일치도, 밴드 유사도의 **유일한 입력**이다. 같은 숫자가 밴드마다 다른 뜻이 되지 않도록 아래 기준을 따른다. 검수는 Studio **분류 검수 대기열**에서 같은 장르 밴드를 나란히 놓고 한다(`npm run audit:moods -- --queue`로도 목록을 볼 수 있다).

### 점수의 뜻

| 점수 | 뜻 | 판단 질문 |
|---|---|---|
| 5 | 핵심 정체성 | 이 무드를 빼면 밴드를 설명할 수 없는가? |
| 4 | 대표곡 대부분에서 뚜렷함 | 대표곡 3곡 중 2곡 이상에서 바로 들리는가? |
| 3 | 분명한 특징 | 한 시기나 일부 대표곡에서 분명하게 들리는가? |
| 1–2 | 가끔 드러남 | 있긴 하지만 이 밴드를 고르는 이유는 아닌가? |
| 0 | 미지정 | 해당 없음 |

- **3점부터 "강한 신호"다.** 히치하이킹 진입 규칙, 느낌으로 찾기 결과, 유사도의 공유 무드는 모두 3점 이상만 센다. 1–2점은 화면에 거의 영향을 주지 않으므로, 애매하면 넣지 않는 편이 낫다.
- 밴드당 3점 이상 무드는 **3~6개**, 5점은 **1~3개**를 권한다. 3점 이상이 2개 이하면 히치하이킹 방향이 1개 이하로 줄어 막다른 길이 된다.
- 점수는 밴드의 **대표적인 시기·대표곡** 기준이다. 커리어 전체의 모든 변화를 넣지 않는다(예: 후기 실험작 한 장 때문에 `experimental-weird`를 올리지 않는다).
- 장르 이름이 곧 무드는 아니다. 메탈이라고 `aggressive-heavy`를 자동으로 주지 않는다(예: Nightwish·Within Temptation은 웅장함이 핵심이고 공격성은 약하다).

### 무드별 기준 밴드

같은 장르 안에서 점수를 맞출 때 아래 밴드를 기준점으로 쓴다. 0점 예시는 "헷갈리기 쉽지만 해당하지 않는" 밴드다.

| 무드 | 5점 | 3점 | 0점(헷갈리지만 해당 없음) |
|---|---|---|---|
| bright-upbeat 밝고 신나는 | Van Halen, The Vaccines, The Kooks | The Cars, Journey, Pulp | Joy Division, Radiohead |
| fast-driving 빠르고 질주하는 | Anthrax, Bad Religion, Dead Kennedys | Sabaton, Royal Blood, Trivium | Black Sabbath(묵직하지만 느림) |
| groovy-danceable 춤추기 좋고 그루비한 | New Order, The Stone Roses, Franz Ferdinand | Red Hot Chili Peppers, The Black Keys, Bloc Party | Radiohead(전자음만으로 그루비가 아님) |
| aggressive-heavy 강렬하고 공격적인 | Lamb of God, Machine Head, Anthrax | Foo Fighters, Rancid, Audioslave | Nightwish, Evanescence(무겁지만 공격성은 약함) |
| massive-heavy 묵직하고 압도적인 | Meshuggah, Gojira, Melvins | Thin Lizzy, Dio, Porcupine Tree | Coldplay |
| slow-calm 잔잔하고 느린 | Beach House, Mazzy Star, The xx | — (기준 밴드 보강 필요) | Slowdive(몽환적이지만 노이즈가 큼) |
| melancholic-lonely 우울하고 쓸쓸한 | The Smiths, Joy Division, The National | The Smashing Pumpkins, Wolf Alice, Fontaines D.C. | Oasis |
| dark-gloomy 어둡고 음울한 | Bauhaus, King Diamond, Interpol | Soundgarden, Depeche Mode, Ghost | The Smiths(쓸쓸하지만 음산하지 않음) |
| warm-comforting 따뜻하고 편안한 | Kings of Convenience, Peach Pit | Tom Petty and the Heartbreakers, Toto, Mumford & Sons | Cigarettes After Sex를 5로 주지 않는다(차분하지만 차가운 쪽) |
| romantic-emotional 낭만적이고 감성적인 | Snow Patrol, Suede, Kodaline | Foreigner, Europe, Tesla | Interpol |
| youth-rebellious 청춘과 반항 | The Libertines, Dead Kennedys, Mudhoney | Kings of Leon, Rage Against the Machine, Wet Leg | Eagles |
| hopeful-uplifting 희망적이고 벅찬 | Boston, The Verve, Mumford & Sons | Fleetwood Mac, Incubus, Scorpions | Joy Division |
| dreamy-ethereal 몽환적이고 흐릿한 | Cocteau Twins, Slowdive, Beach House | Tame Impala, Sleep Token, A Perfect Circle | Pink Floyd를 우주감(cosmic)과 혼동하지 않는다 |
| cold-urban 차갑고 도시적인 | Interpol, Joy Division, The xx | Depeche Mode, The Cars, Bloc Party | The Strokes(도시적이지만 차갑지 않음) |
| cosmic-psychedelic 우주적이고 환각적인 | Pink Floyd, The Doors, King Gizzard | The Beatles(사이키 시기), Screaming Trees | Slowdive |
| noisy-wall 노이즈와 사운드의 벽 | My Bloody Valentine, Sonic Youth, The Jesus and Mary Chain | The Smashing Pumpkins, Wolf Alice | Metallica(무겁지만 노이즈 질감이 아님) |
| acoustic-organic 어쿠스틱하고 자연스러운 | Eagles, Kings of Convenience, Mumford & Sons | Fleetwood Mac, Led Zeppelin, The Rolling Stones | Coldplay |
| electronic-synth 전자음과 신스가 많은 | Depeche Mode, New Order, Nine Inch Nails | Tame Impala, Architects, Kasabian | The Killers를 5로 주지 않는다(신스는 장식) |
| epic-cinematic 웅장하고 영화적인 | Nightwish, Sabaton, Muse | Genesis, Mastodon, Behemoth | Travis(떼창형이지만 웅장하지 않음) |
| technical-complex 복잡하고 테크니컬 | Dream Theater, Meshuggah, Rush | Gojira, Blind Guardian, Kreator | AC/DC |
| experimental-weird 실험적이고 기묘한 | Talking Heads, King Crimson, Sonic Youth | Pavement, Faith No More, Jane's Addiction | Dream Theater(복잡하지만 기묘하지 않음) |
| long-form-immersive 긴 곡에 몰입하는 | Godspeed You! Black Emperor, Tool, Yes | Genesis, Black Sabbath | Iron Maiden을 대표곡 길이만으로 5로 주지 않는다 |
| riff-solo-driven 기타 리프와 솔로 중심 | Deep Purple, Jimi Hendrix Experience, Cream | Foo Fighters, Ghost, Incubus | Queen을 0으로 두지 않는다(브라이언 메이) — 검수 대상 |
| anthemic-live 떼창하고 싶은 공연장형 | Foo Fighters, Kings of Leon, Muse | Soundgarden, Trivium, Dirty Honey | Mazzy Star |

- 표의 예시는 2026-11-24 카탈로그 점수를 바탕으로 했다. 기준 밴드의 점수를 바꾸면 이 표도 함께 고친다.
- 대기열의 표시 기준: **같은 계열과 점수가 크게 다름** = 같은 대표 장르+세부장르를 공유하는 동료 평균 무드 벡터와의 코사인 유사도 0.5 미만 / **3점 이상 무드 2개 이하** / **히치하이킹 방향 1개 이하**(진입 규칙 기준) / **대표 장르의 핵심 무드**(`quickMoodIds`)가 모두 3점 미만. 표시는 "먼저 볼 곳"이지 오류가 아니다 — Queen처럼 장르 안에서 원래 독특한 밴드도 걸린다.
