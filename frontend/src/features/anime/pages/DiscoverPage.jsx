import { useEffect, useState } from 'react'
import AnimeCard from '../components/AnimeCard'
import { getAnimeListing } from '../animeApi'
import heroArtwork from '../../../assets/hero.png'

export default function DiscoverPage() {
  const [page, setPage] = useState(1)
  const [listing, setListing] = useState({ data: [], pagination: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getAnimeListing({ page, signal: controller.signal })
      .then((result) => setListing({ data: result.data, pagination: result.pagination }))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [page, reloadKey])

  const goToPage = (nextPage) => {
    setLoading(true)
    setError('')
    setPage(nextPage)
  }

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
          <h1 id="hero-heading">Stories that stay<br /><em>with you.</em></h1>
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
          <p className="listing-note">Showing page {listing.pagination?.page || page}</p>
        </div>
        {loading ? (
          <div className="anime-grid" aria-label="Loading anime" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <div className="anime-card card-skeleton" key={index} />)}</div>
        ) : error ? (
          <div className="listing-state"><strong>We could not load the collection.</strong><span>{error}</span><button className="primary-button" type="button" onClick={retry}>Try again</button></div>
        ) : listing.data.length ? (
          <>
            <div className="anime-grid">{listing.data.map((item, index) => <AnimeCard key={item.id} anime={item} index={index} />)}</div>
            <div className="pagination-controls">
              <button type="button" onClick={() => goToPage(page - 1)} disabled={!listing.pagination?.hasPreviousPage}>← Previous</button>
              <span>Page {listing.pagination?.page}</span>
              <button type="button" onClick={() => goToPage(page + 1)} disabled={!listing.pagination?.hasNextPage}>Next →</button>
            </div>
          </>
        ) : (
          <div className="listing-state"><strong>No anime found.</strong><span>This page did not return any anime.</span></div>
        )}
      </section>
    </main>
  )
}
