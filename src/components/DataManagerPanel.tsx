import { AlertTriangle, FileDown, FileUp, History, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { genres } from '../data/genres'
import { taxonomyGenres, taxonomySubgenres } from '../data/taxonomy'
import { resolveSubgenreId } from '../lib/bandIntake'
import { studioFetchJson } from '../lib/studioApiClient'
import { getMissingTrackGuides, getStudioDiagnostics } from '../lib/studioDiagnostics'
import type { Band, EraId, GenreId, PendingRelation, Track } from '../types/music'
import { LinkHealthPanel, type LinkHealthSummary } from './LinkHealthPanel'
import { CatalogFactAuditPanel } from './CatalogFactAuditPanel'

export interface DeletedBandRecord {
  band: Band
  affectedRelations: Array<{ bandId: string; relations: Band['relations'] }>
}

interface HistoryEntry { id: string; createdAt: string; label: string; count: number }

interface DataManagerPanelProps {
  bands: Band[]
  selectedBandId: string
  trash: DeletedBandRecord[]
  pendingRelations: PendingRelation[]
  onSelectBand: (band: Band) => void
  onAddBands: (bands: Band[]) => void
  onDeleteBand: (bandId: string) => void
  onRestoreBand: (record: DeletedBandRecord) => void
  onUpdateBand: (band: Band) => void
  onPersist: (note: string) => Promise<void>
  onLinkHealthSummary?: (summary: LinkHealthSummary) => void
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1 }
    else if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) { row.push(field.trim()); field = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field.trim()); field = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else field += character
  }
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)
  const headers = rows.shift()?.map((item) => item.replace(/^\uFEFF/, '')) ?? []
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

const slugify = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const list = (value: string) => value.split(/[;|]/).map((item) => item.trim()).filter(Boolean)
const eraFromYear = (year: number) => `${Math.min(2020, Math.max(1960, Math.floor(year / 10) * 10))}s` as EraId
const taxonomyByLegacy: Record<GenreId, (typeof taxonomyGenres)[number]['id']> = {
  'classic-rock': 'classic-roots-rock', 'hard-rock': 'hard-glam-rock', 'progressive-art': 'progressive-art-psychedelic', 'punk-rock': 'punk-emo',
  'alternative-indie': 'alternative-grunge', 'britpop-indie': 'indie-britpop-garage', 'heavy-metal': 'traditional-power-thrash-metal', 'extreme-metal': 'extreme-metal',
}

function csvBand(row: Record<string, string>, index: number): Band {
  const year = Number(row.formed) || new Date().getFullYear()
  const name = row.name || `새 밴드 ${index + 1}`
  const requestedGenre = row.primaryGenre as GenreId
  const primaryGenre = genres.some((genre) => genre.id === requestedGenre) ? requestedGenre : 'classic-rock'
  const subgenres = list(row.subgenres)
  const taxonomyPrimary = taxonomyByLegacy[primaryGenre]
  const taxonomySubgenreIds = [...new Set(subgenres.map(resolveSubgenreId).filter((id): id is string => Boolean(id)))]
  const normalizedSubgenres = taxonomySubgenreIds.map((id) => taxonomySubgenres.find((item) => item.id === id)?.name ?? id)
  return {
    id: slugify(row.id || name) || `csv-band-${Date.now()}-${index}`,
    name, formed: year, origin: row.origin || '', countryCode: (row.countryCode || '').toUpperCase(), activeYears: row.activeYears || `${year}–현재`,
    primaryGenre, genreIds: [primaryGenre], subgenres: normalizedSubgenres, tags: list(row.tags),
    eraTags: [{ era: eraFromYear(year), genreIds: [primaryGenre], subgenres: normalizedSubgenres }],
    summary: row.summary || '', style: row.style || '',
    image: { wikipediaTitle: name, alt: `${name} 밴드 사진`, credit: { sourceUrl: '', license: '검토 필요', reviewStatus: 'needs-review' } },
    members: [], tracks: [], relations: [],
    sources: [{ label: `${name} — CSV import`, url: 'https://en.wikipedia.org/', publisher: 'Editorial', note: 'Studio CSV 일괄 입력 후 검수 필요' }],
    taxonomyV2: { primaryGenreId: taxonomyPrimary, secondaryGenreIds: [], subgenreIds: taxonomySubgenreIds, moodScores: {}, reviewStatus: 'draft', reviewNote: 'CSV 일괄 입력 후 분류 검수 필요' },
    reviewStatus: 'draft',
  }
}

export function DataManagerPanel({ bands, selectedBandId, trash, pendingRelations, onSelectBand, onAddBands, onDeleteBand, onRestoreBand, onUpdateBand, onPersist, onLinkHealthSummary }: DataManagerPanelProps) {
  const [message, setMessage] = useState('CSV 입력, 휴지통, 이력 복구와 검수 상태를 관리합니다.')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const csvRef = useRef<HTMLInputElement>(null)
  const selected = bands.find((band) => band.id === selectedBandId) ?? bands[0]

  const warnings = useMemo(() => getStudioDiagnostics(bands), [bands])
  const missingTrackGuides = useMemo(() => getMissingTrackGuides(bands), [bands])

  const loadHistory = async () => {
    try {
      setHistory((await studioFetchJson<{ entries: HistoryEntry[] }>('/api/studio/catalog-history')).entries)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '변경 이력을 불러오지 못했습니다.')
    }
  }
  useEffect(() => { void loadHistory() }, [bands])

  const importCsv = async (file: File) => {
    try {
      const rows = parseCsv(await file.text())
      const incoming = rows.map(csvBand)
      const used = new Set(bands.map((band) => band.id))
      const unique = incoming.filter((band) => {
        if (used.has(band.id)) return false
        used.add(band.id)
        return true
      })
      if (!unique.length) throw new Error('추가할 유효한 행이 없습니다. ID 중복을 확인하세요.')
      onAddBands(unique)
      setMessage(`${unique.length}개 밴드를 초안으로 가져왔습니다. 검토 후 변경 저장을 누르세요.`)
    } catch (error) { setMessage(`CSV 가져오기 실패: ${error instanceof Error ? error.message : '형식을 확인하세요.'}`) }
  }
  const downloadTemplate = () => {
    const content = 'id,name,formed,origin,countryCode,activeYears,primaryGenre,subgenres,tags,summary,style\nexample-band,Example Band,2000,"서울, 대한민국",KR,2000–현재,alternative-indie,"인디 록;포스트 록","기타;서정성","업적과 발자취","리듬과 사운드 설명"\n'
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'rock-atlas-band-template.csv'; anchor.click(); URL.revokeObjectURL(url)
  }
  const restoreHistory = async (entry: HistoryEntry) => {
    if (!window.confirm(`${new Date(entry.createdAt).toLocaleString('ko-KR')} 상태로 전체 카탈로그를 복구할까요? 현재 상태는 자동 백업됩니다.`)) return
    try {
      await studioFetchJson('/api/studio/catalog-history', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entry.id }) })
      window.location.reload()
    } catch (error) {
      setMessage(`복구 실패: ${error instanceof Error ? error.message : 'Studio 서버를 확인하세요.'}`)
    }
  }
  const updateTrack = (trackId: string, patch: Partial<Track>) => {
    if (!selected) return
    onUpdateBand({ ...selected, tracks: selected.tracks.map((track) => track.id === trackId ? { ...track, ...patch } : track) })
  }

  return (
    <section id="data-manager" className="studio-form-section studio-data-manager">
      <div className="studio-section-heading"><span>DB</span><div><h3>데이터 관리 고도화</h3><p>일괄 입력, 삭제·복구, 변경 이력, 검수와 자동 경고를 한곳에서 처리합니다.</p></div></div>
      <div className="studio-manager-actions">
        <button onClick={() => csvRef.current?.click()}><FileUp size={15} /> CSV 일괄 추가</button><input ref={csvRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && void importCsv(event.target.files[0])} />
        <button onClick={downloadTemplate}><FileDown size={15} /> CSV 양식</button>
        <button className="is-primary" onClick={() => void onPersist('데이터 관리 화면에서 일괄 저장').then(loadHistory)}><Save size={15} /> 변경 저장</button>
        <span>{message}</span>
      </div>

      <div className="studio-manager-grid">
        <CatalogFactAuditPanel bands={bands} selectedBandId={selectedBandId} onSelectBand={onSelectBand} onUpdateBand={onUpdateBand} />
        <details open><summary><AlertTriangle size={14} /> 자동 진단 <em>{warnings.length}</em></summary><div className="studio-warning-list">{warnings.length ? warnings.map((warning, index) => <button key={`${warning.message}-${index}`} data-severity={warning.severity} onClick={() => { const band = bands.find((item) => item.id === warning.bandId); if (band) onSelectBand(band) }}><strong>{warning.severity === 'error' ? '오류' : '주의'}</strong><span>{warning.message}</span></button>) : <p>중복·관계·공개 검수 경고가 없습니다.</p>}</div></details>

        <details><summary><Trash2 size={14} /> 삭제·복구 <em>{trash.length}</em></summary><div className="studio-trash">
          {selected && <button className="studio-danger-button" onClick={() => window.confirm(`${selected.name}을 휴지통으로 옮길까요? 연결된 수신 관계도 함께 보관됩니다.`) && onDeleteBand(selected.id)}><Trash2 size={14} /> 선택한 {selected.name} 삭제</button>}
          {trash.length ? trash.map((record) => <div key={record.band.id}><span><strong>{record.band.name}</strong><small>{record.band.id}</small></span><button onClick={() => onRestoreBand(record)}><RotateCcw size={13} /> 복구</button></div>) : <p>휴지통이 비어 있습니다.</p>}
        </div></details>

        <details><summary><History size={14} /> 변경 이력 <em>{history.length}</em></summary><div className="studio-history-list">{history.length ? history.map((entry) => <div key={entry.id}><span><strong>{entry.label}</strong><small>{new Date(entry.createdAt).toLocaleString('ko-KR')} · {entry.count}개</small></span><button onClick={() => void restoreHistory(entry)}><RotateCcw size={13} /> 이 상태로 복구</button></div>) : <p>아직 저장 이력이 없습니다.</p>}</div></details>

        <details><summary><AlertTriangle size={14} /> 보류 중인 관계 <em>{pendingRelations.length}</em></summary><div className="studio-warning-list">{pendingRelations.length ? pendingRelations.map((pending) => <button key={pending.id} data-severity="warning" onClick={() => { const band = bands.find((item) => item.id === pending.sourceBandId); if (band) onSelectBand(band) }}><strong>대기</strong><span>{pending.sourceBandName} → {pending.targetBandId} ({pending.note}) · {pending.targetBandId} 밴드가 추가되면 양쪽에 자동 연결됩니다.</span></button>) : <p>보류 중인 관계가 없습니다.</p>}</div></details>

        <details><summary><AlertTriangle size={14} /> 감상 안내 없는 대표곡 <em>{missingTrackGuides.length}</em></summary><div className="studio-warning-list">{missingTrackGuides.length ? missingTrackGuides.map((item) => <button key={`${item.bandId}-${item.trackId}`} data-severity="warning" onClick={() => { const band = bands.find((candidate) => candidate.id === item.bandId); if (band) onSelectBand(band) }}><strong>{item.bandName}</strong><span>{item.trackTitle} — 감상 안내가 비어 있습니다.</span></button>) : <p>감상 안내가 비어 있는 대표곡이 없습니다.</p>}</div></details>

        <details open><summary><ShieldCheck size={14} /> 출처·곡 링크 검수</summary>{selected ? <div className="studio-verification">
          <label>검수할 밴드<select value={selected.id} onChange={(event) => { const band = bands.find((item) => item.id === event.target.value); if (band) onSelectBand(band) }}>{bands.map((band) => <option key={band.id} value={band.id}>{band.name}</option>)}</select></label>
          <div className="studio-source-summary">{selected.sources.map((source) => <a key={`${source.publisher}-${source.url}`} href={source.url} target="_blank" rel="noreferrer"><strong>{source.publisher}</strong><span>{source.externalId ?? source.label}</span></a>)}</div>
          <div className="studio-track-audit">{selected.tracks.map((track) => <div key={track.id}><span><strong>{track.title}</strong><small>{[track.album, track.year].filter(Boolean).join(' · ') || '곡 정보 확인 중'}</small></span><a href={track.source.url} target="_blank" rel="noreferrer">외부 링크 열기</a><select aria-label={`${track.title} 검수 상태`} value={track.reviewStatus} onChange={(event) => updateTrack(track.id, { reviewStatus: event.target.value as Track['reviewStatus'], reviewedAt: event.target.value === 'draft' ? undefined : new Date().toISOString().slice(0, 10), reviewedBy: event.target.value === 'draft' ? undefined : 'Studio operator' })}><option value="draft">초안</option><option value="reviewed">검수됨</option><option value="published">공개</option></select></div>)}</div>
        </div> : <p>검수할 밴드가 없습니다.</p>}</details>
      </div>
      <LinkHealthPanel bands={bands} onSelectBand={onSelectBand} onSummaryChange={onLinkHealthSummary} />
    </section>
  )
}
