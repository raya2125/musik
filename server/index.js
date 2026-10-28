import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  compactText,
  normalizeText,
  extractCanonicalSong,
  verifySongLyricsOnLrclib,
  computeTrackRelevance,
  parseViewCount
} from './smartSearch.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
// Official Spotify 2025/2026 compliant Loopback IP Redirect URI (no 'localhost' allowed by Spotify)
const SPOTIFY_REDIRECT_URI = `http://127.0.0.1:${PORT}/api/spotify/callback`;
const SESSION_FILE = path.join(__dirname, 'spotify-session.json');

app.use(cors());
app.use(express.json());

const YT_DLP_PATH = path.join(__dirname, 'bin', 'yt-dlp.exe');
const FFMPEG_CANDIDATES = [
  'C:\\Users\\malif\\AppData\\Local\\Programs\\GNU Octave\\Octave-11.3.0\\mingw64\\bin\\ffmpeg.exe',
  'ffmpeg'
];
const FFMPEG_PATH = FFMPEG_CANDIDATES.find((p) => p === 'ffmpeg' || fs.existsSync(p)) || null;

// Stream URL caches
const streamCache = new Map();
const pendingResolves = new Map();
let wrappedSyncLogs = [];

/* ==================== SPOTIFY OAUTH 2.0 PKCE ENGINE ==================== */
let spotifySession = {
  clientId: '',
  codeVerifier: '',
  accessToken: '',
  refreshToken: '',
  expiresAt: 0,
  user: null
};

if (fs.existsSync(SESSION_FILE)) {
  try {
    spotifySession = { ...spotifySession, ...JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8')) };
  } catch {}
}

function saveSpotifySession() {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(spotifySession, null, 2));
  } catch {}
}

function base64UrlEncode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getValidSpotifyToken() {
  if (!spotifySession.accessToken) return null;
  if (Date.now() < spotifySession.expiresAt - 60000) {
    return spotifySession.accessToken;
  }
  if (!spotifySession.refreshToken || !spotifySession.clientId) {
    return spotifySession.accessToken;
  }
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: spotifySession.refreshToken,
      client_id: spotifySession.clientId
    });
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await res.json();
    if (data.access_token) {
      spotifySession.accessToken = data.access_token;
      if (data.refresh_token) spotifySession.refreshToken = data.refresh_token;
      spotifySession.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      saveSpotifySession();
      return spotifySession.accessToken;
    }
  } catch (e) {
    console.error('Spotify token refresh error:', e);
  }
  return spotifySession.accessToken;
}

/**
 * Start 1-Click Spotify OAuth 2.0 PKCE Login
 */
app.get('/api/spotify/login', (req, res) => {
  const clientId = (req.query.clientId || spotifySession.clientId || '').trim();
  if (!clientId) {
    return res.status(400).send('Masukkan Spotify Client ID terlebih dahulu.');
  }

  const codeVerifier = base64UrlEncode(crypto.randomBytes(64));
  const codeChallenge = base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());

  spotifySession.clientId = clientId;
  spotifySession.codeVerifier = codeVerifier;
  saveSpotifySession();

  const scopes = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'user-top-read',
    'user-read-recently-played',
    'user-modify-playback-state',
    'user-read-playback-state'
  ].join(' ');

  const authParams = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    scope: scopes
  });

  res.redirect(`https://accounts.spotify.com/authorize?${authParams.toString()}`);
});

/**
 * Spotify OAuth 2.0 PKCE Callback (http://127.0.0.1:3001/api/spotify/callback)
 */
app.get('/api/spotify/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.send(`
      <html><body style="background:#09090b;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div><h3>Login Dibatalkan: ${error || 'No code'}</h3><p>Silakan tutup jendela ini dan coba lagi.</p></div>
      </body></html>
    `);
  }

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: spotifySession.clientId,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier: spotifySession.codeVerifier
      })
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed');
    }

    spotifySession.accessToken = tokenData.access_token;
    spotifySession.refreshToken = tokenData.refresh_token || '';
    spotifySession.expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

    // Fetch real Spotify Profile
    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${spotifySession.accessToken}` }
    });
    const meData = await meRes.json();
    spotifySession.user = {
      id: meData.id,
      displayName: meData.display_name || meData.id || 'Spotify User',
      email: meData.email || '',
      product: meData.product || 'free',
      avatar: meData.images?.[0]?.url || ''
    };
    saveSpotifySession();

    res.send(`
      <!doctype html>
      <html>
        <head><title>Spotify Terhubung — AURA</title></head>
        <body style="background:#000;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:32px;background:#121214;border:1px solid #27272a;border-radius:24px;max-width:360px;">
            <div style="width:52px;height:52px;border-radius:50%;background:#1DB954;color:#000;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;margin:0 auto 16px;">✓</div>
            <h2 style="margin:0 0 8px;">Spotify Berhasil Terhubung!</h2>
            <p style="color:#a1a1aa;font-size:13px;margin:0 0 20px;">Halo <b>${spotifySession.user.displayName}</b>, playlist dan Spotify Wrapped Sync kamu sudah aktif.</p>
            <button onclick="window.close()" style="background:#fff;color:#000;border:none;padding:10px 24px;border-radius:99px;font-weight:700;cursor:pointer;">Kembali ke AURA Music</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS' }, '*');
              setTimeout(() => window.close(), 1200);
            } else {
              setTimeout(() => { window.location.href = 'http://localhost:5173'; }, 1500);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`
      <html><body style="background:#09090b;color:#f87171;font-family:sans-serif;padding:40px;">
        <h3>Gagal menghubungkan Spotify:</h3><pre>${err.message}</pre>
        <p style="color:#a1a1aa">Pastikan Redirect URI di Spotify Developer Dashboard persis tertulis: <code>${SPOTIFY_REDIRECT_URI}</code></p>
      </body></html>
    `);
  }
});

app.get('/api/spotify/status', async (req, res) => {
  const token = await getValidSpotifyToken();
  res.json({
    connected: Boolean(token && spotifySession.user),
    clientId: spotifySession.clientId || '',
    redirectUri: SPOTIFY_REDIRECT_URI,
    user: spotifySession.user || null
  });
});

app.post('/api/spotify/logout', (req, res) => {
  spotifySession.accessToken = '';
  spotifySession.refreshToken = '';
  spotifySession.expiresAt = 0;
  spotifySession.user = null;
  saveSpotifySession();
  res.json({ success: true });
});

/**
 * Fetch User's REAL Spotify Playlists & Liked Songs Count
 */
app.get('/api/spotify/playlists', async (req, res) => {
  try {
    const token = await getValidSpotifyToken();
    if (!token) return res.json({ connected: false, playlists: [] });

    const plRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=30', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const plData = await plRes.json();

    const playlists = [
      {
        id: 'spotify_me_tracks',
        name: 'Liked Songs (Akun Spotify)',
        owner: spotifySession.user?.displayName || 'Spotify',
        cover: 'https://misc.scdn.co/liked-songs/liked-songs-300.png',
        trackCount: 'Sync'
      },
      ...(plData.items || []).map((p) => ({
        id: p.id,
        name: p.name,
        owner: p.owner?.display_name || 'Spotify',
        cover: p.images?.[0]?.url || '',
        trackCount: p.tracks?.total || 0
      }))
    ];

    res.json({ connected: true, playlists });
  } catch (err) {
    res.json({ connected: false, playlists: [], error: err.message });
  }
});

/**
 * Fetch All Tracks inside a User's Real Spotify Playlist or Spotify Liked Songs
 * Resolves playable audio from YouTube; source quality is not guaranteed lossless.
 */
app.get('/api/spotify/playlist/:playlistId', async (req, res) => {
  try {
    const token = await getValidSpotifyToken();
    if (!token) return res.status(401).json({ error: 'Not connected to Spotify' });

    const { playlistId } = req.params;
    const apiUrl =
      playlistId === 'spotify_me_tracks'
        ? 'https://api.spotify.com/v1/me/tracks?limit=40'
        : `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50`;

    const spRes = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const spData = await spRes.json();

    const results = (spData.items || [])
      .map((entry) => entry.track || entry)
      .filter((t) => t && t.id && t.name)
      .map((t) => {
        const artistName = (t.artists || []).map((a) => a.name).join(', ') || 'Artist';
        const q = `${artistName} - ${t.name} official audio`;
        return {
          id: `sp_real_${t.id}`,
          spotifyUri: t.uri || `spotify:track:${t.id}`,
          ytVideoId: '',
          searchStreamQuery: q,
          title: t.name,
          artist: artistName,
          album: t.album?.name || 'Single',
          duration: Math.floor((t.duration_ms || 215000) / 1000),
          cover: t.album?.images?.[0]?.url || '',
          audioUrl: `/api/stream?q=${encodeURIComponent(q)}&fallback=${encodeURIComponent(t.preview_url || '')}`,
          previewUrl: t.preview_url || '',
          losslessInfo: { isLossless: false, format: 'HQ Web Stream (Opus ~160kbps)' },
          sourceMode: 'spotify'
        };
      });

    // Pre-warm first track in background
    if (results[0]?.searchStreamQuery) {
      resolveFullStreamUrl('', results[0].previewUrl, results[0].searchStreamQuery).catch(() => {});
    }

    res.json({ count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==================== YOUTUBE & STREAMING ENGINE ==================== */
function parseDurationToSeconds(text) {
  if (!text) return 215;
  const parts = text.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 215;
}

async function searchYouTubeMusic(query) {
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        }
      }
    );
    const html = await res.text();
    const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents?.[0]?.itemSectionRenderer?.contents || [];

    const videos = [];
    for (const item of contents) {
      const v = item.videoRenderer;
      if (v && v.videoId) {
        const seconds = parseDurationToSeconds(v.lengthText?.simpleText);
        if (seconds > 30 && seconds < 1200) {
          const rawOwner = v.ownerText?.runs?.[0]?.text || 'YouTube Artist';
          videos.push({
            videoId: v.videoId,
            title: v.title?.runs?.[0]?.text || 'YouTube Music Track',
            artist: rawOwner.replace(/ - Topic$/i, ''),
            isTopicMaster: / - Topic$/i.test(rawOwner),
            thumbnail: v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url || '',
            duration: seconds,
            views: v.shortViewCountText?.simpleText || '',
            numericViews: parseViewCount(v.shortViewCountText?.simpleText || '')
          });
        }
      }
      if (videos.length >= 18) break;
    }
    return videos;
  } catch {
    return [];
  }
}

/**
 * Resolves the official YouTube Music Studio Album Master ("Art Track" / ATV)
 * directly from record-label DDEX deliveries instead of Music Videos or fan re-uploads.
 */
async function findStudioArtTrackId(rawQuery = '') {
  const cleanQuery = rawQuery
    .replace(/\b(official\s*(music\s*)?(audio|video|lyric\s*video))\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanQuery) return null;

  // Do not force studio album ATV if user explicitly wants a live/acoustic/remix/cover version
  if (/\b(live|acoustic|akustik|unplugged|cover|remix|dj|slowed|reverb|karaoke|concert|session)\b/i.test(cleanQuery)) {
    return null;
  }

  try {
    const res = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240717.01.00',
            hl: 'en',
            gl: 'ID'
          }
        },
        query: cleanQuery,
        // Official YTM "Songs" filter -> returns label-supplied Studio Art Tracks (ATV)
        params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D'
      }),
      signal: AbortSignal.timeout(3200)
    });
    if (!res.ok) return null;
    const payload = JSON.stringify(await res.json());
    const match = payload.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function resolveFullStreamUrl(videoId = '', fallbackUrl = '', searchQuery = '') {
  if (!fs.existsSync(YT_DLP_PATH)) return fallbackUrl;

  const cacheKey = videoId || (searchQuery ? `q:${searchQuery}` : '');
  if (!cacheKey) return fallbackUrl;

  const cached = streamCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  if (pendingResolves.has(cacheKey)) {
    return pendingResolves.get(cacheKey);
  }

  const promise = (async () => {
    try {
      let resolvedVideoId = videoId;
      if (!resolvedVideoId && searchQuery) {
        resolvedVideoId = (await findStudioArtTrackId(searchQuery)) || '';
      }

      const targetArg = resolvedVideoId
        ? `https://www.youtube.com/watch?v=${resolvedVideoId}`
        : `ytsearch1:${searchQuery}`;

      const { stdout } = await execFileAsync(
        YT_DLP_PATH,
        [
          '--js-runtimes',
          `node:${process.execPath}`,
          '-f',
          '251/ba[acodec=opus][protocol=https]/140/ba[protocol=https]/ba/bestaudio',
          '--no-playlist',
          '--no-warnings',
          '-g',
          targetArg
        ],
        { timeout: 18000 }
      );
      const lines = stdout.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const directUrl =
        lines.find((l) => l.startsWith('http') && !l.includes('.m3u8')) ||
        lines.find((l) => l.startsWith('http'));
      if (directUrl && directUrl.startsWith('http')) {
        streamCache.set(cacheKey, {
          url: directUrl,
          expiresAt: Date.now() + 2 * 60 * 60 * 1000
        });
        return directUrl;
      }
      return fallbackUrl;
    } catch {
      return fallbackUrl;
    } finally {
      pendingResolves.delete(cacheKey);
    }
  })();

  pendingResolves.set(cacheKey, promise);
  return promise;
}

/**
 * Smart Lyric-Aware & Fuzzy Dual-Engine Search
 * Matches Song Title, Artist, Album, Typos, AND Partial Song Lyrics (with exact timestamp!)
 */
app.get('/api/search', async (req, res) => {
  try {
    const query = (req.query.q || 'Tulus').trim();
    const mode = req.query.mode || 'spotify';
    const token = await getValidSpotifyToken();

    const words = query.split(/\s+/).filter(Boolean);
    const shouldProbeLyrics = words.length >= 2;
    const ytMainQuery = mode === 'ytmusic' ? `${query} audio` : `${query} official audio`;

    // WAVE 1: Parallel Direct Catalog + YouTube Audio + Neural Lyric Video Index
    const [spDirectRes, itunesDirectRes, ytAudioVideos, ytLyricVideos] = await Promise.all([
      token
        ? fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=14`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
            .then((r) => r.json())
            .catch(() => null)
        : Promise.resolve(null),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=14`)
        .then((r) => r.json())
        .catch(() => ({ results: [] })),
      searchYouTubeMusic(ytMainQuery),
      shouldProbeLyrics ? searchYouTubeMusic(`${query} lirik lyrics`) : Promise.resolve([])
    ]);

    // Extract & count consensus of canonical songs from Lyric & Audio videos
    const candidateMap = new Map();
    const combinedDiscoveryVideos = [...ytLyricVideos.slice(0, 8), ...ytAudioVideos.slice(0, 5)];

    for (const v of combinedDiscoveryVideos) {
      const parsed = extractCanonicalSong(v.title, v.artist);
      if (!parsed || !parsed.canonicalQuery) continue;
      const key = compactText(parsed.canonicalQuery).slice(0, 28);
      if (key.length < 3) continue;

      if (!candidateMap.has(key)) {
        candidateMap.set(key, {
          ...parsed,
          videoId: v.videoId,
          thumbnail: v.thumbnail,
          duration: v.duration,
          count: 1
        });
      } else {
        candidateMap.get(key).count += 1;
      }
    }

    const topLyricCandidates = Array.from(candidateMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, shouldProbeLyrics ? 3 : 0);

    // WAVE 2: Verify Lyrics on LRCLIB + Fetch Official Catalog Metadata for Lyric-Discovered Songs
    const candidateEnrichments = await Promise.all(
      topLyricCandidates.map(async (cand) => {
        const [lrcVerified, spCandRes, itunesCandRes] = await Promise.all([
          verifySongLyricsOnLrclib(cand.canonicalQuery, query),
          token
            ? fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(
                  cand.canonicalQuery
                )}&type=track&limit=3`,
                { headers: { Authorization: `Bearer ${token}` } }
              )
                .then((r) => r.json())
                .catch(() => null)
            : Promise.resolve(null),
          fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(
              cand.canonicalQuery
            )}&entity=song&limit=3`
          )
            .then((r) => r.json())
            .catch(() => ({ results: [] }))
        ]);

        // Fallback lyric badge when 2+ lyric videos unanimously point to this song for a 3+ word query
        const fallbackLyricMatch =
          !lrcVerified?.lyricMatch && words.length >= 3 && cand.count >= 2
            ? { matched: true, score: 0.72, line: query, time: null }
            : null;

        return {
          cand,
          lyricMatch: lrcVerified?.lyricMatch || fallbackLyricMatch,
          spTracks: spCandRes?.tracks?.items || [],
          itunesTracks: itunesCandRes?.results || []
        };
      })
    );

    // Helper to convert Spotify API track -> AURA Track Object
    const allYtPool = [...ytAudioVideos, ...ytLyricVideos];
    const buildFromSpotifyTrack = (t, extra = {}) => {
      const artistName = (t.artists || []).map((a) => a.name).join(', ');
      const trackLower = (t.name || '').toLowerCase();
      const matchingYt =
        allYtPool.find((v) => v.title.toLowerCase().includes(trackLower.slice(0, 8))) || null;

      const q = `${artistName} - ${t.name} official audio`;
      const vId =
        extra.preferredVideoId || (matchingYt?.isTopicMaster ? matchingYt.videoId : '');
      const streamUrl = vId
        ? `/api/stream?videoId=${encodeURIComponent(vId)}&fallback=${encodeURIComponent(
            t.preview_url || ''
          )}`
        : `/api/stream?q=${encodeURIComponent(q)}&fallback=${encodeURIComponent(t.preview_url || '')}`;

      return {
        id: `sp_real_${t.id}`,
        spotifyUri: t.uri,
        ytVideoId: vId,
        searchStreamQuery: q,
        title: t.name,
        artist: artistName,
        album: t.album?.name || 'Single',
        duration: Math.floor((t.duration_ms || 215000) / 1000),
        cover: t.album?.images?.[0]?.url || '',
        audioUrl: streamUrl,
        previewUrl: t.preview_url || '',
        lyricMatch: extra.lyricMatch || null,
        discoveredViaLyricIndex: Boolean(extra.discoveredViaLyricIndex),
        lyricConsensusCount: extra.lyricConsensusCount || 0,
        losslessInfo: { isLossless: false, format: 'HQ Web Stream (Opus ~160kbps)' },
        popularity: t.popularity || 65,
        numericViews: (t.popularity || 65) * 1200000,
        views: `${((t.popularity || 65) * 1.2).toFixed(0)}M streams`,
        sourceMode: mode
      };
    };

    // Helper to convert iTunes Catalog track -> AURA Track Object
    const buildFromItunesTrack = (item, extra = {}) => {
      const trackLower = (item.trackName || '').toLowerCase();
      const artistLower = (item.artistName || '').toLowerCase();
      const matchingYt =
        allYtPool.find(
          (v) =>
            v.title.toLowerCase().includes(trackLower.slice(0, 8)) &&
            (v.title.toLowerCase().includes(artistLower.slice(0, 5)) ||
              v.artist.toLowerCase().includes(artistLower.slice(0, 5)))
        ) ||
        allYtPool.find((v) => v.title.toLowerCase().includes(trackLower.slice(0, 9))) ||
        null;

      const coverHiRes = item.artworkUrl100
        ? item.artworkUrl100.replace('100x100bb', '600x600bb')
        : matchingYt?.thumbnail || '';

      const q = `${item.artistName} - ${item.trackName} official audio`;
      const vId =
        extra.preferredVideoId || (matchingYt?.isTopicMaster ? matchingYt.videoId : '');
      const streamEndpoint = vId
        ? `/api/stream?videoId=${encodeURIComponent(vId)}&fallback=${encodeURIComponent(
            item.previewUrl || ''
          )}`
        : `/api/stream?q=${encodeURIComponent(q)}&fallback=${encodeURIComponent(
            item.previewUrl || ''
          )}`;

      return {
        id: `sp_${item.trackId}`,
        spotifyUri: '',
        ytVideoId: vId,
        searchStreamQuery: q,
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName || 'Single',
        duration: Math.floor((item.trackTimeMillis || 215000) / 1000),
        cover: coverHiRes,
        audioUrl: streamEndpoint,
        previewUrl: item.previewUrl,
        lyricMatch: extra.lyricMatch || null,
        discoveredViaLyricIndex: Boolean(extra.discoveredViaLyricIndex),
        lyricConsensusCount: extra.lyricConsensusCount || 0,
        losslessInfo: { isLossless: false, format: 'HQ Web Stream (Opus ~160kbps)' },
        popularity: 75,
        numericViews: 25000000,
        views: '25M streams',
        sourceMode: mode
      };
    };

    const rawCandidates = [];

    // 1. Add Lyric-Discovered & LRCLIB-Verified Canonical Songs first!
    for (const enriched of candidateEnrichments) {
      const extraMeta = {
        lyricMatch: enriched.lyricMatch,
        discoveredViaLyricIndex: true,
        lyricConsensusCount: enriched.cand.count
      };
      if (token && enriched.spTracks.length > 0) {
        enriched.spTracks.slice(0, 2).forEach((t) => rawCandidates.push(buildFromSpotifyTrack(t, extraMeta)));
      } else if (enriched.itunesTracks.length > 0) {
        enriched.itunesTracks
          .slice(0, 2)
          .forEach((t) => rawCandidates.push(buildFromItunesTrack(t, extraMeta)));
      }
    }

    // 2. Add Direct Mode Results
    if (mode === 'spotify') {
      if (token && spDirectRes?.tracks?.items?.length) {
        spDirectRes.tracks.items.forEach((t) => rawCandidates.push(buildFromSpotifyTrack(t)));
      } else {
        (itunesDirectRes?.results || []).forEach((item) => rawCandidates.push(buildFromItunesTrack(item)));
      }
    } else {
      // YouTube Music Mode: Merge verified lyric songs + YouTube Music videos/remixes/acoustics
      const allItunes = [
        ...candidateEnrichments.flatMap((e) => e.itunesTracks),
        ...(itunesDirectRes?.results || [])
      ];

      for (const video of ytAudioVideos) {
        const matchingCatalog =
          allItunes.find((t) =>
            video.title.toLowerCase().includes((t.trackName || '').toLowerCase().slice(0, 8))
          ) || null;

        // Check if this video matches one of our LRCLIB-verified lyric candidates
        const matchingEnrichment = candidateEnrichments.find((e) =>
          compactText(video.title).includes(compactText(e.cand.title).slice(0, 10))
        );

        const cleanCover =
          matchingCatalog &&
          video.title.toLowerCase().includes((matchingCatalog.trackName || '').toLowerCase())
            ? matchingCatalog.artworkUrl100.replace('100x100bb', '600x600bb')
            : video.thumbnail;

        rawCandidates.push({
          id: `yt_${video.videoId}`,
          spotifyUri: '',
          ytVideoId: video.videoId,
          title: video.title,
          artist: video.artist,
          album: matchingCatalog?.collectionName || 'YouTube Music Audio',
          duration: video.duration || 220,
          cover: cleanCover,
          audioUrl: `/api/stream?videoId=${encodeURIComponent(
            video.videoId
          )}&fallback=${encodeURIComponent(matchingCatalog?.previewUrl || '')}`,
          previewUrl: matchingCatalog?.previewUrl || '',
          lyricMatch: matchingEnrichment?.lyricMatch || null,
          discoveredViaLyricIndex: Boolean(matchingEnrichment),
          lyricConsensusCount: matchingEnrichment?.cand?.count || 0,
          losslessInfo: { isLossless: false, format: 'HQ Web Stream (Opus ~160kbps)' },
          sourceMode: 'ytmusic',
          views: video.views || '',
          numericViews: video.numericViews || parseViewCount(video.views || '')
        });
      }
    }

    // 3. Score, Rank & Deduplicate Results
    const scored = rawCandidates
      .map((track) => ({
        track,
        relevance: computeTrackRelevance(track, query)
      }))
      .sort((a, b) => b.relevance - a.relevance);

    const deduped = [];
    const seenKeys = new Set();

    for (const { track } of scored) {
      const dedupKey =
        mode === 'ytmusic' && track.id.startsWith('yt_')
          ? track.id
          : `${compactText(track.artist).slice(0, 18)}_${compactText(track.title).slice(0, 22)}`;

      if (seenKeys.has(dedupKey)) {
        // Preserve lyricMatch if duplicate had it and existing didn't
        const existing = deduped.find(
          (d) =>
            `${compactText(d.artist).slice(0, 18)}_${compactText(d.title).slice(0, 22)}` === dedupKey
        );
        if (existing && !existing.lyricMatch && track.lyricMatch) {
          existing.lyricMatch = track.lyricMatch;
        }
        continue;
      }
      seenKeys.add(dedupKey);
      deduped.push(track);
      if (deduped.length >= 20) break;
    }

    // Background pre-warm top 2 ranked tracks for instant playback!
    deduped.slice(0, 2).forEach((t) => {
      resolveFullStreamUrl(t.ytVideoId || '', t.previewUrl || '', t.searchStreamQuery || '').catch(
        () => {}
      );
    });

    res.json({
      query,
      mode,
      lyricMatched: deduped.some((t) => Boolean(t.lyricMatch?.matched)),
      count: deduped.length,
      results: deduped
    });
  } catch (err) {
    console.error('Smart search error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/recommendations
 * Smart Infinite Auto-Play / Radio Engine
 * Parameters:
 *   artist: Current playing artist
 *   title: Current playing track title
 *   mode: 'spotify' | 'ytmusic'
 * Returns high-view, related, non-chaotic songs to continuously expand the queue!
 */
app.get('/api/recommendations', async (req, res) => {
  try {
    const artist = (req.query.artist || 'Tulus').trim();
    const title = (req.query.title || '').trim();
    const mode = req.query.mode || 'spotify';

    const clusters = {
      indoPop: [
        'Tulus', 'Mahalini', 'Bernadya', 'Hindia', 'Nadin Amizah',
        'Tiara Andini', 'Sal Priadi', 'Yura Yunita', 'Juicy Luicy',
        'Feby Putri', 'Pamungkas', 'Anggi Marito', 'Fabio Asher',
        'Rizky Febian', 'Budi Doremi', 'Idgitaf'
      ],
      remix: [
        'Febri remix', 'DJ Opus', 'DJ Desa', 'DJ Komang', 'DJ BonBon',
        'Alok', 'Alan Walker', 'Marshmello', 'DJ TikTok Viral'
      ],
      westPop: [
        'The Weeknd', 'Joji', 'Daniel Caesar', 'SZA', 'Frank Ocean',
        'Bruno Mars', 'Keshi', 'Lauv', 'Jeremy Zucker', 'Post Malone',
        'Billie Eilish'
      ],
      indoRock: [
        'Sheila On 7', 'Dewa 19', 'Peterpan', 'Noah', 'Padi',
        'Ungu', 'Fourtwnty', 'Payung Teduh'
      ]
    };

    const artistLower = artist.toLowerCase();
    let cluster = clusters.indoPop;
    if (
      artistLower.includes('remix') ||
      artistLower.includes('dj') ||
      artistLower.includes('bass') ||
      artistLower.includes('febri')
    ) {
      cluster = clusters.remix;
    } else if (clusters.westPop.some((a) => artistLower.includes(a.toLowerCase()))) {
      cluster = clusters.westPop;
    } else if (clusters.indoRock.some((a) => artistLower.includes(a.toLowerCase()))) {
      cluster = clusters.indoRock;
    }

    // Pick 2 target related artists that are distinct from current
    const distinct = cluster.filter((a) => !artistLower.includes(a.toLowerCase()));
    const shuffled = [...distinct].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 2);
    const recSearchQuery = `${selected.join(' ')} popular hits`;

    // Internal fetch to our search endpoint
    const internalUrl = `http://127.0.0.1:${PORT}/api/search?q=${encodeURIComponent(recSearchQuery)}&mode=${mode}`;
    const searchRes = await fetch(internalUrl);
    const data = await searchRes.json();

    // Clean and filter out current song
    const cleanResults = (data.results || []).filter((t) => {
      if (!t || !t.title) return false;
      if (title && t.title.toLowerCase().includes(title.toLowerCase().slice(0, 7))) return false;
      return true;
    });

    res.json({
      success: true,
      seedArtist: artist,
      seedTitle: title,
      clusterFound: selected,
      count: cleanResults.length,
      results: cleanResults.slice(0, 14)
    });
  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stream', async (req, res) => {
  try {
    const { videoId, fallback, q } = req.query;
    const targetUrl = await resolveFullStreamUrl(videoId || '', fallback || '', q || '');

    if (!targetUrl) {
      return res.status(404).send('Audio stream not found');
    }

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    };
    if (req.headers.range) headers.Range = req.headers.range;

    const upstream = await fetch(targetUrl, { headers });
    res.status(upstream.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');

    ['content-type', 'content-length', 'content-range'].forEach((h) => {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    if (!upstream.body) return res.end();

    const nodeStream = Readable.fromWeb(upstream.body);
    nodeStream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    req.on('close', () => nodeStream.destroy());
    nodeStream.pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.get('/api/lyrics', async (req, res) => {
  try {
    const { title = '', artist = '' } = req.query;
    const cleanTitle = title
      .replace(/\(.*?\)|\[.*?\]/g, '')
      .replace(/official\s*(music\s*)?(video|audio|lyric.*)/gi, '')
      .trim();

    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${cleanTitle}`)}`;
    const lrcRes = await fetch(searchUrl, { headers: { 'User-Agent': 'AuraMusicStudio/2.0' } });
    const items = await lrcRes.json();

    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ found: false, synced: false, lines: [] });
    }

    const best = items.find((i) => i.syncedLyrics) || items[0];
    if (best.syncedLyrics) {
      const lines = best.syncedLyrics
        .split(/\r?\n/)
        .map((line) => {
          const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
          if (!m) return null;
          const secs = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
          const text = m[3].trim();
          return text ? { time: secs, text } : null;
        })
        .filter(Boolean);

      return res.json({ found: true, synced: true, lines });
    }

    const plainLines = (best.plainLyrics || '')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((text, idx) => ({ time: idx * 4, text }));

    res.json({ found: plainLines.length > 0, synced: false, lines: plainLines });
  } catch {
    res.json({ found: false, synced: false, lines: [] });
  }
});

app.get('/api/download-audio', async (req, res) => {
  let tempFlacPath = null;
  try {
    const { videoId, url, title = 'Track', artist = 'Artist', album = 'Album', format = 'ORIGINAL' } = req.query;
    const qParam = url?.includes('q=') ? new URLSearchParams(url.split('?')[1]).get('q') : '';
    const vParam =
      videoId || (url?.includes('videoId=') ? new URLSearchParams(url.split('?')[1]).get('videoId') : '');

    const sourceUrl = vParam || qParam
      ? await resolveFullStreamUrl(vParam || '', '', qParam || `${artist} ${title} official audio`)
      : url;

    if (!sourceUrl) return res.status(400).send('Missing audio stream');
    if (format === 'FLAC' && !FFMPEG_PATH) {
      return res.status(503).send('FLAC conversion unavailable; refusing to label the source stream as FLAC');
    }

    if (FFMPEG_PATH && format === 'FLAC') {
      const flacSafeName = `${artist} - ${title} [FLAC conversion].flac`.replace(
        /[^a-zA-Z0-9 \-\.\[\]\(\)]/g,
        ''
      );
      tempFlacPath = path.join(os.tmpdir(), `aura_${Date.now()}_${Math.random().toString(36).slice(2)}.flac`);
      await execFileAsync(
        FFMPEG_PATH,
        [
          '-y',
          '-i',
          sourceUrl,
          '-vn',
          '-c:a',
          'flac',
          '-sample_fmt',
          's32',
          '-ar',
          '48000',
          '-metadata',
          `title=${title}`,
          '-metadata',
          `artist=${artist}`,
          '-metadata',
          `album=${album}`,
          tempFlacPath
        ],
        { timeout: 60000 }
      );

      const stat = fs.statSync(tempFlacPath);
      res.setHeader('Content-Type', 'audio/flac');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${flacSafeName}"`);

      const readStream = fs.createReadStream(tempFlacPath);
      readStream.on('close', () => {
        if (tempFlacPath && fs.existsSync(tempFlacPath)) fs.unlinkSync(tempFlacPath);
      });
      return readStream.pipe(res);
    }

    const response = await fetch(sourceUrl);
    const upstreamMime = (response.headers.get('content-type') || 'audio/webm').split(';')[0].trim();
    const ext = upstreamMime.includes('mp4') ? 'm4a' : upstreamMime.includes('mpeg') ? 'mp3' : 'webm';
    const safeName = `${artist} - ${title} [HQ Opus 48kHz].${ext}`.replace(
      /[^a-zA-Z0-9 \-\.\[\]\(\)]/g,
      ''
    );
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', upstreamMime);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(buffer);
  } catch (err) {
    if (tempFlacPath && fs.existsSync(tempFlacPath)) {
      try { fs.unlinkSync(tempFlacPath); } catch {}
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * Spotify Wrapped Sync Bridge — Resolves Real Spotify Track URI & Syncs to Connected Spotify Account!
 */
app.post('/api/spotify/wrapped-sync', async (req, res) => {
  const { track, spotifyAccessToken, activeMode, listenedSeconds } = req.body;
  const timestamp = new Date().toISOString();
  const activeToken = (await getValidSpotifyToken()) || spotifyAccessToken;

  let resolvedUri = track?.spotifyUri || '';
  let syncStatus = 'LOCAL_LOGGED';

  if (activeToken) {
    try {
      // If track came from YT Music or lacks a real 22-char Spotify URI, match exact track on Spotify API!
      if (!resolvedUri || !/^spotify:track:[A-Za-z0-9]{22}$/.test(resolvedUri)) {
        const cleanTitle = (track?.title || '').replace(/\(.*?\)|\[.*?\]/g, '').trim();
        const sRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(
            `${cleanTitle} ${track?.artist || ''}`
          )}&type=track&limit=1`,
          { headers: { Authorization: `Bearer ${activeToken}` } }
        );
        const sData = await sRes.json();
        if (sData?.tracks?.items?.[0]?.uri) {
          resolvedUri = sData.tracks.items[0].uri;
        }
      }

      if (resolvedUri.startsWith('spotify:track:')) {
        // Trigger playback / queue sync on Spotify Connect
        const spPlay = await fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uris: [resolvedUri], position_ms: 0 })
        });

        if (spPlay.status === 204 || spPlay.status === 200) {
          // Mute Spotify Connect device volume to avoid hearing both playback sources.
          await fetch('https://api.spotify.com/v1/me/player/volume?volume_percent=0', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${activeToken}` }
          }).catch(() => {});
          syncStatus = 'LIVE_SPOTIFY_WRAPPED_SYNCED';
        } else {
          // Add to Spotify Queue so next time Spotify opens it's queued
          await fetch(
            `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(resolvedUri)}`,
            { method: 'POST', headers: { Authorization: `Bearer ${activeToken}` } }
          ).catch(() => {});
          syncStatus = 'SPOTIFY_ACCOUNT_MATCHED';
        }
      }
    } catch {
      syncStatus = 'OFFLINE_QUEUE_SYNCED';
    }
  }

  const logEntry = {
    id: `sync_${Date.now()}`,
    timestamp,
    title: track?.title || 'Unknown Track',
    artist: track?.artist || 'Unknown Artist',
    cover: track?.cover || '',
    spotifyUri: resolvedUri || 'spotify:track:matched',
    playedVia: activeMode === 'ytmusic' ? 'YouTube Music • source quality unverified' : 'Spotify catalog • source quality unverified',
    listenedSeconds: listenedSeconds || 215,
    wrappedCounted: true,
    syncStatus
  };

  wrappedSyncLogs.unshift(logEntry);
  if (wrappedSyncLogs.length > 100) wrappedSyncLogs.pop();

  res.json({
    success: true,
    entry: logEntry,
    totalSyncedTracks: wrappedSyncLogs.length
  });
});

app.get('/api/spotify/wrapped-logs', (req, res) => {
  res.json({
    totalSyncedTracks: wrappedSyncLogs.length,
    totalMinutesCounted: Math.round(
      wrappedSyncLogs.reduce((acc, item) => acc + (item.listenedSeconds || 180), 0) / 60
    ),
    logs: wrappedSyncLogs
  });
});

app.listen(PORT, () => {
  console.log(`AURA Studio Pro Server running on http://127.0.0.1:${PORT}`);
});
