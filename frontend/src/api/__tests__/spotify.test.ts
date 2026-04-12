import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchMe,
  fetchQueue,
  queueRerank,
  queueSkip,
  addSourceWithProgress,
  play,
  logout,
  type AddProgress,
} from "../spotify";

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("simple API wrappers", () => {
  it("fetchMe should return user on success", async () => {
    const user = { id: "u1", display_name: "Test" };
    globalThis.fetch = mockFetch(user);

    const result = await fetchMe();

    expect(result).toEqual(user);
    expect(fetch).toHaveBeenCalledWith("/api/auth/me");
  });

  it("fetchMe should return null on failure", async () => {
    globalThis.fetch = mockFetch(null, false, 401);

    const result = await fetchMe();

    expect(result).toBeNull();
  });

  it("fetchQueue should call correct endpoint", async () => {
    const queue = { tracks: [], current_index: -1, sources: [] };
    globalThis.fetch = mockFetch(queue);

    const result = await fetchQueue();

    expect(result).toEqual(queue);
    expect(fetch).toHaveBeenCalledWith("/api/queue");
  });

  it("queueRerank should POST weights", async () => {
    const queue = { tracks: [], current_index: 0, sources: [] };
    globalThis.fetch = mockFetch(queue);

    await queueRerank({ hebrew: 50, hype: 50 });

    expect(fetch).toHaveBeenCalledWith("/api/queue/rerank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights: { hebrew: 50, hype: 50 } }),
    });
  });

  it("queueSkip should throw on failure", async () => {
    globalThis.fetch = mockFetch(null, false, 404);

    await expect(queueSkip()).rejects.toThrow("Failed to skip");
  });

  it("play should send uris when provided", async () => {
    globalThis.fetch = mockFetch(null);

    await play(["spotify:track:abc"]);

    expect(fetch).toHaveBeenCalledWith("/api/player/play", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uris: ["spotify:track:abc"] }),
    });
  });

  it("play should omit body when no uris", async () => {
    globalThis.fetch = mockFetch(null);

    await play();

    expect(fetch).toHaveBeenCalledWith("/api/player/play", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: undefined,
    });
  });

  it("logout should clear cookie", async () => {
    globalThis.fetch = mockFetch(null);
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "session_id=abc",
    });

    await logout();

    expect(fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });
});

describe("addSourceWithProgress", () => {
  it("should parse SSE stream and call onProgress", async () => {
    const events: AddProgress[] = [
      { step: "fetching", progress: 0, total: 0, message: "Fetching..." },
      {
        step: "done",
        message: "Done",
        queue: {
          tracks: [],
          current_index: 0,
          current_track: null,
          sources: [],
        },
      },
    ];

    const sseText = events
      .map((e) => `data: ${JSON.stringify(e)}\n`)
      .join("\n");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseText));
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });

    const progress: AddProgress[] = [];
    await addSourceWithProgress("liked", (p) => progress.push(p));

    expect(progress).toHaveLength(2);
    expect(progress[0].step).toBe("fetching");
    expect(progress[1].step).toBe("done");
  });

  it("should throw on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    await expect(addSourceWithProgress("liked", () => {})).rejects.toThrow(
      "Failed to add source",
    );
  });
});
