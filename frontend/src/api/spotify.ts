import type { SpotifyUser, Track, QueueState } from '../types/spotify';

export async function fetchMe(): Promise<SpotifyUser | null> {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return null;
  return res.json();
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
  const res = await fetch('/api/queue/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, playlist_id: playlistId, album_id: albumId }),
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
