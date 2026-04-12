import { useEffect, useState, useRef } from "react";
import * as api from "../../api/spotify";
import type {
  MetricFullConfig,
  RefineAnalysis,
  TrackInspection,
} from "../../api/spotify";

interface RefineModalProps {
  open: boolean;
  onClose: () => void;
  inspectTrackId?: string | null;
}

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

type Phase = "configure" | "analyzing" | "results";
type SourceTab = "playlists" | "albums";
type ResultTab = "overview" | "genres" | "audio" | "tracks";

const SCORE_BUCKETS = ["0", "1-19", "20-39", "40-59", "60-79", "80-100"];

export default function RefineModal({
  open,
  onClose,
  inspectTrackId,
}: RefineModalProps) {
  const [phase, setPhase] = useState<Phase>("configure");
  const [metrics, setMetrics] = useState<Record<string, MetricFullConfig>>({});
  const [inspection, setInspection] = useState<TrackInspection | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(),
  );
  const [sourceTab, setSourceTab] = useState<SourceTab>("playlists");
  const [resultTab, setResultTab] = useState<ResultTab>("overview");
  const [loadingLists, setLoadingLists] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressVal, setProgressVal] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [analysis, setAnalysis] = useState<RefineAnalysis | null>(null);
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);
  const [trackLimit, setTrackLimit] = useState(50);
  const [genreFilter, setGenreFilter] = useState("");
  type InspectTab = "profile" | "scores";
  const [inspectTab, setInspectTab] = useState<InspectTab>("profile");
  const fetchedRef = useRef(false);

  // Load metrics + playlists + albums on first open
  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    api
      .fetchMetricFullConfigs()
      .then(setMetrics)
      .catch(() => {});
    setLoadingLists(true);
    Promise.all([
      api.fetchPlaylists().then((d) => setPlaylists(d.items || [])),
      api
        .fetchAlbums()
        .then((d) =>
          setAlbums((d.items || []).map((i: { album: Album }) => i.album)),
        ),
    ]).finally(() => setLoadingLists(false));
  }, [open]);

  // Inspect a single track
  useEffect(() => {
    if (!open || !inspectTrackId) {
      setInspection(null);
      return;
    }
    setInspectLoading(true);
    setInspectTab("profile");
    setExpandedTrack(null);
    api
      .fetchMetricFullConfigs()
      .then(setMetrics)
      .catch(() => {});
    api
      .inspectTrack(inspectTrackId)
      .then(setInspection)
      .finally(() => setInspectLoading(false));
  }, [open, inspectTrackId]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const toggleSource = (key: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAnalyze = async () => {
    if (!selectedMetric || selectedSources.size === 0) return;
    setPhase("analyzing");
    setProgressMsg("Starting...");
    setProgressVal(0);
    setProgressTotal(0);

    const sources = Array.from(selectedSources).map((key) => {
      if (key === "liked") return { source: "liked" };
      if (key.startsWith("playlist:"))
        return { source: "playlist", playlist_id: key.slice(9) };
      if (key.startsWith("album:"))
        return { source: "album", album_id: key.slice(6) };
      return { source: key };
    });

    try {
      await api.analyzeWithProgress(selectedMetric, sources, (p) => {
        setProgressMsg(p.message);
        if (p.total) setProgressTotal(p.total);
        if (p.progress !== undefined) setProgressVal(p.progress);
        if (p.step === "done" && p.analysis) {
          setAnalysis(p.analysis);
          setPhase("results");
          setResultTab("overview");
          setTrackLimit(50);
          setExpandedTrack(null);
          setGenreFilter("");
        }
      });
    } catch {
      setPhase("configure");
    }
  };

  if (!open) return null;

  const metricColor = metrics[selectedMetric]?.color ?? "#1DB954";
  const metricNames = Object.keys(metrics);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-spotify-dark-light rounded-xl shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] border border-spotify-dark-lighter flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-spotify-dark-lighter shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {(phase === "results" || inspectTrackId) && !inspectTrackId && (
              <button
                onClick={() => setPhase("configure")}
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
                  <path d="M15 10H5M5 10l4-4M5 10l4 4" />
                </svg>
              </button>
            )}
            {inspectTrackId ? (
              inspection ? (
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-spotify-white truncate">
                    {inspection.name}
                  </h2>
                  <p className="text-xs text-spotify-gray truncate">
                    {inspection.artists.join(", ")} — {inspection.album}
                  </p>
                </div>
              ) : (
                <h2 className="text-lg font-bold text-spotify-white">
                  Inspect Track
                </h2>
              )
            ) : (
              <h2 className="text-lg font-bold text-spotify-white">
                Refine Metrics
              </h2>
            )}
          </div>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Single track inspect view ── */}
          {inspectTrackId &&
            (inspectLoading ? (
              <div className="flex justify-center py-16">
                <div className="w-6 h-6 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : inspection ? (
              <>
                {/* Inspect tabs */}
                <div className="flex border-b border-spotify-dark-lighter px-6">
                  {(
                    [
                      ["profile", "Profile"],
                      ["scores", "Scores"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setInspectTab(key)}
                      className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${inspectTab === key ? "text-spotify-white" : "text-spotify-gray hover:text-spotify-white"}`}
                    >
                      {label}
                      {inspectTab === key && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-spotify-green" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="px-6 py-4">
                  {/* ── Profile tab ── */}
                  {inspectTab === "profile" && (
                    <div className="space-y-5">
                      {/* Audio features as bars */}
                      <div>
                        <p className="text-sm font-medium text-spotify-white mb-3">
                          Audio Features
                        </p>
                        {Object.keys(inspection.audio_features).length ===
                          0 && (
                          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-3">
                            <p className="text-xs text-red-400">
                              Not found on ReccoBeats — audio features
                              unavailable. Metric scores that rely on audio
                              boosts or tempo will be lower than expected.
                            </p>
                          </div>
                        )}
                        <div className="space-y-2.5">
                          {Object.entries(inspection.audio_features)
                            .filter(([k]) => k !== "tempo" && k !== "loudness")
                            .sort(
                              ([, a], [, b]) => (b as number) - (a as number),
                            )
                            .map(([name, val]) => {
                              const v = val as number;
                              return (
                                <div
                                  key={name}
                                  className="flex items-center gap-3"
                                >
                                  <span className="text-xs text-spotify-gray w-28 shrink-0 capitalize">
                                    {name}
                                  </span>
                                  <div className="flex-1 h-2.5 rounded-full bg-spotify-dark-lighter overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-spotify-green transition-all"
                                      style={{ width: `${v * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-spotify-white tabular-nums w-10 text-right">
                                    {v.toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                        {/* Tempo + loudness as plain values */}
                        <div className="flex gap-6 mt-3 text-xs">
                          <span className="text-spotify-gray">
                            Tempo:{" "}
                            <span className="text-spotify-white font-medium">
                              {Math.round(inspection.audio_features.tempo ?? 0)}{" "}
                              BPM
                            </span>
                          </span>
                          <span className="text-spotify-gray">
                            Loudness:{" "}
                            <span className="text-spotify-white font-medium">
                              {(
                                inspection.audio_features.loudness ?? 0
                              ).toFixed(1)}{" "}
                              dB
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Genres */}
                      <div>
                        <p className="text-sm font-medium text-spotify-white mb-2">
                          Artist Genres
                        </p>
                        {inspection.artist_genres.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {inspection.artist_genres.map((g) => (
                              <span
                                key={g}
                                className="px-2 py-1 rounded-full bg-spotify-dark-lighter text-xs text-spotify-white"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-spotify-gray">
                            No genres tagged by Spotify
                          </p>
                        )}
                      </div>

                      {inspection.album_genres.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-spotify-white mb-2">
                            Album Genres
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {inspection.album_genres.map((g) => (
                              <span
                                key={g}
                                className="px-2 py-1 rounded-full bg-spotify-dark-lighter text-xs text-spotify-white"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Scores tab ── */}
                  {inspectTab === "scores" && (
                    <div className="space-y-1">
                      {Object.entries(inspection.breakdowns)
                        .sort(([, a], [, b]) => b.score - a.score)
                        .map(([metric, bd]) => {
                          const color = metrics[metric]?.color ?? "#1DB954";
                          const expanded = expandedTrack === metric;
                          return (
                            <div key={metric}>
                              <button
                                onClick={() =>
                                  setExpandedTrack(expanded ? null : metric)
                                }
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-spotify-dark-lighter/50 transition-colors"
                              >
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                                <span className="text-sm text-spotify-white flex-1 text-left capitalize">
                                  {metric.replace(/_/g, " ")}
                                </span>
                                <div className="w-24 h-2 rounded-full bg-spotify-dark-lighter overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${bd.score}%`,
                                      backgroundColor: color,
                                    }}
                                  />
                                </div>
                                <span
                                  className="text-sm font-bold tabular-nums w-8 text-right"
                                  style={{
                                    color: bd.score > 0 ? color : "#6B7280",
                                  }}
                                >
                                  {bd.score}
                                </span>
                                <svg
                                  className={`w-4 h-4 text-spotify-gray shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                              {expanded && (
                                <div className="ml-9 mr-3 mb-2 p-3 rounded-lg bg-spotify-dark-lighter/30 text-xs space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-spotify-gray w-28 shrink-0">
                                      Base score:
                                    </span>
                                    <span className="text-spotify-white font-medium">
                                      {bd.base_score}
                                    </span>
                                    {bd.base_reason && (
                                      <span className="text-spotify-gray">
                                        ({bd.base_reason.replace(/_/g, " ")})
                                      </span>
                                    )}
                                  </div>
                                  {bd.matched_genres.length > 0 && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-spotify-gray w-28 shrink-0">
                                        Matched genres:
                                      </span>
                                      <div className="flex flex-wrap gap-1">
                                        {bd.matched_genres.map((g) => (
                                          <span
                                            key={g}
                                            className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400"
                                          >
                                            {g}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {bd.subgenre_bonus > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-spotify-gray w-28 shrink-0">
                                        Subgenre bonus:
                                      </span>
                                      <span className="text-spotify-white">
                                        +{bd.subgenre_bonus}
                                      </span>
                                    </div>
                                  )}
                                  {bd.audio_boosts.length > 0 &&
                                    bd.audio_boosts.map((ab) => (
                                      <div
                                        key={ab.feature}
                                        className="flex items-center gap-2"
                                      >
                                        <span className="text-spotify-gray w-28 shrink-0 capitalize">
                                          {ab.feature}:
                                        </span>
                                        <div className="flex-1 h-2 rounded-full bg-spotify-dark-lighter overflow-hidden max-w-24">
                                          <div
                                            className="h-full rounded-full"
                                            style={{
                                              width: `${ab.value * 100}%`,
                                              backgroundColor: color,
                                            }}
                                          />
                                        </div>
                                        <span className="text-spotify-gray tabular-nums">
                                          {ab.value}
                                        </span>
                                        <span className="text-spotify-white font-medium">
                                          +{ab.contribution}
                                        </span>
                                      </div>
                                    ))}
                                  {bd.tempo_bonus > 0 && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-spotify-gray w-28 shrink-0">
                                        Tempo bonus:
                                      </span>
                                      <span className="text-spotify-white">
                                        +{bd.tempo_bonus} ({bd.tempo} BPM)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </>
            ) : null)}

          {/* ── Normal refine flow ── */}
          {!inspectTrackId && phase === "configure" && (
            <div className="p-6 space-y-6">
              {/* Metric selector */}
              <div>
                <label className="text-sm font-medium text-spotify-white mb-2 block">
                  Metric
                </label>
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  className="w-full bg-spotify-dark border border-spotify-dark-lighter rounded-lg px-3 py-2 text-sm text-spotify-white focus:outline-none focus:border-spotify-green"
                >
                  <option value="">Select a metric...</option>
                  {metricNames.map((name) => (
                    <option key={name} value={name}>
                      {name.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                {selectedMetric && metrics[selectedMetric] && (
                  <div className="mt-2 p-3 rounded-lg bg-spotify-dark/50 text-xs text-spotify-gray space-y-1">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium mr-2"
                      style={{
                        backgroundColor: metricColor + "30",
                        color: metricColor,
                      }}
                    >
                      {metrics[selectedMetric].type}
                    </span>
                    {metrics[selectedMetric].genres?.primary && (
                      <span>
                        Genres:{" "}
                        {metrics[selectedMetric].genres!.primary.join(", ")}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Source picker */}
              <div>
                <label className="text-sm font-medium text-spotify-white mb-2 block">
                  Sources ({selectedSources.size} selected)
                </label>

                {/* Liked songs toggle */}
                <button
                  onClick={() => toggleSource("liked")}
                  className={`w-full flex items-center justify-between p-3 rounded-lg mb-3 transition-colors ${selectedSources.has("liked") ? "bg-spotify-green/10 border border-spotify-green/30" : "bg-spotify-dark-lighter/50 border border-transparent"}`}
                >
                  <div className="flex items-center gap-3">
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
                    <div className="text-left">
                      <p className="text-sm font-medium text-spotify-white">
                        Liked Songs
                      </p>
                      <p className="text-xs text-spotify-gray">
                        Your saved tracks
                      </p>
                    </div>
                  </div>
                  {selectedSources.has("liked") && (
                    <span className="text-spotify-green text-sm">Selected</span>
                  )}
                </button>

                {/* Tabs */}
                <div className="flex border-b border-spotify-dark-lighter mb-3">
                  {(["playlists", "albums"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSourceTab(t)}
                      className={`px-4 py-2 text-sm font-medium transition-colors relative ${sourceTab === t ? "text-spotify-white" : "text-spotify-gray hover:text-spotify-white"}`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                      {sourceTab === t && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-spotify-green" />
                      )}
                    </button>
                  ))}
                </div>

                {loadingLists ? (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {sourceTab === "playlists" &&
                      playlists.map((pl) => {
                        const key = `playlist:${pl.id}`;
                        const selected = selectedSources.has(key);
                        return (
                          <button
                            key={pl.id}
                            onClick={() => toggleSource(key)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors ${selected ? "bg-spotify-green/10" : "hover:bg-spotify-dark-lighter/50"}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {pl.images?.[0]?.url ? (
                                <img
                                  src={pl.images[0].url}
                                  alt=""
                                  className="w-10 h-10 rounded object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-spotify-dark-lighter shrink-0" />
                              )}
                              <div className="min-w-0 text-left">
                                <p className="text-sm text-spotify-white truncate">
                                  {pl.name}
                                </p>
                                <p className="text-xs text-spotify-gray">
                                  {pl.tracks.total} tracks
                                </p>
                              </div>
                            </div>
                            {selected && (
                              <span className="text-spotify-green text-xs shrink-0 ml-2">
                                Selected
                              </span>
                            )}
                          </button>
                        );
                      })}
                    {sourceTab === "albums" &&
                      albums.map((al) => {
                        const key = `album:${al.id}`;
                        const selected = selectedSources.has(key);
                        return (
                          <button
                            key={al.id}
                            onClick={() => toggleSource(key)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors ${selected ? "bg-spotify-green/10" : "hover:bg-spotify-dark-lighter/50"}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {al.images?.[0]?.url ? (
                                <img
                                  src={al.images[0].url}
                                  alt=""
                                  className="w-10 h-10 rounded object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-spotify-dark-lighter shrink-0" />
                              )}
                              <div className="min-w-0 text-left">
                                <p className="text-sm text-spotify-white truncate">
                                  {al.name}
                                </p>
                                <p className="text-xs text-spotify-gray truncate">
                                  {al.artists.map((a) => a.name).join(", ")}
                                </p>
                              </div>
                            </div>
                            {selected && (
                              <span className="text-spotify-green text-xs shrink-0 ml-2">
                                Selected
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Analyze button */}
              <button
                onClick={handleAnalyze}
                disabled={!selectedMetric || selectedSources.size === 0}
                className="w-full py-3 rounded-full bg-spotify-green text-black font-semibold text-sm hover:bg-spotify-green-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Analyze {selectedSources.size} source
                {selectedSources.size !== 1 ? "s" : ""} with{" "}
                {selectedMetric || "..."}
              </button>
            </div>
          )}

          {!inspectTrackId && phase === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-8 h-8 border-2 border-spotify-green border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-spotify-gray text-sm mb-4">{progressMsg}</p>
              {progressTotal > 0 && (
                <div className="w-64">
                  <div className="w-full h-1.5 rounded-full bg-spotify-dark-lighter overflow-hidden">
                    <div
                      className="h-full rounded-full bg-spotify-green transition-all duration-300"
                      style={{
                        width: `${Math.round((progressVal / progressTotal) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-spotify-gray text-center mt-1 tabular-nums">
                    {progressVal}/{progressTotal}
                  </p>
                </div>
              )}
            </div>
          )}

          {!inspectTrackId && phase === "results" && analysis && (
            <div>
              {/* Result tabs */}
              <div className="flex border-b border-spotify-dark-lighter px-6">
                {(["overview", "genres", "audio", "tracks"] as const).map(
                  (t) => (
                    <button
                      key={t}
                      onClick={() => setResultTab(t)}
                      className={`px-4 py-2.5 text-sm font-medium transition-colors relative capitalize ${resultTab === t ? "text-spotify-white" : "text-spotify-gray hover:text-spotify-white"}`}
                    >
                      {t}
                      {resultTab === t && (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-0.5"
                          style={{ backgroundColor: metricColor }}
                        />
                      )}
                    </button>
                  ),
                )}
              </div>

              <div className="p-6">
                {/* ── Overview ── */}
                {resultTab === "overview" && (
                  <div>
                    <div className="flex gap-4 mb-6">
                      <div className="px-4 py-3 rounded-lg bg-spotify-dark-lighter/50">
                        <p className="text-xs text-spotify-gray">Tracks</p>
                        <p className="text-lg font-bold text-spotify-white">
                          {analysis.track_count}
                        </p>
                      </div>
                      <div className="px-4 py-3 rounded-lg bg-spotify-dark-lighter/50">
                        <p className="text-xs text-spotify-gray">Mean Score</p>
                        <p
                          className="text-lg font-bold"
                          style={{ color: metricColor }}
                        >
                          {analysis.tracks.length > 0
                            ? Math.round(
                                analysis.tracks.reduce(
                                  (s, t) => s + t.score,
                                  0,
                                ) / analysis.tracks.length,
                              )
                            : 0}
                        </p>
                      </div>
                      <div className="px-4 py-3 rounded-lg bg-spotify-dark-lighter/50">
                        <p className="text-xs text-spotify-gray">
                          Scoring &gt; 0
                        </p>
                        <p className="text-lg font-bold text-spotify-white">
                          {Math.round(
                            ((analysis.track_count -
                              (analysis.score_histogram["0"] ?? 0)) /
                              analysis.track_count) *
                              100,
                          )}
                          %
                        </p>
                      </div>
                    </div>

                    <p className="text-sm font-medium text-spotify-white mb-3">
                      Score Distribution
                    </p>
                    <div className="flex items-end gap-2 h-32">
                      {SCORE_BUCKETS.map((label) => {
                        const count = analysis.score_histogram[label] ?? 0;
                        const max = Math.max(
                          ...SCORE_BUCKETS.map(
                            (b) => analysis.score_histogram[b] ?? 0,
                          ),
                          1,
                        );
                        const pct = (count / max) * 100;
                        return (
                          <div
                            key={label}
                            className="flex-1 flex flex-col items-center h-full justify-end group"
                          >
                            <span className="text-xs text-spotify-gray tabular-nums mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {count}
                            </span>
                            <div
                              className="w-full rounded-t-sm min-h-[2px] transition-all duration-300"
                              style={{
                                height:
                                  count > 0 ? `${Math.max(pct, 4)}%` : "2px",
                                backgroundColor: metricColor,
                                opacity: count > 0 ? 1 : 0.2,
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 mt-1">
                      {SCORE_BUCKETS.map((l) => (
                        <span
                          key={l}
                          className="flex-1 text-center text-[10px] text-spotify-gray"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Genres ── */}
                {resultTab === "genres" && (
                  <div>
                    <input
                      type="text"
                      placeholder="Filter genres..."
                      value={genreFilter}
                      onChange={(e) => setGenreFilter(e.target.value)}
                      className="w-full bg-spotify-dark border border-spotify-dark-lighter rounded-lg px-3 py-2 text-sm text-spotify-white mb-4 focus:outline-none focus:border-spotify-green"
                    />
                    <div className="max-h-[50vh] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-spotify-dark-light">
                          <tr className="text-left text-spotify-gray text-xs">
                            <th className="pb-2 pr-4">Genre</th>
                            <th className="pb-2 pr-4 w-20">Count</th>
                            <th className="pb-2 w-24">Match</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.genre_frequencies
                            .filter(
                              (g) =>
                                !genreFilter ||
                                g.genre.includes(genreFilter.toLowerCase()),
                            )
                            .map((g) => (
                              <tr
                                key={g.genre}
                                className={`border-t border-spotify-dark-lighter/50 ${g.match_type ? "bg-spotify-dark-lighter/20" : ""}`}
                              >
                                <td className="py-1.5 pr-4 text-spotify-white">
                                  {g.genre}
                                </td>
                                <td className="py-1.5 pr-4 text-spotify-gray tabular-nums">
                                  {g.count}
                                </td>
                                <td className="py-1.5">
                                  {g.match_type && (
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-medium ${g.match_type === "primary" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}`}
                                    >
                                      {g.match_type}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Audio ── */}
                {resultTab === "audio" && (
                  <div>
                    <div className="grid grid-cols-2 gap-5">
                      {Object.entries(analysis.audio_features)
                        .sort(
                          ([, a], [, b]) =>
                            (b.boosted ? 1 : 0) - (a.boosted ? 1 : 0),
                        )
                        .map(([name, feat]) => {
                          const bins = Object.entries(feat.histogram);
                          const maxCount = Math.max(
                            ...bins.map(([, c]) => c),
                            1,
                          );
                          return (
                            <div
                              key={name}
                              className={`p-3 rounded-lg ${feat.boosted ? "border border-opacity-30" : "border border-spotify-dark-lighter/50"}`}
                              style={
                                feat.boosted
                                  ? { borderColor: metricColor }
                                  : undefined
                              }
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p
                                  className="text-sm font-medium capitalize"
                                  style={{
                                    color: feat.boosted
                                      ? metricColor
                                      : undefined,
                                  }}
                                >
                                  {name}
                                  {feat.invert ? " (inverted)" : ""}
                                </p>
                                {feat.boosted && (
                                  <span
                                    className="text-xs px-2 py-0.5 rounded"
                                    style={{
                                      backgroundColor: metricColor + "30",
                                      color: metricColor,
                                    }}
                                  >
                                    weight: {feat.weight}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-end gap-px h-16">
                                {bins.map(([label, count]) => {
                                  const pct = (count / maxCount) * 100;
                                  return (
                                    <div
                                      key={label}
                                      className="flex-1 flex flex-col items-center h-full justify-end group"
                                    >
                                      <span className="text-[8px] text-spotify-gray tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                                        {count}
                                      </span>
                                      <div
                                        className="w-full rounded-t-sm min-h-[1px] transition-all"
                                        style={{
                                          height:
                                            count > 0
                                              ? `${Math.max(pct, 3)}%`
                                              : "1px",
                                          backgroundColor: feat.boosted
                                            ? metricColor
                                            : "#9CA3AF",
                                          opacity: count > 0 ? 0.8 : 0.2,
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex justify-between mt-1 text-[9px] text-spotify-gray">
                                <span>mean: {feat.mean}</span>
                                <span>median: {feat.median}</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Tempo */}
                    <div className="mt-5 p-3 rounded-lg border border-spotify-dark-lighter/50">
                      <p className="text-sm font-medium text-spotify-white mb-2">
                        Tempo (BPM)
                      </p>
                      <div className="flex items-end gap-px h-16">
                        {Object.entries(analysis.tempo.histogram).map(
                          ([label, count]) => {
                            const maxT = Math.max(
                              ...Object.values(analysis.tempo.histogram),
                              1,
                            );
                            const pct = (count / maxT) * 100;
                            return (
                              <div
                                key={label}
                                className="flex-1 flex flex-col items-center h-full justify-end group"
                              >
                                <span className="text-[8px] text-spotify-gray tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                                  {count}
                                </span>
                                <div
                                  className="w-full rounded-t-sm min-h-[1px] transition-all"
                                  style={{
                                    height:
                                      count > 0
                                        ? `${Math.max(pct, 3)}%`
                                        : "1px",
                                    backgroundColor: "#9CA3AF",
                                    opacity: count > 0 ? 0.7 : 0.2,
                                  }}
                                />
                              </div>
                            );
                          },
                        )}
                      </div>
                      <div className="flex justify-between mt-1 text-[9px] text-spotify-gray">
                        <span>60</span>
                        <span>mean: {analysis.tempo.mean}</span>
                        <span>260</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tracks ── */}
                {resultTab === "tracks" && (
                  <div className="space-y-1">
                    {analysis.tracks.slice(0, trackLimit).map((t) => {
                      const expanded = expandedTrack === t.id;
                      const bd = t.breakdown;
                      return (
                        <div key={t.id}>
                          <button
                            onClick={() =>
                              setExpandedTrack(expanded ? null : t.id)
                            }
                            className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-spotify-dark-lighter/50 transition-colors text-left"
                          >
                            {t.album_image ? (
                              <img
                                src={t.album_image}
                                alt=""
                                className="w-9 h-9 rounded shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded bg-spotify-dark-lighter shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-spotify-white truncate">
                                {t.name}
                              </p>
                              <p className="text-xs text-spotify-gray truncate">
                                {t.artists.join(", ")}
                              </p>
                            </div>
                            <span
                              className="text-sm font-bold tabular-nums shrink-0 w-8 text-right"
                              style={{
                                color: t.score > 0 ? metricColor : "#6B7280",
                              }}
                            >
                              {t.score}
                            </span>
                            <svg
                              className={`w-4 h-4 text-spotify-gray shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>

                          {expanded && (
                            <div className="ml-14 mr-4 mb-3 p-3 rounded-lg bg-spotify-dark-lighter/30 text-xs space-y-2">
                              {/* Base score */}
                              <div className="flex items-center gap-2">
                                <span className="text-spotify-gray w-28 shrink-0">
                                  Base score:
                                </span>
                                <span className="text-spotify-white font-medium">
                                  {bd.base_score}
                                </span>
                                {bd.base_reason && (
                                  <span className="text-spotify-gray">
                                    ({bd.base_reason.replace(/_/g, " ")})
                                  </span>
                                )}
                              </div>
                              {/* Matched genres */}
                              {bd.matched_genres.length > 0 && (
                                <div className="flex items-start gap-2">
                                  <span className="text-spotify-gray w-28 shrink-0">
                                    Matched genres:
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {bd.matched_genres.map((g) => (
                                      <span
                                        key={g}
                                        className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400"
                                      >
                                        {g}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Subgenre bonus */}
                              {bd.subgenre_bonus > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-spotify-gray w-28 shrink-0">
                                    Subgenre bonus:
                                  </span>
                                  <span className="text-spotify-white">
                                    +{bd.subgenre_bonus}
                                  </span>
                                </div>
                              )}
                              {/* Audio boosts */}
                              {bd.audio_boosts.length > 0 &&
                                bd.audio_boosts.map((ab) => (
                                  <div
                                    key={ab.feature}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="text-spotify-gray w-28 shrink-0 capitalize">
                                      {ab.feature}:
                                    </span>
                                    <div className="flex-1 h-2 rounded-full bg-spotify-dark-lighter overflow-hidden max-w-32">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${ab.value * 100}%`,
                                          backgroundColor: metricColor,
                                        }}
                                      />
                                    </div>
                                    <span className="text-spotify-gray tabular-nums">
                                      {ab.value}
                                    </span>
                                    <span className="text-spotify-white font-medium">
                                      +{ab.contribution}
                                    </span>
                                  </div>
                                ))}
                              {/* Tempo */}
                              {bd.tempo_bonus > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-spotify-gray w-28 shrink-0">
                                    Tempo bonus:
                                  </span>
                                  <span className="text-spotify-white">
                                    +{bd.tempo_bonus} ({bd.tempo} BPM)
                                  </span>
                                </div>
                              )}
                              {/* All genres */}
                              <div className="flex items-start gap-2 pt-1 border-t border-spotify-dark-lighter/50">
                                <span className="text-spotify-gray w-28 shrink-0">
                                  All genres:
                                </span>
                                <p className="text-spotify-gray">
                                  {t.artist_genres.length > 0
                                    ? t.artist_genres.join(", ")
                                    : "none"}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {trackLimit < analysis.tracks.length && (
                      <button
                        onClick={() => setTrackLimit((l) => l + 50)}
                        className="w-full py-2 text-sm text-spotify-gray hover:text-spotify-white transition-colors"
                      >
                        Show more ({analysis.tracks.length - trackLimit}{" "}
                        remaining)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
