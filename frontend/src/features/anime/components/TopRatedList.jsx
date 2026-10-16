const formatScore = (score) => (Number.isFinite(score) ? score.toFixed(1) : '—')

export default function TopRatedList({ anime = [], loading }) {
  return (
    <aside className="top-rated-panel" aria-labelledby="top-rated-heading">
      <div className="top-rated-heading">
        <div><p className="eyebrow"><span />BEST SCORES</p><h2 id="top-rated-heading">Top rated</h2></div>
        <span className="all-time-label">ALL TIME</span>
      </div>
      <div className="top-rated-list">
        {loading ? Array.from({ length: 6 }, (_, index) => (
          <div className="top-rated-skeleton" key={index}><span /><i /><div><b /><b /></div></div>
        )) : anime.map((item, index) => (
          <article className="top-rated-item" key={item.id}>
            <span className="top-rated-rank">{String(index + 1).padStart(2, '0')}</span>
            {item.image ? <img src={item.image} alt={`${item.title} poster`} loading="lazy" /> : <div className="top-rated-image-fallback" aria-hidden="true">ANI</div>}
            <div className="top-rated-copy">
              <h3 title={item.title}>{item.title}</h3>
              <div><span className="top-rated-score">★ {formatScore(item.score)}</span><span>{item.type?.toUpperCase() || 'ANIME'}</span></div>
            </div>
          </article>
        ))}
      </div>
    </aside>
  )
}
