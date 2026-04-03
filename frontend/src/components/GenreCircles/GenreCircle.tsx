interface MetricCircleProps {
  name: string;
  color: string;
  value: number;
  dimmed: boolean;
  onHover: (hovering: boolean) => void;
  onClick: () => void;
}

export default function MetricCircle({ name, color, value, dimmed, onHover, onClick }: MetricCircleProps) {
  return (
    <div
      className="shrink-0"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div
        onClick={onClick}
        className="w-32 h-32 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110"
        style={{
          backgroundColor: value > 0 ? `${color}${Math.max(20, Math.round(value * 0.6)).toString(16).padStart(2, '0')}` : `${color}1a`,
          border: `2px solid ${value > 0 ? color : `${color}66`}`,
          opacity: dimmed ? 0.3 : 1,
          transform: dimmed ? 'scale(0.9)' : undefined,
        }}
      >
        <span
          className="text-sm font-semibold select-none text-center leading-tight px-1 whitespace-pre-line"
          style={{ color }}
        >
          {name.replace('_', '\n')}
        </span>
        {value > 0 && (
          <span className="text-[10px] mt-0.5 font-medium opacity-80" style={{ color }}>
            {value}%
          </span>
        )}
      </div>
    </div>
  );
}
