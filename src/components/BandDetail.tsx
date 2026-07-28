import { ArrowLeft, CalendarDays, Check, CircleAlert, ExternalLink, Heart, MapPin, Share2, Users } from 'lucide-react'
import { genreById } from '../data/genres'
import { eraById } from '../data/eras'
import { reviewBand } from '../data/review'
import { taxonomyGenreById, taxonomyMoodById, taxonomySubgenreById } from '../data/taxonomy'
import type { Band, BandEraTag, Track } from '../types/music'
import type { MoodId } from '../types/taxonomy'
import { BandImage } from './BandImage'
import { RelationMap } from './RelationMap'

const LATEST_ERA = '2020s'

/** Collapses consecutive eras with the same subgenre/genre mix into one range row, so a genre that never changed doesn't repeat itself every decade. */
function groupEraTags(eraTags: BandEraTag[]) {
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
  return groups.map((group) => {
    const startLabel = eraById[group.startEra].label
    const endLabel = eraById[group.endEra].label
    const isOngoing = group.endEra === LATEST_ERA && group.startEra !== group.endEra
    const label = group.startEra === group.endEra ? startLabel : isOngoing ? `${startLabel}~` : `${startLabel}~${endLabel}`
    return { key: `${group.startEra}-${group.endEra}`, label, subgenres: group.subgenres, note: group.note }
  })
}

interface BandDetailProps {
  band: Band
  onBack: () => void
  onSelectBand: (band: Band) => void
  isFavorite: boolean
  onToggleFavorite: (bandId: string) => void
  visitedIds: string[]
  onShare: () => void
}

export function BandDetail({ band, onBack, onSelectBand, isFavorite, onToggleFavorite, visitedIds, onShare }: BandDetailProps) {
  const genre = genreById[band.primaryGenre]
  const taxonomyGenre = band.taxonomyV2 ? taxonomyGenreById[band.taxonomyV2.primaryGenreId] : undefined
  const genreColor = taxonomyGenre?.color ?? genre.color
  const taxonomySubgenres = band.taxonomyV2?.subgenreIds.map((id) => taxonomySubgenreById[id]?.name ?? id) ?? []
  const taxonomyCrossings = band.taxonomyV2
    ? [...new Set([band.taxonomyV2.primaryGenreId, ...band.taxonomyV2.secondaryGenreIds])].map((id) => taxonomyGenreById[id]).filter(Boolean)
    : []
  const topMoods = band.taxonomyV2
    ? Object.entries(band.taxonomyV2.moodScores)
      .filter(([, score]) => score >= 3)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([id]) => taxonomyMoodById[id as MoodId]?.name ?? id)
    : []
  const currentMembers = band.members.filter((member) => member.status !== 'former')
  const formerMembers = band.members.filter((member) => member.status === 'former')
  const review = reviewBand(band)
  const imageCredit = band.image.credit
  const datedTracks = band.tracks.filter((track): track is Track & { year: number } => typeof track.year === 'number').sort((a, b) => a.year - b.year)
  const orderedTracks = [...band.tracks].sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity))
  const albums = [...new Set(band.tracks.map((track) => track.album).filter((album): album is string => Boolean(album)))]
  const youtubeChannel = band.sources.find((source) => source.publisher === 'YouTube' && source.official)

  return (
    <main className="detail-page" style={{ '--genre-color': genreColor } as React.CSSProperties}>
      <div className="detail-topbar shell">
        <button className="back-button" onClick={onBack}><ArrowLeft size={17} /> 이전 페이지</button>
        <span>ROCK ATLAS / {(taxonomyGenre?.englishName ?? genre.englishName).toUpperCase()}</span>
        <button className="back-button" onClick={onShare}><Share2 size={16} /> 이 밴드 공유</button>
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
            <span><Users size={17} />주요 멤버 {band.members.length}명</span>
          </div>
          <div className="tag-list tag-list-emphasis">{(taxonomySubgenres.length ? taxonomySubgenres : band.subgenres).map((tag) => <span key={tag}>#{tag}</span>)}</div>
        </div>
      </section>

      <div className="detail-grid shell">
        <section className="detail-story">
          <span className="section-no">01 / SOUND</span>
          <h2>어떤 음악을 하나요?</h2>
          <p>{band.style}</p>
          <div className="sound-facts">
            <div><span>세부 장르</span>{(taxonomySubgenres.length ? taxonomySubgenres : band.subgenres).length
              ? (taxonomySubgenres.length ? taxonomySubgenres : band.subgenres).map((item) => <strong key={item}>{item}</strong>)
              : <strong>{taxonomyGenre?.displayName || genre.name}</strong>}</div>
            {topMoods.length > 0 && <div><span>대표 분위기</span>{topMoods.map((mood) => <strong key={mood}>{mood}</strong>)}</div>}
            <div><span>대표 음반</span>{albums.length ? albums.map((album) => <strong key={album}>{album}</strong>) : <strong>편집 대기</strong>}</div>
          </div>
          <div className="genre-crossings">
            <span>장르 교차점</span>
            {taxonomyCrossings.length
              ? taxonomyCrossings.map((item) => <strong key={item.id}>{item.displayName}</strong>)
              : band.genreIds.map((id) => <strong key={id}>{genreById[id].name}</strong>)}
          </div>
          <div className="era-timeline" aria-label="시대별 장르 변화">
            {groupEraTags(band.eraTags).map((group) => (
              <div key={group.key}>
                <strong>{group.label}</strong>
                <span>{group.subgenres.map((item) => <em key={item}>{item}</em>)}</span>
                {group.note && <small>{group.note}</small>}
              </div>
            ))}
          </div>
        </section>

        <section className="track-list-section">
          <span className="section-no">02 / FOOTPRINT</span>
          <h2>대표곡으로 보는 발자취</h2>
          <div className="career-timeline">
            <div><time>{band.formed}</time><span><strong>{band.origin}에서 결성</strong><small>{band.activeYears}</small></span></div>
            {datedTracks.map((track) => (
              <div key={track.id}><time>{track.year}</time><span><strong>{track.title}</strong><small>{track.album ?? '싱글·수록 음반 정보 확인 중'}</small></span></div>
            ))}
          </div>
          <h3 className="listen-heading">대표곡</h3>
          <div className="track-list track-guide-list">
            {orderedTracks.map((item, index) => {
              const hasReviewedDirectLink = item.reviewStatus !== 'draft' && Boolean(item.youtubeId)
              const href = hasReviewedDirectLink
                ? item.source.url
                : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${band.name} ${item.title}`)}`
              return (
                <a key={item.id} className="track-row track-guide-row" href={href} target="_blank" rel="noreferrer">
                  <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="track-info"><strong>{item.title}</strong><small>{[item.album, item.year].filter(Boolean).join(' · ')}</small>{item.guide && <p>{item.guide}</p>}</span>
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

        <section className="members-section detail-grid-wide">
          <span className="section-no">03 / PEOPLE</span>
          <h2>주요 멤버</h2>
          <div className="member-columns">
            <div>
              <h3>현재 / 후기 라인업</h3>
              {currentMembers.map((member) => <p key={member.name}><strong>{member.name}</strong><span>{member.role}{member.activeYears ? ` · ${member.activeYears}` : ''}{member.status === 'touring' ? ' · 투어' : ''}</span></p>)}
            </div>
            {formerMembers.length > 0 && <div>
              <h3>과거 핵심 멤버</h3>
              {formerMembers.map((member) => <p key={member.name}><strong>{member.name}</strong><span>{member.role}{member.activeYears ? ` · ${member.activeYears}` : ''}</span></p>)}
            </div>}
          </div>
        </section>
      </div>

      <div className="shell"><RelationMap band={band} onSelect={onSelectBand} visitedIds={visitedIds} /></div>

      <details className="sources-disclosure shell">
        <summary><span>출처 · 권리</span><small>검수 {review.passedChecks}/{review.totalChecks}</small></summary>
        <div className="sources-disclosure-body">
          <p>데이터와 이미지·영상 권리 상태를 확인하는 운영 정보입니다.</p>
          <div className="review-progress" aria-label={`검수 기준 ${review.totalChecks}개 중 ${review.passedChecks}개 통과`}><span style={{ width: `${(review.passedChecks / review.totalChecks) * 100}%` }} /></div>
          <ul className="review-checks">
            {review.checks.map((check) => (
              <li key={check.id} className={check.passed ? 'is-passed' : ''}>{check.passed ? <Check size={14} /> : <CircleAlert size={14} />}<span><strong>{check.label}</strong><small>{check.detail}</small></span></li>
            ))}
          </ul>
          <div className="source-links">
            {band.sources.map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span>{source.label}<small>{source.externalId ?? source.note ?? '외부 원문 연결'}</small></span><ExternalLink size={13} /></a>
            ))}
          </div>
        </div>
      </details>
    </main>
  )
}
