import { useRef, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type WaveformProps = {
  data: number[]; // ~200 amplitude values (0–1)
  progress: number; // 0–1 playback position
  onSeek: (position: number) => void; // called with 0–1 on click
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_HEIGHT = 64;
const AMBER = "#F0A500";
const SURFACE_3 = "#2D2D50";
const BAR_GAP = 1;
const FALLBACK_BAR_HEIGHT = 4; // px, for empty data fallback
const FALLBACK_BAR_COUNT = 200;
const MIN_BAR_HEIGHT = 2; // ensure bars are always visible

// ─── Component ─────────────────────────────────────────────────────────────────

export function Waveform({ data, progress, onSeek }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const draw = useCallback(
    (width: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = width;
      canvas.height = CANVAS_HEIGHT;

      ctx.clearRect(0, 0, width, CANVAS_HEIGHT);

      const bars = data.length > 0 ? data : new Array(FALLBACK_BAR_COUNT).fill(FALLBACK_BAR_HEIGHT / CANVAS_HEIGHT);
      const barCount = bars.length;

      // Total width allocated per bar = canvas width / barCount
      // Bar width = allocation - gap
      const allocation = width / barCount;
      const barWidth = Math.max(1, allocation - BAR_GAP);
      const radius = barWidth / 2;

      for (let i = 0; i < barCount; i++) {
        const amplitude = bars[i] as number;
        const barHeight = Math.max(MIN_BAR_HEIGHT, amplitude * CANVAS_HEIGHT);
        const x = i * allocation + (allocation - barWidth) / 2;
        const y = (CANVAS_HEIGHT - barHeight) / 2;

        const position = i / barCount;
        ctx.fillStyle = position <= progress ? AMBER : SURFACE_3;

        // Rounded rectangle bar caps
        if (barWidth >= 2 && barHeight >= 2 * radius) {
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + barWidth - radius, y);
          ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
          ctx.lineTo(x + barWidth, y + barHeight - radius);
          ctx.quadraticCurveTo(x + barWidth, y + barHeight, x + barWidth - radius, y + barHeight);
          ctx.lineTo(x + radius, y + barHeight);
          ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.fill();
        } else {
          // Fallback: simple rect for very narrow bars
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      }
    },
    [data, progress]
  );

  // Draw when data/progress changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Cancel any pending frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      draw(container.clientWidth);
      animationFrameRef.current = null;
    });
  }, [draw]);

  // Resize observer to redraw when container width changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      if (width > 0) {
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          draw(width);
          animationFrameRef.current = null;
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const position = Math.max(0, Math.min(1, x / canvas.width));
      onSeek(position);
    },
    [onSeek]
  );

  return (
    <div ref={containerRef} className="w-full" style={{ height: CANVAS_HEIGHT }}>
      <canvas
        ref={canvasRef}
        height={CANVAS_HEIGHT}
        className="w-full cursor-pointer"
        style={{ height: CANVAS_HEIGHT, display: "block" }}
        onClick={handleClick}
        aria-label="Audio waveform. Click to seek."
        role="slider"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
