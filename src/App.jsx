import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, Search, Download, Check,
  Sliders, Smartphone, Activity, Volume2, VolumeX, Trash2,
  Heart, Shuffle, Repeat, Mic2, ListMusic, Maximize2, Minimize2,
  ChevronLeft, Library, Sparkles, WifiOff, Disc3, Loader2, X,
  CheckCircle2, Radio, ShieldCheck, ArrowDownToLine, Info,
  ArrowLeft, User, Plus, Folder, Flame, Tv, Bell
} from 'lucide-react';
import { dspEngine } from './utils/losslessAudioEngine';
import { saveTrackOffline, getAllOfflineTracks, deleteOfflineTrack } from './utils/offlineStorage';
import {
  apiSearchTracks,
  apiFetchLyrics,
  apiWrappedSync,
  apiGetWrappedLogs,
  getStudioServerUrl,
  setStudioServerUrl,
  isNativeApk,
  apiGetSpotifyStatus,
  apiLogoutSpotify,
  apiGetSpotifyPlaylists,
  apiGetSpotifyPlaylistTracks,
  apiGetRecommendations,
  getSpotifyLoginUrl,
  apiPrewarmTracks,
  resolveFastStreamSrc
} from './utils/apiBridge';

/* --- Authentic Minimalist Brand & Audio Vector Icons --- */
const SpotifyIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.434-5.305-1.76-8.786-.963-.335.077-.67-.133-.746-.469-.077-.336.132-.67.469-.746 3.809-.87 7.076-.496 9.713 1.115.293.18.386.563.207.856zm1.224-2.723c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.517-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.234 1.328.366.226.48.707.256 1.071zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.493.15-1.016-.128-1.166-.62-.149-.493.129-1.016.621-1.166 3.532-1.073 9.404-.865 13.115 1.338.445.264.59.837.327 1.282-.264.444-.838.59-1.279.322z" />
  </svg>
);

const YTMusicIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-7.5c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm-1 1.5l2.5 1.5-2.5 1.5v-3z" />
  </svg>
);

const LosslessIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
    <path d="M2 8c2-5 4-5 6 0s4 5 6 0 4-5 6 0" />
    <path d="M2 8c2 5 4 5 6 0s4-5 6 0 4 5 6 0" strokeOpacity="0.45" />
  </svg>
);

const PlayingBars = ({ colorClass = 'bg-emerald-400' }) => (
  <div className="flex items-end gap-[2px] h-3.5 w-3.5 justify-center">
    <span className={`w-[3px] rounded-full animate-eq-1 ${colorClass}`} />
    <span className={`w-[3px] rounded-full animate-eq-2 ${colorClass}`} />
    <span className={`w-[3px] rounded-full animate-eq-3 ${colorClass}`} />
  </div>
);

const CURATED_MIXES = [
  {
    id: 'mix_indo',
    title: 'Nusantara Mix',
    subtitle: 'Tulus, Mahalini, Bernadya, Hindia',
    query: 'Mahalini Tulus Bernadya',
    mode: 'spotify',
    gradient: 'from-emerald-600 to-teal-900',
    cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'mix_midnight',
    title: 'Midnight Studio R&B',
    subtitle: 'The Weeknd, Joji, SZA, Daniel Caesar',
    query: 'The Weeknd Joji',
    mode: 'spotify',
    gradient: 'from-indigo-600 to-slate-900',
    cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'mix_yt_live',
    title: 'YT Music Live & Acoustic',
    subtitle: 'Unplugged, Live Sessions & Exclusive Covers',
    query: 'Tulus Hindia live acoustic session',
    mode: 'ytmusic',
    gradient: 'from-rose-600 to-red-950',
    cover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&q=80'
  },
  {
    id: 'mix_classics',
    title: 'Timeless Remastered',
    subtitle: 'Coldplay, Sheila On 7, Dewa 19, Oasis',
    query: 'Sheila On 7 Coldplay',
    mode: 'spotify',
    gradient: 'from-amber-600 to-stone-900',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80'
  }
];

const EQ_PRESETS = {
  'Studio Reference': [2.5, 1.2, 0.0, 1.8, 3.2],
  'Harman Target': [3.5, 1.5, -0.5, 2.0, 2.5],
  'Deep Sub Bass': [5.0, 3.0, 0.0, 1.0, 1.5],
  'Vocal Crystal': [-0.5, 0.5, 2.5, 3.5, 2.0],
  'Flat Studio': [0.0, 0.0, 0.0, 0.0, 0.0]
};

function formatTime(secs) {
  if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function App() {
  // Theme State: 'pixel' (Spotify-TUI Retro Terminal) vs 'studio' (Modern Glassmorphism)
  const [uiTheme, setUiTheme] = useState(() => localStorage.getItem('aura_ui_theme') || 'pixel');
  const [pixelCategory, setPixelCategory] = useState('all'); // 'all' | 'music' | 'podcasts'

  // Creator & Artist State
  const [activeArtist, setActiveArtist] = useState(null);
  const [followedArtists, setFollowedArtists] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('aura_followed_artists') || '["Febri remix", "Tulus", "Mahalini"]');
    } catch {
      return ["Febri remix", "Tulus", "Mahalini"];
    }
  });

  const toggleFollowArtist = (artistName) => {
    if (!artistName) return;
    setFollowedArtists((prev) => {
      const next = prev.includes(artistName)
        ? prev.filter((a) => a !== artistName)
        : [...prev, artistName];
      localStorage.setItem('aura_followed_artists', JSON.stringify(next));
      return next;
    });
  };

  const isFollowed = (artistName) => followedArtists.includes(artistName);

  const openArtistView = (artistName) => {
    if (!artistName) return;
    const clean = artistName.split('&')[0].split(',')[0].split('feat')[0].trim();
    const target = clean || artistName.trim();
    setActiveArtist(target);
    setActiveView('artist');
    fetchTracks(target, sourceMode, `Koleksi Artis: ${target}`, true);
  };

  const getArtistDetails = (name) => {
    const artistName = name || 'Artis';
    let hash = 0;
    for (let i = 0; i < artistName.length; i++) {
      hash = (hash << 5) - hash + artistName.charCodeAt(i);
      hash |= 0;
    }
    const listeners = Math.abs(hash % 3800000) + 1200000;
    const rank = (Math.abs(hash) % 45) + 1;
    return {
      name: artistName,
      listeners: listeners.toLocaleString('id-ID'),
      rank,
      bio: `${artistName} adalah salah satu kreator & produser musik paling aktif di Spotify dan YouTube Music.`,
      genres: ['Indie Pop', 'Acoustic / Remix', 'Pop Nusantara'],
      cities: [
        { city: 'Jakarta, ID', count: `${Math.round(listeners * 0.35).toLocaleString('id-ID')} pendengar` },
        { city: 'Surabaya, ID', count: `${Math.round(listeners * 0.22).toLocaleString('id-ID')} pendengar` },
        { city: 'Bandung, ID', count: `${Math.round(listeners * 0.18).toLocaleString('id-ID')} pendengar` },
        { city: 'Medan, ID', count: `${Math.round(listeners * 0.12).toLocaleString('id-ID')} pendengar` }
      ]
    };
  };

  // Core Engine State
  const [sourceMode, setSourceMode] = useState('spotify'); // 'spotify' | 'ytmusic'
  const [activeView, setActiveView] = useState('discover'); // 'discover' | 'liked' | 'offline' | 'wrapped' | 'artist'
  const [rightTab, setRightTab] = useState('playing'); // 'playing' | 'lyrics' | 'eq'
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [isFullscreenPlayer, setIsFullscreenPlayer] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState('all');

  // Catalog & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFeedTitle, setActiveFeedTitle] = useState('Rekomendasi Utama');
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Playback State
  const [currentTrack, setCurrentTrack] = useState({
    id: 'track_febri_tante',
    title: 'Tante Culik Aku Dong (Remix)',
    artist: 'Febri remix',
    album: 'Tante Culik Aku Dong Remix - Single',
    duration: 335,
    cover: '/febri-dove.png',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=electronic-future-beats-117997.mp3'
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(36);
  const [duration, setDuration] = useState(335);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isAutoRadio, setIsAutoRadio] = useState(true); // Infinite Music Flow: auto-fetch new popular hits when queue ends
  const [isExtendingQueue, setIsExtendingQueue] = useState(false);

  // Lossless & EQ State
  const [isEqEnabled, setIsEqEnabled] = useState(true);
  const [activePreset, setActivePreset] = useState('Studio Reference');
  const [eqGains, setEqGains] = useState(EQ_PRESETS['Studio Reference']);
  const [spectrumBars, setSpectrumBars] = useState(new Array(28).fill(10));

  // Live Lyrics State
  const [lyricsData, setLyricsData] = useState({ loading: false, found: false, synced: false, lines: [] });
  const activeLyricRef = useRef(null);

  // Liked Songs & Offline Storage
  const [likedTracks, setLikedTracks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('aura_liked_tracks') || '[]');
    } catch {
      return [];
    }
  });
  const [offlineTracks, setOfflineTracks] = useState([]);
  const [downloadingIds, setDownloadingIds] = useState({});

  // Spotify Wrapped Sync Bridge & Official OAuth Account State
  const [wrappedSyncEnabled, setWrappedSyncEnabled] = useState(true);
  const [spotifyAccount, setSpotifyAccount] = useState({
    connected: false,
    user: null,
    redirectUri: 'http://127.0.0.1:3001/api/spotify/callback'
  });
  const [spotifyClientId, setSpotifyClientId] = useState(
    localStorage.getItem('aura_spotify_client_id') || ''
  );
  const [userSpotifyPlaylists, setUserSpotifyPlaylists] = useState([]);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [spotifyUsername, setSpotifyUsername] = useState(
    localStorage.getItem('aura_spotify_user') || 'Spotify Listener'
  );
  const [spotifyToken, setSpotifyToken] = useState(localStorage.getItem('aura_spotify_token') || '');
  const [wrappedLogs, setWrappedLogs] = useState([]);
  const [totalWrappedMinutes, setTotalWrappedMinutes] = useState(248);
  const [syncToast, setSyncToast] = useState(null);

  // PWA Install Prompt & Server URL Config
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [serverUrlInput, setServerUrlInput] = useState(() => getStudioServerUrl());

  const deckARef = useRef(null);
  const deckBRef = useRef(null);
  const audioRef = useRef(null);
  const standbyDeckRef = useRef(null);
  const standbyTrackIdRef = useRef(null);
  const playRequestIdRef = useRef(0);
  const activeBlobUrlRef = useRef(null);
  const hoverPreloadTimerRef = useRef(null);
  const losslessFileRef = useRef(null);
  const animFrameRef = useRef(null);

  const importLosslessFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    let verifiedLossless = false;
    if (extension === 'flac') {
      const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      verifiedLossless = String.fromCharCode(...header) === 'fLaC';
    } else if (extension === 'wav') {
      const header = new DataView(await file.slice(0, 1024 * 1024).arrayBuffer());
      if (header.byteLength >= 28 && header.getUint32(0, false) === 0x52494646 && header.getUint32(8, false) === 0x57415645) {
        for (let offset = 12; offset + 16 <= header.byteLength;) {
          const chunkId = header.getUint32(offset, false);
          const chunkSize = header.getUint32(offset + 4, true);
          if (chunkId === 0x666d7420) {
            const codec = header.getUint16(offset + 8, true);
            verifiedLossless = codec === 1 || codec === 3;
            break;
          }
          if (!chunkSize) break;
          offset += 8 + chunkSize + (chunkSize % 2);
        }
      }
    }
    if (!verifiedLossless) {
      window.alert('File ini bukan FLAC yang valid atau WAV PCM. Coba file lossless lain.');
      return;
    }
    const title = file.name.replace(/\.[^.]+$/, '');
    const track = {
      id: `local_${Date.now()}`,
      title,
      artist: 'File lokal',
      album: 'Koleksi lokal',
      duration: 0,
      cover: '/icon.svg',
      audioBlob: file,
      localFileName: file.name,
      localFormat: extension.toUpperCase(),
      isLocalLossless: true,
      audioUrl: ''
    };
    setTracks((previous) => [track, ...previous.filter((item) => !item.isLocalLossless)]);
    setActiveFeedTitle('File Lossless Lokal');
    setActiveView('discover');
    await playTrack(track);
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 19) return 'Selamat Sore';
    return 'Selamat Malam';
  }, []);

  const refreshSpotifyConnection = async () => {
    const status = await apiGetSpotifyStatus();
    setSpotifyAccount(status);
    if (status.clientId && !spotifyClientId) {
      setSpotifyClientId(status.clientId);
      localStorage.setItem('aura_spotify_client_id', status.clientId);
    }
    if (status.connected) {
      const pl = await apiGetSpotifyPlaylists();
      if (pl.playlists) setUserSpotifyPlaylists(pl.playlists);
    } else {
      setUserSpotifyPlaylists([]);
    }
  };

  const openSpotifyPlaylist = async (pl) => {
    setIsLoading(true);
    setSourceMode('spotify');
    setActiveView('discover');
    setActiveFeedTitle(pl.name);
    try {
      const data = await apiGetSpotifyPlaylistTracks(pl.id);
      if (data.results?.length) setTracks(data.results);
    } catch (e) {
      console.error('Playlist load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpotifyOAuthLogin = () => {
    if (!spotifyClientId.trim()) {
      alert('Masukkan Client ID dari Spotify Developer Dashboard terlebih dahulu!');
      return;
    }
    localStorage.setItem('aura_spotify_client_id', spotifyClientId.trim());
    const loginUrl = getSpotifyLoginUrl(spotifyClientId.trim());
    window.open(loginUrl, 'SpotifyLoginPopup', 'width=520,height=720');
  };

  useEffect(() => {
    fetchTracks('Mahalini Tulus Bernadya Hindia', 'spotify', 'Rekomendasi Utama Terpopuler');
    loadOfflineLibrary();
    fetchWrappedLogs();
    refreshSpotifyConnection();

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const msgHandler = (e) => {
      if (e.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
        refreshSpotifyConnection();
        setSyncToast('Akun Spotify resmi berhasil terhubung!');
        setTimeout(() => setSyncToast(null), 4000);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('message', msgHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('message', msgHandler);
    };
  }, []);

  // Persist Liked Songs
  useEffect(() => {
    localStorage.setItem('aura_liked_tracks', JSON.stringify(likedTracks));
  }, [likedTracks]);

  // Fetch Lyrics whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    setLyricsData({ loading: true, found: false, synced: false, lines: [] });

    apiFetchLyrics(currentTrack.title, currentTrack.artist)
      .then((data) => {
        if (!cancelled) {
          setLyricsData({
            loading: false,
            found: Boolean(data.found),
            synced: Boolean(data.synced),
            lines: data.lines || []
          });
        }
      })
      .catch(() => {
        if (!cancelled) setLyricsData({ loading: false, found: false, synced: false, lines: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id]);

  // Auto-scroll synced karaoke lyrics
  const activeLyricIndex = useMemo(() => {
    if (!lyricsData.lines.length) return -1;
    let idx = -1;
    for (let i = 0; i < lyricsData.lines.length; i++) {
      if (progress >= lyricsData.lines[i].time - 0.3) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [progress, lyricsData.lines]);

  useEffect(() => {
    if (activeLyricRef.current && (rightTab === 'lyrics' || isFullscreenPlayer)) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLyricIndex, rightTab, isFullscreenPlayer]);

  // Spectrum Visualizer Loop
  useEffect(() => {
    const tick = () => {
      if (isPlaying && !isBuffering) {
        const freq = dspEngine.getFrequencyData();
        const bars = Array.from({ length: 28 }, (_, i) => {
          const val = freq[i] || 0;
          return Math.max(8, Math.min(100, (val / 255) * 100));
        });
        setSpectrumBars(bars);
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, isBuffering]);

  const fetchTracks = async (query, mode = sourceMode, customHeading = null, preserveView = false, autoPlay = false) => {
    setIsLoading(true);
    if (!preserveView) {
      setActiveView('discover');
    }
    if (customHeading) setActiveFeedTitle(customHeading);
    else setActiveFeedTitle(`Hasil untuk "${query}"`);

    try {
      const data = await apiSearchTracks(query, mode);
      if (data.results?.length) {
        setTracks(data.results);
        if (autoPlay) {
          await playTrack(data.results[0]);
        } else if (!currentTrack) {
          setCurrentTrack(data.results[0]);
          setDuration(data.results[0].duration || 215);
        }
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchMode = (newMode) => {
    if (newMode === sourceMode) return;
    setSourceMode(newMode);
    const q = searchQuery.trim() || (newMode === 'ytmusic' ? 'Mahalini Tulus live audio' : 'Tulus Mahalini');
    fetchTracks(
      q,
      newMode,
      newMode === 'ytmusic' ? 'YouTube Music • kualitas sumber bervariasi' : 'Spotify Catalog • kualitas sumber bervariasi'
    );
  };

  const loadOfflineLibrary = async () => {
    try {
      const saved = await getAllOfflineTracks();
      setOfflineTracks(saved);
    } catch {}
  };

  const fetchWrappedLogs = async () => {
    try {
      const data = await apiGetWrappedLogs();
      if (data.logs) {
        setWrappedLogs(data.logs);
        setTotalWrappedMinutes(248 + (data.totalMinutesCounted || 0));
      }
    } catch {}
  };

  const triggerSpotifyWrappedSync = async (track) => {
    if (!wrappedSyncEnabled || !track) return;
    try {
      const data = await apiWrappedSync({
        track,
        spotifyAccessToken: spotifyToken || null,
        activeMode: track.sourceMode || sourceMode,
        listenedSeconds: track.duration || 215
      });
      if (data.success) {
        setSyncToast(
          `Synced ke Spotify Wrapped • ${track.title.slice(0, 28)}${track.title.length > 28 ? '…' : ''}`
        );
        setTimeout(() => setSyncToast(null), 4000);
        fetchWrappedLogs();
      }
    } catch {}
  };

  const resolvePlaySrc = (track) => {
    if (!track) return { src: '', isObjectUrl: false };
    if (track.audioBlob) {
      return { src: URL.createObjectURL(track.audioBlob), isObjectUrl: true };
    }
    const offlineMatch = offlineTracks.find((t) => t.id === track.id);
    if (offlineMatch?.audioBlob) {
      return { src: URL.createObjectURL(offlineMatch.audioBlob), isObjectUrl: true };
    }
    return { src: resolveFastStreamSrc(track.audioUrl || ''), isObjectUrl: false };
  };

  const preloadIntoStandbyDeck = (track) => {
    if (!track || !standbyDeckRef.current) return;
    if (track.id === currentTrack?.id || track.audioBlob || track.isLocalLossless) return;
    if (offlineTracks.some((t) => t.id === track.id)) return;
    if (
      standbyTrackIdRef.current === track.id &&
      standbyDeckRef.current.src &&
      !standbyDeckRef.current.error
    ) {
      return;
    }

    const preloadSrc = resolveFastStreamSrc(track.audioUrl || '');
    if (!preloadSrc) return;

    const deck = standbyDeckRef.current;
    try {
      deck.pause();
      deck.muted = true;
      deck.preload = 'auto';
      deck.src = preloadSrc;
      deck.load();
      standbyTrackIdRef.current = track.id;
    } catch {}
  };

  const handleTrackRowEnter = (track) => {
    if (!track || track.id === currentTrack?.id) return;
    apiPrewarmTracks([track], true);
    if (hoverPreloadTimerRef.current) clearTimeout(hoverPreloadTimerRef.current);
    hoverPreloadTimerRef.current = setTimeout(() => {
      preloadIntoStandbyDeck(track);
    }, 60);
  };

  const handleTrackRowLeave = () => {
    if (hoverPreloadTimerRef.current) {
      clearTimeout(hoverPreloadTimerRef.current);
      hoverPreloadTimerRef.current = null;
    }
  };

  const playTrack = async (track, startAtSeconds = 0) => {
    if (!track || !audioRef.current) return;
    const reqId = ++playRequestIdRef.current;

    setCurrentTrack(track);
    setProgress(startAtSeconds || 0);
    setDuration(track.duration || 215);

    if (startAtSeconds > 0) {
      setShowRightPanel(true);
      setRightTab('lyrics');
    }

    const hasOfflineOrLocalBlob =
      Boolean(track.audioBlob) || offlineTracks.some((t) => t.id === track.id && t.audioBlob);

    const canSwapStandby =
      startAtSeconds <= 0 &&
      !hasOfflineOrLocalBlob &&
      standbyDeckRef.current &&
      standbyTrackIdRef.current === track.id &&
      standbyDeckRef.current.src &&
      !standbyDeckRef.current.error;

    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }

    // Zero-Delay Path: Instant Hardware Buffer Swap to pre-decoded Standby Deck!
    if (canSwapStandby) {
      const oldDeck = audioRef.current;
      const newDeck = standbyDeckRef.current;
      oldDeck.pause();
      oldDeck.muted = true;

      audioRef.current = newDeck;
      standbyDeckRef.current = oldDeck;
      standbyTrackIdRef.current = null;

      newDeck.muted = false;
      newDeck.volume = isMuted ? 0 : volume;
      setIsBuffering(newDeck.readyState < 3);

      try {
        dspEngine.init(newDeck);
        dspEngine.setActiveElement(newDeck);
        dspEngine.resume();
        dspEngine.setEqEnabled(track.isLocalLossless ? false : isEqEnabled);
        if (newDeck.currentTime > 0.25) newDeck.currentTime = 0;
        await newDeck.play();
        if (reqId !== playRequestIdRef.current) return;
        setIsPlaying(true);
        setIsBuffering(false);
        triggerSpotifyWrappedSync(track);
        return;
      } catch (swapErr) {
        if (reqId !== playRequestIdRef.current) return;
        console.warn('Standby deck fallback to direct load:', swapErr);
      }
    }

    // Standard Fast-Stream Path (backed by Server 256KB RAM Head-Chunk burst)
    const { src: playSrc, isObjectUrl } = resolvePlaySrc(track);
    if (!playSrc) {
      setIsBuffering(false);
      return;
    }
    if (isObjectUrl) {
      activeBlobUrlRef.current = playSrc;
    }

    const activeDeck = audioRef.current;
    activeDeck.pause();
    activeDeck.muted = false;
    activeDeck.preload = 'auto';
    activeDeck.volume = isMuted ? 0 : volume;
    activeDeck.src = playSrc;
    setIsBuffering(true);

    try {
      dspEngine.init(activeDeck);
      dspEngine.setActiveElement(activeDeck);
      dspEngine.resume();
      // Keep imported lossless files free from the app's preset EQ curve.
      dspEngine.setEqEnabled(track.isLocalLossless ? false : isEqEnabled);
      await activeDeck.play();
      if (reqId !== playRequestIdRef.current) return;
      if (startAtSeconds > 0 && audioRef.current) {
        audioRef.current.currentTime = Math.max(0, startAtSeconds - 0.5);
      }
      setIsPlaying(true);
      setIsBuffering(false);
      triggerSpotifyWrappedSync(track);
    } catch (err) {
      if (reqId !== playRequestIdRef.current) return;
      console.warn('Direct stream playback note:', err);
      setIsBuffering(false);
    }
  };

  const togglePlayPause = async () => {
    if (!audioRef.current || !currentTrack) return;
    if (!audioRef.current.src) {
      await playTrack(currentTrack);
      return;
    }
    dspEngine.init(audioRef.current);
    dspEngine.setActiveElement(audioRef.current);
    dspEngine.resume();
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsBuffering(true);
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } finally {
        setIsBuffering(false);
      }
    }
  };

  const playNext = async () => {
    const activeList = activeDisplayedTracks.length ? activeDisplayedTracks : tracks;
    if (!activeList.length) return;

    if (isShuffle) {
      const unplayed = activeList.filter((t) => t.id !== currentTrack?.id);

      // Infinite Dynamic Shuffle: when pool has <= 2 tracks remaining, auto-pull new radio songs!
      if (isAutoRadio && unplayed.length <= 2 && currentTrack && !isExtendingQueue) {
        setIsExtendingQueue(true);
        try {
          const rec = await apiGetRecommendations(
            currentTrack.artist,
            currentTrack.title,
            sourceMode,
            currentTrack.ytVideoId,
            true
          );
          if (rec?.results?.length) {
            const existingIds = new Set(activeList.map((t) => t.id));
            const newTracks = rec.results.filter((t) => !existingIds.has(t.id));
            if (newTracks.length > 0) {
              setTracks((prev) => [...prev, ...newTracks]);
              const combinedPool = [...unplayed, ...newTracks];
              const rand = combinedPool[Math.floor(Math.random() * combinedPool.length)];
              setIsExtendingQueue(false);
              playTrack(rand);
              return;
            }
          }
        } catch (e) {
          console.error('Shuffle auto-extension error:', e);
        } finally {
          setIsExtendingQueue(false);
        }
      }

      const pool = unplayed.length ? unplayed : activeList;
      const rand = pool[Math.floor(Math.random() * pool.length)];
      playTrack(rand);
      return;
    }

    const idx = activeList.findIndex((t) => t.id === currentTrack?.id);

    // Smart Infinite Auto-Radio: when reaching queue end, auto-extend with fresh popular related hits!
    if (isAutoRadio && (idx === -1 || idx >= activeList.length - 1)) {
      if (!isExtendingQueue && currentTrack) {
        setIsExtendingQueue(true);
        try {
          const rec = await apiGetRecommendations(
            currentTrack.artist,
            currentTrack.title,
            sourceMode,
            currentTrack.ytVideoId
          );
          if (rec?.results?.length) {
            const existingIds = new Set(activeList.map((t) => t.id));
            const newTracks = rec.results.filter((t) => !existingIds.has(t.id));
            if (newTracks.length > 0) {
              setTracks((prev) => [...prev, ...newTracks]);
              setIsExtendingQueue(false);
              playTrack(newTracks[0]);
              return;
            }
          }
        } catch (e) {
          console.error('Auto radio queue extension error:', e);
        } finally {
          setIsExtendingQueue(false);
        }
      }
    }

    const nextIdx = idx >= 0 && idx + 1 < activeList.length ? idx + 1 : 0;
    playTrack(activeList[nextIdx]);
  };

  const startRadioFromSearch = async () => {
    const seedTrack = tracks[0];
    if (!seedTrack && !searchQuery.trim()) return;
    setIsLoading(true);
    const seedName = searchQuery.trim() || seedTrack?.title;
    setSyncToast(`Menyiapkan Radio Acak: "${seedName}"...`);
    try {
      const rec = await apiGetRecommendations(
        seedTrack?.artist || searchQuery,
        seedTrack?.title || '',
        sourceMode,
        seedTrack?.ytVideoId || '',
        true,
        searchQuery
      );
      if (rec?.results?.length) {
        const pool = [...rec.results];
        const shuffled = pool.sort(() => 0.5 - Math.random());
        const first = seedTrack || shuffled[0];
        const finalQueue = [first, ...shuffled.filter((t) => t.id !== first.id)];
        setTracks(finalQueue);
        setActiveFeedTitle(`Radio Acak: ${seedName}`);
        setIsShuffle(true);
        await playTrack(first);
        setSyncToast(`Radio Acak Aktif: ${finalQueue.length} lagu serupa siap diputar!`);
        setTimeout(() => setSyncToast(null), 3500);
      } else if (tracks.length > 0) {
        setIsShuffle(true);
        const rand = tracks[Math.floor(Math.random() * tracks.length)];
        await playTrack(rand);
      }
    } catch (e) {
      console.error('Start radio error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const startSongRadio = async (track) => {
    if (!track) return;
    setSyncToast(`Memulai Radio Lagu: "${track.title}"...`);
    playTrack(track);
    try {
      const rec = await apiGetRecommendations(
        track.artist,
        track.title,
        sourceMode,
        track.ytVideoId,
        true
      );
      if (rec?.results?.length) {
        const pool = rec.results.filter((t) => t.id !== track.id);
        const shuffled = pool.sort(() => 0.5 - Math.random());
        const finalQueue = [track, ...shuffled];
        setTracks(finalQueue);
        setActiveFeedTitle(`Radio Lagu: ${track.title} (${track.artist})`);
        setSyncToast(`Radio Aktif: ${finalQueue.length} lagu serupa siap berputar!`);
        setTimeout(() => setSyncToast(null), 3500);
      }
    } catch (e) {
      console.error('Radio fetch error:', e);
    }
  };

  const playPrev = () => {
    if (audioRef.current && audioRef.current.currentTime > 4) {
      audioRef.current.currentTime = 0;
      return;
    }
    const activeList = activeDisplayedTracks.length ? activeDisplayedTracks : tracks;
    if (!activeList.length) return;
    const idx = activeList.findIndex((t) => t.id === currentTrack?.id);
    const prevIdx = idx > 0 ? idx - 1 : activeList.length - 1;
    playTrack(activeList[prevIdx]);
  };

  const toggleLike = (track, e) => {
    if (e) e.stopPropagation();
    if (!track) return;
    setLikedTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      if (exists) return prev.filter((t) => t.id !== track.id);
      return [{ ...track, audioBlob: undefined }, ...prev];
    });
  };

  const isLiked = (id) => likedTracks.some((t) => t.id === id);
  const isOffline = (id) => offlineTracks.some((t) => t.id === id);

  const handleDownloadOffline = async (track, directExportFile = true, e = null) => {
    if (e) e.stopPropagation();
    if (!track || downloadingIds[track.id] !== undefined) return;

    setDownloadingIds((prev) => ({ ...prev, [track.id]: 15 }));
    try {
      const record = await saveTrackOffline(track, (pct) => {
        setDownloadingIds((prev) => ({ ...prev, [track.id]: pct }));
      });
      await loadOfflineLibrary();

      if (directExportFile && record.audioBlob) {
        const blobUrl = URL.createObjectURL(record.audioBlob);
        const a = document.createElement('a');
        a.href = blobUrl;
        const audioType = record.audioBlob.type?.toLowerCase() || '';
        const extensionByType = {
          'audio/flac': 'flac',
          'audio/x-flac': 'flac',
          'audio/mp4': 'm4a',
          'audio/mpeg': 'mp3',
          'audio/ogg': 'ogg',
          'audio/webm': 'webm',
          'video/webm': 'webm',
          'audio/wav': 'wav',
          'audio/x-wav': 'wav'
        };
        const extension = extensionByType[audioType] || 'audio';
        a.download = track.isLocalLossless
          ? track.localFileName
          : `${track.artist} - ${track.title} [HQ Audio].${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      }
    } catch (err) {
      console.error('Audio download error:', err);
    } finally {
      setTimeout(() => {
        setDownloadingIds((prev) => {
          const copy = { ...prev };
          delete copy[track.id];
          return copy;
        });
      }, 500);
    }
  };

  const applyPreset = (name) => {
    const gains = EQ_PRESETS[name];
    if (!gains) return;
    setActivePreset(name);
    setEqGains([...gains]);
    gains.forEach((g, idx) => dspEngine.setBandGain(idx, g));
  };

  const handleEqSlider = (idx, val) => {
    const db = parseFloat(val);
    const next = [...eqGains];
    next[idx] = db;
    setEqGains(next);
    setActivePreset('Custom');
    dspEngine.setBandGain(idx, db);
  };

  const activeDisplayedTracks = useMemo(() => {
    if (activeView === 'liked') return likedTracks;
    if (activeView === 'offline') return offlineTracks;
    return tracks;
  }, [activeView, likedTracks, offlineTracks, tracks]);

  // Zero-Delay Queue Lookahead: Pre-warm upcoming neighbors & pre-decode next track in Standby Deck
  useEffect(() => {
    const activeList = activeDisplayedTracks.length ? activeDisplayedTracks : tracks;
    if (!activeList.length) return;

    const idx = activeList.findIndex((t) => t.id === currentTrack?.id);
    if (idx === -1) {
      apiPrewarmTracks(activeList.slice(0, 2), true);
      apiPrewarmTracks(activeList.slice(2, 6), false);
      if (!isPlaying && activeList[0]) {
        preloadIntoStandbyDeck(activeList[0]);
      }
      return;
    }

    const immediateNext = activeList[idx + 1] || activeList[0];
    const prevNeighbor = idx > 0 ? activeList[idx - 1] : activeList[activeList.length - 1];
    const upcomingSlice = activeList.slice(idx + 1, idx + 5);

    if (immediateNext && immediateNext.id !== currentTrack?.id) {
      apiPrewarmTracks([immediateNext], true);
      if (!isShuffle) {
        preloadIntoStandbyDeck(immediateNext);
      }
    }
    apiPrewarmTracks([...upcomingSlice.slice(1), prevNeighbor].filter(Boolean), false);

    // Proactive Infinite Auto-Radio: extend queue 2 tracks BEFORE reaching queue end so Next never waits
    if (
      isAutoRadio &&
      isPlaying &&
      activeView === 'discover' &&
      !isExtendingQueue &&
      currentTrack &&
      idx >= activeList.length - 3
    ) {
      setIsExtendingQueue(true);
      apiGetRecommendations(
        currentTrack.artist,
        currentTrack.title,
        sourceMode,
        currentTrack.ytVideoId
      )
        .then((rec) => {
          if (rec?.results?.length) {
            setTracks((prev) => {
              const existingIds = new Set(prev.map((t) => t.id));
              const fresh = rec.results.filter((t) => !existingIds.has(t.id));
              if (fresh.length) apiPrewarmTracks(fresh.slice(0, 4), false);
              return fresh.length ? [...prev, ...fresh] : prev;
            });
          }
        })
        .catch(() => {})
        .finally(() => setIsExtendingQueue(false));
    }
  }, [currentTrack?.id, activeDisplayedTracks, tracks, isPlaying, isShuffle, isAutoRadio, activeView, sourceMode]);

  const handleDeckWaiting = (e) => {
    if (e.currentTarget !== audioRef.current) return;
    setIsBuffering(true);
  };

  const handleDeckPlaying = (e) => {
    if (e.currentTarget !== audioRef.current) return;
    setIsBuffering(false);
    setIsPlaying(true);
  };

  const handleDeckTimeUpdate = (e) => {
    if (e.currentTarget !== audioRef.current) return;
    const el = e.currentTarget;
    setProgress(el.currentTime);
    if (el.duration && isFinite(el.duration)) {
      setDuration(el.duration);
    }
  };

  const handleDeckEnded = (e) => {
    if (e.currentTarget !== audioRef.current) return;
    if (isRepeat && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      playNext();
    }
  };

  const accentBg = sourceMode === 'spotify' ? 'bg-[#1DB954] text-black' : 'bg-[#FF0033] text-white';
  const accentText = sourceMode === 'spotify' ? 'text-[#1DB954]' : 'text-[#FF0033]';
  const accentBar = sourceMode === 'spotify' ? 'bg-[#1DB954]' : 'bg-[#FF0033]';

  const ambientGradient = useMemo(() => {
    if (uiTheme === 'pixel') {
      return 'from-[#222436]/90 via-[#1e2030] to-[#1e2030]';
    }
    if (activeView === 'liked') return 'from-indigo-900/55 via-[#121214] to-[#121214]';
    if (activeView === 'offline') return 'from-amber-900/40 via-[#121214] to-[#121214]';
    if (activeView === 'wrapped') return 'from-emerald-900/50 via-[#121214] to-[#121214]';
    if (activeView === 'artist') return 'from-emerald-950/70 via-[#121214] to-[#121214]';
    return sourceMode === 'spotify'
      ? 'from-emerald-950/65 via-[#121214] to-[#121214]'
      : 'from-rose-950/65 via-[#121214] to-[#121214]';
  }, [activeView, sourceMode, uiTheme]);

  return (
    <div
      className={`flex flex-col h-screen w-screen ${
        uiTheme === 'pixel'
          ? 'bg-[#161822] text-[#c0caf5] font-mono selection:bg-[#73daca] selection:text-black'
          : 'bg-black text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black'
      } select-none overflow-hidden p-0 sm:p-2 sm:gap-2`}
    >
      {/* Dual-Deck Zero-Latency HTML5 Audio Pipeline (Active Deck + Pre-Decoded Standby Deck) */}
      <audio
        ref={(el) => {
          deckARef.current = el;
          if (el && !audioRef.current) audioRef.current = el;
        }}
        crossOrigin="anonymous"
        preload="auto"
        onWaiting={handleDeckWaiting}
        onPlaying={handleDeckPlaying}
        onTimeUpdate={handleDeckTimeUpdate}
        onEnded={handleDeckEnded}
      />
      <audio
        ref={(el) => {
          deckBRef.current = el;
          if (el && !standbyDeckRef.current) {
            el.muted = true;
            standbyDeckRef.current = el;
          }
        }}
        crossOrigin="anonymous"
        preload="auto"
        onWaiting={handleDeckWaiting}
        onPlaying={handleDeckPlaying}
        onTimeUpdate={handleDeckTimeUpdate}
        onEnded={handleDeckEnded}
      />

      {/* Subtle Floating Toast for Spotify Wrapped Scrobble */}
      {syncToast && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full bg-zinc-900/95 border border-emerald-500/30 shadow-2xl backdrop-blur-xl text-xs text-emerald-300 animate-fade-in">
          <SpotifyIcon className="w-3.5 h-3.5 text-[#1DB954]" />
          <span className="font-medium">{syncToast}</span>
        </div>
      )}

      {/* ==================== TOP NATIVE APPLICATION BAR ==================== */}
      <header
        className={`h-12 px-3 sm:px-3 flex items-center justify-between gap-3 shrink-0 z-20 transition-colors ${
          uiTheme === 'pixel'
            ? 'bg-[#1a1c29] border-b border-[#2f334d] font-mono'
            : 'bg-black border-b border-white/[0.04]'
        }`}
      >
        {/* Left Brand & Home */}
        <div className="flex items-center gap-2.5">
          {uiTheme === 'pixel' && (
            <span className="hidden sm:inline text-xs font-mono text-[#565f89] font-bold mr-1">...</span>
          )}
          <button
            onClick={() => setActiveView('discover')}
            className="flex items-center gap-2 group focus:outline-none"
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-inner ${
                uiTheme === 'pixel'
                  ? 'bg-[#24283b] border border-[#3b4261]'
                  : 'bg-zinc-900 border border-white/10'
              }`}
            >
              <img src="/icon.svg" alt="AURA" className="w-6 h-6" />
            </div>
            <div className="hidden sm:flex items-baseline gap-1.5">
              <span
                className={`font-extrabold tracking-tight text-[15px] ${
                  uiTheme === 'pixel' ? 'text-[#73daca] font-mono' : 'text-white'
                }`}
              >
                AURA
              </span>
              <span
                className={`text-[9px] font-mono font-semibold tracking-widest uppercase ${
                  uiTheme === 'pixel' ? 'text-[#7aa2f7]' : 'text-zinc-500'
                }`}
              >
                {uiTheme === 'pixel' ? 'TUI-PIXEL' : 'STUDIO'}
              </span>
            </div>
          </button>
        </div>

        {/* Center Search Pill + Segmented Source Engine Switcher */}
        <div className="flex items-center gap-2 flex-1 max-w-2xl justify-center">
          {uiTheme === 'pixel' && (
            <div className="hidden sm:flex items-center gap-1.5 text-[#7aa2f7] font-mono text-xs font-bold mr-1">
              <button
                onClick={() => setActiveView('discover')}
                className="hover:text-white px-1.5 py-0.5 rounded bg-[#24283b] border border-[#3b4261]"
                title="Kembali"
              >
                &lt;
              </button>
              <button
                className="text-zinc-600 px-1.5 py-0.5 rounded bg-[#24283b]/50 border border-[#3b4261]/40 cursor-not-allowed"
                title="Maju"
              >
                &gt;
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) fetchTracks(searchQuery.trim(), sourceMode);
            }}
            className={`flex-1 max-w-md flex items-center rounded-full px-3.5 h-9 transition-all border ${
              uiTheme === 'pixel'
                ? 'bg-[#24283b] border-[#3b4261] focus-within:border-[#73daca] text-[#c0caf5]'
                : 'bg-[#18181b] hover:bg-[#202024] focus-within:bg-[#202024] focus-within:ring-1 focus-within:ring-white/20 border-white/[0.04]'
            }`}
          >
            <Search className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                sourceMode === 'spotify'
                  ? 'Cari lagu, creator, atau ketik potongan lirik...'
                  : 'Cari lirik lagu, live session, atau remix di YT Music...'
              }
              className={`bg-transparent w-full text-[13px] placeholder-zinc-500 focus:outline-none ${
                uiTheme === 'pixel' ? 'text-[#c0caf5] font-mono' : 'text-white'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-zinc-500 hover:text-zinc-300 ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Dual Engine Pill Switcher: Spotify Mode <-> YT Music Mode */}
          <div
            className={`flex items-center p-0.5 rounded-full border shrink-0 ${
              uiTheme === 'pixel'
                ? 'bg-[#24283b] border-[#3b4261]'
                : 'bg-[#18181b] border-white/[0.06]'
            }`}
          >
            <button
              onClick={() => handleSwitchMode('spotify')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                sourceMode === 'spotify'
                  ? 'bg-[#1DB954] text-black shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <SpotifyIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Spotify</span>
            </button>
            <button
              onClick={() => handleSwitchMode('ytmusic')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                sourceMode === 'ytmusic'
                  ? 'bg-[#FF0033] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <YTMusicIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">YT Music</span>
            </button>
          </div>
        </div>

        {/* Right Studio Badges: Theme Toggle, Lossless Signal, Wrapped Sync & Install App */}
        <div className="flex items-center gap-1.5">
          {/* UI Theme Toggle Button: Pixel TUI <-> Studio Pro */}
          <button
            onClick={() => {
              const nextTheme = uiTheme === 'pixel' ? 'studio' : 'pixel';
              setUiTheme(nextTheme);
              localStorage.setItem('aura_ui_theme', nextTheme);
            }}
            title="Ganti Tema UI (Pixelated TUI / Studio Pro)"
            className={`flex items-center gap-1.5 px-2.5 h-8 rounded-full border text-[11px] font-mono font-bold transition-all ${
              uiTheme === 'pixel'
                ? 'bg-[#73daca]/20 border-[#73daca]/60 text-[#73daca] shadow-[0_0_10px_rgba(115,218,202,0.35)]'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
          >
            <span>{uiTheme === 'pixel' ? '👾 Pixel TUI' : '💎 Studio Pro'}</span>
          </button>

          <input
            ref={losslessFileRef}
            type="file"
            accept=".flac,.wav,audio/flac,audio/wav"
            className="hidden"
            onChange={importLosslessFile}
          />
          <button
            onClick={() => losslessFileRef.current?.click()}
            title="Putar file FLAC atau WAV PCM lokal (Bit-Perfect Lossless Asli)"
            className="flex items-center gap-1.5 px-2 sm:px-2.5 h-8 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-300 text-[11px] font-semibold hover:bg-amber-500/20"
          >
            <Folder className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Import FLAC/WAV</span>
          </button>
          {/* EQ control: Audio Equalizer (Studio DSP) */}
          <button
            onClick={() => {
              setShowRightPanel(true);
              setRightTab('eq');
            }}
            title="Pengaturan Equalizer Audio DSP"
            className={`hidden sm:flex items-center gap-1.5 px-2.5 h-8 rounded-full text-[11px] font-mono font-semibold border transition-all ${
              isEqEnabled
                ? 'bg-amber-500/10 border-amber-400/30 text-amber-300 hover:bg-amber-500/15'
                : 'bg-zinc-900 border-white/5 text-zinc-500'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>EQ DSP</span>
          </button>

          {/* Wrapped Bridge / Connect Spotify Account Pill */}
          <button
            onClick={() => setActiveView('wrapped')}
            title="Hubungkan Akun Spotify & Pengaturan Wrapped Sync"
            className={`flex items-center gap-1.5 px-2.5 h-8 rounded-full border text-[11px] font-semibold transition-all ${
              spotifyAccount.connected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : uiTheme === 'pixel'
                ? 'bg-[#24283b] hover:bg-[#2d3149] border-[#3b4261] text-[#c0caf5]'
                : 'bg-[#18181b] hover:bg-[#222226] border-white/[0.08] text-zinc-200'
            }`}
          >
            {spotifyAccount.connected && spotifyAccount.user?.avatar ? (
              <img src={spotifyAccount.user.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
            ) : (
              <SpotifyIcon className="w-3.5 h-3.5 text-[#1DB954]" />
            )}
            <span className="hidden md:inline">
              {spotifyAccount.connected
                ? spotifyAccount.user?.displayName || 'Terhubung'
                : 'Connect Spotify'}
            </span>
          </button>

          {/* Install Native App / Phone APK Modal Trigger */}
          <button
            onClick={() => {
              if (deferredPrompt) deferredPrompt.prompt();
              else setShowInstallModal(true);
            }}
            className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Aplikasi HP</span>
          </button>

          {uiTheme === 'pixel' && (
            <div className="hidden xl:flex items-center gap-2 text-xs font-mono text-[#565f89] pl-1 select-none">
              <span className="hover:text-white cursor-pointer">—</span>
              <span className="hover:text-white cursor-pointer">□</span>
              <span className="hover:text-rose-400 cursor-pointer">✕</span>
            </div>
          )}
        </div>
      </header>

      {/* ==================== 3-ISLAND WORKSPACE ==================== */}
      <div className="flex flex-1 min-h-0 gap-2 overflow-hidden px-0 sm:px-0">
        {/* ---------- LEFT ISLAND: YOUR LIBRARY ---------- */}
        <aside className="hidden lg:flex flex-col w-[275px] bg-[#121214] rounded-2xl border border-white/[0.05] overflow-hidden shrink-0">
          <div className="p-4 pb-2 space-y-3">
            <div className="flex items-center justify-between text-zinc-400">
              <div className="flex items-center gap-2 font-bold text-sm text-zinc-200">
                <Library className="w-4 h-4 text-zinc-400" />
                <span>Koleksi Kamu</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">AUDIO</span>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'playlists', label: 'Mixes' },
                { id: 'offline', label: 'Offline' }
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setLibraryFilter(chip.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    libraryFilter === chip.id
                      ? 'bg-white text-black font-semibold'
                      : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
            {/* Pinned: Liked Songs */}
            {(libraryFilter === 'all' || libraryFilter === 'playlists') && (
              <button
                onClick={() => setActiveView('liked')}
                className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all ${
                  activeView === 'liked' ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-400 flex items-center justify-center shrink-0 shadow-md">
                  <Heart className="w-5 h-5 text-white fill-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white truncate">Lagu Disukai</p>
                  <p className="text-xs text-zinc-400 truncate">Playlist • {likedTracks.length} lagu</p>
                </div>
              </button>
            )}

            {/* Pinned: Offline audio library */}
            {(libraryFilter === 'all' || libraryFilter === 'offline') && (
              <button
                onClick={() => setActiveView('offline')}
                className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all ${
                  activeView === 'offline' ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-800 flex items-center justify-center shrink-0 shadow-md">
                  <Download className="w-5 h-5 text-black stroke-[2.4]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white truncate">Audio Offline</p>
                  <p className="text-xs text-amber-400/90 truncate">
                    Tersimpan di HP • {offlineTracks.length} lagu
                  </p>
                </div>
              </button>
            )}

            {/* Pinned: Spotify Wrapped Sync Tracker */}
            {libraryFilter === 'all' && (
              <button
                onClick={() => setActiveView('wrapped')}
                className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all ${
                  activeView === 'wrapped' ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#1DB954] to-emerald-950 flex items-center justify-center shrink-0 shadow-md">
                  <SpotifyIcon className="w-5 h-5 text-black" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white truncate">Spotify Wrapped 2026</p>
                  <p className="text-xs text-emerald-400 truncate">
                    Auto-Bridge • {totalWrappedMinutes} mnt tercatat
                  </p>
                </div>
              </button>
            )}

            {/* Real Imported User Spotify Playlists (when connected!) */}
            {(libraryFilter === 'all' || libraryFilter === 'playlists') &&
              userSpotifyPlaylists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => openSpotifyPlaylist(pl)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-white/[0.05] transition-all"
                >
                  {pl.cover ? (
                    <img
                      src={pl.cover}
                      alt={pl.name}
                      className="w-11 h-11 rounded-lg object-cover shrink-0 bg-zinc-800"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                      <SpotifyIcon className="w-5 h-5 text-[#1DB954]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white truncate">{pl.name}</p>
                    <p className="text-xs text-emerald-400/90 truncate">
                      Spotify Playlist • {pl.trackCount} lagu
                    </p>
                  </div>
                </button>
              ))}

            {/* Curated Mixes */}
            {(libraryFilter === 'all' || libraryFilter === 'playlists') &&
              CURATED_MIXES.map((mix) => (
                <button
                  key={mix.id}
                  onClick={() => {
                    if (mix.mode !== sourceMode) setSourceMode(mix.mode);
                    fetchTracks(mix.query, mix.mode, mix.title, false, true);
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-white/[0.04] transition-all"
                >
                  <img
                    src={mix.cover}
                    alt={mix.title}
                    className="w-11 h-11 rounded-lg object-cover shrink-0 bg-zinc-800"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-zinc-100 truncate">{mix.title}</p>
                    <p className="text-xs text-zinc-400 truncate">{mix.subtitle}</p>
                  </div>
                </button>
              ))}
          </div>
        </aside>

        {/* ---------- CENTER ISLAND: MAIN STAGE ---------- */}
        <main
          className={`flex-1 sm:rounded-2xl border overflow-y-auto relative pb-28 sm:pb-6 transition-colors ${
            uiTheme === 'pixel'
              ? 'bg-[#1e2030] border-[#2f334d]'
              : 'bg-[#121214] border-white/[0.05]'
          }`}
        >
          {/* Ambient Top Wash */}
          <div className={`bg-gradient-to-b ${ambientGradient} px-4 sm:px-7 pt-4 pb-6`}>
            {/* === VIEW 1: DISCOVER / HOME / SEARCH === */}
            {activeView === 'discover' && (
              <div className="space-y-5">
                {/* Pixelated TUI Aesthetic matching Image 2 */}
                {uiTheme === 'pixel' ? (
                  <>
                    {/* Top Category Chips matching Image 2: [ All ] [ Music ] [ Podcasts ] */}
                    <div className="flex items-center gap-2">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'music', label: 'Music' },
                        { id: 'podcasts', label: 'Podcasts' }
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setPixelCategory(cat.id);
                            if (cat.id === 'music') fetchTracks('Pop Hits Indonesia', sourceMode, 'Music Feed');
                            if (cat.id === 'podcasts') fetchTracks('Podcast Indonesia', sourceMode, 'Podcast Feed');
                            if (cat.id === 'all') fetchTracks('Febri remix Tulus Mahalini', sourceMode, 'Rekomendasi Utama');
                          }}
                          className={`px-3.5 py-1 rounded-md text-xs font-mono font-bold transition-all ${
                            pixelCategory === cat.id
                              ? 'bg-[#c0caf5] text-[#1a1b26] shadow-sm'
                              : 'bg-[#24283b] text-[#7aa2f7] hover:bg-[#2d3149] hover:text-[#c0caf5]'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Authentic Neon-Green ASCII Art Header matching Image 2! */}
                    <div className="py-1 text-[#73daca] font-mono text-[10px] sm:text-xs leading-[1.12] select-none tracking-tight font-bold drop-shadow-[0_0_8px_rgba(115,218,202,0.35)] overflow-x-auto">
                      <pre className="whitespace-pre">
{`   ___             _   _  __         _        _ 
  / __|_ __  ___ _| |_(_)/ _|_  _  _| |_ _  _(_)
  \\__ \\ '_ \\/ _ \\ | _| |  _| || || |  _| || || |
  |___/ .__/\\___/\\__|_|_|   \\_, |\\_, |\\__|\\_,_|_|
      |_|                   |__/ |__/           `}
                      </pre>
                    </div>

                    {/* 2-Column Grid of 8 Cards matching Image 2! */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {/* 1. Sufjan Stevens (Artist Card) */}
                      <div
                        onClick={() => openArtistView('Sufjan Stevens')}
                        className="group flex items-center justify-between bg-[#24283b] hover:bg-[#2d3149] border border-[#3b4261] rounded-lg overflow-hidden cursor-pointer transition-all pr-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=120&q=80"
                            alt="Sufjan Stevens"
                            className="w-12 h-12 object-cover shrink-0"
                          />
                          <span className="font-mono font-bold text-xs sm:text-[13px] text-[#c0caf5] group-hover:text-emerald-400 truncate">
                            Sufjan Stevens
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">Creator</span>
                      </div>

                      {/* 2. Viral Remix Pick (Emoji) */}
                      <div
                        onClick={() => fetchTracks('TikTok Viral Remix 2026', sourceMode, 'Viral Remix & Edits', false, true)}
                        className="group flex items-center justify-between bg-[#24283b] hover:bg-[#2d3149] border border-[#3b4261] rounded-lg overflow-hidden cursor-pointer transition-all pr-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-indigo-800 to-black flex items-center justify-center shrink-0 text-xl">
                            🤪
                          </div>
                          <span className="font-mono font-bold text-xs sm:text-[13px] text-[#c0caf5] truncate">
                            Viral Remix &amp; Bass
                          </span>
                        </div>
                      </div>

                      {/* 3. Time Is Tearing Us Apart Radio */}
                      <div
                        onClick={() => fetchTracks('Time Is Tearing Us Apart', sourceMode, 'Time Is Tearing Us Apart Radio', false, true)}
                        className="group flex items-center justify-between bg-[#24283b] hover:bg-[#2d3149] border border-[#3b4261] rounded-lg overflow-hidden cursor-pointer transition-all pr-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=120&q=80"
                            alt="Radio"
                            className="w-12 h-12 object-cover shrink-0"
                          />
                          <span className="font-mono font-bold text-xs sm:text-[13px] text-[#c0caf5] truncate">
                            Time Is Tearing Us Apart Radio
                          </span>
                        </div>
                      </div>

                      {/* 4. Liked Songs (Purple box with Heart) */}
                      <div
                        onClick={() => setActiveView('liked')}
                        className="group flex items-center justify-between bg-[#24283b] hover:bg-[#2d3149] border border-[#3b4261] rounded-lg overflow-hidden cursor-pointer transition-all pr-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shrink-0">
                            <Heart className="w-5 h-5 text-white fill-white" />
                          </div>
                          <span className="font-mono font-bold text-xs sm:text-[13px] text-white truncate">
                            Liked Songs
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#7aa2f7]">{likedTracks.length}</span>
                      </div>

                      {/* 5. You seem pretty sad */}
                      <div
                        onClick={() => fetchTracks('you seem pretty sad for a girl so in love', sourceMode, 'Indie Melancholy', false, true)}
                        className="group flex items-center justify-between bg-[#24283b] hover:bg-[#2d3149] border border-[#3b4261] rounded-lg overflow-hidden cursor-pointer transition-all pr-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src="https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=120&q=80"
                            alt=""
                            className="w-12 h-12 object-cover shrink-0"
                          />
                          <span className="font-mono font-bold text-xs sm:text-[13px] text-[#c0caf5] truncate">
                            you seem pretty sad for a girl so in love
                          </span>
                        </div>
                      </div>

                      {/* 6. Random Popular Songs */}
                      <div
                        onClick={() => fetchTracks('Pop Hits Indonesia 2026', sourceMode, 'Random Popular Songs', false, true)}
                        className="group flex items-center justify-between bg-[#24283b] hover:bg-[#2d3149] border border-[#3b4261] rounded-lg overflow-hidden cursor-pointer transition-all pr-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=120&q=80"
                            alt=""
                            className="w-12 h-12 object-cover shrink-0"
                          />
                          <span className="font-mono font-bold text-xs sm:text-[13px] text-[#c0caf5] truncate">
                            Random Popular Songs 🎧🎵
                          </span>
                        </div>
                      </div>

                      {/* 7. Irgendwie, irgendwo, irgendwann */}
                      <div
                        onClick={() => fetchTracks('Irgendwie irgendwo irgendwann', sourceMode, '80s Synth Dance Mix', false, true)}
                        className="group flex items-center justify-between bg-[#24283b] hover:bg-[#2d3149] border border-[#3b4261] rounded-lg overflow-hidden cursor-pointer transition-all pr-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src="https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=120&q=80"
                            alt=""
                            className="w-12 h-12 object-cover shrink-0"
                          />
                          <span className="font-mono font-bold text-xs sm:text-[13px] text-[#c0caf5] truncate">
                            Irgendwie, irgendwo (12&quot; Dance Mix) Radio
                          </span>
                        </div>
                      </div>

                      {/* 8. Febri remix (Creator Card matching user image!) */}
                      <div
                        onClick={() => openArtistView('Febri remix')}
                        className="group flex items-center justify-between bg-[#24283b] hover:bg-[#2d3149] border border-emerald-500/40 rounded-lg overflow-hidden cursor-pointer transition-all pr-3 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src="/febri-dove.png"
                            alt="Febri remix"
                            className="w-12 h-12 object-cover shrink-0 bg-black"
                          />
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-xs sm:text-[13px] text-white group-hover:text-emerald-400 truncate block">
                              Febri remix
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400">
                              ✓ Creator Terverifikasi
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          PROFIL
                        </span>
                      </div>
                    </div>

                    {/* Pre-save upcoming releases Carousel matching Image 2 */}
                    <div className="pt-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-mono font-bold text-[#c0caf5] tracking-wide">
                          Pre-save upcoming releases
                        </h3>
                        <button
                          onClick={() => fetchTracks('Upcoming Releases 2026', sourceMode, 'Upcoming Releases')}
                          className="text-[11px] font-mono text-[#7aa2f7] hover:underline"
                        >
                          Show all
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          {
                            title: 'Javelin (Deluxe Master)',
                            artist: 'Sufjan Stevens',
                            cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=240&q=80'
                          },
                          {
                            title: 'Tante Culik Aku Dong (Remix)',
                            artist: 'Febri remix',
                            cover: '/febri-dove.png'
                          },
                          {
                            title: 'Worst Christmas Ever!',
                            artist: 'Retro Holidays',
                            cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=240&q=80'
                          },
                          {
                            title: 'Midnight Unplugged 2026',
                            artist: 'Indie Collective',
                            cover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=240&q=80'
                          }
                        ].map((rel, idx) => (
                          <div
                            key={idx}
                            onClick={() => fetchTracks(`${rel.artist} ${rel.title}`, sourceMode, rel.title, false, true)}
                            className="group p-2.5 rounded-xl bg-[#24283b] hover:bg-[#2d3149] border border-[#3b4261] transition-all cursor-pointer space-y-2"
                          >
                            <img
                              src={rel.cover}
                              alt={rel.title}
                              className="w-full aspect-square rounded-lg object-cover bg-black"
                            />
                            <div>
                              <p className="text-xs font-mono font-bold text-[#c0caf5] truncate group-hover:text-emerald-400">
                                {rel.title}
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openArtistView(rel.artist);
                                }}
                                className="text-[11px] font-mono text-[#7aa2f7] hover:underline truncate block"
                              >
                                {rel.artist}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Modern Studio Aesthetic */}
                    <div className="flex items-center justify-between">
                      <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                        {greeting}
                      </h1>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        {sourceMode === 'spotify' ? (
                          <>
                            <SpotifyIcon className="w-4 h-4 text-[#1DB954]" />
                            <span>Spotify Catalog</span>
                          </>
                        ) : (
                          <>
                            <YTMusicIcon className="w-4 h-4 text-[#FF0033]" />
                            <span>YT Music Engine • Wrapped Synced</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Iconic 6-Card Quick Picks Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                      <div
                        onClick={() => setActiveView('liked')}
                        className="group flex items-center justify-between bg-white/[0.06] hover:bg-white/[0.12] rounded-lg overflow-hidden cursor-pointer transition-all pr-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-600 to-emerald-400 flex items-center justify-center shrink-0">
                            <Heart className="w-5 h-5 text-white fill-white" />
                          </div>
                          <span className="font-bold text-xs sm:text-[13px] text-white truncate">
                            Lagu Disukai
                          </span>
                        </div>
                      </div>

                      <div
                        onClick={() => setActiveView('offline')}
                        className="group flex items-center justify-between bg-white/[0.06] hover:bg-white/[0.12] rounded-lg overflow-hidden cursor-pointer transition-all pr-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-500 to-yellow-800 flex items-center justify-center shrink-0">
                            <Download className="w-5 h-5 text-black stroke-[2.3]" />
                          </div>
                          <span className="font-bold text-xs sm:text-[13px] text-white truncate">
                            Audio Offline ({offlineTracks.length})
                          </span>
                        </div>
                      </div>

                      {CURATED_MIXES.map((mix) => (
                        <div
                          key={mix.id}
                          onClick={() => {
                            if (mix.mode !== sourceMode) setSourceMode(mix.mode);
                            fetchTracks(mix.query, mix.mode, mix.title, false, true);
                          }}
                          className="group flex items-center justify-between bg-white/[0.06] hover:bg-white/[0.12] rounded-lg overflow-hidden cursor-pointer transition-all pr-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={mix.cover}
                              alt={mix.title}
                              className="w-12 h-12 sm:w-14 sm:h-14 object-cover shrink-0"
                            />
                            <span className="font-bold text-xs sm:text-[13px] text-white truncate">
                              {mix.title}
                            </span>
                          </div>
                          <div
                            className={`w-8 h-8 rounded-full hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all shadow-lg shrink-0 ${accentBg}`}
                          >
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* === VIEW: ARTIST / CREATOR PROFILE === */}
            {activeView === 'artist' && activeArtist && (() => {
              const details = getArtistDetails(activeArtist);
              const artistAvatar =
                activeArtist === 'Febri remix'
                  ? '/febri-dove.png'
                  : tracks[0]?.cover || currentTrack?.cover || '/febri-dove.png';
              return (
                <div className="space-y-6 pt-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setActiveView('discover')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-300 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Kembali ke Beranda</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                        PROFIL CREATOR RESMI
                      </span>
                    </div>
                  </div>

                  {/* Hero Banner */}
                  <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-black p-6 sm:p-8 border border-white/[0.08] shadow-2xl">
                    <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 relative z-10">
                      <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden shadow-2xl border-2 border-emerald-400/50 shrink-0 bg-zinc-900 group">
                        <img
                          src={artistAvatar}
                          alt={activeArtist}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Artis Terverifikasi</span>
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight truncate">
                          {activeArtist}
                        </h1>
                        <p className="text-xs sm:text-sm text-zinc-300 font-mono">
                          {details.listeners} pendengar bulanan • Peringkat #{details.rank} di Indonesia
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-white/10 relative z-10">
                      <button
                        onClick={() => {
                          if (tracks.length > 0) playTrack(tracks[0]);
                        }}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm shadow-lg hover:scale-105 transition-all"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                        <span>Putar Semua Lagu</span>
                      </button>

                      <button
                        onClick={() => toggleFollowArtist(activeArtist)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-full font-bold text-xs border transition-all ${
                          isFollowed(activeArtist)
                            ? 'bg-white/15 border-emerald-400 text-emerald-300'
                            : 'border-zinc-700 text-white hover:border-white'
                        }`}
                      >
                        {isFollowed(activeArtist) ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Mengikuti</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>Ikuti Creator</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          const nextMode = sourceMode === 'spotify' ? 'ytmusic' : 'spotify';
                          setSourceMode(nextMode);
                          fetchTracks(activeArtist, nextMode, `Koleksi Artis: ${activeArtist}`);
                        }}
                        className="flex items-center gap-2 px-4 py-3 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-mono font-semibold"
                      >
                        <span>Cari di:</span>
                        <span className={sourceMode === 'spotify' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                          {sourceMode === 'spotify' ? 'YT Music →' : 'Spotify →'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* About the Artist Card matching Image 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                        <Info className="w-4 h-4 text-emerald-400" />
                        <span>Tentang {activeArtist}</span>
                      </h3>
                      <p className="text-xs sm:text-[13px] text-zinc-300 leading-relaxed">
                        {details.bio}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {details.genres.map((g, idx) => (
                          <span key={idx} className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300">
                            #{g}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2.5">
                      <h4 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wide">Kota Pendengar Terbanyak</h4>
                      <div className="space-y-2 text-xs">
                        {details.cities.map((c, i) => (
                          <div key={i} className="flex items-center justify-between text-zinc-300 font-mono">
                            <span>{c.city}</span>
                            <span className="text-zinc-500">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* === COLLECTION HEADER FOR LIKED / OFFLINE === */}
            {(activeView === 'liked' || activeView === 'offline') && (
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 pt-2">
                <div
                  className={`w-36 h-36 sm:w-44 sm:h-44 rounded-2xl shadow-2xl flex items-center justify-center shrink-0 ${
                    activeView === 'liked'
                      ? 'bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-400'
                      : 'bg-gradient-to-br from-amber-400 via-amber-600 to-stone-900'
                  }`}
                >
                  {activeView === 'liked' ? (
                    <Heart className="w-16 h-16 text-white fill-white" />
                  ) : (
                    <Download className="w-16 h-16 text-black stroke-[2.2]" />
                  )}
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                    {activeView === 'liked' ? 'Koleksi Pribadi' : 'Penyimpanan Perangkat • Tanpa Kuota'}
                  </span>
                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                    {activeView === 'liked' ? 'Lagu Disukai' : 'Audio Offline'}
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400">
                    {activeView === 'liked'
                      ? `${likedTracks.length} lagu tersimpan • Otomatis tersinkron ke Spotify Wrapped`
                      : `${offlineTracks.length} file audio tersimpan dan siap diputar tanpa internet`}
                  </p>
                </div>
              </div>
            )}

            {/* === VIEW: SPOTIFY WRAPPED 2026 BRIDGE === */}
            {activeView === 'wrapped' && (
              <div className="space-y-6 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                      <SpotifyIcon className="w-3.5 h-3.5" />
                      <span>DUAL-MODE SCROBBLER BRIDGE</span>
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                      Spotify Wrapped Sync
                    </h1>
                    <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
                      Dengar lagu online atau file lokal. Kualitas stream online tidak diverifikasi, dan setiap pemutaran dicocokkan untuk log Spotify Wrapped.
                    </p>
                  </div>
                  <button
                    onClick={() => setWrappedSyncEnabled(!wrappedSyncEnabled)}
                    className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-all ${
                      wrappedSyncEnabled
                        ? 'bg-[#1DB954] text-black'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {wrappedSyncEnabled ? '● Auto-Sync Aktif' : 'Auto-Sync Nonaktif'}
                  </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                    <p className="text-xs text-zinc-400">Total Durasi Tercatat</p>
                    <p className="text-2xl font-extrabold text-white mt-1 font-mono">
                      {totalWrappedMinutes} <span className="text-xs font-sans text-emerald-400">menit</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                    <p className="text-xs text-zinc-400">Lagu Disinkronkan Sesi Ini</p>
                    <p className="text-2xl font-extrabold text-white mt-1 font-mono">
                      {wrappedLogs.length} <span className="text-xs font-sans text-zinc-400">lagu</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                    <p className="text-xs text-zinc-400">Mode Bridge</p>
                    <p className="text-sm font-bold text-emerald-400 mt-2">
                      Spotify + YT Music + Offline
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ==================== TRACK TABLE / CONTENT BODY ==================== */}
          <div className="px-4 sm:px-7 py-2">
            {activeView === 'wrapped' ? (
              <div className="space-y-5">
                {/* Official 1-Click Spotify OAuth 2.0 PKCE Login Card */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-4">
                  {spotifyAccount.connected ? (
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        {spotifyAccount.user?.avatar ? (
                          <img
                            src={spotifyAccount.user.avatar}
                            alt=""
                            className="w-14 h-14 rounded-full object-cover border-2 border-[#1DB954]"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-[#1DB954] text-black flex items-center justify-center font-black text-xl">
                            {(spotifyAccount.user?.displayName || 'S')[0]}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-extrabold text-white">
                              {spotifyAccount.user?.displayName}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                              {spotifyAccount.user?.product || 'Connected'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            ✓ Playlist Spotify kamu sudah muncul di Sidebar Kiri & Wrapped Sync aktif otomatis!
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          await apiLogoutSpotify();
                          refreshSpotifyConnection();
                        }}
                        className="px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300"
                      >
                        Putuskan Akun
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                            <SpotifyIcon className="w-4 h-4 text-[#1DB954]" />
                            <span>Cara Connect Akun Spotify Kamu (1-Klik Resmi OAuth PKCE)</span>
                          </h3>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Tanpa password & aman 100% langsung lewat halaman login resmi Spotify:
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-black/50 border border-white/[0.06] space-y-1">
                          <span className="text-[10px] font-mono font-bold text-emerald-400">LANGKAH 1</span>
                          <p className="text-zinc-300 leading-relaxed">
                            Buka{' '}
                            <a
                              href="https://developer.spotify.com/dashboard"
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#1DB954] underline font-bold"
                            >
                              developer.spotify.com/dashboard
                            </a>{' '}
                            lalu klik tombol <b>Create App</b>.
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-black/50 border border-white/[0.06] space-y-1.5">
                          <span className="text-[10px] font-mono font-bold text-emerald-400">LANGKAH 2</span>
                          <p className="text-zinc-300">
                            Isi kolom <b>Redirect URIs</b> dengan alamat ini:
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                spotifyAccount.redirectUri || 'http://127.0.0.1:3001/api/spotify/callback'
                              );
                              setCopiedRedirect(true);
                              setTimeout(() => setCopiedRedirect(false), 2000);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 font-mono text-[10px] text-amber-300 flex items-center justify-between"
                          >
                            <span className="truncate">http://127.0.0.1:3001/api/spotify/callback</span>
                            <span className="text-white font-sans font-bold ml-1 shrink-0">
                              {copiedRedirect ? 'Copied!' : 'Copy'}
                            </span>
                          </button>
                        </div>

                        <div className="p-3 rounded-xl bg-black/50 border border-white/[0.06] space-y-1">
                          <span className="text-[10px] font-mono font-bold text-emerald-400">LANGKAH 3</span>
                          <p className="text-zinc-300 leading-relaxed">
                            Centang <b>Web API</b>, klik <b>Save</b>, lalu salin <b>Client ID</b> kamu ke kolom di bawah ini.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                        <input
                          type="text"
                          value={spotifyClientId}
                          onChange={(e) => setSpotifyClientId(e.target.value)}
                          placeholder="Paste Spotify Client ID di sini (contoh: 4b8f9c2d1e...)"
                          className="flex-1 px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white font-mono focus:outline-none focus:border-[#1DB954]"
                        />
                        <button
                          onClick={handleSpotifyOAuthLogin}
                          className="px-6 py-2.5 rounded-xl bg-[#1DB954] hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shrink-0"
                        >
                          <SpotifyIcon className="w-4 h-4" />
                          <span>Login dengan Spotify</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Live Sync Log List */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Riwayat Sinkronisasi Real-Time
                  </h3>
                  {wrappedLogs.length === 0 ? (
                    <div className="py-10 text-center text-xs text-zinc-500">
                      Putar lagu apa saja di mode Spotify atau YT Music untuk melihat log sinkronisasi Wrapped secara langsung.
                    </div>
                  ) : (
                    wrappedLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {log.cover ? (
                            <img src={log.cover} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                              <SpotifyIcon className="w-4 h-4 text-[#1DB954]" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-white truncate">{log.title}</p>
                            <p className="text-xs text-zinc-400 truncate">
                              {log.artist} • <span className="text-zinc-300">{log.playedVia}</span>
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold shrink-0">
                          ✓ Tercatat
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Section Title & Play All Action */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {activeDisplayedTracks.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => playTrack(activeDisplayedTracks[0])}
                          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all ${accentBg}`}
                          title="Putar Urut"
                        >
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </button>
                        {activeView === 'discover' && (
                          <button
                            onClick={startRadioFromSearch}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 transition-all hover:scale-105 active:scale-95 shadow-md"
                            title="Acak & mulai Radio 50 lagu serupa hasil pencarian ini"
                          >
                            <Shuffle className="w-3.5 h-3.5" />
                            <span>Acak Radio</span>
                          </button>
                        )}
                      </div>
                    )}
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white font-mono">
                        {activeView === 'discover'
                          ? activeFeedTitle
                          : activeView === 'liked'
                          ? 'Daftar Lagu Disukai'
                          : activeView === 'offline'
                          ? 'File audio tersimpan'
                          : activeView === 'artist'
                          ? `Daftar Lagu Populer: ${activeArtist}`
                          : 'Koleksi Lagu'}
                      </h2>
                      <p className="text-xs text-zinc-500 font-mono">
                        Full-length stream • kualitas sumber mengikuti penyedia audio
                      </p>
                    </div>
                  </div>

                  {/* Quick Artist Filter Pills on Discover */}
                  {activeView === 'discover' && (
                    <div className="hidden xl:flex items-center gap-1.5">
                      {['Febri remix', 'Tulus', 'Mahalini', 'Bernadya', 'Hindia', 'The Weeknd', 'Sufjan Stevens'].map((art) => (
                        <button
                          key={art}
                          onClick={() => openArtistView(art)}
                          className="px-3 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono font-medium text-zinc-300 hover:text-emerald-400 transition-all cursor-pointer"
                        >
                          {art}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Professional Spotify-Style Track Table Header */}
                <div className="grid grid-cols-[32px_1fr_auto] md:grid-cols-[36px_1.6fr_1fr_110px] items-center px-3 py-2 border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <span className="text-center">#</span>
                  <span>Judul</span>
                  <span className="hidden md:block">Album</span>
                  <span className="text-right pr-2">Durasi</span>
                </div>

                {/* Track Rows */}
                {isLoading && activeView === 'discover' ? (
                  <div className="space-y-1.5 pt-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div
                        key={i}
                        className="h-14 rounded-xl bg-white/[0.03] animate-pulse"
                      />
                    ))}
                  </div>
                ) : activeDisplayedTracks.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <p className="text-sm font-semibold text-zinc-300">Belum ada lagu di daftar ini</p>
                    <p className="text-xs text-zinc-500">
                      {activeView === 'offline'
                        ? 'File audio tersimpan untuk diputar offline. Konversi FLAC tidak menambah kualitas yang tidak ada di sumber.'
                        : 'Klik ikon Hati pada lagu favoritmu untuk menyimpannya ke koleksi ini.'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.02] pt-1">
                    {activeDisplayedTracks.map((track, idx) => {
                      const isCurrent = currentTrack?.id === track.id;
                      const liked = isLiked(track.id);
                      const savedOffline = isOffline(track.id);
                      const dlPct = downloadingIds[track.id];

                      return (
                        <div
                          key={track.id}
                          onMouseEnter={() => handleTrackRowEnter(track)}
                          onMouseLeave={handleTrackRowLeave}
                          onPointerDown={() => handleTrackRowEnter(track)}
                          onClick={() => playTrack(track)}
                          className={`group grid grid-cols-[32px_1fr_auto] md:grid-cols-[36px_1.6fr_1fr_110px] items-center px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                            isCurrent ? 'bg-white/[0.09]' : 'hover:bg-white/[0.05]'
                          }`}
                        >
                          {/* # or Animated Equalizer */}
                          <div className="flex items-center justify-center text-xs font-mono text-zinc-500">
                            {isCurrent && isPlaying ? (
                              <PlayingBars
                                colorClass={sourceMode === 'spotify' ? 'bg-[#1DB954]' : 'bg-[#FF0033]'}
                              />
                            ) : (
                              <>
                                <span className={`group-hover:hidden ${isCurrent ? accentText : ''}`}>
                                  {idx + 1}
                                </span>
                                <Play className="w-3.5 h-3.5 text-white fill-white hidden group-hover:block" />
                              </>
                            )}
                          </div>

                          {/* Cover + Title + Artist + Subtle Lossless Tag */}
                          <div className="flex items-center gap-3 min-w-0 pr-3">
                            <img
                              src={track.cover}
                              alt={track.title}
                              className="w-10 h-10 rounded-md object-cover bg-zinc-800 shrink-0"
                            />
                            <div className="min-w-0">
                              <p
                                className={`text-[13.5px] font-semibold truncate ${
                                  isCurrent ? accentText : 'text-white'
                                }`}
                              >
                                {track.title}
                              </p>
                              <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                                {track.isLocalLossless ? (
                                  <span className="inline-flex items-center gap-0.5 px-1 py-[1px] rounded bg-amber-400/20 text-amber-300 text-[9px] font-mono font-bold shrink-0 border border-amber-400/30">
                                    {track.localFormat} LOSSLESS
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1 py-[1px] rounded bg-white/10 text-zinc-400 text-[9px] font-mono shrink-0">
                                    HQ 160k
                                  </span>
                                )}
                                {savedOffline && (
                                  <span className="inline-flex items-center px-1 py-[1px] rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold shrink-0">
                                    OFFLINE
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openArtistView(track.artist);
                                  }}
                                  className="truncate hover:underline hover:text-emerald-400 text-left transition-colors cursor-pointer block font-medium"
                                  title={`Lihat creator ${track.artist}`}
                                >
                                  {track.artist}
                                </button>
                              </div>
                              {track.lyricMatch?.matched && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[11px] font-medium max-w-full truncate">
                                    <Mic2 className="w-3 h-3 text-[#1DB954] shrink-0" />
                                    <span className="truncate">
                                      Lirik cocok: &ldquo;{track.lyricMatch.line}&rdquo;
                                    </span>
                                  </span>
                                  {track.lyricMatch.time != null && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        playTrack(track, track.lyricMatch.time);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono font-bold transition-colors shrink-0"
                                      title="Langsung putar pada detik lirik ini dinyanyikan"
                                    >
                                      <Play className="w-2.5 h-2.5 fill-current" />
                                      <span>Putar di {formatTime(track.lyricMatch.time)}</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Album */}
                          <div className="hidden md:block text-xs text-zinc-400 truncate pr-4">
                            {track.album}
                          </div>

                          {/* Actions (Radio + Heart + FLAC Download/Delete) + Duration */}
                          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                            {/* Start Song Radio */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startSongRadio(track);
                              }}
                              title="Mulai Radio Lagu Ini (putar 50 lagu serupa)"
                              className="p-1.5 rounded-full text-zinc-400 hover:text-emerald-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:scale-110"
                            >
                              <Radio className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => toggleLike(track, e)}
                              title="Simpan ke Lagu Disukai"
                              className={`p-1.5 rounded-full transition-opacity ${
                                liked
                                  ? 'text-[#1DB954] opacity-100'
                                  : 'text-zinc-400 hover:text-white sm:opacity-0 sm:group-hover:opacity-100'
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                            </button>

                            {activeView === 'offline' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteOfflineTrack(track.id).then(loadOfflineLibrary);
                                }}
                                title="Hapus file Offline"
                                className="p-1.5 rounded-full text-zinc-400 hover:text-rose-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : dlPct !== undefined ? (
                              <span className="text-[10px] font-mono text-amber-300 w-7 text-center">
                                {dlPct}%
                              </span>
                            ) : (
                              <button
                                onClick={(e) => handleDownloadOffline(track, true, e)}
                                title={
                                  savedOffline
                                    ? 'Tersimpan offline (klik untuk ekspor ulang)'
                                    : 'Simpan audio untuk offline'
                                }
                                className={`p-1.5 rounded-full transition-opacity ${
                                  savedOffline
                                    ? 'text-amber-400 opacity-100'
                                    : 'text-zinc-400 hover:text-amber-300 sm:opacity-0 sm:group-hover:opacity-100'
                                }`}
                              >
                                {savedOffline ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </button>
                            )}

                            <span className="text-xs font-mono text-zinc-500 w-10 text-right">
                              {formatTime(track.duration)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* ---------- RIGHT ISLAND: NOW PLAYING / LIVE LYRICS / DAC EQ ---------- */}
        {showRightPanel && (
          <aside className="hidden xl:flex flex-col w-[325px] bg-[#121214] rounded-2xl border border-white/[0.05] overflow-hidden shrink-0">
            {/* Panel Switcher */}
            <div className="p-3 border-b border-white/[0.05] flex items-center justify-between gap-1">
              <div className="flex items-center bg-black/50 p-0.5 rounded-xl flex-1">
                {[
                  { id: 'playing', label: 'Playing' },
                  { id: 'lyrics', label: 'Lirik' },
                  { id: 'eq', label: 'DAC / EQ' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setRightTab(tab.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      rightTab === tab.id
                        ? 'bg-zinc-800 text-white shadow'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowRightPanel(false)}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg"
                title="Tutup panel kanan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* SUB-TAB 1: NOW PLAYING & SIGNAL PATH */}
              {rightTab === 'playing' && currentTrack && (
                <>
                  <div className="relative group rounded-2xl overflow-hidden shadow-2xl bg-zinc-900 aspect-square">
                    <img
                      src={currentTrack.cover}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base text-white leading-snug line-clamp-2">
                        {currentTrack.title}
                      </h3>
                      <button
                        onClick={() => openArtistView(currentTrack.artist)}
                        className="group/artist flex items-center gap-1.5 text-sm font-semibold text-zinc-300 hover:text-emerald-400 hover:underline mt-0.5 truncate text-left transition-colors cursor-pointer"
                        title={`Buka profil creator ${currentTrack.artist}`}
                      >
                        <span className="truncate">{currentTrack.artist}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          ARTIST
                        </span>
                      </button>
                    </div>
                    <button
                      onClick={() => toggleLike(currentTrack)}
                      className={`p-1.5 rounded-full shrink-0 ${
                        isLiked(currentTrack.id) ? 'text-[#1DB954]' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${isLiked(currentTrack.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Transparent Audio Signal Path Card */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Activity className="w-4 h-3.5 text-amber-400" />
                        <span>Audio Signal Path</span>
                      </span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        currentTrack?.isLocalLossless
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-white/10 text-zinc-400'
                      }`}>
                        {currentTrack?.isLocalLossless ? 'BIT-PERFECT LOSSLESS' : 'HQ STREAM (OPUS)'}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Source Audio</span>
                        <span className="text-zinc-200 font-medium font-mono text-[11px]">
                          {currentTrack?.isLocalLossless ? `${currentTrack.localFormat} (Asli Bit-Perfect)` : 'YouTube Web Audio (~160kbps)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>DSP Equalizer</span>
                        <span className="text-amber-300 font-mono text-[11px]">
                          {currentTrack?.isLocalLossless
                            ? 'Bypass (Pure Audio)'
                            : isEqEnabled
                            ? `Active (${activePreset})`
                            : 'Bypass (Flat)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Output Engine</span>
                        <span className="text-zinc-300 font-mono text-[11px]">Web Audio API</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Spotify Wrapped</span>
                        <span className="text-emerald-400 font-medium">✓ Auto-Scrobbled</span>
                      </div>
                    </div>
                  </div>

                  {/* Image 2 Matching "About the artist" Card */}
                  <div
                    onClick={() => openArtistView(currentTrack.artist)}
                    className="relative group rounded-xl overflow-hidden border border-white/[0.08] hover:border-emerald-500/50 transition-all cursor-pointer shadow-lg"
                  >
                    <div
                      className="h-28 bg-cover bg-center relative"
                      style={{
                        backgroundImage: `url(${currentTrack.cover})`
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-[#181926] via-[#181926]/75 to-transparent" />
                      <div className="absolute top-2.5 left-3 text-[11px] font-mono font-bold text-white/90 uppercase tracking-wider">
                        About the artist
                      </div>
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate group-hover:text-emerald-400 transition-colors">
                            {currentTrack.artist}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-mono">Artis Terverifikasi</p>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-1 rounded bg-white/20 text-white backdrop-blur-sm group-hover:bg-emerald-500 group-hover:text-black transition-colors font-bold shrink-0">
                          Buka Profil →
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Up Next Queue */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-300">Berikutnya di Antrean</span>
                      <button
                        onClick={() => setIsAutoRadio(!isAutoRadio)}
                        title="Otomatis merekomendasikan lagu baru saat antrean habis"
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                          isAutoRadio
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                            : 'border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {isAutoRadio ? '📻 Auto-Radio ON' : 'Radio OFF'}
                      </button>
                    </div>
                    {isExtendingQueue && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-300 text-xs font-mono">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mencari rekomendasi lagu populer baru...</span>
                      </div>
                    )}
                    {activeDisplayedTracks
                      .slice(
                        Math.max(0, activeDisplayedTracks.findIndex((t) => t.id === currentTrack.id) + 1),
                        Math.max(0, activeDisplayedTracks.findIndex((t) => t.id === currentTrack.id) + 4)
                      )
                      .map((nextTrack) => (
                        <div
                          key={nextTrack.id}
                          onMouseEnter={() => handleTrackRowEnter(nextTrack)}
                          onMouseLeave={handleTrackRowLeave}
                          onPointerDown={() => handleTrackRowEnter(nextTrack)}
                          onClick={() => playTrack(nextTrack)}
                          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.05] cursor-pointer transition-colors"
                        >
                          <img
                            src={nextTrack.cover}
                            alt=""
                            className="w-9 h-9 rounded-md object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-zinc-200 truncate">
                              {nextTrack.title}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openArtistView(nextTrack.artist);
                              }}
                              className="text-[11px] text-zinc-500 hover:text-emerald-400 hover:underline truncate text-left cursor-pointer transition-colors block"
                            >
                              {nextTrack.artist}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}

              {/* SUB-TAB 2: LIVE TIME-SYNCED KARAOKE LYRICS */}
              {rightTab === 'lyrics' && (
                <div className="space-y-3 py-2">
                  {lyricsData.loading ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-xs">Memuat lirik sinkron...</span>
                    </div>
                  ) : !lyricsData.found ? (
                    <div className="py-16 text-center space-y-1">
                      <Mic2 className="w-7 h-7 text-zinc-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-zinc-400">Lirik belum tersedia</p>
                      <p className="text-[11px] text-zinc-600">Putar lagu lain untuk lirik karaoke otomatis.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5 pb-12">
                      {lyricsData.lines.map((line, i) => {
                        const isActive = i === activeLyricIndex;
                        const isPast = i < activeLyricIndex;
                        return (
                          <p
                            key={i}
                            ref={isActive ? activeLyricRef : null}
                            onClick={() => {
                              if (audioRef.current) {
                                audioRef.current.currentTime = line.time;
                                setProgress(line.time);
                              }
                            }}
                            className={`cursor-pointer transition-all duration-300 leading-relaxed ${
                              isActive
                                ? 'text-white font-extrabold text-[17px] scale-[1.01]'
                                : isPast
                                ? 'text-zinc-600 font-semibold text-sm hover:text-zinc-300'
                                : 'text-zinc-400/80 font-semibold text-sm hover:text-zinc-200'
                            }`}
                          >
                            {line.text}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 3: 5-BAND PARAMETRIC EQ */}
              {rightTab === 'eq' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                    <div>
                      <p className="text-xs font-bold text-amber-300">Equalizer audio</p>
                      <p className="text-[11px] text-zinc-400">EQ mengubah sinyal yang diputar</p>
                    </div>
                    <button
                      onClick={() => {
                        const next = !isEqEnabled;
                        setIsEqEnabled(next);
                        dspEngine.setEqEnabled(currentTrack?.isLocalLossless ? false : next);
                      }}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                        isEqEnabled ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isEqEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Real-time Spectrum Analyzer */}
                  <div className="h-20 bg-black/60 rounded-xl p-2.5 border border-white/[0.05] flex items-end justify-between gap-[3px]">
                    {spectrumBars.map((h, i) => (
                      <div
                        key={i}
                        style={{ height: `${isPlaying ? h : 10}%` }}
                        className={`flex-1 rounded-t-sm transition-all duration-75 ${
                          sourceMode === 'spotify'
                            ? 'bg-gradient-to-t from-emerald-600 to-amber-300'
                            : 'bg-gradient-to-t from-rose-600 to-amber-300'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Acoustic Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-zinc-400">Preset Akustik</span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(EQ_PRESETS).map((preset) => (
                        <button
                          key={preset}
                          onClick={() => applyPreset(preset)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            activePreset === preset
                              ? 'bg-white text-black font-bold'
                              : 'bg-white/[0.05] text-zinc-300 hover:bg-white/[0.1]'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5-Band Sliders */}
                  <div className="space-y-3 pt-1">
                    {['60Hz Sub-Bass', '230Hz Warmth', '910Hz Vocal Mid', '3.6kHz Presence', '14kHz Treble Air'].map(
                      (bandLabel, idx) => (
                        <div key={bandLabel} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-300 font-medium">{bandLabel}</span>
                            <span className="font-mono text-amber-300">
                              {eqGains[idx] > 0 ? `+${eqGains[idx]}` : eqGains[idx]} dB
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-6"
                            max="6"
                            step="0.5"
                            value={eqGains[idx]}
                            onChange={(e) => handleEqSlider(idx, e.target.value)}
                            className="w-full aura-slider"
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ==================== BOTTOM PLAYER CONTROLLER ==================== */}
      <footer
        className={`h-[78px] px-3 sm:px-4 flex items-center justify-between gap-4 shrink-0 border-t ${
          uiTheme === 'pixel'
            ? 'bg-[#181926] border-[#2f334d] font-mono'
            : 'bg-black border-white/[0.06]'
        } sm:border-none z-30 transition-colors`}
      >
        {/* Left: Now Playing Info (Tap to open Fullscreen Player on Mobile!) */}
        <div
          onClick={() => {
            if (window.innerWidth < 1280) setIsFullscreenPlayer(true);
          }}
          className="flex items-center gap-3 min-w-0 flex-1 max-w-[30%] cursor-pointer xl:cursor-default"
        >
          {currentTrack && (
            <>
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-900 shrink-0 group">
                <img
                  src={currentTrack.cover}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFullscreenPlayer(true);
                  }}
                  className="hidden sm:flex absolute inset-0 bg-black/50 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Layar Penuh"
                >
                  <Maximize2 className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-white truncate">{currentTrack.title}</p>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openArtistView(currentTrack.artist);
                    }}
                    className="truncate hover:underline hover:text-emerald-400 text-left transition-colors cursor-pointer font-medium"
                    title={`Buka creator ${currentTrack.artist}`}
                  >
                    {currentTrack.artist}
                  </button>
                  {currentTrack.isLocalLossless ? (
                    <span className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold shrink-0 border border-amber-400/30">
                      {currentTrack.localFormat} LOSSLESS
                    </span>
                  ) : (
                    <span className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 font-medium shrink-0">
                      HQ 160k
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => toggleLike(currentTrack, e)}
                className={`hidden sm:block p-1.5 shrink-0 ${
                  isLiked(currentTrack.id) ? 'text-[#1DB954]' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked(currentTrack.id) ? 'fill-current' : ''}`} />
              </button>
            </>
          )}
        </div>

        {/* Center: Transport Controls + Precision Seek Bar */}
        <div className="flex flex-col items-center justify-center flex-1 max-w-xl gap-1.5">
          <div className="flex items-center gap-4 sm:gap-5">
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              className={`hidden sm:block transition-colors ${
                isShuffle ? accentText : 'text-zinc-400 hover:text-white'
              }`}
              title="Acak"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button onClick={playPrev} className="text-zinc-300 hover:text-white transition-colors">
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md"
            >
              {isBuffering ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button onClick={playNext} className="text-zinc-300 hover:text-white transition-colors">
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={() => setIsRepeat(!isRepeat)}
              className={`hidden sm:block transition-colors ${
                isRepeat ? accentText : 'text-zinc-400 hover:text-white'
              }`}
              title="Ulangi Lagu"
            >
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          {/* Seek Bar with Timestamps (matching Image 2 in Pixel mode!) */}
          <div className="w-full hidden sm:flex items-center gap-2.5 text-[11px] font-mono text-zinc-500">
            <span className="w-8 text-right font-mono">{formatTime(progress)}</span>
            <div
              onClick={(e) => {
                if (!audioRef.current) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const seekTo = ratio * (duration || 1);
                audioRef.current.currentTime = seekTo;
                setProgress(seekTo);
              }}
              className="group flex-1 h-1 hover:h-1.5 bg-zinc-800 rounded-full cursor-pointer relative transition-all"
            >
              <div
                style={{ width: `${Math.min(100, (progress / (duration || 1)) * 100)}%` }}
                className={`h-full rounded-full relative ${
                  uiTheme === 'pixel' ? 'bg-[#73daca]' : accentBar
                }`}
              >
                <span className="w-3 h-3 rounded-full bg-white shadow absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <span className={`w-10 text-left font-mono ${uiTheme === 'pixel' ? 'text-[#7aa2f7]' : ''}`}>
              {uiTheme === 'pixel'
                ? `-${formatTime(Math.max(0, duration - progress))}`
                : formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Lyrics, DAC/EQ, Offline Audio Download, Volume & Fullscreen */}
        <div className="hidden md:flex items-center justify-end gap-2.5 flex-1 max-w-[30%]">
          <button
            onClick={() => {
              setShowRightPanel(true);
              setRightTab('lyrics');
            }}
            title="Lirik Live"
            className={`p-1.5 rounded-lg transition-colors ${
              showRightPanel && rightTab === 'lyrics' ? accentText : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Mic2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setShowRightPanel(true);
              setRightTab('eq');
            }}
            title="Equalizer audio"
            className={`p-1.5 rounded-lg transition-colors ${
              showRightPanel && rightTab === 'eq' ? 'text-amber-400' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
          </button>

          {currentTrack && (
            <button
              onClick={() => handleDownloadOffline(currentTrack, true)}
              title="Simpan audio untuk offline"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 transition-colors"
            >
              {downloadingIds[currentTrack.id] !== undefined ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Volume Control */}
          <div className="flex items-center gap-1.5 w-24">
            <button
              onClick={() => {
                const nextMute = !isMuted;
                setIsMuted(nextMute);
                if (audioRef.current) audioRef.current.volume = nextMute ? 0 : volume;
              }}
              className="text-zinc-400 hover:text-white"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                setIsMuted(v === 0);
                if (audioRef.current) audioRef.current.volume = v;
              }}
              className="w-full aura-slider"
            />
          </div>

          <button
            onClick={() => setIsFullscreenPlayer(true)}
            title="Mode Imersif Layar Penuh"
            className="p-1.5 text-zinc-400 hover:text-white"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* ==================== MOBILE NATIVE BOTTOM TAB BAR ==================== */}
      <nav className="flex lg:hidden items-center justify-around bg-zinc-950/95 backdrop-blur-xl border-t border-white/[0.06] py-2 shrink-0 z-30">
        {[
          { id: 'discover', label: 'Beranda', icon: Disc3, action: () => setActiveView('discover') },
          { id: 'liked', label: 'Disukai', icon: Heart, action: () => setActiveView('liked') },
          { id: 'offline', label: 'Offline', icon: Download, action: () => setActiveView('offline') },
          { id: 'wrapped', label: 'Wrapped', icon: Activity, action: () => setActiveView('wrapped') },
          { id: 'player', label: 'Lirik & EQ', icon: Sliders, action: () => setIsFullscreenPlayer(true) }
        ].map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
                active ? 'text-white' : 'text-zinc-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ==================== IMMERSIVE FULLSCREEN NOW PLAYING (APPLE MUSIC / SPOTIFY PRO STYLE) ==================== */}
      {isFullscreenPlayer && currentTrack && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-hidden">
          {/* Dynamic Blurred Album Cover Backdrop */}
          <img
            src={currentTrack.cover}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-150 blur-3xl opacity-35 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/65 to-black/90 pointer-events-none" />

          {/* Top Bar */}
          <div className="relative z-10 flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setIsFullscreenPlayer(false)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold backdrop-blur-md"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Tutup</span>
            </button>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${
                currentTrack.isLocalLossless
                  ? 'bg-amber-400/15 border-amber-400/30 text-amber-300'
                  : 'bg-white/10 border-white/10 text-zinc-300'
              }`}>
                {currentTrack.isLocalLossless ? `${currentTrack.localFormat} BIT-PERFECT LOSSLESS` : 'HQ STREAM • OPUS ~160KBPS'}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                ✓ Wrapped Synced
              </span>
            </div>
          </div>

          {/* Main Split: Artwork + Controls on Left, Live Karaoke Lyrics on Right */}
          <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center px-6 sm:px-14 pb-8 overflow-y-auto">
            <div className="flex flex-col items-center lg:items-start max-w-md mx-auto w-full space-y-6">
              <img
                src={currentTrack.cover}
                alt={currentTrack.title}
                className="w-64 h-64 sm:w-80 sm:h-80 rounded-3xl object-cover shadow-[0_25px_70px_rgba(0,0,0,0.75)] border border-white/10"
              />

              <div className="w-full flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white truncate">
                    {currentTrack.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFullscreenPlayer(false);
                      openArtistView(currentTrack.artist);
                    }}
                    className="text-sm sm:text-base text-zinc-300 hover:text-emerald-400 hover:underline truncate cursor-pointer transition-colors text-left font-medium block"
                    title={`Buka creator ${currentTrack.artist}`}
                  >
                    {currentTrack.artist}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleLike(currentTrack)}
                    className={`p-2.5 rounded-full bg-white/10 ${
                      isLiked(currentTrack.id) ? 'text-[#1DB954]' : 'text-white'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isLiked(currentTrack.id) ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleDownloadOffline(currentTrack, true)}
                    className="p-2.5 rounded-full bg-white/10 text-amber-300"
                    title="Simpan audio untuk offline"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Fullscreen Scrubber */}
              <div className="w-full space-y-1.5">
                <div
                  onClick={(e) => {
                    if (!audioRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    audioRef.current.currentTime = ratio * (duration || 1);
                  }}
                  className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer overflow-hidden"
                >
                  <div
                    style={{ width: `${Math.min(100, (progress / (duration || 1)) * 100)}%` }}
                    className="h-full bg-white rounded-full"
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-zinc-400">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Fullscreen Transport */}
              <div className="w-full flex items-center justify-center gap-8">
                <button onClick={playPrev} className="text-white/80 hover:text-white">
                  <SkipBack className="w-7 h-7 fill-current" />
                </button>
                <button
                  onClick={togglePlayPause}
                  className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 transition-transform"
                >
                  {isBuffering ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-7 h-7 fill-current" />
                  ) : (
                    <Play className="w-7 h-7 fill-current ml-1" />
                  )}
                </button>
                <button onClick={playNext} className="text-white/80 hover:text-white">
                  <SkipForward className="w-7 h-7 fill-current" />
                </button>
              </div>
            </div>

            {/* Right Column: Live Karaoke Lyrics */}
            <div className="h-[340px] lg:h-[460px] overflow-y-auto pr-2 space-y-4">
              {lyricsData.found ? (
                lyricsData.lines.map((line, i) => {
                  const isActive = i === activeLyricIndex;
                  return (
                    <p
                      key={i}
                      ref={isActive ? activeLyricRef : null}
                      onClick={() => {
                        if (audioRef.current) audioRef.current.currentTime = line.time;
                      }}
                      className={`cursor-pointer transition-all duration-300 ${
                        isActive
                          ? 'text-2xl sm:text-3xl font-extrabold text-white'
                          : 'text-lg sm:text-xl font-bold text-white/30 hover:text-white/60'
                      }`}
                    >
                      {line.text}
                    </p>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/40 space-y-2">
                  <Mic2 className="w-10 h-10 text-zinc-500" />
                  <p className="text-sm font-semibold">Belum tersedia lirik sinkron / Lagu instrumen</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== INSTALL NATIVE APP MODAL ==================== */}
      {showInstallModal && (
        <div
          onClick={() => setShowInstallModal(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#18181b] border border-white/10 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src="/icon.svg" alt="AURA" className="w-9 h-9 rounded-xl" />
                <div>
                  <h3 className="font-extrabold text-base text-white">Install AURA Music</h3>
                  <p className="text-xs text-zinc-400">Android • iOS • Windows Native App</p>
                </div>
              </div>
              <button onClick={() => setShowInstallModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              {!isNativeApk() && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-emerald-400">File Android APK Resmi (Siap Install)</p>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                      ANDROID 8.0+
                    </span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Unduh langsung file <code>AuraMusic-Studio.apk</code> ke HP Android kamu atau kirim lewat WhatsApp / kabel USB.
                  </p>
                  <a
                    href="/AuraMusic-Studio.apk"
                    download="AuraMusic-Studio.apk"
                    className="w-full py-2.5 rounded-xl bg-[#1DB954] hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Download AuraMusic-Studio.apk</span>
                  </a>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/[0.06] space-y-2">
                <p className="font-bold text-amber-300">Koneksi Studio Server (Full-Track & konversi audio)</p>
                <p className="text-zinc-400 leading-relaxed">
                  Konversi ke FLAC tidak menambah detail yang tidak ada pada sumber audio. Kualitas stream online mengikuti penyedianya.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverUrlInput}
                    onChange={(e) => setServerUrlInput(e.target.value)}
                    placeholder="http://10.150.197.246:3001"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() => {
                      setStudioServerUrl(serverUrlInput);
                      fetchTracks(searchQuery || 'Tulus Mahalini', sourceMode);
                      setShowInstallModal(false);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-black font-bold text-xs"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 rounded-full bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
