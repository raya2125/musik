// IndexedDB Engine for Offline 24-Bit FLAC Storage on Phone & Desktop App
import { getStudioServerUrl } from './apiBridge';

const DB_NAME = 'AuraMusicOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_tracks';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTrackOffline(track, onProgress) {
  const db = await openDB();
  let audioBlob = null;

  try {
    // Preserve imported lossless files byte-for-byte; do not transcode them.
    if (track.isLocalLossless && track.audioBlob) {
      audioBlob = track.audioBlob;
    } else {
      if (onProgress) onProgress(15);
      const params = new URLSearchParams({
        videoId: track.ytVideoId || '',
        url: track.audioUrl || '',
        title: track.title || 'Track',
        artist: track.artist || 'Artist',
        album: track.album || 'Single',
        format: 'FLAC'
      });
      if (onProgress) onProgress(40);
      const base = getStudioServerUrl();
      const res = await fetch(`${base}/api/download-audio?${params.toString()}`);
      if (!res.ok) throw new Error('Download failed');
      if (onProgress) onProgress(75);
      audioBlob = await res.blob();
      if (onProgress) onProgress(95);
    }
  } catch (e) {
    const res = await fetch(track.previewUrl || track.audioUrl);
    audioBlob = await res.blob();
  }

  const realSizeMB = audioBlob?.size ? (audioBlob.size / (1024 * 1024)).toFixed(1) : '0.0';

  const record = {
    ...track,
    downloadedAt: new Date().toISOString(),
    fileSizeMB: realSizeMB,
    audioBlob,
    isOffline: true
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => {
      if (onProgress) onProgress(100);
      resolve(record);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllOfflineTracks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOfflineTrack(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
