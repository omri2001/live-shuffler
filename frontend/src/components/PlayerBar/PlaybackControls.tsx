import { useEffect, useCallback } from "react";
import { usePlayer } from "../../context/PlayerContext";
import * as api from "../../api/spotify";

export default function PlaybackControls() {
  const { state, dispatch, refreshQueue } = usePlayer();

  const handlePlayPause = useCallback(async () => {
    if (state.isPlaying) {
      await api.pause();
      dispatch({ type: "TOGGLE_PLAY", isPlaying: false });
    } else {
      await api.play();
      dispatch({ type: "TOGGLE_PLAY", isPlaying: true });
    }
  }, [state.isPlaying, dispatch]);

  // Global spacebar for play/pause
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      // Don't intercept if user is typing in an input/select/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      handlePlayPause();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handlePlayPause]);

  const handleRestart = async () => {
    await api.queueRestart();
    dispatch({ type: "SET_PROGRESS", progressMs: 0 });
  };

  const handleSkip = async () => {
    try {
      await api.queueSkip();
      await refreshQueue();
    } catch {
      // ignore
    }
  };

  const handlePrevious = async () => {
    try {
      await api.queuePrevious();
      await refreshQueue();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Restart */}
      <button
        onClick={handleRestart}
        className="w-8 h-8 flex items-center justify-center text-spotify-gray hover:text-spotify-white transition-colors"
        title="Restart track"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2v4h4" />
          <path
            d="M2 6A6 6 0 1 1 3.34 10"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Previous */}
      <button
        onClick={handlePrevious}
        className="w-8 h-8 flex items-center justify-center text-spotify-gray hover:text-spotify-white transition-colors"
        title="Previous"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="2" height="12" rx="0.5" />
          <path d="M14 2.5v11a.5.5 0 01-.77.42L6 8.42V13.5a.5.5 0 01-1 0v-11a.5.5 0 011 0v5.08l7.23-5.5A.5.5 0 0114 2.5z" />
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={handlePlayPause}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-spotify-white hover:scale-105 transition-transform"
        title={state.isPlaying ? "Pause" : "Play"}
      >
        {state.isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#121212">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#121212">
            <path d="M4 2.5v11a.5.5 0 00.77.42l9-5.5a.5.5 0 000-.84l-9-5.5A.5.5 0 004 2.5z" />
          </svg>
        )}
      </button>

      {/* Skip */}
      <button
        onClick={handleSkip}
        className="w-8 h-8 flex items-center justify-center text-spotify-gray hover:text-spotify-white transition-colors"
        title="Next"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2.5v11a.5.5 0 00.77.42L10 8.42V13.5a.5.5 0 001 0v-11a.5.5 0 00-1 0v5.08L2.77 2.08A.5.5 0 002 2.5z" />
          <rect x="12" y="2" width="2" height="12" rx="0.5" />
        </svg>
      </button>
    </div>
  );
}
