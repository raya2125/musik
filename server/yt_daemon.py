import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

import yt_dlp


class SilentLogger:
    def debug(self, msg):
        pass

    def info(self, msg):
        pass

    def warning(self, msg):
        pass

    def error(self, msg):
        pass


CACHE_DIR = os.environ.get(
    "AURA_YT_CACHE_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), ".ytcache"),
)
NODE_BIN = os.environ.get("AURA_NODE_PATH", "")

FORMAT_SELECTOR = (
    "251/ba[acodec=opus][protocol=https]/140/ba[protocol=https]/ba/bestaudio"
)

_thread_local = threading.local()
_write_lock = threading.Lock()


def _base_opts(fast_client=True):
    yt_args = {"player_skip": ["hls", "dash"]}
    if fast_client:
        # visionos requires NO JS player/n-challenge solver, returns itag 251 Opus 48kHz,
        # and has ZERO instream ad sleep lockout (immediate HTTP 206 in <1s)!
        yt_args["player_client"] = ["visionos"]

    opts = {
        "format": FORMAT_SELECTOR,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "logger": SilentLogger(),
        "cachedir": CACHE_DIR,
        "socket_timeout": 10,
        "extractor_args": {"youtube": yt_args},
    }
    if NODE_BIN and os.path.exists(NODE_BIN):
        opts["js_runtimes"] = {"node": {"path": NODE_BIN}}
    return opts


def _get_extractors():
    if not hasattr(_thread_local, "fast_ydl"):
        _thread_local.fast_ydl = yt_dlp.YoutubeDL(_base_opts(fast_client=True))
        _thread_local.fallback_ydl = yt_dlp.YoutubeDL(_base_opts(fast_client=False))
    return _thread_local.fast_ydl, _thread_local.fallback_ydl


def _pick_direct_url(info):
    if not info:
        return None
    if "entries" in info and info["entries"]:
        info = next((e for e in info["entries"] if e), None)
    if not info:
        return None

    url = info.get("url") or ""
    if url.startswith("http") and ".m3u8" not in url:
        return info

    for fmt in reversed(info.get("requested_formats") or info.get("formats") or []):
        f_url = fmt.get("url") or ""
        acodec = fmt.get("acodec") or ""
        if f_url.startswith("http") and ".m3u8" not in f_url and acodec != "none":
            merged = dict(info)
            merged["url"] = f_url
            merged["ext"] = fmt.get("ext") or info.get("ext")
            merged["format_id"] = fmt.get("format_id")
            merged["available_at"] = fmt.get("available_at") or info.get("available_at")
            merged["http_headers"] = fmt.get("http_headers") or info.get("http_headers")
            return merged
    return None


def _handle_request(req):
    req_id = req.get("id")
    target = (req.get("target") or "").strip()
    if not target:
        return {"id": req_id, "ok": False, "error": "empty_target"}

    fast_ydl, fallback_ydl = _get_extractors()
    last_err = "no_stream"

    for ydl in (fast_ydl, fallback_ydl):
        try:
            raw = ydl.extract_info(target, download=False)
            picked = _pick_direct_url(raw)
            if picked and picked.get("url"):
                ext = (picked.get("ext") or "webm").lower()
                mime = (
                    "audio/mp4"
                    if ext in ("m4a", "mp4")
                    else "audio/mpeg"
                    if ext == "mp3"
                    else "audio/webm"
                )
                headers = picked.get("http_headers") or {}
                return {
                    "id": req_id,
                    "ok": True,
                    "url": picked["url"],
                    "videoId": picked.get("id") or "",
                    "itag": picked.get("format_id") or "",
                    "mime": mime,
                    "userAgent": headers.get("User-Agent") or "",
                    "availableAt": picked.get("available_at") or 0,
                }
        except Exception as exc:
            last_err = str(exc)
            continue

    return {"id": req_id, "ok": False, "error": last_err}


def _emit(payload):
    line = json.dumps(payload, separators=(",", ":")) + "\n"
    with _write_lock:
        sys.stdout.write(line)
        sys.stdout.flush()


def main():
    pool = ThreadPoolExecutor(max_workers=4)
    for _ in range(2):
        pool.submit(_get_extractors)
    _emit({"ready": True})

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            req = json.loads(raw_line)
        except Exception:
            continue

        def _task(r=req):
            res = _handle_request(r)
            _emit(res)

        pool.submit(_task)


if __name__ == "__main__":
    main()
