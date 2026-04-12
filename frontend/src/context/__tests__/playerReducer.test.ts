import { describe, it, expect } from "vitest";
import type { Track } from "../../types/spotify";

// We need to extract and test the reducer directly.
// Since it's not exported, we'll re-implement the import trick:
// The reducer is defined in PlayerContext.tsx but not exported.
// We'll test it by importing the module and accessing it indirectly,
// or we test the logic patterns it implements.

// For now, let's test the reducer logic by importing the module.
// Since playerReducer is not exported, we test through the provider.
// But actually the cleanest approach: let's just inline-test the logic.

function makeTrack(id: string, scores?: Record<string, number>): Track {
  return {
    id,
    name: `Track ${id}`,
    uri: `spotify:track:${id}`,
    duration_ms: 200000,
    artists: [{ id: "a1", name: "Artist", type: "artist", uri: "" }],
    album: {
      id: "alb1",
      name: "Album",
      images: [],
      uri: "",
      release_date: "2024",
    },
    _scores: scores,
  } as Track;
}

// Since playerReducer is not exported, we need to test it through the component.
// However, the most valuable thing to test is the reducer logic.
// Let's dynamically import and extract it.

// Actually, the cleanest approach: test the state transitions via renderHook.
// But first, let's see if we can just import the module.

// The reducer function isn't exported. The most pragmatic approach:
// test the Provider + usePlayer hook combo via renderHook.

import { renderHook, act } from "@testing-library/react";
import { PlayerProvider, usePlayer } from "../PlayerContext";
import { createElement } from "react";

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(PlayerProvider, { authenticated: false }, children);
}

describe("PlayerContext", () => {
  it("should provide initial state", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    expect(result.current.state.currentTrack).toBeNull();
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.progressMs).toBe(0);
    expect(result.current.state.queue).toEqual([]);
    expect(result.current.state.queueIndex).toBe(-1);
  });

  it("SET_TRACK should update current track and progress", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });
    const track = makeTrack("t1");

    act(() => {
      result.current.dispatch({
        type: "SET_TRACK",
        track,
        progressMs: 5000,
        isPlaying: true,
      });
    });

    expect(result.current.state.currentTrack?.id).toBe("t1");
    expect(result.current.state.progressMs).toBe(5000);
    expect(result.current.state.isPlaying).toBe(true);
    expect(result.current.state.durationMs).toBe(200000);
  });

  it("SET_TRACK should merge _scores from queue", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });
    const queueTrack = makeTrack("t1", { hebrew: 100 });

    // First set queue with scored track
    act(() => {
      result.current.dispatch({
        type: "SET_QUEUE",
        queue: {
          tracks: [queueTrack],
          current_index: 0,
          current_track: queueTrack,
          sources: [],
        },
      });
    });

    // Then SET_TRACK from Spotify (no scores)
    const spotifyTrack = makeTrack("t1");
    delete spotifyTrack._scores;

    act(() => {
      result.current.dispatch({
        type: "SET_TRACK",
        track: spotifyTrack,
        progressMs: 0,
        isPlaying: true,
      });
    });

    // Should have merged scores from queue
    expect(result.current.state.currentTrack?._scores).toEqual({
      hebrew: 100,
    });
  });

  it("SET_QUEUE should preserve Spotify track when it differs from queue current", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    // Spotify is playing track A
    act(() => {
      result.current.dispatch({
        type: "SET_TRACK",
        track: makeTrack("spotify-track"),
        progressMs: 1000,
        isPlaying: true,
      });
    });

    // Queue says current is track B, but spotify-track is in the queue
    act(() => {
      result.current.dispatch({
        type: "SET_QUEUE",
        queue: {
          tracks: [
            makeTrack("queue-current"),
            makeTrack("spotify-track", { hype: 80 }),
          ],
          current_index: 0,
          current_track: makeTrack("queue-current"),
          sources: ["liked"],
        },
      });
    });

    // Should keep Spotify's track, not queue's current
    expect(result.current.state.currentTrack?.id).toBe("spotify-track");
    expect(result.current.state.queueIndex).toBe(1);
    expect(result.current.state.sources).toEqual(["liked"]);
  });

  it("TICK should advance progress when playing", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_TRACK",
        track: makeTrack("t1"),
        progressMs: 10000,
        isPlaying: true,
      });
    });

    act(() => {
      result.current.dispatch({ type: "TICK" });
    });

    expect(result.current.state.progressMs).toBe(11000);
  });

  it("TICK should not advance when paused", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_TRACK",
        track: makeTrack("t1"),
        progressMs: 10000,
        isPlaying: false,
      });
    });

    act(() => {
      result.current.dispatch({ type: "TICK" });
    });

    expect(result.current.state.progressMs).toBe(10000);
  });

  it("TICK should clamp to duration", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_TRACK",
        track: makeTrack("t1"), // duration_ms = 200000
        progressMs: 199500,
        isPlaying: true,
      });
    });

    act(() => {
      result.current.dispatch({ type: "TICK" });
    });

    expect(result.current.state.progressMs).toBe(200000);
  });

  it("STOP should clear playback state", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_TRACK",
        track: makeTrack("t1"),
        progressMs: 5000,
        isPlaying: true,
      });
    });

    act(() => {
      result.current.dispatch({ type: "STOP" });
    });

    expect(result.current.state.currentTrack).toBeNull();
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.progressMs).toBe(0);
  });

  it("TOGGLE_PLAY should update isPlaying", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "TOGGLE_PLAY", isPlaying: true });
    });

    expect(result.current.state.isPlaying).toBe(true);

    act(() => {
      result.current.dispatch({ type: "TOGGLE_PLAY", isPlaying: false });
    });

    expect(result.current.state.isPlaying).toBe(false);
  });
});
