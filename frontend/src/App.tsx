import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchMe, setQueueSize as apiSetQueueSize } from './api/spotify';
import type { SpotifyUser } from './types/spotify';
import { PlayerProvider } from './context/PlayerContext';
import AppLayout from './components/Layout/AppLayout';
import GenreCircles from './components/GenreCircles/GenreCircles';
import PlayerBar from './components/PlayerBar/PlayerBar';
import TrackScores from './components/PlayerBar/TrackScores';
import QueuePanel from './components/Queue/QueuePanel';
import SettingsModal from './components/Settings/SettingsModal';
import LibraryModal from './components/Library/LibraryModal';
import LoginButton from './components/Auth/LoginButton';

const queryClient = new QueryClient();

function AppContent() {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [queueSize, setQueueSize] = useState(10);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    if (session) {
      document.cookie = `session_id=${session}; path=/; max-age=${86400 * 30}; samesite=lax`;
      window.history.replaceState({}, '', '/');
    }

    fetchMe()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.body.classList.toggle('light', !darkMode);
  }, [darkMode]);

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
        <TrackScores />
        <GenreCircles />

        {/* Top-right buttons — left of queue */}
        <div className="absolute top-4 right-84 z-10 flex gap-2">
          <button
            onClick={() => setLibraryOpen(true)}
            className="w-9 h-9 rounded-full bg-spotify-dark-lighter/80 flex items-center justify-center text-spotify-gray hover:text-spotify-white hover:bg-spotify-dark-lighter transition-colors"
            title="Library"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 2v14M5 5l4-3 4 3M3 7h12M3 7v8a2 2 0 002 2h8a2 2 0 002-2V7" />
            </svg>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-spotify-dark-lighter/80 flex items-center justify-center text-spotify-gray hover:text-spotify-white hover:bg-spotify-dark-lighter transition-colors"
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="9" r="2.5" />
              <path d="M14.7 11.1a1.2 1.2 0 00.24 1.32l.04.04a1.44 1.44 0 11-2.04 2.04l-.04-.04a1.2 1.2 0 00-1.32-.24 1.2 1.2 0 00-.72 1.08v.12a1.44 1.44 0 11-2.88 0v-.06a1.2 1.2 0 00-.78-1.08 1.2 1.2 0 00-1.32.24l-.04.04a1.44 1.44 0 11-2.04-2.04l.04-.04a1.2 1.2 0 00.24-1.32 1.2 1.2 0 00-1.08-.72h-.12a1.44 1.44 0 110-2.88h.06a1.2 1.2 0 001.08-.78 1.2 1.2 0 00-.24-1.32l-.04-.04a1.44 1.44 0 112.04-2.04l.04.04a1.2 1.2 0 001.32.24h.06a1.2 1.2 0 00.72-1.08v-.12a1.44 1.44 0 112.88 0v.06a1.2 1.2 0 00.72 1.08 1.2 1.2 0 001.32-.24l.04-.04a1.44 1.44 0 112.04 2.04l-.04.04a1.2 1.2 0 00-.24 1.32v.06a1.2 1.2 0 001.08.72h.12a1.44 1.44 0 110 2.88h-.06a1.2 1.2 0 00-1.08.72z" />
            </svg>
          </button>
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
            try { await apiSetQueueSize(size); } catch { /* ignore */ }
          }}
        />

        <LibraryModal
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
        />
      </AppLayout>
    </PlayerProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
