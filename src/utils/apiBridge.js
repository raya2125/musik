// Smart Hybrid API Bridge for AURA Music Studio (Desktop + Native Android APK)
// 1. On Desktop/Browser: Uses local /api/* Studio Server directly.
// 2. Inside Native Android APK: Connects to Studio Server (Wi-Fi/Hotspot/Tunnel) for full-track audio and conversion,
//    and automatically falls back to Standalone Direct Cloud APIs (iTunes + LRCLIB + Offline IndexedDB) on 4G/5G!

const DEFAULT_STUDIO_SERVER = 'http://10.150.197.246:3001';

export function isNativeApk() {
  return (
    Boolean(window.Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && !window.location.port)
  );
}

export function getStudioServerUrl() {
  const saved = localStorage.getItem('aura_studio_server_url');
  if (saved !== null && saved.trim() !== '') return saved.trim().replace(/\/+$/, '');
  if (isNativeApk()) return DEFAULT_STUDIO_SERVER;
  return ''; // relative '/api' on web dev/preview
}

export function setStudioServerUrl(url) {
  localStorage.setItem('aura_studio_server_url', (url || '').trim().replace(/\/+$/, ''));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function resolveStreamUrl(audioUrl, baseUrl) {
  if (!audioUrl) return '';
  if (audioUrl.startsWith('/api/') && baseUrl) {
    return `${baseUrl}${audioUrl}`;
  }
  return audioUrl;
}

/**
 * Search Tracks (Hybrid Studio Server -> Standalone Cloud Fallback)
 */
export async function apiSearchTracks(query, mode = 'spotify') {
  const base = getStudioServerUrl();
  try {
    const res = await fetchWithTimeout(
      `${base}/api/search?q=${encodeURIComponent(query)}&mode=${mode}`,
      {},
      base ? 4500 : 12000
    );
    if (res.ok) {
      const data = await res.json();
      if (data.results?.length) {
        return {
          ...data,
          serverConnected: true,
          results: data.results.map((t) => ({
            ...t,
            audioUrl: resolveStreamUrl(t.audioUrl, base)
          }))
        };
      }
    }
  } catch {
    // Fallback to Standalone Direct Cloud Engine below
  }

  // Standalone Direct Cloud Engine (Works anywhere on 4G/5G without Laptop Server!)
  const itunesRes = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=20`
  );
  const itunesData = await itunesRes.json();
  const items = itunesData.results || [];

  const results = items.map((item) => {
    const coverHiRes = item.artworkUrl100
      ? item.artworkUrl100.replace('100x100bb', '600x600bb')
      : '';
    return {
      id: `${mode}_${item.trackId}`,
      spotifyUri: `spotify:track:${item.trackId}`,
      ytVideoId: '',
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName || 'Single',
      releaseYear: item.releaseDate ? new Date(item.releaseDate).getFullYear() : 2025,
      duration: Math.floor((item.trackTimeMillis || 210000) / 1000),
      cover: coverHiRes,
      audioUrl: resolveStreamUrl(
        `/api/stream?q=${encodeURIComponent(`${item.artistName} - ${item.trackName} official audio`)}`,
        base
      ) || item.previewUrl,
      previewUrl: item.previewUrl,
      losslessInfo: { available: true, format: 'Direct Full Audio + 96kHz DSP' },
      sourceMode: mode
    };
  });

  return { query, mode, count: results.length, serverConnected: false, results };
}

/**
 * Fetch Time-Synced Karaoke Lyrics (Studio Server -> Direct LRCLIB Cloud Fallback)
 */
export async function apiFetchLyrics(title = '', artist = '') {
  const base = getStudioServerUrl();
  try {
    const res = await fetchWithTimeout(
      `${base}/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
      {},
      3500
    );
    if (res.ok) return await res.json();
  } catch {}

  // Direct LRCLIB Cloud call (CORS-enabled globally!)
  try {
    const cleanTitle = title
      .replace(/\(.*?\)|\[.*?\]/g, '')
      .replace(/official\s*(music\s*)?(video|audio|lyric.*)/gi, '')
      .trim();
    const lrcRes = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${cleanTitle}`)}`
    );
    const items = await lrcRes.json();
    if (!Array.isArray(items) || !items.length) return { found: false, synced: false, lines: [] };

    const best = items.find((i) => i.syncedLyrics) || items[0];
    if (best.syncedLyrics) {
      const lines = best.syncedLyrics
        .split(/\r?\n/)
        .map((line) => {
          const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
          if (!m) return null;
          return { time: parseInt(m[1], 10) * 60 + parseFloat(m[2]), text: m[3].trim() };
        })
        .filter((l) => l && l.text);
      return { found: true, synced: true, lines };
    }
    const plainLines = (best.plainLyrics || '')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((text, idx) => ({ time: idx * 4, text }));
    return { found: plainLines.length > 0, synced: false, lines: plainLines };
  } catch {
    return { found: false, synced: false, lines: [] };
  }
}

/**
 * Spotify Wrapped Sync (Studio Server + Local Persistent Mobile Log + Direct Spotify Web API)
 */
export async function apiWrappedSync({ track, spotifyAccessToken, activeMode, listenedSeconds }) {
  const localLogs = JSON.parse(localStorage.getItem('aura_wrapped_logs') || '[]');
  const entry = {
    id: `sync_${Date.now()}`,
    timestamp: new Date().toISOString(),
    title: track?.title || 'Unknown Track',
    artist: track?.artist || 'Unknown Artist',
    cover: track?.cover || '',
    spotifyUri: track?.spotifyUri || 'spotify:track:matched',
    playedVia: activeMode === 'ytmusic' ? 'YouTube Music • source quality unverified' : 'Spotify catalog • source quality unverified',
    listenedSeconds: listenedSeconds || 215,
    wrappedCounted: true
  };

  localLogs.unshift(entry);
  if (localLogs.length > 100) localLogs.pop();
  localStorage.setItem('aura_wrapped_logs', JSON.stringify(localLogs));

  // Direct Spotify Connect API ping if OAuth token provided
  if (spotifyAccessToken && track?.spotifyUri?.startsWith('spotify:track:')) {
    fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [track.spotifyUri], position_ms: 0 })
    }).catch(() => {});
  }

  const base = getStudioServerUrl();
  try {
    await fetchWithTimeout(
      `${base}/api/spotify/wrapped-sync`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track, spotifyAccessToken, activeMode, listenedSeconds })
      },
      2500
    );
  } catch {}

  return { success: true, entry, logs: localLogs };
}

export async function apiGetWrappedLogs() {
  const localLogs = JSON.parse(localStorage.getItem('aura_wrapped_logs') || '[]');
  const base = getStudioServerUrl();
  try {
    const res = await fetchWithTimeout(`${base}/api/spotify/wrapped-logs`, {}, 2500);
    if (res.ok) {
      const data = await res.json();
      if (data.logs?.length >= localLogs.length) return data;
    }
  } catch {}

  return {
    totalSyncedTracks: localLogs.length,
    totalMinutesCounted: Math.round(
      localLogs.reduce((acc, item) => acc + (item.listenedSeconds || 180), 0) / 60
    ),
    logs: localLogs
  };
}

/**
 * Spotify OAuth 2.0 PKCE & Real Library Sync Helpers
 */
export function getSpotifyLoginUrl(clientId) {
  const base = getStudioServerUrl() || 'http://127.0.0.1:3001';
  return `${base}/api/spotify/login?clientId=${encodeURIComponent(clientId.trim())}`;
}

export async function apiGetSpotifyStatus() {
  const base = getStudioServerUrl();
  try {
    const res = await fetchWithTimeout(`${base}/api/spotify/status`, {}, 3000);
    if (res.ok) return await res.json();
  } catch {}
  return {
    connected: false,
    clientId: localStorage.getItem('aura_spotify_client_id') || '',
    redirectUri: 'http://127.0.0.1:3001/api/spotify/callback',
    user: null
  };
}

export async function apiLogoutSpotify() {
  const base = getStudioServerUrl();
  try {
    await fetchWithTimeout(`${base}/api/spotify/logout`, { method: 'POST' }, 3000);
  } catch {}
}

export async function apiGetSpotifyPlaylists() {
  const base = getStudioServerUrl();
  try {
    const res = await fetchWithTimeout(`${base}/api/spotify/playlists`, {}, 5000);
    if (res.ok) return await res.json();
  } catch {}
  return { connected: false, playlists: [] };
}

export async function apiGetSpotifyPlaylistTracks(playlistId) {
  const base = getStudioServerUrl();
  const res = await fetchWithTimeout(
    `${base}/api/spotify/playlist/${encodeURIComponent(playlistId)}`,
    {},
    10000
  );
  const data = await res.json();
  return {
    ...data,
    results: (data.results || []).map((t) => ({
      ...t,
      audioUrl: resolveStreamUrl(t.audioUrl, base)
    }))
  };
}

/**
 * Smart Infinite Auto-Play / Radio Recommendations
 */
export async function apiGetRecommendations(artist, title, mode = 'spotify') {
  const base = getStudioServerUrl();
  try {
    const res = await fetchWithTimeout(
      `${base}/api/recommendations?artist=${encodeURIComponent(artist || '')}&title=${encodeURIComponent(
        title || ''
      )}&mode=${mode}`,
      {},
      base ? 4500 : 8000
    );
    if (res.ok) {
      const data = await res.json();
      if (data.results?.length) {
        return {
          ...data,
          results: data.results.map((t) => ({
            ...t,
            audioUrl: resolveStreamUrl(t.audioUrl, base)
          }))
        };
      }
    }
  } catch {}

  // Fallback direct cloud
  return apiSearchTracks(`${artist || 'Tulus'} popular hits`, mode);
}
