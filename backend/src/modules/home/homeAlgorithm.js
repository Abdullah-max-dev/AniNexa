const MIN_HOME_YEAR = 2012;

const getYear = (anime) => {
    const year = Number.parseInt(anime.attributes?.startDate?.slice(0, 4), 10);
    return Number.isInteger(year) ? year : null;
};

const isHomeCandidate = (anime) => {
    const year = getYear(anime);
    const currentYear = new Date().getUTCFullYear();
    const { attributes = {} } = anime;

    const isUnreleased = attributes.status === "unreleased";
    const isCurrentlyReleasing = attributes.status === "current";
    const hasCompleteMetadata = Number.isFinite(Number.parseFloat(attributes.averageRating))
        && attributes.episodeCount !== null
        && attributes.episodeCount !== undefined;

    return anime?.id
        && attributes.status !== "tba"
        && year !== null
        && year >= MIN_HOME_YEAR
        && year <= currentYear + 1
        // Upcoming titles require a trailer. Ongoing titles can appear before
        // Kitsu knows their final episode count or community rating.
        && (isUnreleased ? Boolean(attributes.youtubeVideoId) : isCurrentlyReleasing || hasCompleteMetadata);
};

const uniqueEligible = (anime) => {
    const ids = new Set();

    return anime.filter((item) => {
        if (!isHomeCandidate(item) || ids.has(item.id)) return false;
        ids.add(item.id);
        return true;
    });
};

const addNext = (result, source, seenIds) => {
    const next = source.find((item) => !seenIds.has(item.id));
    if (!next) return false;

    result.push(next);
    seenIds.add(next.id);
    return true;
};

// The home page is intentionally not an all-time ranking. It uses two recent
// picks for every one established popular pick, so older classics cannot fill
// the first screen while visitors still see proven shows.
const createHomeMix = ({ recent, popular, limit }) => {
    const recentPool = uniqueEligible(recent);
    const popularPool = uniqueEligible(popular);
    const result = [];
    const seenIds = new Set();

    while (result.length < limit) {
        const addedRecent = addNext(result, recentPool, seenIds);
        if (result.length >= limit) break;

        const addedPopular = addNext(result, popularPool, seenIds);
        if (result.length >= limit) break;

        const addedSecondRecent = addNext(result, recentPool, seenIds);
        if (!addedRecent && !addedPopular && !addedSecondRecent) break;
    }

    return result;
};

const ratingValue = (anime) => Number.parseFloat(anime.attributes?.averageRating) || 0;
const userCountValue = (anime) => Number(anime.attributes?.userCount) || 0;

const createTopRated = (anime, limit = 10) => uniqueEligible(anime)
    .sort((first, second) => ratingValue(second) - ratingValue(first) || userCountValue(second) - userCountValue(first))
    .slice(0, limit);

module.exports = { createHomeMix, createTopRated };
