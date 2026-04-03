import { createContext, useContext, useReducer, useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { Track, QueueState } from '../types/spotify';
import { fetchCurrentTrack, fetchQueue, queueSkip } from '../api/spotify';

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  queue: Track[];
  queueIndex: number;
  sources: string[];
}

type PlayerAction =
  | { type: 'SET_TRACK'; track: Track; progressMs: number; isPlaying: boolean }
  | { type: 'TOGGLE_PLAY'; isPlaying: boolean }
  | { type: 'SET_PROGRESS'; progressMs: number }
  | { type: 'STOP' }
  | { type: 'TICK' }
  | { type: 'SET_QUEUE'; queue: QueueState };

const initialState: PlayerState = {
  currentTrack: null,
  isPlaying: false,
  progressMs: 0,
  durationMs: 0,
  queue: [],
  queueIndex: -1,
  sources: [],
};

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'SET_TRACK': {
      const useQueueTrack = state.currentTrack?._scores && state.currentTrack.id === action.track.id;
      return {
        ...state,
        currentTrack: useQueueTrack ? state.currentTrack : action.track,
        progressMs: action.progressMs,
        isPlaying: action.isPlaying,
        durationMs: action.track.duration_ms,
      };
    }
    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: action.isPlaying };
    case 'SET_PROGRESS':
      return { ...state, progressMs: action.progressMs };
    case 'STOP':
      return { ...state, currentTrack: null, isPlaying: false, progressMs: 0, durationMs: 0 };
    case 'TICK':
      if (!state.isPlaying) return state;
      return { ...state, progressMs: Math.min(state.progressMs + 1000, state.durationMs) };
    case 'SET_QUEUE':
      return {
        ...state,
        queue: action.queue.tracks,
        queueIndex: action.queue.current_index,
        currentTrack: action.queue.current_track,
        durationMs: action.queue.current_track?.duration_ms ?? 0,
        sources: action.queue.sources ?? state.sources,
      };
    default:
      return state;
  }
}

const PlayerContext = createContext<{
  state: PlayerState;
  dispatch: React.Dispatch<PlayerAction>;
  refreshQueue: () => Promise<void>;
} | null>(null);

export function PlayerProvider({ children, authenticated }: { children: ReactNode; authenticated: boolean }) {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshQueue = useCallback(async () => {
    try {
      const q = await fetchQueue();
      dispatch({ type: 'SET_QUEUE', queue: q });
    } catch {
      // ignore
    }
  }, []);

  const skippingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  // Poll Spotify for playback state + queue
  useEffect(() => {
    if (!authenticated) return;

    const poll = async () => {
      if (skippingRef.current) return;

      try {
        const [playback] = await Promise.all([
          fetchCurrentTrack(),
          refreshQueue(),
        ]);

        const s = stateRef.current;

        if (playback?.item) {
          const songEnded = wasPlayingRef.current
            && !playback.is_playing
            && playback.progress_ms <= 1000
            && s.currentTrack
            && playback.item.id === s.currentTrack.id;

          if (songEnded && !skippingRef.current) {
            skippingRef.current = true;
            try {
              await queueSkip();
              await refreshQueue();
            } finally {
              skippingRef.current = false;
            }
          } else {
            dispatch({ type: 'SET_TRACK', track: playback.item, progressMs: playback.progress_ms, isPlaying: playback.is_playing });
            wasPlayingRef.current = playback.is_playing;
          }
        } else if (!playback && s.currentTrack && wasPlayingRef.current && !skippingRef.current) {
          skippingRef.current = true;
          try {
            await queueSkip();
            await refreshQueue();
          } finally {
            skippingRef.current = false;
          }
        }
      } catch {
        // ignore polling errors
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [authenticated, refreshQueue]);

  // Local tick for smooth progress bar
  useEffect(() => {
    if (state.isPlaying) {
      tickRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    } else {
      clearInterval(tickRef.current);
    }
    return () => clearInterval(tickRef.current);
  }, [state.isPlaying]);

  return (
    <PlayerContext.Provider value={{ state, dispatch, refreshQueue }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
