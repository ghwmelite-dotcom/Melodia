import { useRef, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type WaveformProps = {
  data: number[]; // ~200 amplitude values (0–1)
  progress: number; // 0–1 playback position
  onSeek: (position: number) => void; // called with 0–1 on click
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const WAVEFORM_HEIGHT = 56;
const REFLECTION_HEIGHT = 22;
const CANVAS_HEIGHT = WAVEFORM_HEIGHT + REFLECTION_HEIGHT;
const AMBER = "#F0A500";
const AMBER_LIGHT = "#FFD166";
const SURFACE_3 = "#2D2D50";
const BAR_GAP = 1;
const FALLBACK_BAR_HEIGHT = 4;
const FALLBACK_BAR_COUNT = 200;
const MIN_BAR_HEIGHT = 2;
const PLAYHEAD_WIDTH = 2;

// ─── Component ─────────────────────────────────────────────────────────────────

export function Waveform({ data, progress, onSeek }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const draw = useCallback(
    (width: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = CANVAS_HEIGHT * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${CANVAS_HEIGHT}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, CANVAS_HEIGHT);

      const bars = data.length > 0
        ? data
        : new Array(FALLBACK_BAR_COUNT).fill(FALLBACK_BAR_HEIGHT / WAVEFORM_HEIGHT);
      const barCount = bars.length;

      const allocation = width / barCount;
      const barWidth = Math.max(1, allocation - BAR_GAP);
      const radius = Math.min(barWidth / 2, 3);

      // ── Draw main waveform bars ──────────────────────────────────────────────
      for (let i = 0; i < barCount; i++) {
        const amplitude = bars[i] as number;
        const barHeight = Math.max(MIN_BAR_HEIGHT, amplitude * WAVEFORM_HEIGHT);
        const x = i * allocation + (allocation - barWidth) / 2;
        const y = WAVEFORM_HEIGHT - barHeight; // bottom-aligned

        const position = i / barCount;
        const isPlayed = position <= progress;

        if (isPlayed) {
          // Gradient fill for played bars: amber → amber-light
          const grad = ctx.createLinearGradient(x, y, x, y + barHeight);
          grad.addColorStop(0, AMBER_LIGHT);
          grad.addColorStop(1, AMBER);
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = SURFACE_3;
        }

        // Rounded-top bar
        if (barWidth >= 2 && barHeight >= 2 * radius) {
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + barWidth - radius, y);
          ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
          ctx.lineTo(x + barWidth, y + barHeight);
          ctx.lineTo(x, y + barHeight);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, barHeight);
        }

        // ── Reflection (mirrored below baseline, faded) ────────────────────────
        const refBarHeight = Math.min(barHeight * 0.45, REFLECTION_HEIGHT);
        const refY = WAVEFORM_HEIGHT; // start at baseline

        const refGrad = ctx.createLinearGradient(x, refY, x, refY + refBarHeight);
        if (isPlayed) {
          refGrad.addColorStop(0, `rgba(240,165,0,0.28)`);
          refGrad.addColorStop(1, `rgba(240,165,0,0)`);
        } else {
          refGrad.addColorStop(0, `rgba(45,45,80,0.35)`);
          refGrad.addColorStop(1, `rgba(45,45,80,0)`);
        }
        ctx.fillStyle = refGrad;
        ctx.fillRect(x, refY, barWidth, refBarHeight);
      }

      // ── Playhead line ────────────────────────────────────────────────────────
      if (progress > 0 && progress < 1) {
        const playheadX = Math.floor(progress * width);

        // Glow behind the playhead
        const glowGrad = ctx.createLinearGradient(
          playheadX - 6,
          0,
          playheadX + 6,
          0
        );
        glowGrad.addColorStop(0, "rgba(240,165,0,0)");
        glowGrad.addColorStop(0.5, "rgba(240,165,0,0.25)");
        glowGrad.addColorStop(1, "rgba(240,165,0,0)");
        ctx.fillStyle = glowGrad;
        ctx.fillRect(playheadX - 6, 0, 12, WAVEFORM_HEIGHT);

        // Thin line
        ctx.fillStyle = AMBER_LIGHT;
        ctx.fillRect(
          playheadX - PLAYHEAD_WIDTH / 2,
          0,
          PLAYHEAD_WIDTH,
          WAVEFORM_HEIGHT
        );

        // Small circle at top of playhead
        ctx.beginPath();
        ctx.arc(playheadX, 4, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = AMBER_LIGHT;
        ctx.fill();
      }
    },
    [data, progress]
  );

  // Draw when data/progress changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      draw(container.clientWidth);
      animationFrameRef.current = null;
    });
  }, [draw]);

  // Resize observer
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

  // Cleanup
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
      const position = Math.max(0, Math.min(1, x / rect.width));
      onSeek(position);
    },
    [onSeek]
  );

  return (
    <div ref={containerRef} className="w-full" style={{ height: CANVAS_HEIGHT }}>
      <canvas
        ref={canvasRef}
        className="w-full cursor-pointer"
        style={{ display: "block" }}
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
