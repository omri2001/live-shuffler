import { useState, useEffect, useRef } from 'react';
import * as api from '../../api/spotify';
import type { SuggestionTrack, SuggestionItem } from '../../api/spotify';

interface SuggestPageProps {
  code: string;
}

export default function SuggestPage({ code }: SuggestPageProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SuggestionTrack[]>([]);
  const [pool, setPool] = useState<SuggestionItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitted, setSubmitted] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`suggest_votes_${code}`) || '[]')); } catch { return new Set(); }
  });
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // Poll the suggestion pool and clean stale votes
  useEffect(() => {
    const fetch = () => api.suggestionsPool(code).then(d => {
      setPool(d.suggestions);
      const currentIds = new Set(d.suggestions.map((s: SuggestionItem) => s.track_id));
      setSubmitted(prev => {
        const cleaned = new Set([...prev].filter(id => currentIds.has(id)));
        if (cleaned.size !== prev.size) {
          localStorage.setItem(`suggest_votes_${code}`, JSON.stringify([...cleaned]));
        }
        return cleaned;
      });
    }).catch(() => setError('Session closed'));
    fetch();
    pollRef.current = setInterval(fetch, 5000);
    return () => clearInterval(pollRef.current);
  }, [code]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      api.suggestionsSearch(code, query)
        .then(d => setResults(d.tracks))
        .catch(() => setError('Session closed'))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, code]);

  const handleSuggest = async (track: SuggestionTrack) => {
    if (submitted.has(track.id) && pool.some(s => s.track_id === track.id)) return;
    try {
      await api.suggestionsSubmit(code, track.id, track);
      setSubmitted(prev => {
        const next = new Set(prev).add(track.id);
        localStorage.setItem(`suggest_votes_${code}`, JSON.stringify([...next]));
        return next;
      });
      api.suggestionsPool(code).then(d => setPool(d.suggestions)).catch(() => {});
    } catch {
      setError('Failed to submit');
    }
  };

  const handleUnvote = async (trackId: string) => {
    if (!submitted.has(trackId)) return;
    try {
      await api.suggestionsUnvote(code, trackId);
      setSubmitted(prev => {
        const next = new Set(prev);
        next.delete(trackId);
        localStorage.setItem(`suggest_votes_${code}`, JSON.stringify([...next]));
        return next;
      });
      api.suggestionsPool(code).then(d => setPool(d.suggestions)).catch(() => {});
    } catch {
      // ignore
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-spotify-dark flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-spotify-white text-lg font-bold mb-2">Session Closed</p>
          <p className="text-spotify-gray text-sm">The DJ has stopped accepting requests</p>
        </div>
      </div>
    );
  }

  const poolIds = new Set(pool.map(s => s.track_id));

  return (
    <div className="min-h-screen bg-spotify-dark text-spotify-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-spotify-dark border-b border-spotify-dark-lighter px-4 py-4">
        <h1 className="text-lg font-bold mb-3 text-center">Suggest a Song</h1>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search for a song..."
          autoFocus
          className="w-full bg-spotify-dark-light border border-spotify-dark-lighter rounded-xl px-4 py-3 text-base text-spotify-white placeholder-spotify-gray focus:outline-none focus:border-spotify-green"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search results */}
        {query.length >= 2 && (
          <div className="px-4 py-3">
            {searching ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <p className="text-spotify-gray text-sm text-center py-4">No results</p>
            ) : (
              <div className="space-y-2">
                {results.map(track => {
                  const alreadyInPool = poolIds.has(track.id);
                  const justSubmitted = submitted.has(track.id) && alreadyInPool;
                  return (
                    <div key={track.id} className="flex items-center gap-3 p-3 rounded-xl bg-spotify-dark-light">
                      {track.image ? (
                        <img src={track.image} alt="" className="w-12 h-12 rounded shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-spotify-dark-lighter shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{track.name}</p>
                        <p className="text-xs text-spotify-gray truncate">{track.artists.join(', ')}</p>
                      </div>
                      {justSubmitted ? (
                        <button
                          onClick={() => handleUnvote(track.id)}
                          className="px-4 py-2 rounded-full text-sm font-semibold shrink-0 transition-colors border border-red-500/50 text-red-400 hover:bg-red-500/10 active:scale-95"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuggest(track)}
                          className="px-4 py-2 rounded-full text-sm font-semibold shrink-0 transition-colors bg-spotify-green text-black hover:bg-spotify-green-hover active:scale-95"
                        >
                          Suggest
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Current pool */}
        {pool.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs text-spotify-gray uppercase tracking-wider mb-2">
              Current Requests ({pool.length})
            </p>
            <div className="space-y-2">
              {pool.map(s => (
                <div key={s.track_id} className="flex items-center gap-3 p-3 rounded-xl bg-spotify-dark-light/50">
                  {s.track.image ? (
                    <img src={s.track.image} alt="" className="w-10 h-10 rounded shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-spotify-dark-lighter shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{s.track.name}</p>
                    <p className="text-xs text-spotify-gray truncate">{s.track.artists.join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.count > 1 && (
                      <span className="px-2 py-0.5 rounded-full bg-spotify-green/20 text-spotify-green text-xs font-bold">{s.count}</span>
                    )}
                    {submitted.has(s.track_id) ? (
                      <button
                        onClick={() => handleUnvote(s.track_id)}
                        className="px-3 py-1.5 rounded-full text-xs transition-colors border border-red-500/50 text-red-400 hover:bg-red-500/10 active:scale-95"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSuggest(s.track as SuggestionTrack)}
                        className="px-3 py-1.5 rounded-full text-xs transition-colors bg-spotify-dark-lighter text-spotify-gray hover:text-spotify-white active:scale-95"
                      >
                        +1
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pool.length === 0 && query.length < 2 && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <p className="text-spotify-gray text-sm text-center">Search for a song to suggest it to the DJ</p>
          </div>
        )}
      </div>
    </div>
  );
}
