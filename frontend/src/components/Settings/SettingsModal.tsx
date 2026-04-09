import { useEffect } from 'react';
import type { CircleLayout } from '../../App';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  queueSize: number;
  onQueueSizeChange: (size: number) => void;
  circleLayout: CircleLayout;
  onCircleLayoutChange: (layout: CircleLayout) => void;
  gridColumns: number;
  onGridColumnsChange: (cols: number) => void;
}

const LAYOUTS: { key: CircleLayout; label: string }[] = [
  { key: 'carousel', label: 'Scroll' },
  { key: 'grid', label: 'Grid' },
  { key: 'favorites', label: 'Picks' },
];

export default function SettingsModal({ open, onClose, darkMode, onToggleDarkMode, queueSize, onQueueSizeChange, circleLayout, onCircleLayoutChange, gridColumns, onGridColumnsChange }: SettingsModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-spotify-dark-light rounded-xl shadow-2xl w-96 max-w-[90vw] border border-spotify-dark-lighter">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-spotify-dark-lighter">
          <h2 className="text-lg font-bold text-spotify-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-spotify-gray hover:text-spotify-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Dark/Light mode toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-spotify-white">Dark mode</p>
              <p className="text-xs text-spotify-gray mt-0.5">Switch between dark and light theme</p>
            </div>
            <button
              onClick={onToggleDarkMode}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                darkMode ? 'bg-spotify-green' : 'bg-spotify-dark-lighter'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  darkMode ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Queue size */}
          <div className="flex items-center justify-between mt-5 pt-5 border-t border-spotify-dark-lighter">
            <div>
              <p className="text-sm font-medium text-spotify-white">Queue size</p>
              <p className="text-xs text-spotify-gray mt-0.5">Number of songs in the queue</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onQueueSizeChange(Math.max(1, queueSize - 1))}
                disabled={queueSize <= 1}
                className="w-7 h-7 rounded-full bg-spotify-dark-lighter text-spotify-white flex items-center justify-center hover:bg-spotify-gray/30 transition-colors text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                -
              </button>
              <span
                className="text-sm font-medium text-spotify-white w-6 text-center tabular-nums cursor-text"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  const v = Math.max(1, Math.min(50, Number(e.currentTarget.textContent) || 1));
                  onQueueSizeChange(v);
                  e.currentTarget.textContent = String(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
                }}
              >
                {queueSize}
              </span>
              <button
                onClick={() => onQueueSizeChange(Math.min(50, queueSize + 1))}
                disabled={queueSize >= 50}
                className="w-7 h-7 rounded-full bg-spotify-dark-lighter text-spotify-white flex items-center justify-center hover:bg-spotify-gray/30 transition-colors text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          </div>

          {/* Metric layout */}
          <div className="flex items-center justify-between mt-5 pt-5 border-t border-spotify-dark-lighter">
            <div>
              <p className="text-sm font-medium text-spotify-white">Metric layout</p>
              <p className="text-xs text-spotify-gray mt-0.5">How metric circles are displayed</p>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-spotify-dark-lighter">
              {LAYOUTS.map(l => (
                <button
                  key={l.key}
                  onClick={() => onCircleLayoutChange(l.key)}
                  className={`min-w-[52px] px-3 py-1.5 text-xs font-medium transition-colors text-center ${
                    circleLayout === l.key
                      ? 'bg-spotify-green text-black'
                      : 'bg-spotify-dark-lighter text-spotify-gray hover:text-spotify-white'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid zoom (only when grid layout is selected) */}
          {circleLayout === 'grid' && (
            <div className="flex items-center justify-between mt-5 pt-5 border-t border-spotify-dark-lighter">
              <div>
                <p className="text-sm font-medium text-spotify-white">Grid size</p>
                <p className="text-xs text-spotify-gray mt-0.5">Circles per row</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onGridColumnsChange(Math.max(3, gridColumns - 1))}
                  disabled={gridColumns <= 3}
                  className="w-7 h-7 rounded-full bg-spotify-dark-lighter text-spotify-white flex items-center justify-center hover:bg-spotify-gray/30 transition-colors text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <span
                  className="text-sm font-medium text-spotify-white w-6 text-center tabular-nums cursor-text"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const v = Math.max(3, Math.min(10, Number(e.currentTarget.textContent) || 3));
                    onGridColumnsChange(v);
                    e.currentTarget.textContent = String(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
                  }}
                >
                  {gridColumns}
                </span>
                <button
                  onClick={() => onGridColumnsChange(Math.min(10, gridColumns + 1))}
                  disabled={gridColumns >= 10}
                  className="w-7 h-7 rounded-full bg-spotify-dark-lighter text-spotify-white flex items-center justify-center hover:bg-spotify-gray/30 transition-colors text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
