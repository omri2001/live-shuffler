import type { SpotifyUser, Track, QueueState } from '../types/spotify';

export async function fetchMe(): Promise<SpotifyUser | null> {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return null;
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
  document.cookie = 'session_id=; path=/; max-age=0';
}

export async function fetchTracks(offset = 0, limit = 50): Promise<{ items: { track: Track }[]; total: number }> {
  const res = await fetch(`/api/tracks?offset=${offset}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch tracks');
  return res.json();
}

export async function fetchCurrentTrack(): Promise<{ item: Track; is_playing: boolean; progress_ms: number } | null> {
  const res = await fetch('/api/player/current');
  if (!res.ok || res.status === 204) return null;
  return res.json();
}

export async function play(uris?: string[]): Promise<void> {
  await fetch('/api/player/play', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: uris ? JSON.stringify({ uris }) : undefined,
  });
}

export async function seek(positionMs: number): Promise<void> {
  await fetch(`/api/player/seek?position_ms=${Math.round(positionMs)}`, { method: 'PUT' });
}

export async function pause(): Promise<void> {
  await fetch('/api/player/pause', { method: 'PUT' });
}

export async function fetchGenres(): Promise<string[]> {
  const res = await fetch('/api/genres');
  if (!res.ok) throw new Error('Failed to fetch genres');
  return res.json();
}

// Queue API
export async function fetchQueue(): Promise<QueueState> {
  const res = await fetch('/api/queue');
  if (!res.ok) throw new Error('Failed to fetch queue');
  return res.json();
}

export interface AddProgress {
  step: string;
  progress?: number;
  total?: number;
  message: string;
  queue?: QueueState;
}

export async function addSourceWithProgress(
  source: string,
  onProgress: (p: AddProgress) => void,
  playlistId?: string,
  albumId?: string,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout
  try {
  const res = await fetch('/api/queue/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, playlist_id: playlistId, album_id: albumId }),
    signal: controller.signal,
  });
  if (!res.ok) throw new Error('Failed to add source');

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data: AddProgress = JSON.parse(line.slice(6));
          onProgress(data);
        } catch {
          // ignore parse errors
        }
      }
    }
  }
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPlaylists(): Promise<{ items: { id: string; name: string; images: { url: string }[]; tracks: { total: number } }[] }> {
  const res = await fetch('/api/playlists');
  if (!res.ok) throw new Error('Failed to fetch playlists');
  return res.json();
}

export async function fetchAlbums(): Promise<{ items: { album: { id: string; name: string; images: { url: string }[]; artists: { name: string }[] } }[] }> {
  const res = await fetch('/api/albums');
  if (!res.ok) throw new Error('Failed to fetch albums');
  return res.json();
}

export async function rescoreQueue(): Promise<QueueState> {
  const res = await fetch('/api/queue/rescore', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to rescore');
  return res.json();
}

export async function syncCurrentTrack(trackId: string): Promise<QueueState> {
  const res = await fetch('/api/queue/sync-current', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_id: trackId }),
  });
  if (!res.ok) throw new Error('Failed to sync current track');
  return res.json();
}

export async function queueSkip(): Promise<QueueState> {
  const res = await fetch('/api/queue/skip', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to skip');
  return res.json();
}

export async function queuePrevious(): Promise<QueueState> {
  const res = await fetch('/api/queue/previous', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to go previous');
  return res.json();
}

export async function queueJump(index: number): Promise<QueueState> {
  const res = await fetch(`/api/queue/jump/${index}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to jump');
  return res.json();
}

export async function queueRestart(): Promise<QueueState> {
  const res = await fetch('/api/queue/restart', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to restart');
  return res.json();
}

export async function queueShuffle(): Promise<QueueState> {
  const res = await fetch('/api/queue/shuffle', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to shuffle');
  return res.json();
}

export async function queueRemove(index: number): Promise<QueueState> {
  const res = await fetch(`/api/queue/${index}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove');
  return res.json();
}

export async function queueClear(): Promise<QueueState> {
  const res = await fetch('/api/queue', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear queue');
  return res.json();
}

export async function setQueueSize(size: number): Promise<QueueState> {
  const res = await fetch('/api/queue/size', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ size }),
  });
  if (!res.ok) throw new Error('Failed to set queue size');
  return res.json();
}

export async function removeSource(sourceKey: string): Promise<QueueState> {
  const res = await fetch('/api/queue/remove-source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_key: sourceKey }),
  });
  if (!res.ok) throw new Error('Failed to remove source');
  return res.json();
}

export async function queueShuffleRandom(): Promise<QueueState> {
  const res = await fetch('/api/queue/shuffle-random', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to shuffle');
  return res.json();
}

export interface QueueStats {
  total: number;
  metrics: Record<string, Record<string, number>>;
}

export async function fetchQueueStats(): Promise<QueueStats> {
  const res = await fetch('/api/queue/stats');
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export interface MetricConfig {
  color: string;
  type: string;
}

export async function fetchMetricConfigs(): Promise<Record<string, MetricConfig>> {
  const res = await fetch('/api/queue/scorers');
  if (!res.ok) throw new Error('Failed to fetch metric configs');
  return res.json();
}

export async function queueRerank(weights: Record<string, number>): Promise<QueueState> {
  const res = await fetch('/api/queue/rerank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weights }),
  });
  if (!res.ok) throw new Error('Failed to rerank');
  return res.json();
}

// ── Refine API ──

export interface TrackInspection {
  track_id: string;
  name: string;
  artists: string[];
  album: string;
  artist_genres: string[];
  album_genres: string[];
  audio_features: Record<string, number>;
  breakdowns: Record<string, {
    score: number;
    base_score: number;
    base_reason: string | null;
    matched_genres: string[];
    subgenre_bonus: number;
    audio_boosts: { feature: string; value: number; contribution: number }[];
    tempo_bonus: number;
    tempo: number;
  }>;
}

export async function inspectTrack(trackId: string): Promise<TrackInspection> {
  const res = await fetch(`/api/refine/inspect/${trackId}`);
  if (!res.ok) throw new Error('Failed to inspect track');
  return res.json();
}

export interface MetricFullConfig {
  color: string;
  type: string;
  genres?: { primary: string[]; artist_score: number; album_score: number };
  subgenres?: { keywords: string[]; bonus: number };
  audio_boosts?: { feature: string; weight: number; invert?: boolean }[];
  tempo?: { min?: number; max?: number; bonus: number }[];
  text_regex?: string;
  genre_keywords?: string[];
}

export interface RefineTrackResult {
  id: string;
  name: string;
  artists: string[];
  album: string;
  album_image: string;
  score: number;
  breakdown: {
    score: number;
    base_score: number;
    base_reason: string | null;
    matched_genres: string[];
    subgenre_bonus: number;
    audio_boosts: { feature: string; value: number; contribution: number }[];
    tempo_bonus: number;
    tempo: number;
  };
  artist_genres: string[];
  album_genres: string[];
  audio_features: Record<string, number>;
}

export interface RefineAnalysis {
  metric_name: string;
  metric_config: MetricFullConfig;
  track_count: number;
  score_histogram: Record<string, number>;
  genre_frequencies: { genre: string; count: number; match_type: string | null }[];
  audio_features: Record<string, {
    histogram: Record<string, number>;
    mean: number;
    median: number;
    boosted: boolean;
    weight: number;
    invert: boolean;
  }>;
  tempo: {
    histogram: Record<string, number>;
    mean: number;
    median: number;
    ranges: { min?: number; max?: number; bonus: number }[];
  };
  tracks: RefineTrackResult[];
}

export interface RefineProgress {
  step: string;
  progress?: number;
  total?: number;
  message: string;
  analysis?: RefineAnalysis;
}

export async function fetchMetricFullConfigs(): Promise<Record<string, MetricFullConfig>> {
  const res = await fetch('/api/refine/metrics');
  if (!res.ok) throw new Error('Failed to fetch metric configs');
  return res.json();
}

export async function analyzeWithProgress(
  metric: string,
  sources: { source: string; playlist_id?: string; album_id?: string }[],
  onProgress: (p: RefineProgress) => void,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);
  try {
    const res = await fetch('/api/refine/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric, sources }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('Failed to analyze');

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            onProgress(JSON.parse(line.slice(6)));
          } catch { /* ignore */ }
        }
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ── Suggestions API ──

export interface SuggestionStatus {
  enabled: boolean;
  code: string;
  count: number;
}

export interface SuggestionTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  image: string;
  uri: string;
}

export interface SuggestionItem {
  track_id: string;
  track: SuggestionTrack;
  count: number;
  first_requested: number;
  last_requested: number;
}

export async function suggestionsEnable(): Promise<SuggestionStatus> {
  const res = await fetch('/api/suggestions/enable', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to enable');
  return res.json();
}

export async function suggestionsDisable(): Promise<SuggestionStatus> {
  const res = await fetch('/api/suggestions/disable', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to disable');
  return res.json();
}

export async function suggestionsStatus(): Promise<SuggestionStatus> {
  const res = await fetch('/api/suggestions/status');
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function suggestionsList(): Promise<{ suggestions: SuggestionItem[] }> {
  const res = await fetch('/api/suggestions/list');
  if (!res.ok) throw new Error('Failed to fetch list');
  return res.json();
}

export async function suggestionsAccept(trackId: string): Promise<{ queue: QueueState; remaining: number }> {
  const res = await fetch(`/api/suggestions/accept/${trackId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to accept');
  return res.json();
}

export async function suggestionsDismiss(trackId: string): Promise<{ remaining: number }> {
  const res = await fetch(`/api/suggestions/dismiss/${trackId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to dismiss');
  return res.json();
}

// Guest endpoints (no auth, use code)
export async function suggestionsSearch(code: string, q: string): Promise<{ tracks: SuggestionTrack[] }> {
  const res = await fetch(`/api/suggestions/search?code=${encodeURIComponent(code)}&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Failed to search');
  return res.json();
}

export async function suggestionsSubmit(code: string, trackId: string, track: SuggestionTrack): Promise<{ count: number }> {
  const res = await fetch('/api/suggestions/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, track_id: trackId, track }),
  });
  if (!res.ok) throw new Error('Failed to submit');
  return res.json();
}

export async function suggestionsUnvote(code: string, trackId: string): Promise<{ count: number }> {
  const res = await fetch('/api/suggestions/unvote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, track_id: trackId }),
  });
  if (!res.ok) throw new Error('Failed to unvote');
  return res.json();
}

export async function suggestionsPool(code: string): Promise<{ suggestions: SuggestionItem[] }> {
  const res = await fetch(`/api/suggestions/pool?code=${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error('Failed to fetch pool');
  return res.json();
}
