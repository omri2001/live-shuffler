import { usePlayer } from "../../context/PlayerContext";
import * as api from "../../api/spotify";
import type { Track } from "../../types/spotify";

export default function QueuePanel() {
  const { state, refreshQueue } = usePlayer();

  const handleJump = async (index: number) => {
    await api.queueJump(index);
    await refreshQueue();
  };

  const handleRemove = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.queueRemove(index);
    await refreshQueue();
  };

  const handleShuffle = async () => {
    await api.queueShuffle();
    await refreshQueue();
  };

  const handleRescore = async () => {
    await api.rescoreQueue();
    await refreshQueue();
  };

  if (state.queue.length === 0) {
    return (
      <div className="absolute right-0 top-0 bottom-20 w-80 bg-spotify-dark-light border-l border-spotify-dark-lighter flex flex-col items-center justify-center p-4">
        <p className="text-spotify-gray text-sm mb-2">Queue is empty</p>
        <p className="text-spotify-gray text-xs">
          Open the library to add songs
        </p>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-0 bottom-20 w-80 bg-spotify-dark-light border-l border-spotify-dark-lighter flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-spotify-dark-lighter">
        <h2 className="text-sm font-bold text-spotify-white">Queue</h2>
        <div className="flex gap-3">
          <button
            onClick={handleRescore}
            className="text-xs text-spotify-gray hover:text-spotify-white transition-colors"
            title="Re-score all tracks with current metric configs"
          >
            Re-score
          </button>
          <button
            onClick={handleShuffle}
            className="text-xs text-spotify-gray hover:text-spotify-white transition-colors"
            title="Shuffle remaining"
          >
            Shuffle
          </button>
        </div>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {state.queue.map((track: Track, index: number) => {
          const isCurrent = index === state.queueIndex;
          const albumArt =
            track.album.images[track.album.images.length - 1]?.url;

          return (
            <div
              key={`${track.id}-${index}`}
              onClick={() => handleJump(index)}
              className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-spotify-dark-lighter transition-colors ${
                isCurrent ? "bg-spotify-dark-lighter" : ""
              }`}
            >
              <span className="w-5 text-xs text-spotify-gray text-right shrink-0">
                {isCurrent ? (
                  <span className="text-spotify-green">&#9654;</span>
                ) : (
                  index + 1
                )}
              </span>
              {albumArt ? (
                <img
                  src={albumArt}
                  alt=""
                  className="w-8 h-8 rounded shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-spotify-dark-lighter shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm truncate ${isCurrent ? "text-spotify-green" : "text-spotify-white"}`}
                >
                  {track.name}
                </p>
                <p className="text-xs text-spotify-gray truncate">
                  {track.artists.map((a) => a.name).join(", ")}
                </p>
              </div>
              <button
                onClick={(e) => handleRemove(index, e)}
                className="text-spotify-gray hover:text-spotify-white transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                title="Remove"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="currentColor"
                >
                  <path
                    d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
