# AniNexa
AniNexa is a modern anime website where users can discover trending, latest, and popular anime. Users can explore different genres, search for anime, view detailed information, and create personal watchlists. The platform offers a fast, simple, and user-friendly experience across all devices.

## Anime listing cache

The frontend requests only `GET /api/anime?page=1&limit=20`; it does not call Kitsu directly. The backend formats the Kitsu response and stores each page/limit combination in Redis for five minutes.

Set these values in `backend/.env`:

```env
KITSU_API_URL=https://kitsu.io/api/edge
ANIME_CACHE_TTL_SECONDS=300
```

After 300 seconds, Redis removes the listing automatically. The next request loads a fresh result from Kitsu and caches it again. Browser caching is disabled, so Redis remains the only listing cache. If Redis has a temporary problem, the backend still loads the public listing from Kitsu.
