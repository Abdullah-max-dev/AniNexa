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

const transformAnime = ({ id, attributes = {} }) => {
    const rating = Number.parseFloat(attributes.averageRating);

    return {
        id,
        title: getTitle(attributes),
        image: getPoster(attributes.posterImage),
        // Kitsu's rating is 0–100; the frontend receives a 0–10 score.
        score: Number.isFinite(rating) ? Math.round(rating) / 10 : null,
        episodes: attributes.episodeCount ?? null,
        type: attributes.subtype || null,
        status: attributes.status || null,
    };
};

const transformAnimeList = (anime) => anime.map(transformAnime);

module.exports = { transformAnime, transformAnimeList };
