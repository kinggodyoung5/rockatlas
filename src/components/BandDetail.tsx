import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Flag, Heart, MapPin, Search, Share2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { buildBandTimeline } from '../lib/bandTimeline'
import { genreById } from '../data/genres'
import { eraById } from '../data/eras'
import { taxonomyGenreById, taxonomyMoodById, taxonomySubgenreById } from '../data/taxonomy'
import type { HitchhikingDirectionId } from '../config/hitchhiking'
import type { BandDetailCopy } from '../data/siteContent'
import type { JourneyStep, JourneyVia } from '../lib/hitchhiking'
import type { Band, BandEraTag, Member } from '../types/music'
import type { GenreTaxonomyId, MoodId } from '../types/taxonomy'
import { BandImage } from './BandImage'
import { HitchhikingPanel } from './HitchhikingPanel'
import { RelationMap } from './RelationMap'

/** True when the band's own activeYears text ends without a closing year ("...–현재" / "...–present"),
 *  i.e. it's still going. Only the most recent activeYears segment matters — a reunion clause elsewhere
 *  in the string ("1994, 2010–현재") shouldn't make an otherwise-ended run look ongoing. */
export function isStillActive(activeYears: string): boolean {
  const lastSegment = activeYears.split(',').at(-1) ?? ''
  return /현재|present/i.test(lastSegment)
}

/** Collapses consecutive eras with the same subgenre/genre mix into one range row, so a genre that never
 *  changed doesn't repeat itself every decade. The final group extends to "현재" (present) instead of
 *  stopping at its last recorded era when the band is still active — a single era tag for a band that's
 *  never changed genre reads as "1960년대~현재", not just "1960년대". */
export function groupEraTags(eraTags: BandEraTag[], activeYears: string) {
  const groups: { startEra: BandEraTag['era']; endEra: BandEraTag['era']; subgenres: string[]; note?: string }[] = []
  for (const tag of eraTags) {
    const last = groups.at(-1)
    const sameAsLast = last && JSON.stringify(last.subgenres) === JSON.stringify(tag.subgenres)
    if (sameAsLast) {
      last.endEra = tag.era
      if (tag.note) last.note = last.note ? `${last.note} ${tag.note}` : tag.note
    } else {
      groups.push({ startEra: tag.era, endEra: tag.era, subgenres: tag.subgenres, note: tag.note })
    }
  }
  const ongoing = isStillActive(activeYears)
  return groups.map((group, index) => {
    const startLabel = eraById[group.startEra].label
    const endLabel = eraById[group.endEra].label
    const isLastGroup = index === groups.length - 1
    const label = isLastGroup && ongoing
      ? `${startLabel}~현재`
      : group.startEra === group.endEra ? startLabel : `${startLabel}~${endLabel}`
    return { key: `${group.startEra}-${group.endEra}`, label, subgenres: group.subgenres, note: group.note }
  })
}

function memberLine(member: Member) {
  return [member.role, member.activeYears, member.deceased ? `${member.deceased}년 별세` : ''].filter(Boolean).join(' · ')
}

const sourceLinkOrder = ['Wikipedia', 'MusicBrainz', 'Wikidata'] as const
const formatReviewDate = (value?: string) => value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10).replace(/-/g, '.') : undefined
const albumTypeLabels = { studio: '정규 음반', ep: 'EP', live: '라이브 음반', compilation: '편집 음반' } as const

interface BandDetailProps {
  band: Band
  onBack: () => void
  isFavorite: boolean
  onToggleFavorite: (bandId: string) => void
  visitedIds: string[]
  journeySteps: JourneyStep[]
  onTravelBand: (band: Band, via: JourneyVia) => void
  onResetJourney: () => void
  onShareJourney: () => void
  onShare: () => void
  bandDetailCopy: BandDetailCopy
  /** "잘못된 정보 알리기" 링크(사이트 설정의 제안 폼). 없으면 링크를 숨긴다. */
  reportUrl?: string
  /** 검색에서 곡을 골라 들어왔으면 그 대표곡으로 스크롤한다. */
  focusTrackId?: string
  onSearch?: () => void
  /** 상세 JSON을 받는 중: 인덱스의 축약 데이터로 히어로만 먼저 그린다 (plan P5-4). */
  loading?: boolean
  onMood?: (moodId: MoodId) => void
  onSubgenre?: (genreId: GenreTaxonomyId, subgenreId: string) => void
  /** 목록에서 들어왔을 때 같은 목록의 이전·다음 밴드. ←/→ 키로도 이동한다. */
  prevBand?: Band
  nextBand?: Band
  onNavigate?: (band: Band) => void
}

/** 구역 제목 기본값. Studio 디자인 작업실의 상세 화면 문구로 바꿀 수 있다 (plan P5-4 #6). */
const defaultSectionCopy = {
  soundLabel: '01 / SOUND', soundTitle: '어떤 음악을 하나요?',
  footprintLabel: '02 / FOOTPRINT', footprintTitle: '연표로 보는 발자취',
  crewLabel: '03 / CREW', crewTitle: '이 밴드의 사람들',
  sourcesTitle: '출처와 검수',
}

export function BandDetail({
  band,
  onBack,
  isFavorite,
  onToggleFavorite,
  visitedIds,
  journeySteps,
  onTravelBand,
  onResetJourney,
  onShareJourney,
  onShare,
  bandDetailCopy,
  reportUrl,
  focusTrackId,
  onSearch,
  loading = false,
  onMood,
  onSubgenre,
  prevBand,
  nextBand,
  onNavigate,
}: BandDetailProps) {
  const [showAllAlbums, setShowAllAlbums] = useState(false)
  const copy = { ...defaultSectionCopy, ...Object.fromEntries(Object.entries(bandDetailCopy.sections ?? {}).filter(([, value]) => value?.trim())) }
  useEffect(() => {
    if (!onNavigate || (!prevBand && !nextBand)) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === 'ArrowLeft' && prevBand) onNavigate(prevBand)
      if (event.key === 'ArrowRight' && nextBand) onNavigate(nextBand)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nextBand, onNavigate, prevBand])
  useEffect(() => {
    if (!focusTrackId) return
    const row = document.getElementById(`track-${focusTrackId}`)
    if (!row) return
    row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    row.classList.add('is-focused')
    const timer = window.setTimeout(() => row.classList.remove('is-focused'), 2400)
    return () => window.clearTimeout(timer)
  }, [band.id, focusTrackId])
  const genre = genreById[band.primaryGenre]
  const taxonomyGenre = band.taxonomyV2 ? taxonomyGenreById[band.taxonomyV2.primaryGenreId] : undefined
  const genreColor = taxonomyGenre?.color ?? genre.color
  const taxonomySubgenres = band.taxonomyV2?.subgenreIds.map((id) => taxonomySubgenreById[id]?.name ?? id) ?? []
  const taxonomyCrossings = band.taxonomyV2
    ? [...new Set([band.taxonomyV2.primaryGenreId, ...band.taxonomyV2.secondaryGenreIds])].map((id) => taxonomyGenreById[id]).filter(Boolean)
    : []
  const subgenreTags = band.taxonomyV2?.subgenreIds.map((id) => ({ id, name: taxonomySubgenreById[id]?.name ?? id })) ?? []
  const topMoods = band.taxonomyV2
    ? (Object.entries(band.taxonomyV2.moodScores) as Array<[MoodId, number]>)
      .filter(([, score]) => score >= 3)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([id, score]) => ({ id, score, name: taxonomyMoodById[id]?.name ?? id }))
    : []
  const currentMembers = band.members.filter((member) => member.status !== 'former')
  const formerMembers = band.members.filter((member) => member.status === 'former')
  const imageCredit = band.image.credit
  const orderedTracks = [...band.tracks].sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity))
  const essentialAlbums = (band.albums ?? []).filter((album) => album.essential)
  // 입문 추천 음반이 정해져 있으면 그것을, 아니면 대표곡이 실린 음반을 "대표 음반"으로 보인다.
  const albums = essentialAlbums.length
    ? essentialAlbums.map((album) => album.title)
    : [...new Set(band.tracks.map((track) => track.album).filter((album): album is string => Boolean(album)))]
  const timeline = buildBandTimeline(band, { essentialOnly: !showAllAlbums })
  const hiddenAlbumCount = essentialAlbums.length ? (band.albums?.length ?? 0) - essentialAlbums.length : 0
  const stillActive = isStillActive(band.activeYears)
  const sourceLinks = sourceLinkOrder
    .map((publisher) => band.sources.find((source) => source.publisher === publisher && source.url))
    .filter((source): source is NonNullable<typeof source> => Boolean(source))
  const trivia = (band.trivia ?? []).filter((item) => item.source?.url)
  const reviewedOn = formatReviewDate(band.reviewedAt)
  const youtubeChannel = band.sources.find((source) => source.publisher === 'YouTube' && source.official)

  return (
    <main className="detail-page" style={{ '--genre-color': genreColor } as React.CSSProperties}>
      <div className="detail-topbar shell">
        <button className="back-button" onClick={onBack}><ArrowLeft size={17} /> 이전 페이지</button>
        <span>ROCK ATLAS / {(taxonomyGenre?.englishName ?? genre.englishName).toUpperCase()}</span>
        <span className="detail-topbar-actions">
          {prevBand && onNavigate && <button className="back-button" onClick={() => onNavigate(prevBand)} aria-label={`이전 밴드: ${prevBand.name} (←)`} title={`${prevBand.name} (←)`}><ChevronLeft size={16} /></button>}
          {nextBand && onNavigate && <button className="back-button" onClick={() => onNavigate(nextBand)} aria-label={`다음 밴드: ${nextBand.name} (→)`} title={`${nextBand.name} (→)`}><ChevronRight size={16} /></button>}
          {onSearch && <button className="back-button" onClick={onSearch} aria-label="검색 (/ 또는 Ctrl+K)"><Search size={16} /></button>}
          <button className="back-button" onClick={onShare}><Share2 size={16} /> 이 밴드 공유</button>
        </span>
      </div>

      <section className="detail-hero shell">
        <div className="detail-heading">
          <span className="eyebrow" style={{ color: genreColor }}>{taxonomyGenre?.displayName ?? genre.name} / EST. {band.formed}</span>
          <h1>{band.name}</h1>
        </div>
        <div className="detail-portrait">
          <BandImage band={band} eager />
          <a href={imageCredit.sourceUrl} target="_blank" rel="noreferrer" className="image-credit" title={imageCredit.creator ? `${imageCredit.creator} · ${imageCredit.license}` : undefined}>
            {imageCredit.reviewStatus === 'verified' ? `사진: ${imageCredit.creator} · ${imageCredit.license}` : '사진 출처 · 라이선스 검토 필요'} <ExternalLink size={12} />
          </a>
        </div>
        <div className="detail-intro">
          <button className={`favorite-button detail-favorite ${isFavorite ? 'is-active' : ''}`} onClick={() => onToggleFavorite(band.id)} aria-pressed={isFavorite}>
            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            {isFavorite ? '저장됨' : '이 밴드 저장'}
          </button>
          <span className="detail-kicker">핵심 발자취</span>
          <p className="detail-summary">{band.summary}</p>
          <div className="detail-facts detail-facts-emphasis">
            <span><MapPin size={17} />{band.origin}</span>
            <span><CalendarDays size={17} />{band.activeYears}</span>
            <span><Users size={17} />{formerMembers.length ? `${stillActive ? '현재' : '마지막'} ${currentMembers.length}명 · 거쳐간 멤버 ${formerMembers.length}명` : `멤버 ${currentMembers.length}명`}</span>
          </div>
          <div className="tag-list tag-list-emphasis">{subgenreTags.length && band.taxonomyV2 && onSubgenre
            ? subgenreTags.map((tag) => <button key={tag.id} onClick={() => onSubgenre(band.taxonomyV2!.primaryGenreId, tag.id)} title={taxonomySubgenreById[tag.id]?.description ?? `${tag.name} 밴드 더 보기`}>#{tag.name}</button>)
            : (taxonomySubgenres.length ? taxonomySubgenres : band.subgenres).map((tag) => <span key={tag}>#{tag}</span>)}</div>
        </div>
      </section>

      {loading ? <div className="detail-loading shell" aria-live="polite">밴드 항해 기록을 불러오는 중입니다…</div> : <>
      <nav className="detail-section-nav shell" aria-label="이 페이지의 구역">
        <a href="#sound">소리</a><a href="#footprint">발자취</a><a href="#crew">사람들</a><a href="#hitchhiking">히치하이킹</a><a href="#connections">이어진 밴드</a>
      </nav>

      <div className="detail-grid shell">
        <section className="detail-story" id="sound">
          <span className="section-no">{copy.soundLabel}</span>
          <h2>{copy.soundTitle}</h2>
          <p>{band.style}</p>
          <div className="sound-facts">
            <div><span>세부 장르</span>{(taxonomySubgenres.length ? taxonomySubgenres : band.subgenres).length
              ? (taxonomySubgenres.length ? taxonomySubgenres : band.subgenres).map((item) => <strong key={item}>{item}</strong>)
              : <strong>{taxonomyGenre?.displayName || genre.name}</strong>}</div>
            {topMoods.length > 0 && <div><span>대표 분위기</span><ul className="detail-mood-bars">{topMoods.map((mood) => <li key={mood.id}>
              {onMood ? <button onClick={() => onMood(mood.id)} title="이 분위기로 밴드 찾기">{mood.name}</button> : <strong>{mood.name}</strong>}
              <i aria-hidden="true"><b style={{ width: `${mood.score * 20}%` }} /></i><em aria-label={`5점 중 ${mood.score}점`}>{mood.score}</em>
            </li>)}</ul></div>}
            <div><span>대표 음반</span>{albums.length ? albums.map((album) => <strong key={album}>{album}</strong>) : <strong>편집 대기</strong>}</div>
          </div>
          <div className="genre-crossings">
            <span>장르 교차점</span>
            {taxonomyCrossings.length
              ? taxonomyCrossings.map((item) => <strong key={item.id}>{item.displayName}</strong>)
              : band.genreIds.map((id) => <strong key={id}>{genreById[id].name}</strong>)}
          </div>
          <div className="era-timeline" aria-label="시대별 장르 변화">
            {groupEraTags(band.eraTags, band.activeYears).map((group) => (
              <div key={group.key}>
                <strong>{group.label}</strong>
                <span>{group.subgenres.map((item) => <em key={item}>{item}</em>)}</span>
                {group.note && <small>{group.note}</small>}
              </div>
            ))}
          </div>
        </section>

        <section className="track-list-section" id="footprint">
          <span className="section-no">{copy.footprintLabel}</span>
          <h2>{band.albums?.length || band.milestones?.length ? copy.footprintTitle : '대표곡으로 보는 발자취'}</h2>
          <ol className="career-timeline band-timeline">
            {timeline.map((entry) => {
              if (entry.kind === 'formed') return <li key={entry.key} data-kind="event"><time>{entry.year}</time><span><strong>{band.origin}에서 결성</strong><small>{band.activeYears}</small></span></li>
              if (entry.kind === 'milestone') return <li key={entry.key} data-kind="event"><time>{entry.year}</time><span><strong>{entry.milestone.text}</strong></span></li>
              if (entry.kind === 'track') return <li key={entry.key} data-kind="track"><time>{entry.year}</time><span><strong>{entry.track.title}</strong><small>{entry.track.album ?? (entry.track.releaseType === 'single' ? '싱글' : '대표곡')}</small></span></li>
              return <li key={entry.key} data-kind="album" data-essential={entry.album.essential ? 'true' : undefined}>
                <time>{entry.year}</time>
                <span>
                  <strong>{entry.album.title}{entry.album.essential && <em className="album-badge">입문 추천</em>}</strong>
                  <small>{albumTypeLabels[entry.album.type]}</small>
                  {entry.album.note && <p>{entry.album.note}</p>}
                  {entry.tracks.length > 0 && <ul>{entry.tracks.map((track) => <li key={track.id}>{track.title}</li>)}</ul>}
                </span>
              </li>
            })}
          </ol>
          {hiddenAlbumCount > 0 && <button className="timeline-toggle" onClick={() => setShowAllAlbums(!showAllAlbums)}>{showAllAlbums ? '입문 추천 음반만 보기' : `전체 디스코그래피 펼치기 (${hiddenAlbumCount}장 더)`}</button>}
          <h3 className="listen-heading">대표곡</h3>
          <div className="track-list track-guide-list">
            {orderedTracks.map((item, index) => {
              const hasReviewedDirectLink = item.reviewStatus !== 'draft' && Boolean(item.youtubeId)
              const href = hasReviewedDirectLink
                ? item.source.url
                : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${band.name} ${item.title}`)}`
              return (
                <a key={item.id} id={`track-${item.id}`} className="track-row track-guide-row" href={href} target="_blank" rel="noreferrer">
                  <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="track-info"><strong>{item.title}</strong><small>{[item.album ?? (item.releaseType === 'single' ? '싱글' : undefined), item.year].filter(Boolean).join(' · ')}</small>{item.guide && <p>{item.guide}</p>}</span>
                  <span className="track-external"><small>{hasReviewedDirectLink ? 'YouTube' : 'YouTube 검색'}</small><ExternalLink size={15} /></span>
                </a>
              )
            })}
          </div>
          {youtubeChannel && (
            <a className="youtube-channel-card" href={youtubeChannel.url} target="_blank" rel="noreferrer">
              <span><strong>{band.name} 공식 YouTube</strong><small>더 많은 음악은 아티스트의 공식 채널에서 확인하세요.</small></span>
              <ExternalLink size={18} />
            </a>
          )}
        </section>

        <section className="members-section detail-grid-wide" id="crew">
          <span className="section-no">{copy.crewLabel}</span>
          <h2>{copy.crewTitle}</h2>
          <div className="member-columns">
            <div>
              <h3>{stillActive ? '현재 라인업' : '마지막 라인업'}</h3>
              {currentMembers.map((member) => <p key={member.name}><strong>{member.name}</strong><span>{memberLine(member)}{member.status === 'touring' ? ' · 투어' : ''}</span></p>)}
            </div>
            {formerMembers.length > 0 && <div>
              <h3>과거 핵심 멤버</h3>
              {formerMembers.map((member) => <p key={member.name}><strong>{member.name}</strong><span>{memberLine(member)}</span></p>)}
            </div>}
          </div>
        </section>

        {trivia.length > 0 && <section className="trivia-section detail-grid-wide">
          <span className="section-no">04 / TRIVIA</span>
          <h2>알고 계셨나요</h2>
          <ul>{trivia.map((item) => <li key={item.text}><p>{item.text}</p><a href={item.source.url} target="_blank" rel="noreferrer">{item.source.label} <ExternalLink size={12} /></a></li>)}</ul>
        </section>}
      </div>

      <div className="shell">
        <div id="hitchhiking" className="detail-anchor" />
        <HitchhikingPanel
          band={band}
          visitedIds={visitedIds}
          journeySteps={journeySteps}
          copy={bandDetailCopy}
          onTravel={(target, direction: HitchhikingDirectionId) => onTravelBand(target, direction)}
          onResetJourney={onResetJourney}
          onShareJourney={onShareJourney}
        />
        <div id="connections" className="detail-anchor" />
        <RelationMap band={band} onSelect={(target) => onTravelBand(target, 'connection')} visitedIds={visitedIds} copy={bandDetailCopy} />

        <section className="sources-section" aria-labelledby="sources-title">
          <span className="section-no">SOURCES</span>
          <h2 id="sources-title">{copy.sourcesTitle}</h2>
          <div className="sources-grid">
            <div>
              <h3>참고한 자료</h3>
              <ul>{sourceLinks.map((source) => <li key={source.publisher}><a href={source.url} target="_blank" rel="noreferrer">{source.publisher} <ExternalLink size={12} /></a></li>)}</ul>
              {(band.albums?.length ?? 0) > 0 && <p>음반 목록과 발매 연도는 MusicBrainz 기준입니다.</p>}
            </div>
            <div>
              <h3>사진</h3>
              <p>{imageCredit.reviewStatus === 'verified'
                ? <>{imageCredit.creator ?? '저작자 미상'} · {imageCredit.licenseUrl ? <a href={imageCredit.licenseUrl} target="_blank" rel="noreferrer">{imageCredit.license}</a> : imageCredit.license}</>
                : '출처·라이선스 검토 중'}</p>
              <a href={imageCredit.sourceUrl} target="_blank" rel="noreferrer">원본 파일 <ExternalLink size={12} /></a>
            </div>
            <div>
              <h3>검수</h3>
              <p>{reviewedOn ? `마지막 검수 ${reviewedOn}` : '검수 기록 없음'}</p>
              {reportUrl && <a className="report-link" href={reportUrl} target="_blank" rel="noreferrer" title={`${band.name} 정보에 대한 제안`}><Flag size={13} /> 잘못된 정보 알리기</a>}
            </div>
          </div>
        </section>
      </div>
      </>}
    </main>
  )
}
