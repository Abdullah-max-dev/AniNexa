import { useEffect, useState } from 'react'
import AnimeCard from '../components/AnimeCard'
import TopRatedList from '../components/TopRatedList'
import { getHomeListing } from '../animeApi'
import heroArtwork from '../../../assets/hero.png'

export default function DiscoverPage() {
  const [listing, setListing] = useState({ data: [], topRated: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getHomeListing({ signal: controller.signal })
      .then((result) => setListing({ data: result.data, topRated: result.topRated || [] }))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [reloadKey])

  const retry = () => {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  return (
    <main id="main-content">
      <section className="hero" id="home" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="eyebrow"><span />YOUR NEXT OBSESSION</p>
          {loading ? (
            <h1 id="hero-heading" className="hero-title-skeleton" aria-label="Loading featured anime">
              <span /><span />
            </h1>
          ) : (
            <h1 id="hero-heading">Stories that stay<br /><em>with you.</em></h1>
          )}
          <p className="hero-description">Explore worlds beyond your imagination. Find the anime that feels like it was made just for you.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#discover">Explore collection <span>→</span></a>
            <button className="text-button" type="button">How it works <span>↗</span></button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="planet planet-one" />
          <div className="planet planet-two" />
          <div className="hero-disk"><span>ANIVERSE<br />EST. 2024</span></div>
          <img src={heroArtwork} alt="" />
          <p className="visual-caption">WATCH<br />SOMETHING<br />WONDERFUL</p>
        </div>
      </section>

      <section className="discover-section" id="discover" aria-labelledby="discover-heading">
        <div className="section-title-row">
          <div><p className="eyebrow"><span />FRESH FOR YOU</p><h2 id="discover-heading">Start your next chapter.</h2></div>
        </div>
        <div className="discover-layout">
          <div className="discover-main">
            {loading ? (
              <div className="anime-grid" aria-label="Loading anime" aria-busy="true">
                {Array.from({ length: 10 }, (_, index) => (
                  <div className="anime-card card-skeleton" key={index}>
                    <div className="skeleton-poster" />
                    <div className="skeleton-copy"><span /><span /><span /></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="listing-state">
                <strong>We could not load the collection.</strong>
                <span>{error}</span>
                <button className="primary-button" type="button" onClick={retry}>Try again</button>
              </div>
            ) : listing.data.length ? (
              <div className="anime-grid">{listing.data.map((item, index) => <AnimeCard key={item.id} anime={item} index={index} />)}</div>
            ) : (
              <div className="listing-state"><strong>No anime found.</strong><span>This page did not return any anime.</span></div>
            )}
          </div>
          <TopRatedList anime={listing.topRated} loading={loading} />
        </div>
      </section>
    </main>
  )
}
