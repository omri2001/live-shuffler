export interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

export interface Artist {
  id: string;
  name: string;
}

export interface Album {
  id: string;
  name: string;
  images: SpotifyImage[];
}

export interface Track {
  id: string;
  name: string;
  artists: Artist[];
  album: Album;
  duration_ms: number;
  uri: string;
  _scores?: Record<string, number>;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  images: SpotifyImage[];
}

export interface QueueState {
  tracks: Track[];
  current_index: number;
  current_track: Track | null;
  sources?: string[];
}
