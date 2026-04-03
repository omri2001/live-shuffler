import { useEffect } from 'react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  queueSize: number;
  onQueueSizeChange: (size: number) => void;
}

export default function SettingsModal({ open, onClose, darkMode, onToggleDarkMode, queueSize, onQueueSizeChange }: SettingsModalProps) {
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
                className="w-7 h-7 rounded-full bg-spotify-dark-lighter text-spotify-white flex items-center justify-center hover:bg-spotify-gray/30 transition-colors text-sm font-bold"
              >
                -
              </button>
              <span className="text-sm font-medium text-spotify-white w-6 text-center tabular-nums">{queueSize}</span>
              <button
                onClick={() => onQueueSizeChange(Math.min(50, queueSize + 1))}
                className="w-7 h-7 rounded-full bg-spotify-dark-lighter text-spotify-white flex items-center justify-center hover:bg-spotify-gray/30 transition-colors text-sm font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
