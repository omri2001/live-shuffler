import { useRef, useState, useEffect, useCallback } from 'react';
import MetricCircle from './GenreCircle';
import MetricSlider from './MetricSlider';
import { usePlayer } from '../../context/PlayerContext';
import * as api from '../../api/spotify';
import type { MetricConfig } from '../../api/spotify';
import type { CircleLayout } from '../../App';

interface GenreCirclesProps {
  layout: CircleLayout;
  favoriteMetrics: string[];
  onFavoriteMetricsChange: (metrics: string[]) => void;
  gridColumns: number;
}

export default function GenreCircles({ layout, favoriteMetrics, onFavoriteMetricsChange, gridColumns }: GenreCirclesProps) {
  const { refreshQueue } = usePlayer();
  const scrollRef = useRef<HTMLDivElement>(null);
  const circleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState({ x: 0, y: 0 });
  const circleHover = useRef(false);
  const sliderHover = useRef(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [favPickerOpen, setFavPickerOpen] = useState(false);

  const [metricConfigs, setMetricConfigs] = useState<Record<string, MetricConfig>>({});
  const allMetricNames = Object.keys(metricConfigs);

  useEffect(() => {
    api.fetchMetricConfigs().then(setMetricConfigs).catch(() => {});
  }, []);

  // Which metrics to display based on layout
  const metricNames = layout === 'favorites'
    ? allMetricNames.filter(m => favoriteMetrics.includes(m))
    : allMetricNames;

  const [values, setValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (allMetricNames.length > 0 && Object.keys(values).length === 0) {
      setValues(Object.fromEntries(allMetricNames.map((m) => [m, 0])));
    }
  }, [allMetricNames.length]);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    updateScrollState();
  }, [metricNames.length, layout]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -250 : 250, behavior: 'smooth' });
  };

  const handleChange = (name: string, value: number) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setSoloMetric(null);
    savedValues.current = null;
  };

  const [soloMetric, setSoloMetric] = useState<string | null>(null);
  const savedValues = useRef<Record<string, number> | null>(null);
  const hasAnyValue = Object.values(values).some((v) => v > 0);

  const handleReset = () => {
    setValues(Object.fromEntries(allMetricNames.map((m) => [m, 0])));
    setSoloMetric(null);
    savedValues.current = null;
  };

  const handleRandomMetrics = () => {
    const newValues = Object.fromEntries(
      metricNames.map((m) => [m, Math.random() < 0.4 ? 0 : Math.round(Math.random() * 100)])
    );
    // Keep non-visible metrics at their current value
    const merged = { ...values, ...newValues };
    setValues(merged);
    setSoloMetric(null);
    savedValues.current = null;
    valuesRef.current = merged;
    handleCommit();
  };

  const handleTrueRandom = async () => {
    setValues(Object.fromEntries(allMetricNames.map((m) => [m, 0])));
    setSoloMetric(null);
    savedValues.current = null;
    try {
      await api.queueShuffleRandom();
      await refreshQueue();
    } catch {
      // ignore
    }
  };

  const handleCircleClick = (name: string) => {
    if (soloMetric === name) {
      const restored = savedValues.current ?? Object.fromEntries(allMetricNames.map((m) => [m, 0]));
      setValues(restored);
      valuesRef.current = restored;
      setSoloMetric(null);
      savedValues.current = null;
      handleCommit();
    } else {
      if (!soloMetric) {
        savedValues.current = { ...values };
      }
      const soloValues = Object.fromEntries(allMetricNames.map((m) => [m, m === name ? 100 : 0]));
      setValues(soloValues);
      setSoloMetric(name);
      valuesRef.current = soloValues;
      handleCommit();
    }
  };

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      if (!circleHover.current && !sliderHover.current) {
        setHoveredMetric(null);
      }
    }, 200);
  }, []);

  const handleCircleHover = useCallback((name: string, hovering: boolean) => {
    circleHover.current = hovering;
    if (hovering) {
      clearTimeout(hideTimeout.current);
      const el = circleRefs.current.get(name);
      if (el) {
        // In carousel, skip if the circle is outside the visible scroll area
        const container = scrollRef.current;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const circleRect = el.getBoundingClientRect();
          const circleCenter = circleRect.left + circleRect.width / 2;
          if (circleCenter < containerRect.left || circleCenter > containerRect.right) {
            return;
          }
        }
        const rect = el.getBoundingClientRect();
        setSliderPos({ x: rect.left + rect.width / 2, y: rect.top });
      }
      setHoveredMetric(name);
    } else {
      scheduleHide();
    }
  }, [scheduleHide]);

  const valuesRef = useRef(values);
  valuesRef.current = values;

  const handleCommit = useCallback(async () => {
    try {
      await api.queueRerank(valuesRef.current);
      await refreshQueue();
    } catch {
      // ignore
    }
  }, [refreshQueue]);

  const wheelCommitRef = useRef<ReturnType<typeof setTimeout>>();
  const handleWheel = useCallback((name: string, e: React.WheelEvent) => {
    e.preventDefault();
    const raw = -e.deltaY;
    const delta = Math.sign(raw) * Math.max(1, Math.round(Math.abs(raw) / 20));
    setValues((prev) => {
      const newVal = Math.max(0, Math.min(100, (prev[name] ?? 0) + delta));
      const updated = { ...prev, [name]: newVal };
      valuesRef.current = updated;
      return updated;
    });
    setSoloMetric(null);
    savedValues.current = null;
    clearTimeout(wheelCommitRef.current);
    wheelCommitRef.current = setTimeout(() => handleCommit(), 300);
  }, [handleCommit]);

  const handleSliderHover = useCallback((hovering: boolean) => {
    sliderHover.current = hovering;
    if (hovering) {
      clearTimeout(hideTimeout.current);
    } else {
      scheduleHide();
    }
  }, [scheduleHide]);

  const toggleFavorite = (name: string) => {
    const next = favoriteMetrics.includes(name)
      ? favoriteMetrics.filter(m => m !== name)
      : [...favoriteMetrics, name];
    onFavoriteMetricsChange(next);
  };

  if (allMetricNames.length === 0) return null;

  const getColor = (name: string) => metricConfigs[name]?.color ?? '#1DB954';

  // Grid circle size based on columns — more columns = smaller circles
  const gridSizeClass = gridColumns >= 9 ? 'w-16 h-16' : gridColumns >= 7 ? 'w-20 h-20' : gridColumns >= 5 ? 'w-24 h-24' : 'w-28 h-28';

  const renderCircle = (name: string) => (
    <div key={name} className="flex justify-center"
      onWheel={(e) => handleWheel(name, e)}>
      <MetricCircle
        name={name}
        color={getColor(name)}
        value={values[name] ?? 0}
        dimmed={soloMetric !== null && soloMetric !== name}
        sizeClass={layout === 'grid' ? gridSizeClass : undefined}
        onHover={(h) => handleCircleHover(name, h)}
        onClick={() => handleCircleClick(name)}
        circleRef={(el) => { if (el) circleRefs.current.set(name, el); }}
      />
    </div>
  );

  const actionButtons = (
    <div className="flex justify-center mt-2 gap-2">
      {hasAnyValue && (
        <button onClick={handleReset} className="text-xs text-spotify-gray hover:text-spotify-white transition-colors px-3 py-1 rounded-full border border-spotify-dark-lighter hover:border-spotify-gray">
          Reset
        </button>
      )}
      <button onClick={handleRandomMetrics} className="text-xs text-spotify-gray hover:text-spotify-white transition-colors px-3 py-1 rounded-full border border-spotify-dark-lighter hover:border-spotify-gray" title="Randomize metric sliders and reshuffle">
        Random mix
      </button>
      <button onClick={handleTrueRandom} className="text-xs text-spotify-gray hover:text-spotify-white transition-colors px-3 py-1 rounded-full border border-spotify-dark-lighter hover:border-spotify-gray" title="Fully random shuffle from your whole library">
        Pure shuffle
      </button>
    </div>
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center pl-64 pr-80 pointer-events-none overflow-y-auto">
      <div className="pointer-events-auto relative w-full max-w-3xl px-12 my-auto">

        {/* ── Carousel layout ── */}
        {layout === 'carousel' && (
          <>
            {canScrollLeft && (
              <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-spotify-dark-lighter/80 flex items-center justify-center text-spotify-white hover:bg-spotify-dark-lighter transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )}
            <div className="absolute left-12 top-0 bottom-0 w-12 z-[5] pointer-events-none" style={{ background: 'linear-gradient(to right, var(--color-spotify-dark), transparent)' }} />
            <div className="absolute right-12 top-0 bottom-0 w-12 z-[5] pointer-events-none" style={{ background: 'linear-gradient(to left, var(--color-spotify-dark), transparent)' }} />
            <div ref={scrollRef} onScroll={updateScrollState} className="flex gap-8 px-6 py-4 items-center overflow-x-auto scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {metricNames.map(renderCircle)}
            </div>
            {canScrollRight && (
              <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-spotify-dark-lighter/80 flex items-center justify-center text-spotify-white hover:bg-spotify-dark-lighter transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 2l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )}
          </>
        )}

        {/* ── Grid layout ── */}
        {layout === 'grid' && (
          <div className="grid justify-center gap-4 px-4 py-4" style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}>
            {metricNames.map(renderCircle)}
          </div>
        )}

        {/* ── Favorites layout ── */}
        {layout === 'favorites' && (
          <div className="flex flex-wrap justify-center gap-6 px-4 py-4 items-center">
            {metricNames.length > 0 ? (
              metricNames.map(renderCircle)
            ) : (
              <p className="text-spotify-gray text-sm">No favorites selected</p>
            )}
            {/* Add/remove button */}
            <div className="relative">
              <button
                onClick={() => setFavPickerOpen(o => !o)}
                className="w-12 h-12 rounded-full border-2 border-dashed border-spotify-dark-lighter text-spotify-gray hover:border-spotify-gray hover:text-spotify-white transition-colors flex items-center justify-center"
                title="Add or remove metrics"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 4v10M4 9h10" />
                </svg>
              </button>

              {favPickerOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setFavPickerOpen(false)} />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-spotify-dark-light border border-spotify-dark-lighter rounded-lg shadow-xl py-2 w-48 max-h-64 overflow-y-auto">
                    {allMetricNames.map(name => {
                      const selected = favoriteMetrics.includes(name);
                      return (
                        <button
                          key={name}
                          onClick={() => toggleFavorite(name)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-spotify-dark-lighter transition-colors text-left"
                        >
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getColor(name), opacity: selected ? 1 : 0.3 }} />
                          <span className={selected ? 'text-spotify-white' : 'text-spotify-gray'}>{name.replace(/_/g, ' ')}</span>
                          {selected && <span className="ml-auto text-spotify-green text-xs">&#10003;</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {actionButtons}
      </div>

      {hoveredMetric && (
        <MetricSlider
          color={getColor(hoveredMetric)}
          value={values[hoveredMetric] ?? 0}
          onChange={(v) => handleChange(hoveredMetric, v)}
          onCommit={handleCommit}
          onHover={handleSliderHover}
          x={sliderPos.x}
          y={sliderPos.y}
        />
      )}
    </div>
  );
}
