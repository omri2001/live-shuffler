import { useRef, useState, useEffect, useCallback } from 'react';
import MetricCircle from './GenreCircle';
import MetricSlider from './MetricSlider';
import { usePlayer } from '../../context/PlayerContext';
import * as api from '../../api/spotify';
import type { MetricConfig } from '../../api/spotify';

export default function GenreCircles() {
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

  // Fetch metric configs from backend
  const [metricConfigs, setMetricConfigs] = useState<Record<string, MetricConfig>>({});
  const metricNames = Object.keys(metricConfigs);

  useEffect(() => {
    api.fetchMetricConfigs().then(setMetricConfigs).catch(() => {});
  }, []);

  const [values, setValues] = useState<Record<string, number>>({});

  // Initialize values when metrics load
  useEffect(() => {
    if (metricNames.length > 0 && Object.keys(values).length === 0) {
      setValues(Object.fromEntries(metricNames.map((m) => [m, 0])));
    }
  }, [metricNames.length]);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    updateScrollState();
  }, [metricNames.length]);

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
    setValues(Object.fromEntries(metricNames.map((m) => [m, 0])));
    setSoloMetric(null);
    savedValues.current = null;
  };

  const handleRandomMetrics = () => {
    const newValues = Object.fromEntries(
      metricNames.map((m) => [m, Math.random() < 0.4 ? 0 : Math.round(Math.random() * 100)])
    );
    setValues(newValues);
    setSoloMetric(null);
    savedValues.current = null;
    valuesRef.current = newValues;
    handleCommit();
  };

  const handleTrueRandom = async () => {
    setValues(Object.fromEntries(metricNames.map((m) => [m, 0])));
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
      const restored = savedValues.current ?? Object.fromEntries(metricNames.map((m) => [m, 0]));
      setValues(restored);
      valuesRef.current = restored;
      setSoloMetric(null);
      savedValues.current = null;
      handleCommit();
    } else {
      if (!soloMetric) {
        savedValues.current = { ...values };
      }
      const soloValues = Object.fromEntries(metricNames.map((m) => [m, m === name ? 100 : 0]));
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

  const handleSliderHover = useCallback((hovering: boolean) => {
    sliderHover.current = hovering;
    if (hovering) {
      clearTimeout(hideTimeout.current);
    } else {
      scheduleHide();
    }
  }, [scheduleHide]);

  if (metricNames.length === 0) return null;

  const getColor = (name: string) => metricConfigs[name]?.color ?? '#1DB954';

  return (
    <div className="absolute inset-0 flex items-center justify-center pl-64 pr-80 pointer-events-none">
      <div className="pointer-events-auto relative w-full max-w-3xl px-12">
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-spotify-dark-lighter/80 flex items-center justify-center text-spotify-white hover:bg-spotify-dark-lighter transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <div className="absolute left-12 top-0 bottom-0 w-12 z-[5] pointer-events-none" style={{ background: 'linear-gradient(to right, var(--color-spotify-dark), transparent)' }} />
        <div className="absolute right-12 top-0 bottom-0 w-12 z-[5] pointer-events-none" style={{ background: 'linear-gradient(to left, var(--color-spotify-dark), transparent)' }} />

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-8 px-6 py-4 items-center overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {metricNames.map((name) => (
            <div key={name} ref={(el) => { if (el) circleRefs.current.set(name, el); }}>
              <MetricCircle
                name={name}
                color={getColor(name)}
                value={values[name] ?? 0}
                dimmed={soloMetric !== null && soloMetric !== name}
                onHover={(h) => handleCircleHover(name, h)}
                onClick={() => handleCircleClick(name)}
              />
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex justify-center mt-2 gap-2">
          {hasAnyValue && (
            <button
              onClick={handleReset}
              className="text-xs text-spotify-gray hover:text-spotify-white transition-colors px-3 py-1 rounded-full border border-spotify-dark-lighter hover:border-spotify-gray"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleRandomMetrics}
            className="text-xs text-spotify-gray hover:text-spotify-white transition-colors px-3 py-1 rounded-full border border-spotify-dark-lighter hover:border-spotify-gray"
            title="Randomize metric sliders and reshuffle"
          >
            Random mix
          </button>
          <button
            onClick={handleTrueRandom}
            className="text-xs text-spotify-gray hover:text-spotify-white transition-colors px-3 py-1 rounded-full border border-spotify-dark-lighter hover:border-spotify-gray"
            title="Fully random shuffle from your whole library"
          >
            Pure shuffle
          </button>
        </div>

        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-spotify-dark-lighter/80 flex items-center justify-center text-spotify-white hover:bg-spotify-dark-lighter transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 2l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
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
