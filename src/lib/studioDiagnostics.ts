import type { Band } from '../types/music'

export interface StudioDiagnostic {
  bandId?: string
  severity: 'error' | 'warning'
  message: string
}

export function getStudioDiagnostics(bands: Band[]): StudioDiagnostic[] {
  const issues: StudioDiagnostic[] = []
  const nameGroups = new Map<string, Band[]>()
  const bandIds = new Set(bands.map((band) => band.id))

  bands.forEach((band) => {
    const key = band.name.toLocaleLowerCase().replace(/[^a-z0-9가-힣]/g, '')
    nameGroups.set(key, [...(nameGroups.get(key) ?? []), band])
    const relationTargets = new Set<string>()

    band.relations.forEach((relation) => {
      if (relation.targetBandId === band.id) issues.push({ bandId: band.id, severity: 'error', message: `${band.name}: 자기 자신을 관계 대상으로 지정했습니다.` })
      if (!bandIds.has(relation.targetBandId)) issues.push({ bandId: band.id, severity: 'error', message: `${band.name}: 존재하지 않는 관계 대상 ${relation.targetBandId}` })
      if (relationTargets.has(relation.targetBandId)) issues.push({ bandId: band.id, severity: 'warning', message: `${band.name}: ${relation.targetBandId} 관계가 중복됩니다.` })
      relationTargets.add(relation.targetBandId)
    })

    if (band.reviewStatus !== 'draft' && band.tracks.some((track) => !/^https:\/\//.test(track.source.url))) issues.push({ bandId: band.id, severity: 'warning', message: `${band.name}: 열 수 없는 대표곡 외부 링크가 있습니다.` })
    if (band.reviewStatus !== 'draft' && band.image.credit.reviewStatus !== 'verified') issues.push({ bandId: band.id, severity: 'warning', message: `${band.name}: 공개 상태지만 이미지 권리 검수가 필요합니다.` })
    if (band.reviewStatus !== 'draft' && !band.sources.some((source) => source.publisher === 'Wikidata' && source.externalId)) issues.push({ bandId: band.id, severity: 'warning', message: `${band.name}: Wikidata 식별자가 없습니다.` })
    if (band.reviewStatus !== 'draft' && !band.sources.some((source) => source.publisher === 'MusicBrainz' && source.externalId)) issues.push({ bandId: band.id, severity: 'warning', message: `${band.name}: MusicBrainz 식별자가 없습니다.` })
  })

  nameGroups.forEach((group) => {
    if (group.length > 1) issues.push({ severity: 'error', message: `중복 밴드 이름: ${group.map((band) => band.name).join(', ')}` })
  })

  return issues
}
