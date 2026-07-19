# 보류된 관계 (밴드가 아직 카탈로그에 없어서 연결 못한 관계)

Gemini 리서치에서 나온 관계 중, 대상 밴드가 아직 `catalog.json`에 없어서 반영하지 못한 것들. 대상 밴드가 나중에 추가되면 이 목록을 확인해서 관계를 추가할 것.

- ~~**travis → Coldplay**~~ (해결됨, 2026-07-19): Coldplay가 카탈로그에 추가되어 travis·coldplay 양쪽 relations에 반영 완료.

- **oasis → Blur** (`shared-scene`, strength 3): "1990년대 브릿팝 주도권을 두고 벌인 치열한 라이벌 관계(Battle of Britpop, 1995)." 출처: https://en.wikipedia.org/wiki/Liam_Gallagher (2026-07-18 확인) — Blur가 추가되면 Blur 쪽 relations에도 `oasis`를 `shared-scene`으로 추가.

- **queen → David Bowie** (`shared-scene`, strength 2): "Trident 스튜디오 세션 중 데이비드 보위와 스파이더스 프롬 마스 라이브를 보고 시각적·예술적 자극을 받아 앨범 임팩트를 고민하게 됨." 출처: https://en.wikipedia.org/wiki/Queen_(band) (2026-07-18 확인) — David Bowie가 추가되면 Bowie 쪽 relations에도 `queen`을 추가.

- **green-day → The Offspring** (`shared-scene`, strength 3): "Green Day가 동료 캘리포니아 펑크 밴드인 The Offspring, Rancid와 함께 미국 내 펑크 록의 주류 관심을 부활시키고 대중화한 공로가 있다고 명시됨." 출처: https://en.wikipedia.org/wiki/Green_Day (2026-07-19 확인 — Gemini가 제출한 원 출처 URL은 잘못되어 정정함) — The Offspring이 추가되면 그쪽 relations에도 `green-day`를 `shared-scene`으로 추가.

- **green-day → Rancid** (`shared-scene`, strength 3): 위와 동일 출처·동일 근거. Rancid가 추가되면 그쪽 relations에도 `green-day`를 `shared-scene`으로 추가.

- **theory-of-a-deadman → Nickelback** (`influenced-by`, strength 3): "차드 크로거가 발굴하고 레이블 계약을 맺으며 음악적 성장에 지대한 영향을 줌 — Theory of a Deadman이 Nickelback 프론트맨 Chad Kroeger의 레이블 604 Records와 2001년 최초로 계약한 아티스트가 됨." 출처: https://en.wikipedia.org/wiki/Theory_of_a_Deadman (2026-07-19 확인) — Nickelback이 추가되면 그쪽 relations에도 `theory-of-a-deadman`을 `influenced`로 추가.

- **bon-jovi → Bryan Adams** (`shared-scene`, strength 1): "90년대 중후반 미국에는 본 조비, 캐나다에는 브라이언 애덤스라는 라이벌·동료 관계 구도가 형성되었다는 서술." 출처: https://ko.wikipedia.org/wiki/본_조비 (2026-07-19 확인, 한국어판) — Bryan Adams가 추가되면 그쪽 relations에도 `bon-jovi`를 `shared-scene`으로 추가.
