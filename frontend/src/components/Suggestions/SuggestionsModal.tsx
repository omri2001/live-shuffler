import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import * as api from "../../api/spotify";
import type { SuggestionItem } from "../../api/spotify";
import { usePlayer } from "../../context/PlayerContext";

interface SuggestionsModalProps {
  open: boolean;
  onClose: () => void;
}

function timeAgo(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function SuggestionsModal({
  open,
  onClose,
}: SuggestionsModalProps) {
  const { refreshQueue } = usePlayer();
  const [enabled, setEnabled] = useState(false);
  const [code, setCode] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .suggestionsStatus()
      .then((s) => {
        setEnabled(s.enabled);
        setCode(s.code);
        if (s.enabled) {
          api.suggestionsList().then((d) => setSuggestions(d.suggestions));
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  // Poll for new suggestions
  useEffect(() => {
    if (!open || !enabled) {
      clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => {
      api
        .suggestionsList()
        .then((d) => setSuggestions(d.suggestions))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [open, enabled]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleAccept = async (trackId: string) => {
    const result = await api.suggestionsAccept(trackId);
    setSuggestions((prev) => prev.filter((s) => s.track_id !== trackId));
    await refreshQueue();
  };

  const handleDismiss = async (trackId: string) => {
    await api.suggestionsDismiss(trackId);
    setSuggestions((prev) => prev.filter((s) => s.track_id !== trackId));
  };

  const suggestUrl = `${window.location.origin}?suggest=${code}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(suggestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-spotify-dark-light rounded-xl shadow-2xl w-[520px] max-w-[90vw] max-h-[80vh] border border-spotify-dark-lighter flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-spotify-dark-lighter shrink-0">
          <h2 className="text-lg font-bold text-spotify-white">
            Song Requests
          </h2>
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

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !enabled ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <p className="text-spotify-gray text-sm mb-2">
                Requests are disabled
              </p>
              <p className="text-spotify-gray text-xs text-center">
                Enable song requests in Settings
              </p>
            </div>
          ) : (
            <div className="p-6">
              {/* QR + link */}
              <div className="flex items-center gap-5 mb-6 p-4 rounded-lg bg-spotify-dark-lighter/50">
                <div className="bg-white p-2 rounded-lg shrink-0">
                  <QRCodeSVG value={suggestUrl} size={100} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-spotify-gray mb-2">
                    Share this link or QR code
                  </p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs text-spotify-white bg-spotify-dark rounded px-2 py-1.5 truncate">
                      {suggestUrl}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1.5 rounded bg-spotify-green text-black text-xs font-semibold hover:bg-spotify-green-hover transition-colors shrink-0"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Suggestions list */}
              {suggestions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-spotify-gray text-sm">No requests yet</p>
                  <p className="text-spotify-gray text-xs mt-1">
                    Share the QR code and wait for suggestions
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-spotify-gray mb-2">
                    {suggestions.length} request
                    {suggestions.length !== 1 ? "s" : ""}
                  </p>
                  {suggestions.map((s) => (
                    <div
                      key={s.track_id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-spotify-dark-lighter/30 hover:bg-spotify-dark-lighter/50 transition-colors"
                    >
                      {s.track.image ? (
                        <img
                          src={s.track.image}
                          alt=""
                          className="w-10 h-10 rounded shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-spotify-dark-lighter shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-spotify-white truncate">
                          {s.track.name}
                        </p>
                        <p className="text-xs text-spotify-gray truncate">
                          {s.track.artists.join(", ")}
                        </p>
                      </div>
                      {/* Count badge */}
                      {s.count > 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-spotify-green/20 text-spotify-green text-xs font-bold tabular-nums shrink-0">
                          {s.count}
                        </span>
                      )}
                      <span className="text-[10px] text-spotify-gray shrink-0 w-12 text-right">
                        {timeAgo(s.first_requested)}
                      </span>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleAccept(s.track_id)}
                          className="px-2.5 py-1 rounded-full bg-spotify-green text-black text-xs font-semibold hover:bg-spotify-green-hover transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => handleDismiss(s.track_id)}
                          className="px-2.5 py-1 rounded-full border border-red-500/50 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
