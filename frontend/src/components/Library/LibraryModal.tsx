import { useEffect, useRef, useState } from "react";
import { usePlayer } from "../../context/PlayerContext";
import * as api from "../../api/spotify";

interface LibraryModalProps {
  open: boolean;
  onClose: () => void;
  onError?: (message: string) => void;
}

type Tab = "active" | "liked" | "playlists" | "albums";

interface Playlist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
}

interface Album {
  id: string;
  name: string;
  images: { url: string }[];
  artists: { name: string }[];
}

function sourceLabel(
  key: string,
  playlists: Playlist[],
  albums: Album[],
): { name: string; detail: string; img?: string } {
  if (key === "liked") {
    return { name: "Liked Songs", detail: "Your saved tracks" };
  }
  if (key.startsWith("playlist:")) {
    const id = key.slice(9);
    const pl = playlists.find((p) => p.id === id);
    return {
      name: pl?.name ?? "Playlist",
      detail: `${pl?.tracks.total ?? "?"} tracks`,
      img: pl?.images?.[0]?.url,
    };
  }
  if (key.startsWith("album:")) {
    const id = key.slice(6);
    const al = albums.find((a) => a.id === id);
    return {
      name: al?.name ?? "Album",
      detail: al?.artists.map((a) => a.name).join(", ") ?? "",
      img: al?.images?.[0]?.url,
    };
  }
  return { name: key, detail: "" };
}

export default function LibraryModal({
  open,
  onClose,
  onError,
}: LibraryModalProps) {
  const { state, refreshQueue } = usePlayer();
  const [tab, setTab] = useState<Tab>("active");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addingStatus, setAddingStatus] = useState("");
  const [addingProgress, setAddingProgress] = useState(0);
  const [addingTotal, setAddingTotal] = useState(0);
  const cumulativeRef = useRef(0);
  const [removing, setRemoving] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadedSources = new Set(state.sources);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    // Prefetch playlist/album metadata when modal opens so Active tab shows names
    const needPlaylists =
      playlists.length === 0 &&
      (tab === "playlists" ||
        state.sources.some((s) => s.startsWith("playlist:")));
    const needAlbums =
      albums.length === 0 &&
      (tab === "albums" || state.sources.some((s) => s.startsWith("album:")));

    if (needPlaylists) {
      setLoading(true);
      api
        .fetchPlaylists()
        .then((d) => setPlaylists(d.items || []))
        .finally(() => setLoading(false));
    }
    if (needAlbums) {
      setLoading(true);
      api
        .fetchAlbums()
        .then((d) => setAlbums((d.items || []).map((i) => i.album)))
        .finally(() => setLoading(false));
    }
  }, [open, tab]);

  const handleAdd = async (
    source: string,
    playlistId?: string,
    albumId?: string,
  ) => {
    const key = playlistId
      ? `playlist:${playlistId}`
      : albumId
        ? `album:${albumId}`
        : source;
    if (loadedSources.has(key)) return;
    setAdding(key);
    setAddingStatus("Fetching tracks...");
    const base = cumulativeRef.current;
    let lastTotal = 0;
    setAddingProgress(base);
    try {
      let hadError = false;
      await api.addSourceWithProgress(
        source,
        (p) => {
          setAddingStatus(p.message);
          if (p.step === "error") {
            hadError = true;
            onError?.(p.message || "Failed to add tracks");
          }
          if (p.total) {
            lastTotal = p.total;
            setAddingTotal(base + p.total);
          }
          if (p.progress !== undefined) setAddingProgress(base + p.progress);
          if (p.step === "done") {
            cumulativeRef.current = base + lastTotal;
          }
        },
        playlistId,
        albumId,
      );
      if (!hadError) await refreshQueue();
    } catch {
      onError?.("Failed to add tracks — Spotify may be rate limiting");
    } finally {
      setAdding(null);
      setAddingStatus("");
    }
  };

  const handleRemove = async (sourceKey: string) => {
    setRemoving(sourceKey);
    try {
      await api.removeSource(sourceKey);
      await refreshQueue();
    } finally {
      setRemoving(null);
    }
  };

  if (!open) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "active", label: `Active (${state.sources.length})` },
    { key: "liked", label: "Liked Songs" },
    { key: "playlists", label: "Playlists" },
    { key: "albums", label: "Albums" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-spotify-dark-light rounded-xl shadow-2xl w-[480px] max-w-[90vw] max-h-[70vh] border border-spotify-dark-lighter flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-spotify-dark-lighter">
          <h2 className="text-lg font-bold text-spotify-white">Library</h2>
          <button
            onClick={onClose}
            className="text-spotify-gray hover:text-spotify-white transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-3 pb-1">
          <input
            type="text"
            placeholder="Search playlists, albums..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-spotify-dark border border-spotify-dark-lighter rounded-lg px-3 py-2 text-sm text-spotify-white placeholder-spotify-gray focus:outline-none focus:border-spotify-green"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-spotify-dark-lighter px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                tab === t.key
                  ? "text-spotify-white"
                  : "text-spotify-gray hover:text-spotify-white"
              }`}
            >
              {t.label}
              {tab === t.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-spotify-green" />
              )}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        {adding && (
          <div className="px-6 py-3 border-b border-spotify-dark-lighter">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-spotify-gray">{addingStatus}</span>
              {addingTotal > 0 && (
                <span className="text-xs text-spotify-gray tabular-nums">
                  {addingProgress}/{addingTotal}
                </span>
              )}
            </div>
            <div className="w-full h-1.5 rounded-full bg-spotify-dark-lighter overflow-hidden">
              <div
                className="h-full rounded-full bg-spotify-green transition-all duration-300"
                style={{
                  width:
                    addingTotal > 0
                      ? `${Math.round((addingProgress / addingTotal) * 100)}%`
                      : "0%",
                }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Active sources tab */}
          {tab === "active" &&
            (state.sources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-spotify-gray text-sm">
                  No sources added yet
                </p>
                <p className="text-spotify-gray text-xs mt-1">
                  Add songs from the other tabs
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {state.sources
                  .filter((key) => {
                    if (!search) return true;
                    const info = sourceLabel(key, playlists, albums);
                    return info.name
                      .toLowerCase()
                      .includes(search.toLowerCase());
                  })
                  .map((key) => {
                    const info = sourceLabel(key, playlists, albums);
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 rounded-lg bg-spotify-dark-lighter/50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {key === "liked" ? (
                            <div className="w-10 h-10 rounded bg-gradient-to-br from-purple-700 to-blue-300 flex items-center justify-center shrink-0">
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 20 20"
                                fill="white"
                              >
                                <path d="M10 18s-7-5.3-7-10A4 4 0 0110 5a4 4 0 017 3c0 4.7-7 10-7 10z" />
                              </svg>
                            </div>
                          ) : info.img ? (
                            <img
                              src={info.img}
                              alt=""
                              className="w-10 h-10 rounded object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-spotify-dark-lighter shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-spotify-white truncate">
                              {info.name}
                            </p>
                            <p className="text-xs text-spotify-gray truncate">
                              {info.detail}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemove(key)}
                          disabled={removing === key}
                          className="px-3 py-1.5 rounded-full border border-red-500/50 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0 ml-3"
                        >
                          {removing === key ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    );
                  })}
              </div>
            ))}

          {tab === "liked" && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-spotify-dark-lighter/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-gradient-to-br from-purple-700 to-blue-300 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
                    <path d="M10 18s-7-5.3-7-10A4 4 0 0110 5a4 4 0 017 3c0 4.7-7 10-7 10z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-spotify-white">
                    Liked Songs
                  </p>
                  <p className="text-xs text-spotify-gray">Your saved tracks</p>
                </div>
              </div>
              {loadedSources.has("liked") ? (
                <button
                  onClick={() => handleRemove("liked")}
                  disabled={removing === "liked"}
                  className="px-3 py-1.5 rounded-full border border-red-500/50 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {removing === "liked" ? "Removing..." : "Remove"}
                </button>
              ) : (
                <button
                  onClick={() => handleAdd("liked")}
                  disabled={adding === "liked"}
                  className="px-3 py-1.5 rounded-full bg-spotify-green text-black text-xs font-semibold hover:bg-spotify-green-hover transition-colors disabled:opacity-50"
                >
                  {adding === "liked" ? addingStatus || "Adding..." : "Add"}
                </button>
              )}
            </div>
          )}

          {tab === "playlists" &&
            (loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {playlists
                  .filter(
                    (pl) =>
                      !search ||
                      pl.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((pl) => {
                    const key = `playlist:${pl.id}`;
                    const img = pl.images?.[0]?.url;
                    return (
                      <div
                        key={pl.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-spotify-dark-lighter/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {img ? (
                            <img
                              src={img}
                              alt=""
                              className="w-12 h-12 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-spotify-dark-lighter" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-spotify-white truncate">
                              {pl.name}
                            </p>
                            <p className="text-xs text-spotify-gray">
                              {pl.tracks.total} tracks
                            </p>
                          </div>
                        </div>
                        {loadedSources.has(key) ? (
                          <button
                            onClick={() => handleRemove(key)}
                            disabled={removing === key}
                            className="px-3 py-1.5 rounded-full border border-red-500/50 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0 ml-3"
                          >
                            {removing === key ? "Removing..." : "Remove"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAdd("playlist", pl.id)}
                            disabled={adding === key}
                            className="px-3 py-1.5 rounded-full bg-spotify-green text-black text-xs font-semibold hover:bg-spotify-green-hover transition-colors disabled:opacity-50 shrink-0 ml-3"
                          >
                            {adding === key
                              ? addingStatus || "Adding..."
                              : "Add"}
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}

          {tab === "albums" &&
            (loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {albums
                  .filter(
                    (al) =>
                      !search ||
                      al.name.toLowerCase().includes(search.toLowerCase()) ||
                      al.artists.some((a) =>
                        a.name.toLowerCase().includes(search.toLowerCase()),
                      ),
                  )
                  .map((al) => {
                    const key = `album:${al.id}`;
                    const img = al.images?.[0]?.url;
                    return (
                      <div
                        key={al.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-spotify-dark-lighter/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {img ? (
                            <img
                              src={img}
                              alt=""
                              className="w-12 h-12 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-spotify-dark-lighter" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-spotify-white truncate">
                              {al.name}
                            </p>
                            <p className="text-xs text-spotify-gray truncate">
                              {al.artists.map((a) => a.name).join(", ")}
                            </p>
                          </div>
                        </div>
                        {loadedSources.has(key) ? (
                          <button
                            onClick={() => handleRemove(key)}
                            disabled={removing === key}
                            className="px-3 py-1.5 rounded-full border border-red-500/50 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0 ml-3"
                          >
                            {removing === key ? "Removing..." : "Remove"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAdd("album", undefined, al.id)}
                            disabled={adding === key}
                            className="px-3 py-1.5 rounded-full bg-spotify-green text-black text-xs font-semibold hover:bg-spotify-green-hover transition-colors disabled:opacity-50 shrink-0 ml-3"
                          >
                            {adding === key
                              ? addingStatus || "Adding..."
                              : "Add"}
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
