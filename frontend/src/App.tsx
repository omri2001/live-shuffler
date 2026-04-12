import { useCallback, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fetchMe,
  setQueueSize as apiSetQueueSize,
  logout,
  suggestionsStatus,
  suggestionsEnable,
  suggestionsDisable,
} from "./api/spotify";
import type { SpotifyUser } from "./types/spotify";
import { PlayerProvider, usePlayer } from "./context/PlayerContext";
import Toast from "./components/Toast/Toast";
import AppLayout from "./components/Layout/AppLayout";
import GenreCircles from "./components/GenreCircles/GenreCircles";
import PlayerBar from "./components/PlayerBar/PlayerBar";
import TrackScores from "./components/PlayerBar/TrackScores";
import QueuePanel from "./components/Queue/QueuePanel";
import SettingsModal from "./components/Settings/SettingsModal";
import StatsModal from "./components/Stats/StatsModal";
import LibraryModal from "./components/Library/LibraryModal";
import LoginButton from "./components/Auth/LoginButton";
import RefineModal from "./components/Refine/RefineModal";
import SuggestionsModal from "./components/Suggestions/SuggestionsModal";
import SuggestPage from "./components/Suggestions/SuggestPage";

export type CircleLayout = "carousel" | "grid" | "favorites";

function MainContent({
  layout,
  favoriteMetrics,
  onFavoriteMetricsChange,
  gridColumns,
  onInspect,
}: {
  layout: CircleLayout;
  favoriteMetrics: string[];
  onFavoriteMetricsChange: (m: string[]) => void;
  gridColumns: number;
  onInspect: (trackId: string) => void;
}) {
  const { startupDone, startupMessage, pendingResume, resolveResume } =
    usePlayer();

  if (pendingResume) {
    const activeWeights = Object.entries(pendingResume.weights).filter(
      ([, v]) => v > 0,
    );
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
        <div className="bg-spotify-dark-gray rounded-xl p-5 max-w-xs w-full shadow-xl border border-white/10">
          <p className="text-spotify-white text-sm font-medium mb-2">
            Previous session found
          </p>
          <p className="text-spotify-gray text-xs mb-4">
            {pendingResume.track_count} tracks &middot;{" "}
            {pendingResume.played_count} played
            {activeWeights.length > 0 && (
              <span>
                {" "}
                &middot;{" "}
                {activeWeights
                  .map(([name, val]) => `${name} ${val}%`)
                  .join(", ")}
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => resolveResume(true)}
              className="px-4 py-1.5 rounded-full bg-spotify-green text-black text-xs font-semibold hover:bg-spotify-green-hover transition-colors"
            >
              Continue
            </button>
            <button
              onClick={() => resolveResume(false)}
              className="px-4 py-1.5 rounded-full border border-white/20 text-spotify-gray text-xs font-semibold hover:text-spotify-white hover:border-white/40 transition-colors"
            >
              New Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!startupDone) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-spotify-green border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-spotify-gray text-sm">{startupMessage}</p>
      </div>
    );
  }

  return (
    <>
      <TrackScores onInspect={onInspect} />
      <GenreCircles
        layout={layout}
        favoriteMetrics={favoriteMetrics}
        onFavoriteMetricsChange={onFavoriteMetricsChange}
        gridColumns={gridColumns}
      />
    </>
  );
}

const queryClient = new QueryClient();

function AppContent() {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [inspectTrackId, setInspectTrackId] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsCount, setSuggestionsCount] = useState(0);
  const [requestsEnabled, setRequestsEnabled] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [queueSize, setQueueSize] = useState(10);
  const [circleLayout, setCircleLayout] = useState<CircleLayout>(
    () => (localStorage.getItem("circleLayout") as CircleLayout) || "carousel",
  );
  const [favoriteMetrics, setFavoriteMetrics] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("favoriteMetrics") || "[]");
    } catch {
      return [];
    }
  });
  const [gridColumns, setGridColumns] = useState(
    () => Number(localStorage.getItem("gridColumns")) || 6,
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "info";
  } | null>(null);
  const showToast = useCallback(
    (message: string, type: "error" | "info" = "error") =>
      setToast({ message, type }),
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get("session");
    if (session) {
      document.cookie = `session_id=${session}; path=/; max-age=${86400 * 30}; samesite=lax`;
      window.history.replaceState({}, "", "/");
    }

    fetchMe()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.body.classList.toggle("light", !darkMode);
  }, [darkMode]);

  // Poll suggestion count for badge
  useEffect(() => {
    if (!user) return;
    const poll = () =>
      suggestionsStatus()
        .then((s) => {
          setSuggestionsCount(s.count);
          setRequestsEnabled(s.enabled);
        })
        .catch(() => {});
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [user]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-spotify-dark">
        <div className="w-8 h-8 border-2 border-spotify-green border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-spotify-gray text-sm">Connecting to Spotify...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginButton />;
  }

  return (
    <PlayerProvider authenticated={true}>
      <AppLayout>
        <MainContent
          layout={circleLayout}
          favoriteMetrics={favoriteMetrics}
          onFavoriteMetricsChange={(m) => {
            setFavoriteMetrics(m);
            localStorage.setItem("favoriteMetrics", JSON.stringify(m));
          }}
          gridColumns={gridColumns}
          onInspect={(id) => {
            setInspectTrackId(id);
            setRefineOpen(true);
          }}
        />

        {/* Top-left button — right of song metrics panel */}
        <div className="absolute top-4 left-68 z-10 flex gap-2">
          <button
            onClick={() => setSuggestionsOpen(true)}
            className="w-9 h-9 rounded-full bg-spotify-dark-lighter/80 flex items-center justify-center text-spotify-gray hover:text-spotify-white hover:bg-spotify-dark-lighter transition-colors relative"
            title="Song Requests"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 4h12M3 8h8M3 12h10" />
              <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
            </svg>
            {suggestionsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-spotify-green text-black text-[9px] font-bold flex items-center justify-center">
                {suggestionsCount > 9 ? "!" : suggestionsCount}
              </span>
            )}
          </button>
        </div>

        {/* Top-right buttons — left of queue */}
        <div className="absolute top-4 right-84 z-10 flex gap-2">
          <button
            onClick={() => setLibraryOpen(true)}
            className="w-9 h-9 rounded-full bg-spotify-dark-lighter/80 flex items-center justify-center text-spotify-gray hover:text-spotify-white hover:bg-spotify-dark-lighter transition-colors"
            title="Library"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 2v14M5 5l4-3 4 3M3 7h12M3 7v8a2 2 0 002 2h8a2 2 0 002-2V7" />
            </svg>
          </button>
          <button
            onClick={() => setStatsOpen(true)}
            className="w-9 h-9 rounded-full bg-spotify-dark-lighter/80 flex items-center justify-center text-spotify-gray hover:text-spotify-white hover:bg-spotify-dark-lighter transition-colors"
            title="Queue Stats"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="10" width="3" height="6" rx="0.5" />
              <rect x="7.5" y="6" width="3" height="10" rx="0.5" />
              <rect x="13" y="2" width="3" height="14" rx="0.5" />
            </svg>
          </button>
          <button
            onClick={() => setRefineOpen(true)}
            className="w-9 h-9 rounded-full bg-spotify-dark-lighter/80 flex items-center justify-center text-spotify-gray hover:text-spotify-white hover:bg-spotify-dark-lighter transition-colors"
            title="Refine Metrics"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 2v4M9 12v4M2 9h4M12 9h4" />
              <circle cx="9" cy="9" r="3" />
            </svg>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-spotify-dark-lighter/80 flex items-center justify-center text-spotify-gray hover:text-spotify-white hover:bg-spotify-dark-lighter transition-colors"
            title="Settings"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="9" r="2.5" />
              <path d="M14.7 11.1a1.2 1.2 0 00.24 1.32l.04.04a1.44 1.44 0 11-2.04 2.04l-.04-.04a1.2 1.2 0 00-1.32-.24 1.2 1.2 0 00-.72 1.08v.12a1.44 1.44 0 11-2.88 0v-.06a1.2 1.2 0 00-.78-1.08 1.2 1.2 0 00-1.32.24l-.04.04a1.44 1.44 0 11-2.04-2.04l.04-.04a1.2 1.2 0 00.24-1.32 1.2 1.2 0 00-1.08-.72h-.12a1.44 1.44 0 110-2.88h.06a1.2 1.2 0 001.08-.78 1.2 1.2 0 00-.24-1.32l-.04-.04a1.44 1.44 0 112.04-2.04l.04.04a1.2 1.2 0 001.32.24h.06a1.2 1.2 0 00.72-1.08v-.12a1.44 1.44 0 112.88 0v.06a1.2 1.2 0 00.72 1.08 1.2 1.2 0 001.32-.24l.04-.04a1.44 1.44 0 112.04 2.04l-.04.04a1.2 1.2 0 00-.24 1.32v.06a1.2 1.2 0 001.08.72h.12a1.44 1.44 0 110 2.88h-.06a1.2 1.2 0 00-1.08.72z" />
            </svg>
          </button>

          {/* User avatar */}
          <div className="relative">
            <button
              onClick={() => setAvatarMenuOpen((o) => !o)}
              className="w-9 h-9 rounded-full overflow-hidden border-2 border-transparent hover:border-spotify-green transition-colors"
              title={user.display_name}
            >
              {user.images?.[0]?.url ? (
                <img
                  src={user.images[0].url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-spotify-dark-lighter flex items-center justify-center text-spotify-gray text-sm font-bold">
                  {user.display_name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </button>

            {avatarMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAvatarMenuOpen(false)}
                />
                <div className="absolute right-0 top-11 z-50 bg-spotify-dark-light border border-spotify-dark-lighter rounded-lg shadow-xl py-2 w-48">
                  <div className="px-4 py-2 border-b border-spotify-dark-lighter">
                    <p className="text-sm font-medium text-spotify-white truncate">
                      {user.display_name}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await logout();
                      setUser(null);
                      setAvatarMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-spotify-gray hover:text-spotify-white hover:bg-spotify-dark-lighter transition-colors"
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <QueuePanel />
        <PlayerBar />

        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          queueSize={queueSize}
          onQueueSizeChange={async (size) => {
            setQueueSize(size);
            try {
              await apiSetQueueSize(size);
            } catch {
              /* ignore */
            }
          }}
          circleLayout={circleLayout}
          onCircleLayoutChange={(l) => {
            setCircleLayout(l);
            localStorage.setItem("circleLayout", l);
          }}
          gridColumns={gridColumns}
          onGridColumnsChange={(c) => {
            setGridColumns(c);
            localStorage.setItem("gridColumns", String(c));
          }}
          requestsEnabled={requestsEnabled}
          onToggleRequests={async () => {
            if (requestsEnabled) {
              await suggestionsDisable();
              setRequestsEnabled(false);
              setSuggestionsCount(0);
            } else {
              await suggestionsEnable();
              setRequestsEnabled(true);
            }
          }}
        />

        <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />

        <LibraryModal
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          onError={showToast}
        />

        <RefineModal
          open={refineOpen}
          onClose={() => {
            setRefineOpen(false);
            setInspectTrackId(null);
          }}
          inspectTrackId={inspectTrackId}
        />

        <SuggestionsModal
          open={suggestionsOpen}
          onClose={() => {
            setSuggestionsOpen(false);
            suggestionsStatus()
              .then((s) => setSuggestionsCount(s.count))
              .catch(() => {});
          }}
        />

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AppLayout>
    </PlayerProvider>
  );
}

export default function App() {
  // Check for guest suggestion mode before anything else
  const suggestCode = new URLSearchParams(window.location.search).get(
    "suggest",
  );
  if (suggestCode) {
    return <SuggestPage code={suggestCode} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
