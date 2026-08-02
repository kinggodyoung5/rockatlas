import { Check, Clipboard, Database, LoaderCircle, Search } from 'lucide-react'
import { useState } from 'react'
import { taxonomyGenres, taxonomyMoods, taxonomySubgenres } from '../data/taxonomy'
import { auditBandFacts, type CatalogFactAudit } from '../lib/factAudit'
import { applyVerifiedIdentity, buildIdentityVerification, searchIdentityVerification, type IdentityProvider, type IntakeIdentityVerification } from '../lib/intakeVerification'
import type { Band } from '../types/music'

function researchDraft(name: string, verification: IntakeIdentityVerification): Band {
  const selected = verification.musicbrainz.selected ?? verification.wikidata.selected
  // This draft exists only long enough to request structured evidence. Zero
  // means unknown and prevents a solo artist's birth year becoming a debut year.
  const formed = selected?.formed ?? 0
  const countryCode = verification.musicbrainz.selected?.country ?? ''
  const origin = selected?.origin ?? selected?.area ?? ''
  return applyVerifiedIdentity({
    id: name.toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name, formed, origin, countryCode, activeYears: formed ? `${formed}–현재` : '자료 확인 필요',
    primaryGenre: 'classic-rock', genreIds: ['classic-rock'], subgenres: [], eraTags: [], tags: [], summary: '', style: '',
    image: { wikipediaTitle: name, alt: `${name} 밴드 사진`, credit: { sourceUrl: '', license: '검토 필요', reviewStatus: 'needs-review' } },
    members: [], tracks: [], relations: [], sources: [],
    taxonomyV2: { primaryGenreId: 'classic-roots-rock', secondaryGenreIds: [], subgenreIds: [], moodScores: {}, reviewStatus: 'draft' },
    reviewStatus: 'draft',
  }, verification)
}

function evidenceRequest(name: string, audit: CatalogFactAudit) {
  const formed = audit.facts.find((fact) => fact.id === 'formed')?.externalValue
  const country = audit.facts.find((fact) => fact.id === 'country')?.externalValue
  const origin = audit.facts.find((fact) => fact.id === 'origin')?.externalValue
  const albums = audit.albums.slice(0, 20).map((album) => `${album.title}${album.year ? ` (${album.year})` : ''}`).join('; ')
  const members = audit.externalMembers.slice(0, 20).map((member) => `${member.name}${member.begin || member.end ? ` (${member.begin || '?'}–${member.end || '현재'})` : ''}`).join('; ')
  return `다음은 ROCK ATLAS Studio가 MusicBrainz와 Wikidata에서 직접 확인한 ${name}의 고정 자료다. 이 자료와 충돌하는 사실을 만들지 말고, 자료에 없는 수치·수상·판매량·영향 관계는 추측하지 마라. 외부 ID·이미지·URL은 출력하지 마라. 기존 Gem 지침의 bands JSON 형식으로 이 밴드 1개만 출력하라.\n\n[검증 자료]\n이름: ${name}\n결성 연도: ${formed || '자료 없음'}\n국가 코드: ${country || '자료 없음'}\n결성지: ${origin || '자료 없음'}\n확인된 정규 앨범: ${albums || '자료 없음'}\nMusicBrainz 멤버 관계: ${members || '자료 없음'}\n\n장르·분위기는 아래 ROCK ATLAS 허용 ID만 사용하라. 확신하지 못하는 관계와 시대별 장르 변화는 빈 배열로 둔다. 대표곡은 정확한 곡명·앨범명·연도를 확인할 수 있는 3곡만 쓰고 URL은 쓰지 않는다.\n장르 ID: ${taxonomyGenres.map((item) => item.id).join(', ')}\n세부 장르 ID: ${taxonomySubgenres.map((item) => item.id).join(', ')}\n분위기 ID: ${taxonomyMoods.map((item) => item.id).join(', ')}`
}

export function BandResearchStarter() {
  const [name, setName] = useState('')
  const [verification, setVerification] = useState<IntakeIdentityVerification | null>(null)
  const [audit, setAudit] = useState<CatalogFactAudit | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('밴드명만 입력하면 먼저 신원을 확인하고, AI가 지어낼 수 없는 사실 자료를 만듭니다.')

  const loadAudit = async (next: IntakeIdentityVerification) => {
    if (!next.wikidata.selected || !next.musicbrainz.selected) return
    const result = await auditBandFacts(researchDraft(name.trim(), next))
    setAudit(result)
    setMessage(result.status === 'error' ? '외부 식별자에 문제가 있습니다. 아래 후보를 다시 선택하세요.' : '검증 자료가 준비됐습니다. 한 번 복사해 Gemini 채팅에 붙이면 됩니다.')
  }

  const search = async () => {
    if (name.trim().length < 2 || busy) return
    setBusy(true); setAudit(null); setMessage('Wikidata와 MusicBrainz에서 같은 밴드를 찾고 있습니다…')
    try {
      const next = await searchIdentityVerification({ name: name.trim(), formed: 0, origin: '', countryCode: '' })
      setVerification(next)
      if (next.wikidata.selected && next.musicbrainz.selected) await loadAudit(next)
      else setMessage('동명이인 가능성이 있어 아래에서 올바른 후보만 선택해주세요.')
    } catch (error) { setMessage(error instanceof Error ? error.message : '외부 자료 검색에 실패했습니다.') }
    finally { setBusy(false) }
  }

  const select = async (provider: IdentityProvider, id: string) => {
    if (!verification) return
    setBusy(true); setAudit(null)
    const next = buildIdentityVerification({ name: name.trim(), formed: 0, origin: '', countryCode: '' }, verification.wikidata.candidates, verification.musicbrainz.candidates, {
      wikidata: provider === 'wikidata' ? id : verification.wikidata.selected?.id,
      musicbrainz: provider === 'musicbrainz' ? id : verification.musicbrainz.selected?.id,
    })
    setVerification(next)
    try { await loadAudit(next) } catch (error) { setMessage(error instanceof Error ? error.message : '선택한 후보를 정밀 확인하지 못했습니다.') }
    finally { setBusy(false) }
  }

  const copy = async () => {
    if (!audit) return
    try { await navigator.clipboard.writeText(evidenceRequest(name.trim(), audit)); setMessage('검증 자료와 요청문을 복사했습니다. Gemini Gem 채팅에 그대로 붙여넣으세요.') }
    catch { setMessage('클립보드 권한이 없습니다. 브라우저 권한을 확인하세요.') }
  }

  return <section className="band-research-starter">
    <header><span><Database size={18} /></span><div><strong>밴드명으로 검증 자료 만들기</strong><p>Gemini가 ID·연도·앨범·멤버를 상상하지 못하도록 Studio가 먼저 구조화 자료를 가져옵니다.</p></div></header>
    <div className="band-research-search"><input value={name} onChange={(event) => { setName(event.target.value); setVerification(null); setAudit(null) }} onKeyDown={(event) => { if (event.key === 'Enter') void search() }} placeholder="예: R.E.M." /><button type="button" className="is-primary" disabled={busy || name.trim().length < 2} onClick={() => void search()}>{busy ? <LoaderCircle className="is-spinning" size={15} /> : <Search size={15} />} 자동 조사</button></div>
    <p className="band-research-message">{message}</p>
    {verification && <div className="band-research-providers">{([verification.wikidata, verification.musicbrainz] as const).map((provider) => <article key={provider.provider}><strong>{provider.provider === 'wikidata' ? 'Wikidata' : 'MusicBrainz'}</strong>{provider.selected ? <p><Check size={13} /> {provider.selected.name}<small>{provider.selected.id}</small></p> : <span>후보 선택 필요</span>}<div>{provider.candidates.slice(0, 3).map((candidate) => <button type="button" key={candidate.id} data-selected={candidate.id === provider.selected?.id} onClick={() => void select(provider.provider, candidate.id)}><b>{candidate.name}</b><small>{[candidate.entityType, candidate.origin ?? candidate.area, candidate.formed].filter(Boolean).join(' · ') || candidate.description}</small></button>)}</div></article>)}</div>}
    {audit && audit.status !== 'error' && <div className="band-research-evidence"><div><strong>확보한 근거</strong><span>정규 앨범 {audit.albums.length}개 · 멤버 관계 {audit.externalMembers.length}개 · 신원 직접 연결 {audit.linkedAcrossSources ? '확인' : '주의'}</span></div><button type="button" className="is-primary" onClick={() => void copy()}><Clipboard size={15} /> 검증 자료를 Gemini에 보낼 문장 복사</button></div>}
  </section>
}
