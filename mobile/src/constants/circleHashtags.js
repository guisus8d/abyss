export const CIRCLE_HASHTAGS = [
  'conversacion', 'cafe', 'amigos', 'gaming', 'anime',
  'musica', 'arte', 'memes', 'estudio', 'deportes',
  'peliculas', 'roleplay', 'random', 'novatos', 'noche'
];

export const HASHTAG_COLORS = [
  '#2979ff', '#f472b6', '#facc15', '#22d3ee',
  '#4ade80', '#f97316', '#a855f7', '#ef4444',
  '#06b6d4', '#84cc16'
];

export const getHashtagColor = (tag) => {
  const idx = CIRCLE_HASHTAGS.indexOf(tag);
  return HASHTAG_COLORS[idx >= 0 ? idx :
    Math.abs(tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
    % HASHTAG_COLORS.length];
};
