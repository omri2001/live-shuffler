import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import type { Track, QueueState } from "../types/spotify";
import {
  fetchCurrentTrack,
  fetchQueue,
  queueSkip,
  addSourceWithProgress,
  syncCurrentTrack,
} from "../api/spotify";

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
  | { type: "SET_TRACK"; track: Track; progressMs: number; isPlaying: boolean }
  | { type: "TOGGLE_PLAY"; isPlaying: boolean }
  | { type: "SET_PROGRESS"; progressMs: number }
  | { type: "STOP" }
  | { type: "TICK" }
  | { type: "SET_QUEUE"; queue: QueueState };

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
    case "SET_TRACK": {
      // Find the playing track in the queue to sync index and get _scores
      const queueIdx = state.queue.findIndex((t) => t.id === action.track.id);
      let effectiveTrack = action.track;
      if (queueIdx >= 0 && state.queue[queueIdx]._scores) {
        effectiveTrack = {
          ...action.track,
          _scores: state.queue[queueIdx]._scores,
        };
      } else if (
        state.currentTrack?._scores &&
        state.currentTrack.id === action.track.id
      ) {
        effectiveTrack = state.currentTrack;
      }
      return {
        ...state,
        currentTrack: effectiveTrack,
        queueIndex: queueIdx >= 0 ? queueIdx : state.queueIndex,
        progressMs: action.progressMs,
        isPlaying: action.isPlaying,
        durationMs: action.track.duration_ms,
      };
    }
    case "TOGGLE_PLAY":
      return { ...state, isPlaying: action.isPlaying };
    case "SET_PROGRESS":
      return { ...state, progressMs: action.progressMs };
    case "STOP":
      return {
        ...state,
        currentTrack: null,
        isPlaying: false,
        progressMs: 0,
        durationMs: 0,
      };
    case "TICK":
      if (!state.isPlaying) return state;
      return {
        ...state,
        progressMs: Math.min(state.progressMs + 1000, state.durationMs),
      };
    case "SET_QUEUE": {
      const newQueue = action.queue.tracks;
      const queueCurrent = action.queue.current_track;
      let newIndex = action.queue.current_index;
      let newCurrentTrack = queueCurrent;
      let newDurationMs = queueCurrent?.duration_ms ?? 0;

      // If Spotify is playing a different track than the queue's current,
      // keep Spotify's track — don't override with the queue's
      if (
        state.currentTrack &&
        queueCurrent &&
        state.currentTrack.id !== queueCurrent.id
      ) {
        const idx = newQueue.findIndex(
          (t: Track) => t.id === state.currentTrack!.id,
        );
        if (idx >= 0) {
          newIndex = idx;
          newCurrentTrack = {
            ...state.currentTrack,
            _scores: newQueue[idx]._scores,
          };
        } else {
          newCurrentTrack = state.currentTrack;
        }
        newDurationMs = newCurrentTrack?.duration_ms ?? state.durationMs;
      }

      return {
        ...state,
        queue: newQueue,
        queueIndex: newIndex,
        currentTrack: newCurrentTrack,
        durationMs: newDurationMs,
        sources: action.queue.sources ?? state.sources,
      };
    }
    default:
      return state;
  }
}

const PlayerContext = createContext<{
  state: PlayerState;
  dispatch: React.Dispatch<PlayerAction>;
  refreshQueue: () => Promise<QueueState | null>;
  startupDone: boolean;
  startupMessage: string;
} | null>(null);

export function PlayerProvider({
  children,
  authenticated,
}: {
  children: ReactNode;
  authenticated: boolean;
}) {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const stateRef = useRef(state);
  stateRef.current = state;

  const [startupDone, setStartupDone] = useState(false);
  const [startupMessage, setStartupMessage] = useState("");
  const lastSyncedIdRef = useRef<string | null>(null);

  const refreshQueue = useCallback(async (): Promise<QueueState | null> => {
    try {
      const q = await fetchQueue();
      dispatch({ type: "SET_QUEUE", queue: q });
      return q;
    } catch {
      return null;
    }
  }, []);

  const skippingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  // Step 1: Sequential startup — runs once on mount
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;

    const startup = async () => {
      // 1. Check what Spotify is playing
      setStartupMessage("Connecting to Spotify...");
      try {
        const playback = await fetchCurrentTrack();
        if (!cancelled && playback?.item) {
          dispatch({
            type: "SET_TRACK",
            track: playback.item,
            progressMs: playback.progress_ms,
            isPlaying: playback.is_playing,
          });
          wasPlayingRef.current = playback.is_playing;
        }
      } catch {
        // continue even if playback check fails
      }

      // 2. Check if queue already has sources (page refresh / existing session)
      try {
        const q = await fetchQueue();
        if (!cancelled) {
          dispatch({ type: "SET_QUEUE", queue: q });
          if (q.sources && q.sources.length > 0) {
            setStartupDone(true);
            return;
          }
        }
      } catch {
        // continue to auto-load
      }

      // 3. Auto-load liked songs
      if (!cancelled) {
        setStartupMessage("Loading liked songs...");
        try {
          await addSourceWithProgress("liked", (p) => {
            if (cancelled) return;
            setStartupMessage(p.message);
            if (p.step === "done" && p.queue) {
              dispatch({ type: "SET_QUEUE", queue: p.queue });
            }
          });
        } catch {
          // silently fail — user can add manually from Library
        }
      }

      // 4. Final refresh and mark done
      if (!cancelled) {
        await refreshQueue();
        setStartupDone(true);
      }
    };

    startup();
    return () => {
      cancelled = true;
    };
  }, [authenticated, refreshQueue]);

  // Step 2: Poll — only starts after startup completes
  useEffect(() => {
    if (!authenticated || !startupDone) return;

    const poll = async () => {
      if (skippingRef.current) return;

      try {
        const [playback, queueResult] = await Promise.all([
          fetchCurrentTrack(),
          refreshQueue(),
        ]);

        const s = stateRef.current;

        if (playback?.item) {
          const playingId = playback.item.id;

          // Detect external track change — song changed in Spotify, not through our queue
          if (queueResult && queueResult.sources.length > 0) {
            const queueCurrentId = queueResult.current_track?.id;
            if (
              playingId !== queueCurrentId &&
              playingId !== lastSyncedIdRef.current
            ) {
              lastSyncedIdRef.current = playingId;
              try {
                await syncCurrentTrack(playingId);
                await refreshQueue();
              } catch {
                /* ignore sync errors */
              }
            } else if (playingId === queueCurrentId) {
              lastSyncedIdRef.current = null;
            }
          }

          const songEnded =
            wasPlayingRef.current &&
            !playback.is_playing &&
            playback.progress_ms <= 1000 &&
            s.currentTrack &&
            playback.item.id === s.currentTrack.id;

          if (songEnded && !skippingRef.current) {
            skippingRef.current = true;
            try {
              await queueSkip();
              await refreshQueue();
            } finally {
              skippingRef.current = false;
            }
          } else {
            dispatch({
              type: "SET_TRACK",
              track: playback.item,
              progressMs: playback.progress_ms,
              isPlaying: playback.is_playing,
            });
            wasPlayingRef.current = playback.is_playing;
          }
        } else if (
          !playback &&
          s.currentTrack &&
          wasPlayingRef.current &&
          !skippingRef.current
        ) {
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
  }, [authenticated, startupDone, refreshQueue]);

  // Local tick for smooth progress bar
  useEffect(() => {
    if (state.isPlaying) {
      tickRef.current = setInterval(() => dispatch({ type: "TICK" }), 1000);
    } else {
      clearInterval(tickRef.current);
    }
    return () => clearInterval(tickRef.current);
  }, [state.isPlaying]);

  return (
    <PlayerContext.Provider
      value={{ state, dispatch, refreshQueue, startupDone, startupMessage }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
