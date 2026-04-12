interface MetricCircleProps {
  name: string;
  color: string;
  value: number;
  dimmed: boolean;
  sizeClass?: string;
  onHover: (hovering: boolean) => void;
  onClick: () => void;
  circleRef?: (el: HTMLDivElement | null) => void;
}

export default function MetricCircle({
  name,
  color,
  value,
  dimmed,
  sizeClass,
  onHover,
  onClick,
  circleRef,
}: MetricCircleProps) {
  return (
    <div
      className="shrink-0"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      ref={circleRef}
    >
      <div
        onClick={onClick}
        className={`${sizeClass ?? "w-32 h-32"} rounded-full flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110`}
        style={{
          backgroundColor:
            value > 0
              ? `${color}${Math.max(20, Math.round(value * 0.6))
                  .toString(16)
                  .padStart(2, "0")}`
              : `${color}1a`,
          border: `2px solid ${value > 0 ? color : `${color}66`}`,
          opacity: dimmed ? 0.3 : 1,
          transform: dimmed ? "scale(0.9)" : undefined,
        }}
      >
        <span
          className={`${sizeClass?.includes("w-16") || sizeClass?.includes("w-20") ? "text-[10px]" : sizeClass?.includes("w-24") ? "text-xs" : "text-sm"} font-semibold select-none text-center leading-tight px-1 whitespace-pre-line`}
          style={{ color }}
        >
          {name.replace("_", "\n")}
        </span>
        {value > 0 && (
          <span
            className="text-[10px] mt-0.5 font-medium opacity-80"
            style={{ color }}
          >
            {value}%
          </span>
        )}
      </div>
    </div>
  );
}
