# 보류 관계 이관 기록

보류 관계의 실제 데이터는 이제 `src/data/catalog.json` 최상위의 `pendingRelations`가 관리한다. Studio 검수함에서 아직 등록되지 않은 밴드 관계가 발견되면 이 배열에 저장되고, 대상 밴드가 추가되는 순간 양쪽 관계로 자동 변환된다.

이 문서는 운영 데이터가 아니라 2026-07-30 수동 목록 이관 기록이다. 새로운 보류 관계를 이 문서에 손으로 추가하지 않는다.

## 즉시 연결 완료

- `oasis → blur` · `shared-scene` · 강도 3
  - Oasis와 Blur 양쪽 관계가 모두 존재한다.
- `theory-of-a-deadman → nickelback` · `influenced-by` · 강도 3
  - Theory of a Deadman에는 `influenced-by`, Nickelback에는 `influenced` 관계가 존재한다.

## 자동 연결 대기

아래 네 건은 `catalog.json.pendingRelations`로 이관했다.

- `queen → david-bowie` · `shared-scene` · 강도 2
- `green-day → the-offspring` · `shared-scene` · 강도 3
- `green-day → rancid` · `shared-scene` · 강도 3
- `bon-jovi → bryan-adams` · `shared-scene` · 강도 1

대상 밴드가 추가되면 Studio가 자동으로 처리하므로 별도 수동 작업은 필요 없다. 처리 여부는 Studio 첫 화면의 `자동 연결 대기 관계`와 데이터 관리의 `보류 중인 관계`에서 확인한다.

## 과거 완료 기록

- `travis → coldplay`: 2026-07-19 수동 연결 완료.
