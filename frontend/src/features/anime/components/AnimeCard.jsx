export default function AnimeCard({ anime, index }) {
  const score = Number.isFinite(anime.score) ? anime.score.toFixed(1) : '—'
  const details = [anime.type, anime.episodes ? `${anime.episodes} episodes` : null].filter(Boolean).join(' · ')

  return (
    <article className="anime-card">
      <div className="poster-art">
        {anime.image ? (
          <img className="poster-image" src={anime.image} alt={`${anime.title} poster`} loading="lazy" />
        ) : (
          <div className="poster-fallback" aria-label={`${anime.title} poster unavailable`}>
            <span>0{index + 1}</span><strong>ANI<br />VERSE</strong>
          </div>
        )}
        <div className="poster-badges">
          <div className="poster-primary-badges">
            {anime.episodes !== null && anime.episodes !== undefined && <span>EP {anime.episodes}</span>}
            <span className="rating-badge">★ {score}</span>
            {anime.status === 'unreleased' && anime.trailer && (
              <a className="trailer-badge" href={anime.trailer} target="_blank" rel="noreferrer">TRAILER</a>
            )}
            <span className="type-badge">{anime.type?.toUpperCase() || 'ANIME'}</span>
          </div>
          {(anime.subtitles?.length > 0 || anime.dubs?.length > 0) && (
            <div className="poster-language-badges">
              {anime.subtitles?.length > 0 && <span className="language-badge">SUB</span>}
              {anime.dubs?.length > 0 && <span className="language-badge">DUB</span>}
            </div>
          )}
        </div>
      </div>
      <div className="anime-card-copy">
        <h3 title={anime.title}>{anime.title}</h3>
        <p>{anime.status || details || 'Anime'}</p>
      </div>
    </article>
  )
}
