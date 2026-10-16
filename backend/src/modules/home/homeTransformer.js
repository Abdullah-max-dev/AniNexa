const getTitle = (attributes) => (
    attributes.canonicalTitle
    || attributes.titles?.en
    || attributes.titles?.en_jp
    || attributes.titles?.ja_jp
    || "Untitled anime"
);

const getPoster = (posterImage) => (
    posterImage?.medium
    || posterImage?.large
    || posterImage?.original
    || posterImage?.small
    || null
);

const getAudioAvailability = (anime, streamingLinksById) => {
    const links = anime.relationships?.streamingLinks?.data || [];
    const subtitles = new Set();
    const dubs = new Set();

    links.forEach((link) => {
        const attributes = streamingLinksById.get(String(link.id));
        attributes?.subs?.forEach((language) => subtitles.add(language));
        attributes?.dubs?.forEach((language) => dubs.add(language));
    });

    return { subtitles: [...subtitles], dubs: [...dubs] };
};

const transformHomeAnime = (anime, streamingLinksById = new Map()) => {
    const { id, attributes = {} } = anime;
    const rating = Number.parseFloat(attributes.averageRating);
    const subtype = attributes.subtype || null;
    const audio = getAudioAvailability(anime, streamingLinksById);

    return {
        id,
        title: getTitle(attributes),
        image: getPoster(attributes.posterImage),
        score: Number.isFinite(rating) ? Math.round(rating) / 10 : null,
        // Kitsu represents many movies as one episode, but an episode badge is
        // misleading for a movie card.
        episodes: subtype?.toLowerCase() === "movie" ? null : attributes.episodeCount ?? null,
        type: subtype,
        status: attributes.status || null,
        trailer: attributes.youtubeVideoId ? `https://www.youtube.com/watch?v=${attributes.youtubeVideoId}` : null,
        subtitles: audio.subtitles,
        dubs: audio.dubs,
    };
};

module.exports = { transformHomeAnime };
