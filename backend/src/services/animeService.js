const { transformAnimeList } = require("../transformers/animeTransformer");
const { redisClient } = require("../../db/redis");

const upstreamError = (message, statusCode = 502) => Object.assign(new Error(message), { statusCode });
const ANIME_CACHE_TTL_SECONDS = Number(process.env.ANIME_CACHE_TTL_SECONDS || 300);

if (!Number.isSafeInteger(ANIME_CACHE_TTL_SECONDS) || ANIME_CACHE_TTL_SECONDS <= 0) {
    throw new Error("ANIME_CACHE_TTL_SECONDS must be a positive integer");
}

const cacheKey = ({ page, limit }) => `anime:list:v1:page:${page}:limit:${limit}`;

const getCachedListing = async (key) => {
    try {
        const cached = await redisClient.get(key);
        if (!cached) return null;

        const listing = JSON.parse(cached);
        if (!Array.isArray(listing.data) || !listing.pagination) throw new Error("Invalid cache value");
        return listing;
    } catch {
        // The listing is public data: Redis failure should not prevent Kitsu data from loading.
        return null;
    }
};

const cacheListing = async (key, listing) => {
    try {
        await redisClient.set(key, JSON.stringify(listing), { EX: ANIME_CACHE_TTL_SECONDS });
    } catch {
        // Serve the fresh Kitsu response even if the cache is temporarily unavailable.
    }
};

const listAnime = async ({ page, limit }) => {
    if (!process.env.KITSU_API_URL) {
        throw upstreamError("KITSU_API_URL is not configured", 500);
    }

    const key = cacheKey({ page, limit });
    const cachedListing = await getCachedListing(key);
    if (cachedListing) return cachedListing;

    let url;
    try {
        url = new URL(process.env.KITSU_API_URL);
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid protocol");
        url.pathname = `${url.pathname.replace(/\/+$/, "")}/anime`;
        url.search = "";
        url.searchParams.set("page[limit]", String(limit));
        url.searchParams.set("page[offset]", String((page - 1) * limit));
    } catch {
        throw upstreamError("KITSU_API_URL must be a valid API base URL", 500);
    }

    let response;
    try {
        response = await fetch(url, {
            headers: { Accept: "application/vnd.api+json" },
            signal: AbortSignal.timeout(10000),
        });
    } catch (error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
            throw upstreamError("Anime provider took too long to respond. Please try again.", 504);
        }
        throw upstreamError("Could not reach the anime provider. Please try again.");
    }

    if (!response.ok) {
        throw upstreamError(
            response.status === 429 ? "Anime provider is busy. Please try again shortly." : "Anime provider could not load the list. Please try again.",
            response.status === 429 ? 503 : 502,
        );
    }

    let payload;
    try {
        payload = await response.json();
        if (!Array.isArray(payload.data)) throw new Error("Missing anime list");
    } catch {
        throw upstreamError("Anime provider returned an invalid response.");
    }

    const total = Number.isSafeInteger(payload.meta?.count) && payload.meta.count >= 0 ? payload.meta.count : null;
    const listing = {
        data: transformAnimeList(payload.data),
        pagination: {
            page,
            limit,
            total,
            totalPages: total === null ? null : Math.ceil(total / limit),
            hasNextPage: Boolean(payload.links?.next),
            hasPreviousPage: page > 1,
        },
    };

    await cacheListing(key, listing);
    return listing;
};

module.exports = { listAnime };
