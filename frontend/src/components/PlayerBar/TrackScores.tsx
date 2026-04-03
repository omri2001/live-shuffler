import { usePlayer } from '../../context/PlayerContext';

const SCORE_COLORS: Record<string, string> = {
  hebrew: '#3B82F6',
  non_english: '#26A69A',
  hiphop: '#9C27B0',
  pop: '#E91E63',
  metal: '#607D8B',
  jungle: '#4CAF50',
  dnb: '#FF9800',
  dubstep: '#F44336',
  jazz: '#FF9800',
  chill: '#00BCD4',
  dance: '#CDDC39',
};

export default function TrackScores() {
  const { state } = usePlayer();
  const scores = state.currentTrack?._scores;

  return (
    <div className="absolute left-0 top-0 bottom-20 w-64 bg-spotify-dark-light border-r border-spotify-dark-lighter flex flex-col">
      <div className="px-4 py-3 border-b border-spotify-dark-lighter">
        <h2 className="text-sm font-bold text-spotify-white">Song Metrics</h2>
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
            <div className="flex flex-col gap-3">
              {Object.entries(scores).map(([name, value]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs uppercase tracking-wider text-spotify-gray">
                      {name}
                    </span>
                    <span className="text-xs font-medium tabular-nums" style={{ color: SCORE_COLORS[name] || '#1DB954' }}>
                      {value}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-spotify-dark-lighter overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${value}%`,
                        backgroundColor: SCORE_COLORS[name] || '#1DB954',
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
