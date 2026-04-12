import { useRef } from "react";
import { usePlayer } from "../../context/PlayerContext";
import { seek } from "../../api/spotify";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function ProgressSlider() {
  const { state, dispatch } = usePlayer();
  const seekingRef = useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekingRef.current = true;
    dispatch({ type: "SET_PROGRESS", progressMs: Number(e.target.value) });
  };

  const handleRelease = async (
    e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>,
  ) => {
    if (!seekingRef.current) return;
    seekingRef.current = false;
    const positionMs = Number((e.target as HTMLInputElement).value);
    dispatch({ type: "SET_PROGRESS", progressMs: positionMs });
    await seek(positionMs);
  };

  const progress =
    state.durationMs > 0 ? (state.progressMs / state.durationMs) * 100 : 0;

  return (
    <div className="flex items-center gap-2 w-full max-w-[500px]">
      <span className="text-xs text-spotify-gray w-10 text-right tabular-nums">
        {formatTime(state.progressMs)}
      </span>
      <div className="flex-1 relative group">
        <input
          type="range"
          min={0}
          max={state.durationMs}
          value={state.progressMs}
          onChange={handleChange}
          onMouseUp={handleRelease}
          onTouchEnd={handleRelease}
          className="w-full h-1 appearance-none bg-transparent cursor-pointer relative z-10
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-spotify-white
            [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:group-hover:opacity-100
            [&::-webkit-slider-thumb]:transition-opacity"
        />
        <div className="absolute top-1/2 left-0 -translate-y-1/2 h-1 rounded-full bg-spotify-dark-lighter w-full">
          <div
            className="h-full rounded-full bg-spotify-gray group-hover:bg-spotify-green transition-colors"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-spotify-gray w-10 tabular-nums">
        {formatTime(state.durationMs)}
      </span>
    </div>
  );
}
