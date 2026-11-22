# 포스터에서 발견한 밴드 35팀 — 초안 검토 안내

2026-10-25, 운영자 요청에 따라 추가. **자동 공개·커밋·푸시·배포하지 않았다.**

## 어디서 검토하나

로컬 운영자 페이지를 새로고침하고 데이터 영역의 밴드 검색에서 아래 이름을 찾는다. 각 밴드는 `초안 · 사이트 숨김` 상태다. 상세 화면 미리보기로 확인한 뒤, 운영자가 공개 상태로 바꾸고 저장하면 로컬 공개 목록에 나타난다. 온라인 사이트 반영은 별도 커밋·푸시·배포가 필요하다.

## 추가 명단

포스터의 구획을 식별용으로만 사용했다. 실제 사이트 분류는 기존 13개 장르 체계를 사용한다.

| 포스터 구획 | 새 초안 |
|---|---|
| Hard Rock | Ratt, Europe, Tesla |
| Heavy Metal | Ozzy Osbourne, Saxon, King Diamond, Queensrÿche, Venom |
| Thrash Metal | Exodus, Overkill, Sodom, Destruction, Death Angel, Dark Angel, Flotsam and Jetsam, Nuclear Assault |
| Grunge | Mudhoney, Screaming Trees, Mother Love Bone, Temple of the Dog, Melvins |
| Alternative Rock | Jane's Addiction, Incubus, A Perfect Circle |
| Nu Metal | Mudvayne, Static-X, Coal Chamber, P.O.D., Drowning Pool, Ill Niño, Mushroomhead |
| Modern Metal | Architects, Volbeat, Jinjer, Lorna Shore |

사진의 Venom 로고를 최초 추출에서 Dethklok로 잘못 읽었던 부분을 바로잡았다. Dethklok은 추가하지 않았다. Ozzy Osbourne은 포스터에 포함된 솔로 아티스트이므로 솔로 활동 시작과 참여 밴드 멤버들을 기준으로 정리했다.

## 채운 항목과 확인 범위

- 35팀 모두 결성·출신·활동 기간, 한국어 소개와 소리 설명, 주요 멤버/역할/활동연도, 장르·시대·분위기, 관계를 입력했다.
- 팀당 대표곡 3곡, 총 105곡에 제목·연도·앨범·감상 안내·직접 YouTube 링크를 입력했다.
- 105개 링크의 공개 oEmbed 응답을 실제 조회해 영상 존재·제목·업로더를 대조했다. 밴드/VEVO/공식 음원 Topic/레이블/공식 페스티벌 업로드를 사용했다. 지역 제한·향후 삭제·모든 지역의 실제 재생까지 보장하는 검사는 아니다.
- Overkill의 Elimination은 Resurrection Fest 2018 공식 라이브, Ozzy의 Mr. Crowley는 공식 1981년 라이브다. 해당 감상 안내에도 표시했다.
- Wikidata는 Wikipedia의 연결 항목과 일치시켰고, MusicBrainz 35개 ID는 실제 API의 아티스트 이름·유형으로 다시 확인했다. Architects를 일반 단어 Architect로 잘못 연결한 초기 검색 결과는 가져오기 전에 교체했다.
- Commons 이미지 35개에 원본·표시 URL, 제작자, 라이선스, 사용 조건 링크를 입력했다. Mother Love Bone과 Temple of the Dog는 확인 가능한 밴드 로고를 사용하며 대체 텍스트에도 로고임을 명시했다.
- Exodus/Sodom/Death Angel 사진의 `Attribution`은 CC BY로 임의 변환하지 않았다. 원본의 Stefan Bollmann 표시 조건과 해당 파일 Licensing 섹션을 연결했다.
- 분위기 점수·소리의 유사성은 편집적 판단이다. `sounds-like` 설명은 실제 영향관계라는 주장과 구분했다. 역사적 관계는 인물·투어·협업 이력 기준으로 연결했다.
- Europe, Incubus, Architects, Lorna Shore는 지속적인 음악적 전개를 시대별 설명에 구별했다. 다른 밴드는 일시적인 앨범 차이를 억지로 변화 단계로 늘리지 않았다.

## 보존 및 검증

- 기존 273팀의 관계 외 모든 필드가 동일함을 가져오기 전 비교했다. 기존 공개 243팀과 Claude 초안 30팀의 상태·본문·이미지·곡은 보존했다.
- 새 35개 관계에 대응하는 역방향 연결을 추가했다. 보류 관계 27건은 변동 없다.
- 저장 전 카탈로그 원본과 조사 응답은 `rock-atlas-backups/poster-research-20261025/`에 보관했다. Studio 변경 이력에도 저장 직전 상태가 남는다.
- 조사용 일회성 스크립트는 위 폴더의 `tools/`에 보관했다. 개발용 scripts 폴더에 불필요한 일회성 도구를 남기지 않았다. 보관용이며 경로를 복원하지 않고 재실행하지 말 것.
- 35팀 모두 Studio 운영 준비도 7/7 조건 충족. Lorna Shore는 실제 Studio에서 7/7, 사진·곡·멤버·추천 경로가 상세 미리보기에 표시됨을 확인했다.
- 분류 검사 308/308 통과. 기존 테스트 70/70 통과. 빌드 및 공개 상세·공유 페이지 243개 검사 통과(초안은 공개 목록에 포함되지 않음).
- 전체 무결성 검사에는 **기존 Wintersun 이미지 권리 미검수 1건**이 남는다. 이번 35팀에서 발생한 오류는 아니다. 배포 전 별도 해결해야 한다.
- YouTube 검색 API는 수집 도중 일일 할당량이 소진되어 남은 공식 영상을 웹 검색으로 보완했다. 운영자 영상 검색도 한도 초기화 전까지 제한될 수 있다. 추가 유료 사용은 하지 않았다.

## 다음 단계

운영자가 새 초안을 최종 검토하고 공개할 팀을 선택한다. 내용이 완비되었다는 것은 필드·출처·연결 검사 통과를 뜻하며, 모든 역사적 해석과 분위기 평가가 절대적으로 확정되었다는 의미는 아니다. 공개 승인은 운영자에게 남겨 두었다.
