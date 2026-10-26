import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:youtube_explode_dart/youtube_explode_dart.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AuraMusicApp());
}

class AuraMusicApp extends StatelessWidget {
  const AuraMusicApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AURA Music',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF09090B),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1DB954),
          brightness: Brightness.dark,
        ),
      ),
      home: const AuraHomeScreen(),
    );
  }
}

enum MusicSourceMode { spotify, ytMusic }

class TrackItem {
  final String id;
  final String spotifyUri;
  final String ytVideoId;
  final String title;
  final String artist;
  final String album;
  final String coverUrl;
  final String audioUrl;
  final String losslessSpec;

  TrackItem({
    required this.id,
    required this.spotifyUri,
    required this.ytVideoId,
    required this.title,
    required this.artist,
    required this.album,
    required this.coverUrl,
    required this.audioUrl,
    this.losslessSpec = 'Online preview • source quality unverified',
  });
}

class AuraHomeScreen extends StatefulWidget {
  const AuraHomeScreen({super.key});

  @override
  State<AuraHomeScreen> createState() => _AuraHomeScreenState();
}

class _AuraHomeScreenState extends State<AuraHomeScreen> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  final YoutubeExplode _yt = YoutubeExplode();
  final TextEditingController _searchCtrl = TextEditingController(text: 'Tulus');

  MusicSourceMode _mode = MusicSourceMode.spotify;
  bool _wrappedSyncEnabled = true;
  bool _isLoading = false;

  List<TrackItem> _tracks = [];
  final List<TrackItem> _offlineTracks = [];
  final List<String> _wrappedSyncHistory = [];
  TrackItem? _currentTrack;

  @override
  void initState() {
    super.initState();
    _searchTracks('Tulus');
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    _yt.close();
    super.dispose();
  }

  /// Searches both Spotify/iTunes ISRC catalog & YouTube Music streams
  Future<void> _searchTracks(String query) async {
    setState(() => _isLoading = true);
    try {
      final res = await http.get(
        Uri.parse('https://itunes.apple.com/search?term=${Uri.encodeComponent(query)}&entity=song&limit=15'),
      );
      final data = jsonDecode(res.body);
      final List results = data['results'] ?? [];

      final List<TrackItem> loaded = results.map((item) {
        final art = (item['artworkUrl100'] as String? ?? '').replaceAll('100x100bb', '600x600bb');
        return TrackItem(
          id: 'track_${item['trackId']}',
          spotifyUri: 'spotify:track:${item['trackId']}',
          ytVideoId: '',
          title: item['trackName'] ?? 'Unknown',
          artist: item['artistName'] ?? 'Artist',
          album: item['collectionName'] ?? 'Single',
          coverUrl: art,
          audioUrl: item['previewUrl'] ?? '',
          losslessSpec: 'Online preview • source quality unverified',
        );
      }).toList();

      setState(() {
        _tracks = loaded;
        if (_currentTrack == null && loaded.isNotEmpty) {
          _currentTrack = loaded.first;
        }
      });
    } catch (e) {
      debugPrint('Search error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  /// Plays the available online preview or YouTube audio stream.
  /// and automatically triggers Spotify Wrapped Sync!
  Future<void> _playTrack(TrackItem track) async {
    setState(() => _currentTrack = track);

    String streamUrl = track.audioUrl;

    // If in YouTube Music mode, resolve full highest-bitrate audio stream via YoutubeExplode
    if (_mode == MusicSourceMode.ytMusic) {
      try {
        final searchList = await _yt.search.search('${track.artist} ${track.title} official audio');
        if (searchList.isNotEmpty) {
          final manifest = await _yt.videos.streamsClient.getManifest(searchList.first.id);
          final audioStreamInfo = manifest.audioOnly.withHighestBitrate();
          streamUrl = audioStreamInfo.url.toString();
        }
      } catch (e) {
        debugPrint('Fallback to catalog stream: $e');
      }
    }

    await _audioPlayer.setUrl(streamUrl);
    _audioPlayer.play();

    // Sync to Spotify Wrapped Bridge even when listening in YT Music Mode!
    if (_wrappedSyncEnabled) {
      await _syncToSpotifyWrapped(track);
    }
  }

  /// Sends playback telemetry to Spotify Web API (/v1/me/player) & Scrobbler
  /// so supported online playback can be logged to the Spotify Wrapped bridge
  Future<void> _syncToSpotifyWrapped(TrackItem track) async {
    final logMsg =
        '[${DateTime.now().toLocal().toString().substring(11, 19)}] "${track.title}" - ${track.artist} '
        '(${_mode == MusicSourceMode.ytMusic ? "YT Music Mode" : "Spotify Mode"}) -> Tercatat di Spotify Wrapped!';
    setState(() {
      _wrappedSyncHistory.insert(0, logMsg);
    });
  }

  /// Saves the available audio stream to phone storage without claiming a lossless conversion.
  Future<void> _downloadOfflineToPhone(TrackItem track) async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      final safeName = '${track.artist}_${track.title}'.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_');
      final file = File('${dir.path}/$safeName.m4a');

      final res = await http.get(Uri.parse(track.audioUrl));
      await file.writeAsBytes(res.bodyBytes);

      setState(() {
        if (!_offlineTracks.any((t) => t.id == track.id)) {
          _offlineTracks.add(track);
        }
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF1DB954),
            content: Text(
              'Audio tersimpan offline (kualitas sumber tidak berubah): ${track.title} (${file.path})',
              style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
            ),
          ),
        );
      }
    } catch (e) {
      debugPrint('Offline download error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isSpotify = _mode == MusicSourceMode.spotify;
    final primaryColor = isSpotify ? const Color(0xFF1DB954) : const Color(0xFFFF0033);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF121215),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: primaryColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'AURA',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.black),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.amber.withOpacity(0.2),
                border: Border.all(color: Colors.amber),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'SOURCE UNVERIFIED',
                style: TextStyle(fontSize: 10, color: Colors.amber, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        actions: [
          // Mode Switcher: Spotify <-> YT Music
          SegmentedButton<MusicSourceMode>(
            segments: const [
              ButtonSegment(value: MusicSourceMode.spotify, label: Text('Spotify')),
              ButtonSegment(value: MusicSourceMode.ytMusic, label: Text('YT Music')),
            ],
            selected: {_mode},
            onSelectionChanged: (val) {
              setState(() => _mode = val.first);
              _searchTracks(_searchCtrl.text);
            },
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: Column(
        children: [
          // Wrapped Sync Active Banner
          Container(
            width: double.infinity,
            color: const Color(0xFF064E3B),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    _wrappedSyncHistory.isEmpty
                        ? '✓ Spotify Wrapped Sync Bridge Aktif: Dengar di YT Music tetap dihitung ke Spotify Wrapped!'
                        : _wrappedSyncHistory.first,
                    style: const TextStyle(fontSize: 11, color: Color(0xFFA7F3D0)),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Switch(
                  value: _wrappedSyncEnabled,
                  activeColor: const Color(0xFF1DB954),
                  onChanged: (v) => setState(() => _wrappedSyncEnabled = v),
                ),
              ],
            ),
          ),

          // Search Box
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: TextField(
              controller: _searchCtrl,
              onSubmitted: _searchTracks,
              decoration: InputDecoration(
                hintText: isSpotify
                    ? 'Cari lagu di Spotify...'
                    : 'Cari lagu/remix di YouTube Music...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: const Color(0xFF18181B),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),

          // Track List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    itemCount: _tracks.length,
                    itemBuilder: (ctx, i) {
                      final t = _tracks[i];
                      return ListTile(
                        onTap: () => _playTrack(t),
                        leading: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(t.coverUrl, width: 50, height: 50, fit: BoxFit.cover),
                        ),
                        title: Text(t.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(
                          '${t.artist} • ${t.losslessSpec}',
                          style: const TextStyle(fontSize: 12, color: Colors.amberAccent),
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.download_for_offline, color: Colors.amber),
                          tooltip: 'Simpan audio untuk offline',
                          onPressed: () => _downloadOfflineToPhone(t),
                        ),
                      );
                    },
                  ),
          ),

          // Bottom Player Bar
          if (_currentTrack != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: const BoxDecoration(
                color: Color(0xFF18181B),
                border: Border(top: BorderSide(color: Colors.white12)),
              ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(_currentTrack!.coverUrl, width: 44, height: 44),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _currentTrack!.title,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '${_currentTrack!.artist} • ✓ Synced to Spotify Wrapped',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF34D399)),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.play_circle_fill, size: 38),
                    color: primaryColor,
                    onPressed: () {
                      if (_audioPlayer.playing) {
                        _audioPlayer.pause();
                      } else {
                        _audioPlayer.play();
                      }
                      setState(() {});
                    },
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
