# 내용 보완 작업용 메모

기능 작업(P3 이후)이 끝난 뒤 한꺼번에 보완할 데이터·문장 작업 목록이다. 기능 작업 중에는 여기 항목을 건드리지 않고, 새로 발견한 보완거리만 아래에 덧붙인다.

- 작성: 2026-11-24 (P2-6 관계 보강 2차 직후)
- 수치 재측정: `npm run audit:relations`, `npm run validate:data` (경고 목록), 부록 C 명령(`docs/IMPROVEMENT_PLAN_2026-11.md`)
- 관계 추가 도구: `scripts/add-relations.ts` + 배치 파일 `scripts/data/relation-batches/*.json` (출처 URL 필수, 양방향 자동)

## 1. 출처 없는 영향 관계 (약 192건)

- `influenced` / `influenced-by` 중 `source.url`이 없는 관계. 2026-11-23 기준 영향 관계 322건 중 출처 130건(40%). 계획서 목표는 80%.
- 처리 방법: 인터뷰·공식 이력·위키백과 문장으로 출처를 단다. 근거를 못 찾으면 `shared-scene`(같은 장면)으로 낮추거나 삭제한다.
- 약한 근거 예: 커버 한 곡만으로 "영향"이라 한 관계(예: Metallica ← Lynyrd Skynyrd, 근거 'Tuesday's Gone' 커버).
- 목록 뽑기: `node -e "const c=require('./src/data/catalog.json');for(const b of c.bands)for(const r of b.relations)if(r.kind.startsWith('influenc')&&!r.source?.url)console.log(b.id,r.kind,r.targetBandId)"`

## 2. 미검수 관계 (341건)

- `reviewStatus: 'draft'`인 관계. 문장을 확인하고 사실이면 `reviewed`로 바꾼다. 틀린 문장은 고치거나 삭제.
- 양방향 관계는 짝도 함께 본다(`npm run audit:relations`로 역방향 확인).

## 3. 15자 미만 관계 설명 (31건)

- `validate:data` 경고에 나온다. 근거가 드러나는 한 문장으로 다시 쓴다.
- 예: "헤비 리프의 원형" → "토니 아이오미의 다운튜닝 리프가 초기 스래시 리프 작법의 출발점이 됐다."

## 4. 그 밖에 남은 것

- 관계 1개 41팀(주로 팝/소프트·인디). 카탈로그 안에 확인 가능한 연결 상대가 적으므로, 상대 밴드가 추가될 때 잇는다.
- 관계 0개 3팀: Rascal Flatts(수록 범위 자체를 운영자가 판단), Kings of Convenience, Semisonic.
- 멤버를 언급하는 `shared-scene` 관계(예: Metallica↔Exodus "Kirk Hammett가 합류") 중 `member-link`로 바꿀 것 고르기.

## 기능 작업 중 새로 발견한 보완거리

### 5. 무드 점수 검수 183팀 (P3-1에서 도구만 만들고 데이터는 여기로)

- 도구: Studio **분류 검수 대기열**(같은 장르 밴드를 표로 나란히 놓고 점수 수정 → "검수 완료"), CLI `npm run audit:moods -- --queue`.
- 기준: `docs/TAXONOMY_V2_WORKFLOW.md` 8절(점수의 뜻, 무드별 기준 밴드).
- 2026-11-24 대기열: 표시 있는 밴드 96팀(같은 계열과 크게 다름 46, 3점 이상 무드 2개 이하 7, 방향 1개 이하 43, 장르 핵심 무드 없음 33).
- 대기열을 만들며 눈에 띈 의심 점수: Queen `riff-solo-driven` 0(브라이언 메이), Led Zeppelin `anthemic-live` 0, Iron Maiden `aggressive-heavy` 0, Black Sabbath `fast-driving` 0은 맞을 수 있으나 확인, Misfits `youth-rebellious` 0, Opeth `aggressive-heavy`·`massive-heavy` 0.
- 완료 조건(계획서): 공개 밴드 `taxonomyV2.reviewStatus` 전부 `reviewed`, 방향 1개뿐인 밴드 0팀.

### 6. 빠진 무드 점수 (2026-11-24 `npm run audit:mood-evidence` 판정)

점수가 0~1인데 근거(소개·소리 설명·대표곡 가이드 문장 / 세부장르 / 같은 계열 동료 평균)가 있는 무드 162건을 뽑아 하나씩 판단했다. 괄호는 제안 점수. 적용 전 운영자 확인.

**확실 — 바로 고칠 만함 (27건)**
- 기타 리프와 솔로 중심: Queen(4, 브라이언 메이), Rage Against the Machine(5, 톰 모렐로), Children of Bodom(5, 알렉시 라이호), Bullet for My Valentine(5), Wintersun(4), Sepultura(4), Skid Row(4), Toto(4, 스티브 루카서), The Smashing Pumpkins(4), Manowar(3), Sabaton(3)
- 전자음과 신스: Linkin Park(4), Muse(4), Beck(4), Bad Omens(4), Neon Trees(3), Spiritbox(3)
- 춤추기 좋고 그루비한: Maroon 5(4), Rage Against the Machine(4), Blur(3, 'Girls & Boys')
- 청춘과 반항: Sum 41(4), Misfits(4)
- 강렬하고 공격적인: Opeth(3, 그로울) · 묵직하고 압도적인: Opeth(3), Sleep Token(4), Killswitch Engage(4)
- 떼창하고 싶은 공연장형: Royal Blood(4)
- 어쿠스틱하고 자연스러운: Korpiklaani(4, 아코디언·바이올린)

**그럴듯함 — 들어 보고 판단 (31건)**
- 리프·솔로(3): Sum 41, Blind Guardian, Rhapsody, Sonata Arctica, Venom, King Gizzard, Cage the Elephant, My Chemical Romance, Manic Street Preachers, Papa Roach, Shinedown, Suede, U2, The Police
- 전자음(3): Coldplay, Fall Out Boy, Alestorm(키타) · 그루비(3): Queen, Muse, Tame Impala
- 우주적·환각(3): Cream, Steppenwolf, The Verve, The Smashing Pumpkins
- 긴 곡 몰입(3): Deep Purple, Mercyful Fate, The Who
- 그 밖(3): Opeth 외 Epica 공격성, Nightwish 어두움, Architects·Behemoth 테크니컬, Nine Inch Nails 노이즈, Fleetwood Mac 몽환, The Kinks·American Authors·Ensiferum·The Cranberries·Rascal Flatts 어쿠스틱, Jimmy Eat World 밝음, Aerosmith 낭만, Green Day 웅장(American Idiot), Snow Patrol 잔잔, Kodaline 떼창, Queen 실험

**오탐 — 바꾸지 않음**: My Chemical Romance·The Used·The Fray·Ride 밝음, Beach House 노이즈, Red Hot Chili Peppers 어두움, Black Sabbath·Ozzy·King Diamond 속도, Pink Floyd 테크니컬, Metallica·Van Halen·Radiohead 낭만 등 — 글에 단어가 한 번 나오거나 세부장르가 일부 시기만 가리키는 경우.
