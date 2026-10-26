// Intelligent Multi-Stage Lyric-Aware & Fuzzy Music Search Engine for AURA Studio
// Combines:
// 1. Neural Lyric Video & Caption Discovery
// 2. Canonical Artist-Track Extraction & Deduplication
// 3. LRCLIB Full-Text Fuzzy/Trigram Lyric Verification + Exact Timestamp Extraction
// 4. Unified Relevance Scoring across Spotify API, iTunes Hi-Res Catalog & YouTube Music

const NOISE_PARENS_REGEX =
  /\((?:[^)]*(?:lyric|lirik|official|video|audio|mv|visualizer|terjemahan|sub\s*indo|karaoke|live|remaster|hd|4k|tiktok|viral|version|versi)[^)]*)\)|\[(?:[^\]]*(?:lyric|lirik|official|video|audio|mv|visualizer|terjemahan|sub\s*indo|karaoke|hd|4k|tiktok|viral)[^\]]*)\]/gi;

const GENERIC_LYRIC_CHANNELS =
  /(lyric|lirik|vibes|clouds|senja|musik|music|hits|indie|chill|ost|soundtrack|karaoke|terjemahan|indo|channel|media|records|entertainment|starhits|aquarius|trinity|sony|universal|warner)/i;

export function normalizeText(str = '') {
  return str
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/\bnggak\b|\bgak\b|\bga\b|\btak\b/g, 'tidak')
    .replace(/\bku\s+/g, 'ku')
    .replace(/\bkau\s+/g, 'kau')
    .replace(/\bdi\s+/g, 'di')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactText(str = '') {
  return normalizeText(str).replace(/\s+/g, '');
}

function getTrigrams(s) {
  const clean = `  ${compactText(s)}  `;
  const set = new Set();
  for (let i = 0; i <= clean.length - 3; i++) {
    set.add(clean.slice(i, i + 3));
  }
  return set;
}

export function trigramSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = getTrigrams(a);
  const setB = getTrigrams(b);
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return (2 * intersection) / (setA.size + setB.size);
}

function wordOverlapScore(query, target) {
  const qWords = normalizeText(query).split(' ').filter((w) => w.length >= 2);
  if (!qWords.length) return 0;
  const tNorm = normalizeText(target);
  const tCompact = compactText(target);
  let matched = 0;
  for (const w of qWords) {
    if (tNorm.includes(w) || (w.length >= 4 && tCompact.includes(w))) {
      matched++;
    }
  }
  return matched / qWords.length;
}

/**
 * Parses messy YouTube Lyric/Music video titles into clean canonical { artist, title, query }
 */
export function extractCanonicalSong(rawVideoTitle = '', channelName = '') {
  let cleaned = rawVideoTitle
    .replace(/#\S+/g, ' ')
    .replace(/\|.*$/g, ' ')
    .replace(NOISE_PARENS_REGEX, ' ')
    .replace(/\b(?:official\s*)?(?:music\s*)?(?:lyric\s*|lirik\s*)?(?:video|audio|lyrics|lirik\s*lagu|lirik|terbaru|terjemahan)\b/gi, ' ')
    .replace(/[""«»„]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '')
    .trim();

  if (!cleaned) return null;

  const dashParts = cleaned.split(/\s+[-–—]\s+/);
  if (dashParts.length >= 2) {
    const left = dashParts[0].trim();
    const right = dashParts.slice(1).join(' ').trim();
    if (left && right) {
      return {
        artist: left,
        title: right,
        canonicalQuery: `${left} ${right}`
      };
    }
  }

  const cleanChannel = (channelName || '').replace(/ - Topic$/i, '').trim();
  if (cleanChannel && !GENERIC_LYRIC_CHANNELS.test(cleanChannel)) {
    return {
      artist: cleanChannel,
      title: cleaned,
      canonicalQuery: `${cleanChannel} ${cleaned}`
    };
  }

  return {
    artist: '',
    title: cleaned,
    canonicalQuery: cleaned
  };
}

/**
 * Searches inside an LRCLIB track's synced/plain lyrics for the best line matching `userQuery`
 * Returns { matched, score, line, time }
 */
export function findBestLyricLineMatch(lrcItem, userQuery) {
  if (!lrcItem || !userQuery) return null;

  const qCompact = compactText(userQuery);
  if (qCompact.length < 4) return null;

  let parsedLines = [];
  if (lrcItem.syncedLyrics) {
    parsedLines = lrcItem.syncedLyrics
      .split(/\r?\n/)
      .map((raw) => {
        const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
        if (!m) return null;
        const secs = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
        const text = m[3].trim();
        return text ? { time: Math.round(secs * 10) / 10, text } : null;
      })
      .filter(Boolean);
  } else if (lrcItem.plainLyrics) {
    parsedLines = lrcItem.plainLyrics
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ time: null, text }));
  }

  if (!parsedLines.length) return null;

  let best = { matched: false, score: 0, line: '', time: null };

  // Pass 1: Evaluate individual lines first for exact line & timestamp accuracy
  for (let i = 0; i < parsedLines.length; i++) {
    const single = parsedLines[i].text;
    const cCompact = compactText(single);
    if (!cCompact) continue;

    let score = 0;
    if (cCompact.includes(qCompact)) {
      score = 0.99;
    } else if (qCompact.includes(cCompact) && cCompact.length >= 10) {
      score = 0.91;
    } else {
      const wScore = wordOverlapScore(userQuery, single);
      const triScore = trigramSimilarity(userQuery, single);
      score = wScore * 0.65 + triScore * 0.35;
    }

    if (score > best.score) {
      best = {
        matched: score >= 0.55,
        score,
        line: single,
        time: parsedLines[i].time
      };
    }
  }

  // Pass 2: Evaluate 2-line windows only if user typed lyrics spanning two consecutive lines
  if (best.score < 0.92) {
    for (let i = 0; i + 1 < parsedLines.length; i++) {
      const combined = `${parsedLines[i].text} / ${parsedLines[i + 1].text}`;
      const cCompact = compactText(combined);
      if (!cCompact) continue;

      let score = 0;
      if (cCompact.includes(qCompact)) {
        score = 0.95;
      } else {
        const wScore = wordOverlapScore(userQuery, combined);
        const triScore = trigramSimilarity(userQuery, combined);
        score = (wScore * 0.65 + triScore * 0.35) * 0.96;
      }

      if (score > best.score) {
        best = {
          matched: score >= 0.58,
          score,
          line: combined,
          time: parsedLines[i].time
        };
      }
    }
  }

  return best.matched ? best : null;
}

/**
 * Fetch LRCLIB record for a candidate song & verify lyric snippet match
 */
export async function verifySongLyricsOnLrclib(canonicalQuery, userQuery) {
  try {
    const res = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(canonicalQuery)}`,
      { headers: { 'User-Agent': 'AuraMusicStudio/2.0' } }
    );
    const items = await res.json();
    if (!Array.isArray(items) || !items.length) return null;

    for (const item of items.slice(0, 4)) {
      const match = findBestLyricLineMatch(item, userQuery);
      if (match) {
        return {
          trackName: item.trackName,
          artistName: item.artistName,
          albumName: item.albumName,
          duration: item.duration,
          lyricMatch: match
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Computes relevance score of a track against user's raw query
 */
export function computeTrackRelevance(track, rawQuery) {
  let score = 0;
  const qNorm = normalizeText(rawQuery);
  const qCompact = compactText(rawQuery);
  const titleNorm = normalizeText(track.title);
  const artistNorm = normalizeText(track.artist);
  const combinedNorm = `${artistNorm} ${titleNorm}`;
  const combinedCompact = compactText(combinedNorm);

  // 1. Verified Lyric Match gets highest priority when user typed lyrics!
  if (track.lyricMatch?.matched) {
    score += 950 + Math.round((track.lyricMatch.score || 0.8) * 200);
  } else if (track.discoveredViaLyricIndex) {
    score += 780 + (track.lyricConsensusCount || 1) * 45;
  }

  // 2. Exact / Substring Title & Artist Matches
  if (titleNorm === qNorm || artistNorm === qNorm) {
    score += 1000;
  } else if (combinedCompact.includes(qCompact) && qCompact.length >= 4) {
    score += 880;
  } else {
    const overlap = wordOverlapScore(rawQuery, combinedNorm);
    const tri = trigramSimilarity(rawQuery, combinedNorm);
    score += Math.round(overlap * 500 + tri * 300);
  }

  return score;
}
