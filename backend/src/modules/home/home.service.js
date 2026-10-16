const { redisClient } = require("../../../db/redis");
const { createHomeMix, createTopRated } = require("./homeAlgorithm");
const { transformHomeAnime } = require("./homeTransformer");

const HOME_CACHE_TTL_SECONDS = Number(process.env.ANIME_CACHE_TTL_SECONDS || 300);
const HOME_POOL_SIZE = 20;

if (!Number.isSafeInteger(HOME_CACHE_TTL_SECONDS) || HOME_CACHE_TTL_SECONDS <= 0) {
    throw new Error("ANIME_CACHE_TTL_SECONDS must be a positive integer");
}

const upstreamError = (message, statusCode = 502) => Object.assign(new Error(message), { statusCode });
const cacheKey = (limit) => `home:discover:v7:limit:${limit}`;

const readCache = async (key) => {
    try {
        const cached = await redisClient.get(key);
        if (!cached) return null;

        const listing = JSON.parse(cached);
        return Array.isArray(listing.data) ? listing : null;
    } catch {
        return null;
    }
};

const saveCache = async (key, listing) => {
    try {
        await redisClient.set(key, JSON.stringify(listing), { EX: HOME_CACHE_TTL_SECONDS });
    } catch {
        // Kitsu can still serve the home page if Redis is temporarily unavailable.
    }
};

const createAnimeUrl = (sort) => {
    if (!process.env.KITSU_API_URL) throw upstreamError("KITSU_API_URL is not configured", 500);

    try {
        const url = new URL(process.env.KITSU_API_URL);
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error("Invalid protocol");

        url.pathname = `${url.pathname.replace(/\/+$/, "")}/anime`;
        url.search = "";
        url.searchParams.set("page[limit]", String(HOME_POOL_SIZE));
        url.searchParams.set("page[offset]", "0");
        url.searchParams.set("sort", sort);
        url.searchParams.set("include", "streamingLinks");
        return url;
    } catch (error) {
        if (error.statusCode) throw error;
        throw upstreamError("KITSU_API_URL must be a valid API base URL", 500);
    }
};

const fetchAnimePool = async (sort) => {
    let response;
    try {
        response = await fetch(createAnimeUrl(sort), {
            headers: { Accept: "application/vnd.api+json" },
            signal: AbortSignal.timeout(10000),
        });
    } catch (error) {
        if (error.statusCode) throw error;
        if (error.name === "TimeoutError" || error.name === "AbortError") {
            throw upstreamError("Anime provider took too long to respond. Please try again.", 504);
        }
        throw upstreamError("Could not reach the anime provider. Please try again.");
    }

    if (!response.ok) {
        throw upstreamError(
            response.status === 429 ? "Anime provider is busy. Please try again shortly." : "Anime provider could not load the home page. Please try again.",
            response.status === 429 ? 503 : 502,
        );
    }

    try {
        const payload = await response.json();
        if (!Array.isArray(payload.data)) throw new Error("Missing anime list");
        return { data: payload.data, included: Array.isArray(payload.included) ? payload.included : [] };
    } catch {
        throw upstreamError("Anime provider returned an invalid response.");
    }
};

const getHomeListing = async ({ limit }) => {
    const key = cacheKey(limit);
    const cached = await readCache(key);
    if (cached) return cached;

    const [recentResult, popularResult, topRatedResult] = await Promise.allSettled([
        fetchAnimePool("-startDate"),
        fetchAnimePool("-userCount"),
        fetchAnimePool("-averageRating"),
    ]);

    if (recentResult.status === "rejected" && popularResult.status === "rejected" && topRatedResult.status === "rejected") {
        throw recentResult.reason;
    }

    const emptyPool = { data: [], included: [] };
    const recent = recentResult.status === "fulfilled" ? recentResult.value : emptyPool;
    const popular = popularResult.status === "fulfilled" ? popularResult.value : emptyPool;
    const topRated = topRatedResult.status === "fulfilled" ? topRatedResult.value : emptyPool;
    const streamingLinksById = new Map(
        [...recent.included, ...popular.included, ...topRated.included]
            .filter((item) => item.type === "streamingLinks")
            .map((item) => [String(item.id), item.attributes || {}]),
    );
    const transform = (anime) => transformHomeAnime(anime, streamingLinksById);
    const listing = {
        data: createHomeMix({ recent: recent.data, popular: popular.data, limit }).map(transform),
        topRated: createTopRated(topRated.data).map(transform),
    };

    await saveCache(key, listing);
    return listing;
};

module.exports = { getHomeListing };
