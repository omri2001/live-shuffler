import { useEffect, useState } from 'react';
import { fetchQueueStats, type QueueStats } from '../../api/spotify';
import { METRIC_COLORS } from '../../constants/metricColors';

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
}

const BUCKET_ORDER = ['0', '1-19', '20-39', '40-59', '60-79', '80-100'];

export default function StatsModal({ open, onClose }: StatsModalProps) {
  const [stats, setStats] = useState<QueueStats | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchQueueStats().then(setStats).catch(() => setStats(null));
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const metrics = stats
    ? Object.entries(stats.metrics)
        .map(([name, buckets]) => ({
          name,
          buckets,
          nonZero: BUCKET_ORDER.slice(1).reduce((sum, b) => sum + (buckets[b] ?? 0), 0),
        }))
        .sort((a, b) => b.nonZero - a.nonZero)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-spotify-dark-light rounded-xl shadow-2xl w-[540px] max-w-[90vw] max-h-[80vh] border border-spotify-dark-lighter flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-spotify-dark-lighter shrink-0">
          <h2 className="text-lg font-bold text-spotify-white">Score Distribution</h2>
          <button
            onClick={onClose}
            className="text-spotify-gray hover:text-spotify-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">
          {!stats || stats.total === 0 ? (
            <p className="text-sm text-spotify-gray text-center">No tracks loaded</p>
          ) : (
            <>
              <p className="text-xs text-spotify-gray mb-5">{stats.total} unplayed tracks</p>
              <div className="space-y-6">
                {metrics.map(({ name, buckets }) => {
                  const maxCount = Math.max(...BUCKET_ORDER.map((b) => buckets[b] ?? 0), 1);
                  return (
                    <div key={name}>
                      <p className="text-sm font-medium capitalize mb-2" style={{ color: METRIC_COLORS[name] ?? '#1DB954' }}>
                        {name.replace('_', ' ')}
                      </p>
                      <div className="flex items-end gap-1 h-20">
                        {BUCKET_ORDER.map((label) => {
                          const count = buckets[label] ?? 0;
                          const heightPct = (count / maxCount) * 100;
                          const color = METRIC_COLORS[name] ?? '#1DB954';
                          return (
                            <div key={label} className="flex-1 flex flex-col items-center h-full justify-end group">
                              <span className="text-[10px] text-spotify-gray tabular-nums mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {count}
                              </span>
                              <div
                                className="w-full rounded-t-sm transition-all duration-300 min-h-[2px]"
                                style={{
                                  height: count > 0 ? `${Math.max(heightPct, 5)}%` : '2px',
                                  backgroundColor: color,
                                  opacity: count > 0 ? 1 : 0.2,
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {BUCKET_ORDER.map((label) => (
                          <span key={label} className="flex-1 text-center text-[9px] text-spotify-gray">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
