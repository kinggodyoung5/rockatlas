# ROCK ATLAS 밴드 데이터 생성 템플릿 — 2단계: 형식 변환 (Gemini용)

> **보관용 옛 문서:** 현재 운영용 Gem 지침은 이 문서가 아니라 Studio의 **Gemini Gem 지침 v7 복사** 버튼이 생성하는 내용이다. 이 문서의 시대별 전수 분할·외부 ID·영상 지침을 새 밴드 등록에 사용하지 않는다. v7에서는 Studio가 먼저 Wikidata·MusicBrainz 근거를 만들고, Gemini는 정식 세부 장르 ID로 설명·분류 초안만 작성한다.

**이 문서는 2단계 전용이다.** 리서치(검색)는 이미 `GEMINI_STEP1_RESEARCH.md`로 별도 새 채팅에서 끝냈다고 가정한다. 검색과 형식 변환을 한 번에 시키면 긴 지시문 때문에 도구 호출이 씹히는 경우가 있어서, 두 단계로 쪼갰다.

**사용법:** 새 채팅을 열고, 1단계에서 받은 리서치 결과(밴드별 사실 목록)를 이 문서 맨 아래에 그대로 붙여넣은 뒤, 이 문서 전체를 Gemini에게 준다. 이 단계는 새로 검색할 필요가 거의 없는 **순수 변환 작업**이라 훨씬 가볍고 실패할 여지가 적다.

너(Gemini)는 이 작업에서 **최종 결정권자가 아니다.** 너의 결과물은 사람 또는 다른 AI(Claude)가 한 번 더 검수한 뒤에만 사이트에 올라간다. 그러니 확신이 없으면 반드시 "확인 필요"라고 표시해라. 그럴듯하게 지어내는 것보다 빈칸으로 남기고 솔직하게 실패를 알리는 게 훨씬 낫다.

---

## 0. 절대 규칙 — 환각 방지 (반드시 지킬 것)

너는 최근 사실관계·고유 식별자를 지어내는 경향이 있다고 알려져 있다. 이 작업에서는 그게 치명적이다. 아래 규칙을 어기면 결과물 전체가 폐기된다.

1. **모든 사실(결성연도, 국적, 멤버, 관계, URL, ID)은 이 문서 맨 아래에 붙여넣어진 "1단계 리서치 결과"에 있는 내용만 쓴다.** 거기 없는 사실을 네 내부 지식(파라메트릭 메모리)으로 채우지 마라. 만약 1단계 결과에 특정 필드가 아예 없거나 "검색했지만 못 찾음"으로 표시돼 있으면, 딱 그 필드에 한해서만 검색을 한 번 더 시도해보고, 그래도 못 찾으면 `"확인 필요"`로 남겨라. 즉 이 단계의 기본 동작은 검색이 아니라 "이미 주어진 사실을 스키마에 맞게 옮기는 것"이다.
2. **Wikidata Q-id, MusicBrainz UUID, YouTube 동영상 ID, Wikimedia Commons 파일명은 절대로 추측하거나 패턴으로 생성하지 마라.** 이 값들은 전부 무작위 문자열/숫자라 "그럴듯해 보이는" 값을 만드는 게 가능하지만 100% 틀린다. 반드시 실제로 그 페이지를 열어서 주소창/본문에 적힌 값을 그대로 복사해라. 확실하지 않으면 그 필드는 비우고 `"확인 필요"`라고 표시해라.
3. **이미지의 실제 CDN 경로(`displayUrl`, `originalUrl`)는 계산하지 마라.** Wikimedia Commons의 이미지 URL은 파일명의 해시값으로 만들어지는 경로라 사람이 손으로 만들 수 없다. 대신 Commons 파일 페이지 URL과 파일명, 저작자, 라이선스만 정확히 옮겨 적고, `displayUrl`/`originalUrl`은 비워둔 채 `credit.reviewStatus`를 `"needs-review"`로 남겨라. (아래 3-③ 참고)
4. **유튜브 영상은 검색 결과에 실제로 나타난 watch URL만 사용해라.** "이 밴드 이 노래면 이 ID일 것 같다"는 추측 금지. 채널이 공식 채널인지도 검색 결과의 채널명·구독자 규모·인증 마크로 확인하고, 확신 없으면 `channelName`만 적고 `official` 필드는 아예 넣지 마라.
5. **관계(relations)는 실제로 문서화된 사실에만 기반한다.** "장르가 비슷하니까 관련 있겠지" 같은 추측 금지. 위키피디아 등에 "A가 B에게 영향을 줬다", "A와 B가 같은 신에 속한다" 같은 문장이 명시적으로 있어야 한다. 없으면 관계를 만들지 마라 — 빈 배열도 정답이다.
6. **장르는 아래 8개 중에서만 고른다.** 9번째 장르를 만들거나 목록에 없는 장르 이름을 쓰지 마라. (섹션 4 참고)
7. **relations의 대상은 반드시 실제로 존재하는 밴드의 정식 이름이어야 한다.** 카탈로그에 이미 있는지 없는지는 신경 쓰지 마라 — 그건 네 일이 아니다. 존재 여부 확인과 id 변환은 나중에 시스템이 자동으로 처리한다. (섹션 5, 3-Relation 참고)
8. 확신도가 낮은 항목은 절대 침묵하지 말고 결과 JSON 옆에 **"검토 필요 목록"**을 따로 적어서 사람이 뭘 다시 봐야 하는지 명시해라.

---

## 1. 이 작업의 목표

주어진 밴드 이름 각각에 대해, 아래 스키마(섹션 3)를 그대로 따르는 JSON 객체를 하나씩 만든다. 이 데이터는 록 음악 아카이브 사이트에 실제로 게시될 데이터베이스 항목이다. 정확성이 속도보다 훨씬 중요하다.

---

## 2. 정보는 어디서, 어떻게 가져오는가

밴드 하나당 아래 순서로 실제 검색을 실행해라. 각 단계에서 연 페이지의 URL을 메모해 뒀다가 `sources` 배열에 그대로 써야 한다.

**① 기본 사실 (결성연도, 출신지, 국적, 멤버, 활동 시기, 장르, 약력)**
→ 영어 위키피디아(`en.wikipedia.org/wiki/밴드명`)를 검색해서 연다. 인포박스(Infobox)에 있는 Origin / Years active / Genres / Members 항목을 그대로 옮긴다. 본문에서 결성 배경, 주요 사건, 다른 밴드와의 관계(멤버 이동, 영향 관계 등)를 찾는다.

**② Wikidata 식별자**
→ `밴드명 site:wikidata.org` 또는 `밴드명 wikidata`로 검색해서 실제 Wikidata 페이지를 연다. 주소창의 `Q숫자` 형태 URL을 그대로 복사한다. 절대 암기해서 쓰지 마라 — 밴드마다 다르고 규칙이 없다.

**③ MusicBrainz 식별자**
→ `밴드명 musicbrainz`로 검색해서 실제 아티스트 페이지를 연다. 주소창의 UUID(`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` 형태)를 그대로 복사한다.

**④ Wikimedia Commons 이미지**
→ `밴드명 site:commons.wikimedia.org` 또는 `Category:밴드명 wikimedia commons`로 검색한다. 라이선스가 명확한(Public Domain, CC0, CC BY, CC BY-SA) 밴드 사진을 하나 고른다. 파일 페이지에 적힌 그대로 **파일명, 저작자(uploader/photographer 이름), 라이선스 종류**를 옮긴다. 절대 CDN 경로(`upload.wikimedia.org/.../thumb/...`)를 손으로 만들지 마라 — 규칙 0-③ 참고.

**⑤ 대표곡 유튜브 링크**
→ `밴드명 노래제목 official video youtube`로 검색해서 실제 검색 결과에 뜬 watch URL을 그대로 쓴다. 곡은 그 밴드의 대표곡(위키피디아에 언급되거나 앨범 성과가 뚜렷한 곡) 2곡을 고른다.

**⑥ 관계 근거**
→ ①에서 이미 찾은 위키피디아 본문, 또는 `Big Four thrash metal`처럼 관계 자체를 다루는 별도 위키피디아 문서를 검색해서 관계를 뒷받침하는 실제 문장을 찾는다.

---

## 3. 데이터 스키마 (TypeScript, 그대로 따를 것)

```typescript
type GenreId = // 섹션 4의 8개 id 중 하나만 사용
  | 'classic-rock' | 'hard-rock' | 'progressive-art' | 'punk-rock'
  | 'alternative-indie' | 'grunge' | 'heavy-metal' | 'extreme-metal'

type RelationKind = 'sounds-like' | 'influenced-by' | 'influenced' | 'shared-scene' | 'evolution'
type ReviewStatus = 'draft' | 'reviewed' | 'published'
type EraId = '1960s' | '1970s' | '1980s' | '1990s' | '2000s' | '2010s' | '2020s'

interface SourceRef {
  label: string          // 예: "Metallica — Wikipedia"
  url: string             // 실제로 연 페이지의 URL
  publisher: 'Wikipedia' | 'Wikidata' | 'Wikimedia Commons' | 'MusicBrainz' | 'YouTube' | 'Editorial'
  accessedAt?: string     // "YYYY-MM-DD"
  note?: string
  externalId?: string     // Wikidata Q-id, MusicBrainz UUID, YouTube 채널 ID 등
  official?: boolean      // 공식 채널이 확실할 때만 넣는다
  channelName?: string
  channelType?: 'artist' | 'label' | 'topic'
}

interface ImageCredit {
  sourceUrl: string        // Commons 파일 페이지 URL (https://commons.wikimedia.org/wiki/File:... 형태)
  creator?: string
  license: string          // 예: "CC BY-SA 4.0", "CC0", "Public domain"
  licenseUrl?: string
  reviewStatus: 'verified' | 'needs-review'   // 너는 항상 'needs-review'만 쓴다
}

interface BandImage {
  wikipediaTitle: string   // 위키피디아 문서 제목 (예: "Metallica"). 이것만 있으면 사이트가 자동으로 썸네일을 불러온다.
  fileName?: string        // Commons 파일명 (File: 접두사 제외)
  displayUrl?: string       // 비워둔다 — 계산하지 말 것
  originalUrl?: string      // 비워둔다 — 계산하지 말 것
  alt: string               // 예: "Metallica 밴드 사진"
  credit: ImageCredit
}

interface Member {
  name: string
  role: string              // 한국어: "보컬·기타", "베이스", "드럼" 등
  status: 'current' | 'former' | 'touring'   // 너는 현재(current) 멤버만 넣는다
}

interface Track {
  id: string                 // kebab-case, 예: "master-of-puppets"
  title: string
  year?: number
  album?: string
  youtubeId: string           // watch URL의 v= 뒤 11자리. 실제 검색 결과에서만 가져올 것
  source: SourceRef
  reviewStatus: 'draft'        // 항상 draft
}

// 주의: 실제 사이트 스키마는 targetBandId(내부 id)를 쓰지만,
// 너는 그 밴드가 카탈로그에 이미 있는지, id가 뭔지 알 방법이 없다.
// 그래서 너는 targetBandId 대신 targetBandName(밴드의 정식 실제 이름)을 쓴다.
// 이름 -> id 변환과 "카탈로그에 이미 있는지" 확인은 네 결과물을 받는 쪽(Claude)이
// 항상 최신 상태인 실제 카탈로그를 대조해서 자동으로 처리한다. 너는 신경 쓰지 마라.
interface RelationDraft {
  targetBandName: string         // 실제로 존재하는 밴드의 정식 이름 (지어내지 말 것)
  kind: RelationKind
  strength: 1 | 2 | 3
  note: string                    // 한국어 한 줄 설명
  source?: SourceRef
  reviewStatus: 'draft'           // 항상 draft
}

interface BandEraTag {
  era: EraId
  genreIds: GenreId[]
  subgenres: string[]
  note?: string
}

interface Band {
  id: string                 // kebab-case, 예: "megadeth"
  name: string                // 공식 표기 그대로 (예: "AC/DC", "Guns N' Roses")
  formed: number
  origin: string               // 한국어로: "로스앤젤레스, 미국" 형식
  countryCode: string           // ISO 2자리, 예: "US", "GB", "DE"
  activeYears: string            // "1983–현재" 또는 공백기가 있으면 "1983–2002, 2004–현재"
  primaryGenre: GenreId
  genreIds: GenreId[]              // primaryGenre를 반드시 포함
  subgenres: string[]               // 한국어 세부 장르 2~4개
  eraTags: BandEraTag[]              // 활동 시기별로 1~3개
  tags: string[]                      // 한국어 짧은 인상 태그 3개
  summary: string                      // 한국어 한 줄 요약 (editorial 톤, 마케팅 문구 금지)
  style: string                         // 한국어 사운드 설명 1~2문장
  members: Member[]                      // 현재 멤버만
  tracks: Track[]                         // 정확히 2곡
  relations: RelationDraft[]                // 0~3개, 근거 있는 만큼만 (targetBandName 방식, 위 설명 참고)
  sources: SourceRef[]                      // Wikipedia/Wikidata/MusicBrainz/Commons/YouTube 전부 포함
  reviewStatus: 'draft'                      // 항상 draft
}
```

---

## 4. 사용 가능한 장르 8개 (이 중에서만 고를 것)

| id | 한국어 이름 | 포함 세부장르(참고용) |
|---|---|---|
| `classic-rock` | 클래식 록 | 블루스 록, 포크 록, 사이키델릭 록, 루츠 록 |
| `hard-rock` | 하드 록 | 글램 록, 글램 메탈, 부기 록, 아레나 록 |
| `progressive-art` | 프로그레시브 · 아트 록 | 아트 록, 네오 프로그, 스페이스 록, 포스트 프로그 |
| `punk-rock` | 펑크 록 | 개러지 펑크, 하드코어 펑크, 포스트 펑크의 초기 계보 |
| `alternative-indie` | 얼터너티브 · 그런지 | 뉴메탈, 포스트그런지, 팝 록, 일렉트로닉 록 |
| `grunge` | 브릿팝 · 인디 | 슈게이즈, 드림팝, 포스트록 |
| `heavy-metal` | 헤비 메탈 | NWOBHM, 스피드 메탈, 파워 메탈, 스래시 메탈 |
| `extreme-metal` | 익스트림 메탈 | 데스 메탈, 블랙 메탈, 멜로딕 데스 메탈, 그라인드코어 |

밴드의 실제 장르가 이 8개 중 어디에도 안 맞는 것 같으면, 가장 가까운 것을 고르고 `tags`/`subgenres`에 구체적인 하위 장르명을 적어라. 새 장르 카드를 만들지 마라.

---

## 5. 관계(relations)는 이름 기반이다 — 카탈로그 목록을 몰라도 된다

이 템플릿의 예전 버전은 "관계는 아래 밴드 목록 안에서만 고르라"는 고정 목록을 강제했다. 그런데 밴드가 수백 개로 늘어날 예정이라 그 목록을 매번 손으로 갱신하는 건 불가능하고, 목록이 낡으면 최근 추가된 밴드끼리는 영영 연결이 안 되는 문제가 생긴다. 그래서 방식을 바꿨다.

**너는 카탈로그에 지금 어떤 밴드가 있는지 전혀 몰라도 된다.** 섹션 3의 `RelationDraft`에서 설명한 대로, `targetBandName`에 실제로 존재하는 밴드의 정식 이름만 적으면 된다. 그 밴드가 카탈로그에 이미 있는지, 나중에 추가될 예정인지는 신경 쓰지 마라 — 결과물을 받는 쪽(Claude)이 항상 최신 상태인 실제 카탈로그와 대조해서, 이미 있는 밴드면 자동으로 연결하고 아직 없는 밴드면 "그 밴드가 나중에 추가될 때 자동으로 연결되도록" 보류 처리한다. 즉 네가 만든 관계는 절대 버려지지 않는다.

너는 관계를 만들 때 딱 하나만 지키면 된다: **규칙 0-⑤(실제 문서화된 근거)와 0-⑦(실제로 존재하는 진짜 밴드 이름)을 지킬 것.** 그 밴드가 유명한 록 밴드이기만 하면 카탈로그 소속 여부와 무관하게 이름을 적어라.

(참고용: 아래는 이 문서를 작성한 시점 기준으로 카탈로그에 이미 있던 밴드 34개다. 관계를 만들 때 "어차피 카탈로그에 있을 만한" 유명 밴드 판단에 참고만 하고, 이 목록이 오래돼도 상관없다 — 위에서 설명했듯 목록 밖 밴드와의 관계도 그대로 유효하다.)

```
The Beatles · The Rolling Stones · The Who · Led Zeppelin · AC/DC · Guns N' Roses
Pink Floyd · King Crimson · Yes · Porcupine Tree · Ramones · The Clash · Sex Pistols
Radiohead · Pixies · Sonic Youth · Nirvana · Pearl Jam · Alice in Chains
Black Sabbath · Iron Maiden · Metallica · Tool · Slayer · Death · Children of Bodom
The Cure · Nine Inch Nails · Rammstein · Steely Dan · Lynyrd Skynyrd
Mogwai · My Bloody Valentine · Megadeth
```

---

## 6. 완성 예시 3개 (형식·톤·깊이를 그대로 모방할 것)

아래 세 개는 실제로 사이트에 게시된, 검수 완료 상태의 진짜 데이터다. 국가(영국/미국/독일), 장르 교차 패턴(단일 장르, 시대별 장르 변화, 2차 장르 정리), 이미지 라이선스 종류가 각각 다르게 설계되어 있으니 셋 다 꼼꼼히 봐라. 너의 결과물은 이 셋과 형식·품질이 동일해야 한다 (단, `reviewStatus`는 이 예시들과 달리 전부 `"draft"`로 출력할 것).

### 예시 1 — The Cure (영국, 얼터너티브 · 그런지, 시대별 장르가 바뀌는 케이스)

```json
{
  "id": "the-cure",
  "name": "The Cure",
  "formed": 1978,
  "origin": "크롤리, 잉글랜드",
  "countryCode": "GB",
  "activeYears": "1978–현재",
  "primaryGenre": "alternative-indie",
  "genreIds": ["alternative-indie"],
  "tags": ["고딕", "멜랑콜리", "팝 감각"],
  "subgenres": ["포스트 펑크", "고딕 록", "얼터너티브 록"],
  "eraTags": [
    { "era": "1970s", "genreIds": ["punk-rock"], "subgenres": ["포스트 펑크"] },
    { "era": "1980s", "genreIds": ["alternative-indie"], "subgenres": ["고딕 록"] },
    { "era": "1990s", "genreIds": ["alternative-indie"], "subgenres": ["얼터너티브 록"] }
  ],
  "summary": "차갑고 깊은 고딕의 분위기와 빛나는 팝 멜로디를 한 밴드 안에 공존시킨 존재.",
  "style": "코러스가 깊게 걸린 기타, 선명한 베이스 라인과 로버트 스미스의 흔들리는 보컬이 정서를 만든다.",
  "members": [
    { "name": "Robert Smith", "role": "보컬·기타", "status": "current" },
    { "name": "Simon Gallup", "role": "베이스", "status": "current" },
    { "name": "Roger O'Donnell", "role": "키보드", "status": "current" },
    { "name": "Jason Cooper", "role": "드럼", "status": "current" }
  ],
  "tracks": [
    {
      "id": "just-like-heaven", "title": "Just Like Heaven", "year": 1987, "album": "Kiss Me, Kiss Me, Kiss Me",
      "youtubeId": "n3nPiBai66M",
      "source": { "label": "Just Like Heaven — YouTube", "url": "https://www.youtube.com/watch?v=n3nPiBai66M", "publisher": "YouTube", "accessedAt": "2026-07-17", "channelName": "TheCureVEVO", "channelType": "artist" },
      "reviewStatus": "draft"
    },
    {
      "id": "lovesong", "title": "Lovesong", "year": 1989, "album": "Disintegration",
      "youtubeId": "ks_qOI0lzho",
      "source": { "label": "Lovesong — YouTube", "url": "https://www.youtube.com/watch?v=ks_qOI0lzho", "publisher": "YouTube", "accessedAt": "2026-07-17", "channelName": "TheCureVEVO", "channelType": "artist" },
      "reviewStatus": "draft"
    }
  ],
  "relations": [
    {
      "targetBandName": "Nine Inch Nails", "kind": "influenced", "note": "어두운 정서와 얼터너티브 감수성", "strength": 2, "reviewStatus": "draft",
      "source": { "label": "Nine Inch Nails — Wikipedia", "url": "https://en.wikipedia.org/wiki/Nine_Inch_Nails", "publisher": "Wikipedia", "accessedAt": "2026-07-17", "note": "Trent Reznor가 The Cure를 주요 음악적 영향으로 직접 언급한 기록을 확인" }
    },
    {
      "targetBandName": "Sonic Youth", "kind": "shared-scene", "note": "포스트 펑크 이후의 실험적 기타 음악", "strength": 1, "reviewStatus": "draft",
      "source": { "label": "Rock music — Wikipedia", "url": "https://en.wikipedia.org/wiki/Rock_music", "publisher": "Wikipedia", "accessedAt": "2026-07-17", "note": "Sonic Youth와 The Cure를 각각 미국·영국의 1980년대 얼터너티브 운동을 대표한 밴드로 함께 설명" }
    }
  ],
  "reviewStatus": "draft",
  "image": {
    "wikipediaTitle": "The Cure",
    "fileName": "The_Cure_Live_in_Singapore_2-_1st_August_2007.jpg",
    "alt": "The Cure 밴드 사진",
    "credit": {
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:The_Cure_Live_in_Singapore_2-_1st_August_2007.jpg",
      "creator": "momento mori from Kuala Lumpur, Malaysia",
      "license": "CC BY 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
      "reviewStatus": "needs-review"
    }
  },
  "sources": [
    { "label": "The Cure — Wikipedia", "url": "https://en.wikipedia.org/wiki/The_Cure", "publisher": "Wikipedia", "accessedAt": "2026-07-15", "note": "기본 이력과 멤버 교차 확인용" },
    { "label": "The Cure — Wikidata", "url": "https://www.wikidata.org/wiki/Q484427", "publisher": "Wikidata", "accessedAt": "2026-07-15", "externalId": "Q484427", "note": "이름·결성 시점·국가를 교차 확인한 외부 식별자" },
    { "label": "The Cure — MusicBrainz", "url": "https://musicbrainz.org/artist/69ee3720-a7cb-4402-b48d-a02c366f2bcf", "publisher": "MusicBrainz", "accessedAt": "2026-07-15", "externalId": "69ee3720-a7cb-4402-b48d-a02c366f2bcf", "note": "이름·결성 시점·국가를 교차 확인한 외부 식별자" },
    { "label": "The Cure 이미지 — Wikimedia Commons", "url": "https://commons.wikimedia.org/wiki/File:The_Cure_Live_in_Singapore_2-_1st_August_2007.jpg", "publisher": "Wikimedia Commons", "accessedAt": "2026-07-15", "note": "momento mori from Kuala Lumpur, Malaysia · CC BY 2.0" },
    { "label": "The Cure — 공식 YouTube", "url": "https://www.youtube.com/channel/UCL_zMdXdM51oSi5XpxTvRtQ", "publisher": "YouTube", "externalId": "UCL_zMdXdM51oSi5XpxTvRtQ", "official": true, "channelName": "The Cure", "channelType": "artist", "accessedAt": "2026-07-18", "note": "대표곡 외부 재생이 제한될 때 사용하는 공식 채널 링크" }
  ]
}
```

### 예시 2 — Metallica (미국, 헤비 메탈, 장르 2개 교차)

```json
{
  "id": "metallica",
  "name": "Metallica",
  "formed": 1981,
  "origin": "로스앤젤레스, 미국",
  "countryCode": "US",
  "activeYears": "1981–현재",
  "primaryGenre": "heavy-metal",
  "genreIds": ["heavy-metal", "extreme-metal"],
  "tags": ["스래시", "정밀함", "대형 공연"],
  "subgenres": ["스래시 메탈", "헤비 메탈", "스피드 메탈"],
  "eraTags": [
    { "era": "1980s", "genreIds": ["heavy-metal", "extreme-metal"], "subgenres": ["스래시 메탈", "스피드 메탈"] },
    { "era": "1990s", "genreIds": ["heavy-metal"], "subgenres": ["헤비 메탈"] }
  ],
  "summary": "스래시 메탈의 속도와 복잡성을 대형 록의 스케일로 끌어올린 밴드.",
  "style": "촘촘한 다운피킹 리프, 급격한 구성 전환과 묵직한 중속 그루브를 모두 구사한다.",
  "members": [
    { "name": "James Hetfield", "role": "보컬·기타", "status": "current" },
    { "name": "Lars Ulrich", "role": "드럼", "status": "current" },
    { "name": "Kirk Hammett", "role": "기타", "status": "current" },
    { "name": "Robert Trujillo", "role": "베이스", "status": "current" }
  ],
  "tracks": [
    {
      "id": "master-puppets", "title": "Master of Puppets", "year": 1986, "album": "Master of Puppets",
      "youtubeId": "E0ozmU9cJDg",
      "source": { "label": "Master of Puppets — YouTube", "url": "https://www.youtube.com/watch?v=E0ozmU9cJDg", "publisher": "YouTube", "accessedAt": "2026-07-17", "channelName": "Metallica - Topic", "channelType": "topic" },
      "reviewStatus": "draft"
    },
    {
      "id": "one", "title": "One", "year": 1988, "album": "...And Justice for All",
      "youtubeId": "WM8bTdBs-cw",
      "source": { "label": "One — YouTube", "url": "https://www.youtube.com/watch?v=WM8bTdBs-cw", "publisher": "YouTube", "accessedAt": "2026-07-17", "channelName": "Metallica", "channelType": "artist" },
      "reviewStatus": "draft"
    }
  ],
  "relations": [
    {
      "targetBandName": "Iron Maiden", "kind": "influenced-by", "note": "NWOBHM의 속도와 기타 화음", "strength": 3, "reviewStatus": "draft",
      "source": { "label": "Metallica — Wikipedia", "url": "https://en.wikipedia.org/wiki/Metallica", "publisher": "Wikipedia", "accessedAt": "2026-07-17", "note": "Lars Ulrich가 Iron Maiden을 가장 큰 영향으로 직접 언급한 기록을 확인" }
    },
    {
      "targetBandName": "Slayer", "kind": "shared-scene", "note": "빅 포 스래시 메탈의 동료", "strength": 3, "reviewStatus": "draft",
      "source": { "label": "Thrash metal — Wikipedia", "url": "https://en.wikipedia.org/wiki/Thrash_metal", "publisher": "Wikipedia", "accessedAt": "2026-07-17", "note": "Metallica와 Slayer를 미국 스래시 메탈의 Big Four로 함께 설명" }
    },
    {
      "targetBandName": "Black Sabbath", "kind": "influenced-by", "note": "헤비 리프의 원형", "strength": 2, "reviewStatus": "draft",
      "source": { "label": "Metallica — Wikipedia", "url": "https://en.wikipedia.org/wiki/Metallica", "publisher": "Wikipedia", "accessedAt": "2026-07-17", "note": "초기 헤비 메탈 영향 목록에 Black Sabbath가 명시된 기록을 확인" }
    }
  ],
  "reviewStatus": "draft",
  "image": {
    "wikipediaTitle": "Metallica",
    "fileName": "Metallica_March_2024.jpg",
    "alt": "Metallica 밴드 사진",
    "credit": {
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Metallica_March_2024.jpg",
      "creator": "Library of Congress Life",
      "license": "CC0",
      "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
      "reviewStatus": "needs-review"
    }
  },
  "sources": [
    { "label": "Metallica — Wikipedia", "url": "https://en.wikipedia.org/wiki/Metallica", "publisher": "Wikipedia", "accessedAt": "2026-07-15", "note": "기본 이력과 멤버 교차 확인용" },
    { "label": "Metallica — Wikidata", "url": "https://www.wikidata.org/wiki/Q15920", "publisher": "Wikidata", "accessedAt": "2026-07-15", "externalId": "Q15920", "note": "이름·결성 시점·국가를 교차 확인한 외부 식별자" },
    { "label": "Metallica — MusicBrainz", "url": "https://musicbrainz.org/artist/65f4f0c5-ef9e-490c-aee3-909e7ae6b2ab", "publisher": "MusicBrainz", "accessedAt": "2026-07-15", "externalId": "65f4f0c5-ef9e-490c-aee3-909e7ae6b2ab", "note": "이름·결성 시점·국가를 교차 확인한 외부 식별자" },
    { "label": "Metallica 이미지 — Wikimedia Commons", "url": "https://commons.wikimedia.org/wiki/File:Metallica_March_2024.jpg", "publisher": "Wikimedia Commons", "accessedAt": "2026-07-15", "note": "Library of Congress Life · CC0" },
    { "label": "Metallica — 공식 YouTube", "url": "https://www.youtube.com/channel/UCbulh9WdLtEXiooRcYK7SWw", "publisher": "YouTube", "externalId": "UCbulh9WdLtEXiooRcYK7SWw", "official": true, "channelName": "Metallica", "channelType": "artist", "accessedAt": "2026-07-18", "note": "대표곡 외부 재생이 제한될 때 사용하는 공식 채널 링크" }
  ]
}
```

### 예시 3 — Rammstein (독일, 비영어권, 단일 장르)

```json
{
  "id": "rammstein",
  "name": "Rammstein",
  "formed": 1994,
  "origin": "베를린, 독일",
  "countryCode": "DE",
  "activeYears": "1994–현재",
  "primaryGenre": "heavy-metal",
  "genreIds": ["heavy-metal"],
  "tags": ["독일어", "인더스트리얼 메탈", "극장성"],
  "subgenres": ["노이에 도이체 헤르테", "인더스트리얼 메탈", "얼터너티브 메탈"],
  "eraTags": [
    { "era": "1990s", "genreIds": ["heavy-metal"], "subgenres": ["노이에 도이체 헤르테", "인더스트리얼 메탈"] },
    { "era": "2000s", "genreIds": ["heavy-metal"], "subgenres": ["인더스트리얼 메탈"] }
  ],
  "summary": "독일어의 단단한 리듬과 거대한 무대 연출로 인더스트리얼 메탈을 세계화한 밴드.",
  "style": "기계처럼 반복되는 기타 리프, 행진하는 전자 비트, 저음 보컬과 극단적인 공연 미학이 특징이다.",
  "members": [
    { "name": "Till Lindemann", "role": "보컬", "status": "current" },
    { "name": "Richard Kruspe", "role": "기타", "status": "current" },
    { "name": "Paul Landers", "role": "기타", "status": "current" },
    { "name": "Flake Lorenz", "role": "키보드", "status": "current" }
  ],
  "tracks": [
    {
      "id": "du-hast", "title": "Du hast", "year": 1997, "album": "Sehnsucht",
      "youtubeId": "W3q8Od5qJio",
      "source": { "label": "Du hast — YouTube", "url": "https://www.youtube.com/watch?v=W3q8Od5qJio", "publisher": "YouTube", "accessedAt": "2026-07-17", "channelName": "Rammstein Official", "channelType": "artist" },
      "reviewStatus": "draft"
    },
    {
      "id": "sonne", "title": "Sonne", "year": 2001, "album": "Mutter",
      "youtubeId": "StZcUAPRRac",
      "source": { "label": "Sonne — YouTube", "url": "https://www.youtube.com/watch?v=StZcUAPRRac", "publisher": "YouTube", "accessedAt": "2026-07-17", "channelName": "Rammstein Official", "channelType": "artist" },
      "reviewStatus": "draft"
    }
  ],
  "relations": [
    {
      "targetBandName": "Nine Inch Nails", "kind": "evolution", "note": "산업 록의 주류화 이후 유럽 산업 메탈로 확장된 흐름", "strength": 2, "reviewStatus": "draft",
      "source": { "label": "Industrial metal — Wikipedia", "url": "https://en.wikipedia.org/wiki/Industrial_metal", "publisher": "Wikipedia", "accessedAt": "2026-07-17", "note": "Nine Inch Nails의 주류 돌파 이후 Rammstein이 산업 메탈의 상업적 확장을 이은 흐름을 확인" }
    },
    {
      "targetBandName": "Metallica", "kind": "evolution", "note": "스래시 메탈 이후 산업 메탈로 넓어진 헤비 음악의 분기", "strength": 1, "reviewStatus": "draft",
      "source": { "label": "Heavy metal genres — Wikipedia", "url": "https://en.wikipedia.org/wiki/Heavy_metal_genres", "publisher": "Wikipedia", "accessedAt": "2026-07-17", "note": "스래시 메탈과 산업 메탈을 헤비 메탈에서 갈라진 세대별 하위 장르로 함께 설명" }
    }
  ],
  "reviewStatus": "draft",
  "image": {
    "wikipediaTitle": "Rammstein",
    "fileName": "Rammstein_at_Wacken_Open_Air_2013_06.jpg",
    "alt": "Rammstein 밴드 사진",
    "credit": {
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Rammstein_at_Wacken_Open_Air_2013_06.jpg",
      "creator": "Jonas Rogowski",
      "license": "CC BY-SA 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
      "reviewStatus": "needs-review"
    }
  },
  "sources": [
    { "label": "Rammstein — Wikipedia", "url": "https://en.wikipedia.org/wiki/Rammstein", "publisher": "Wikipedia", "accessedAt": "2026-07-15", "note": "기본 이력과 멤버 교차 확인용" },
    { "label": "Rammstein — Wikidata", "url": "https://www.wikidata.org/wiki/Q25177", "publisher": "Wikidata", "accessedAt": "2026-07-15", "externalId": "Q25177", "note": "이름·결성 시점·국가를 교차 확인한 외부 식별자" },
    { "label": "Rammstein — MusicBrainz", "url": "https://musicbrainz.org/artist/b2d122f9-eadb-4930-a196-8f221eeb0c66", "publisher": "MusicBrainz", "accessedAt": "2026-07-15", "externalId": "b2d122f9-eadb-4930-a196-8f221eeb0c66", "note": "이름·결성 시점·국가를 교차 확인한 외부 식별자" },
    { "label": "Rammstein 이미지 — Wikimedia Commons", "url": "https://commons.wikimedia.org/wiki/File:Rammstein_at_Wacken_Open_Air_2013_06.jpg", "publisher": "Wikimedia Commons", "accessedAt": "2026-07-15", "note": "Jonas Rogowski · CC BY-SA 3.0" },
    { "label": "Rammstein — 공식 YouTube", "url": "https://www.youtube.com/channel/UCYp3rk70ACGXQ4gFAiMr1SQ", "publisher": "YouTube", "externalId": "UCYp3rk70ACGXQ4gFAiMr1SQ", "official": true, "channelName": "Rammstein Official", "channelType": "artist", "accessedAt": "2026-07-18", "note": "대표곡 외부 재생이 제한될 때 사용하는 공식 채널 링크" }
  ]
}
```

---

## 7. 밴드 1개당 작업 순서 (이 순서를 반드시 지킬 것)

1. 섹션 2-①: 위키피디아에서 기본 사실 수집
2. 섹션 2-②③: Wikidata·MusicBrainz 실제 페이지 열어서 ID 확보
3. 섹션 4에서 장르 1개(primaryGenre) + 필요시 교차 장르 1개 선택
4. 활동 시기를 10년 단위로 나눠 eraTags 작성 (앨범 발매 시기 기준)
5. 섹션 2-⑤: 대표곡 2곡의 실제 유튜브 링크 확보
6. 섹션 2-⑥ + 섹션 5: 관계 0~3개, 반드시 실제 문장 근거와 함께 (targetBandName은 실제 밴드 이름이면 되고, 카탈로그 소속 여부는 신경 쓰지 말 것)
7. 섹션 2-④: Commons 이미지 후보 1개, 저작자·라이선스 정확히 기록
8. **8절의 자가 검증 체크리스트를 전부 통과했는지 확인**
9. JSON 객체 하나 출력

---

## 8. 출력 전 자가 검증 체크리스트 (모든 항목에 스스로 답할 것)

- [ ] `formed` 연도를 위키피디아 인포박스에서 직접 봤는가? (기억으로 쓰지 않았는가)
- [ ] Wikidata Q-id를 실제 Wikidata 페이지 주소창에서 복사했는가? (추측하지 않았는가)
- [ ] MusicBrainz UUID를 실제 MusicBrainz 페이지 주소창에서 복사했는가? (추측하지 않았는가)
- [ ] 유튜브 영상 2개의 URL이 실제 검색 결과에 뜬 것인가? (video ID를 지어내지 않았는가)
- [ ] `image.displayUrl`/`originalUrl`을 비워뒀는가? (직접 계산해서 채우지 않았는가)
- [ ] `image.credit.reviewStatus`가 `"needs-review"`인가?
- [ ] 모든 `relations[].targetBandName`이 실제로 존재하는 진짜 밴드의 정식 이름인가? (지어낸 밴드가 아닌가)
- [ ] 모든 `relations`에 실제 근거 문장이 담긴 `source.note`가 있는가?
- [ ] `primaryGenre`와 `genreIds`, `eraTags[].genreIds`가 전부 섹션 4의 8개 id 안에 있는가?
- [ ] 모든 `reviewStatus` 필드(밴드/트랙/관계)가 `"draft"`인가?
- [ ] 확신 없는 항목을 전부 "검토 필요 목록"에 적었는가?

하나라도 "아니오"면 그 필드를 비우거나 다시 검색해서 채워라. 절대 그럴듯한 값으로 대충 채우지 마라.

---

## 9. 출력 형식

이 JSON은 사이트에 바로 들어가는 최종본이 아니라 **중간 산출물(스테이징 데이터)**이다. 받는 쪽(Claude)이 매번 다음 두 가지를 자동으로 처리한 뒤에 실제 `catalog.json`에 반영한다: ① 사실관계·ID·이미지·영상 재검증, ② `relations[].targetBandName`을 그 시점의 실제 카탈로그와 대조해서 있으면 `targetBandId`로 변환하고, 아직 없는 밴드면 나중에 그 밴드가 추가될 때 자동으로 연결되도록 보류 목록에 저장. 그러니 너는 이름만 정확히 적으면 되고, 그 이름 그대로 두면 된다.

- 밴드별로 하나의 JSON 객체를 만들고, 전체를 **JSON 배열 하나**로 감싸서 출력해라. 다른 설명 문장이나 마크다운 코드펜스 없이, 순수 JSON만 출력해라 (파일로 바로 저장해서 쓸 것이기 때문).
- 배열 뒤에 별도로 `---검토 필요 목록---` 섹션을 만들어서, 확신이 낮았던 항목·빈칸으로 둔 항목·판단이 애매했던 관계 후보를 밴드별로 정리해라. 이건 JSON 밖에, 일반 텍스트로 적어라.

출력 예시 구조:

```json
[
  { "id": "band-one", ... },
  { "id": "band-two", ... }
]
```
```
---검토 필요 목록---
- band-one: MusicBrainz 페이지를 못 찾아서 externalId 비워둠. 재확인 필요.
- band-two: "influenced-by" 관계 하나는 근거 문장이 약해서 strength를 1로 낮춤.
```

---

## 10. 절대 하지 말 것 (요약)

- Wikidata Q-id, MusicBrainz UUID, YouTube video ID를 지어내기
- Wikimedia Commons 이미지의 CDN 경로(`upload.wikimedia.org/.../thumb/...`)를 손으로 계산해서 채우기
- 섹션 4에 없는 9번째 장르 만들기
- 실제로 존재하지 않는(지어낸) 밴드 이름으로 관계 만들기
- 근거 문장 없이 관계 만들기
- `reviewStatus`를 `"draft"`가 아닌 값으로 출력하기
- JSON 앞뒤에 장황한 설명 붙이기 (검토 필요 목록만 예외)

---

## 사용 방법 — 두 가지 중 하나를 고를 것

**A. Gem으로 저장해서 매번 재사용 (권장)**
이 문서 전체(여기까지 위의 모든 내용)를 Gemini의 Gem "지침"란에 한 번만 저장해라. 그 뒤로는 새 리서치 결과가 나올 때마다, 저장된 그 Gem을 열고 **리서치 결과만 채팅 메시지로 보내면** 그걸 받는 즉시 이 문서의 규칙대로 JSON으로 변환해서 출력해라. 지침을 다시 설명해달라거나 다시 붙여넣어달라고 요구하지 마라 — 이미 알고 있다.

**B. Gem 없이 매번 통째로 붙여넣기**
Gem을 안 쓴다면, 이 문서 전체 뒤에 리서치 결과를 이어 붙여서 새 채팅에 한 번에 준다.

## 리서치 결과가 아직 없다면

이 지침을 받았는데(Gem 저장 시점이든, 이후 채팅이든) 정작 처리할 밴드의 리서치 결과가 없다면, 절대 답변을 지어내지 말고 "리서치 결과를 붙여넣어달라"고 요청해라. 리서치 결과 없이 밴드 정보를 만들어내는 것은 이 문서 전체의 목적을 위반하는 것이다.
