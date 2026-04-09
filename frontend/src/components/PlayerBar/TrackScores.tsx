import { useEffect, useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { fetchMetricConfigs, type MetricConfig } from '../../api/spotify';

interface TrackScoresProps {
  onInspect?: (trackId: string) => void;
}

export default function TrackScores({ onInspect }: TrackScoresProps) {
  const { state } = usePlayer();
  const scores = state.currentTrack?._scores;
  const [configs, setConfigs] = useState<Record<string, MetricConfig>>({});

  useEffect(() => {
    fetchMetricConfigs().then(setConfigs).catch(() => {});
  }, []);

  const getColor = (name: string) => configs[name]?.color ?? '#1DB954';

  return (
    <div className="absolute left-0 top-0 bottom-20 w-64 bg-spotify-dark-light border-r border-spotify-dark-lighter flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-spotify-dark-lighter shrink-0">
        <h2 className="text-sm font-bold text-spotify-white">Song Metrics</h2>
        {state.currentTrack && onInspect && (
          <button
            onClick={() => onInspect(state.currentTrack!.id)}
            className="text-xs text-spotify-gray hover:text-spotify-white transition-colors"
          >
            Inspect
          </button>
        )}
      </div>

      {!state.currentTrack ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-spotify-gray text-sm text-center">No track playing</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Track info */}
          <div className="mb-4">
            <p className="text-sm font-medium text-spotify-white truncate">
              {state.currentTrack.name}
            </p>
            <p className="text-xs text-spotify-gray truncate">
              {state.currentTrack.artists.map(a => a.name).join(', ')}
            </p>
          </div>

          {/* Scores */}
          {scores && Object.keys(scores).length > 0 ? (
            <div className="flex flex-col gap-3 pb-6">
              {Object.entries(scores).map(([name, value]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs uppercase tracking-wider text-spotify-gray">
                      {name}
                    </span>
                    <span className="text-xs font-medium tabular-nums" style={{ color: getColor(name) }}>
                      {value}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-spotify-dark-lighter overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${value}%`,
                        backgroundColor: getColor(name),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-spotify-gray text-xs">No scores available</p>
          )}
        </div>
      )}
    </div>
  );
}
