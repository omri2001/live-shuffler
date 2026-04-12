interface MetricSliderProps {
  color: string;
  value: number;
  onChange: (value: number) => void;
  onCommit: () => void;
  onHover: (hovering: boolean) => void;
  x: number;
  y: number;
}

export default function MetricSlider({
  color,
  value,
  onChange,
  onCommit,
  onHover,
  x,
  y,
}: MetricSliderProps) {
  const handleSliderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const py = rect.bottom - e.clientY;
    const pct = Math.round(
      Math.max(0, Math.min(100, (py / rect.height) * 100)),
    );
    onChange(pct);
  };

  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    handleSliderClick(e);
  };

  return (
    <div
      className="fixed z-50 pointer-events-auto"
      style={{ left: x, top: y - 16, transform: "translate(-50%, -100%)" }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Invisible buffer zone around the slider */}
      <div className="p-6 -m-6">
        <div className="flex flex-col items-center">
          {/* Value label */}
          <div
            className="mb-2 px-2.5 py-1 rounded-md text-xs font-bold tabular-nums"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {value}%
          </div>

          {/* Track */}
          <div
            className="w-4 h-48 rounded-full relative cursor-pointer"
            style={{
              backgroundColor: `${color}15`,
              border: `1px solid ${color}30`,
            }}
            onClick={(e) => {
              handleSliderClick(e);
              onCommit();
            }}
            onMouseMove={handleDrag}
            onMouseUp={onCommit}
          >
            {/* Fill with glow */}
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
              style={{
                height: `${value}%`,
                background: `linear-gradient(to top, ${color}, ${color}88)`,
                boxShadow: value > 0 ? `0 0 8px ${color}66` : "none",
              }}
            />

            {/* Thumb */}
            <div
              className="absolute left-1/2 -translate-x-1/2 w-7 h-7 rounded-full border-[3px] shadow-lg transition-all duration-75 pointer-events-none"
              style={{
                bottom: `clamp(-4px, calc(${value}% - 14px), calc(100% - 24px))`,
                backgroundColor: color,
                borderColor: "#fff",
                boxShadow: `0 0 10px ${color}88, 0 2px 8px rgba(0,0,0,0.4)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
