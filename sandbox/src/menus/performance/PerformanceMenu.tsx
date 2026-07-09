import { useEffect, useRef, useState } from 'react';
import './performanceMenu.css';

export type PerformanceMenuProps = {
  visible: boolean;
  bootError: string | null;
};

const HISTORY_SIZE = 80;
const FPS_SAMPLE_INTERVAL_S = 0.25;
const GRAPH_REFERENCE_FPS = 60;

const drawFpsGraph = (canvas: HTMLCanvasElement, history: number[]) => {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (width <= 0 || height <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const styles = getComputedStyle(canvas);
  const accent = styles.getPropertyValue('--accent-primary').trim() || '#7ec4d8';
  const muted = styles.getPropertyValue('--text-muted').trim() || 'rgba(255, 255, 255, 0.55)';
  const border = styles.getPropertyValue('--border-subtle').trim() || 'rgba(255, 255, 255, 0.12)';

  const maxFps = Math.max(GRAPH_REFERENCE_FPS, ...history, 1);
  const toY = (value: number) => height - (value / maxFps) * (height - 2) - 1;

  const refY = toY(GRAPH_REFERENCE_FPS);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(0, refY);
  ctx.lineTo(width, refY);
  ctx.stroke();
  ctx.setLineDash([]);

  if (history.length < 2) return;

  const stepX = width / (HISTORY_SIZE - 1);
  const startIndex = HISTORY_SIZE - history.length;
  const points = history.map((value, index) => ({
    x: (startIndex + index) * stepX,
    y: toY(value),
  }));

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.lineTo(points[points.length - 1].x, height);
  ctx.lineTo(points[0].x, height);
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.18;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  if (history.length > 0) {
    const last = points[points.length - 1];
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = muted;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${GRAPH_REFERENCE_FPS}`, width - 2, refY - 2);
};

export const PerformanceMenu = ({ visible, bootError }: PerformanceMenuProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<number[]>([]);
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    if (!visible || bootError) return;

    let rafId = 0;
    let lastFrame = performance.now();
    let accum = 0;
    let frameCount = 0;

    const tick = (now: number) => {
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;
      accum += dt;
      frameCount++;

      if (accum >= FPS_SAMPLE_INTERVAL_S) {
        const sample = Math.round(frameCount / accum);
        accum = 0;
        frameCount = 0;
        setFps(sample);

        const history = historyRef.current;
        history.push(sample);
        if (history.length > HISTORY_SIZE) history.shift();
      }

      const canvas = canvasRef.current;
      if (canvas) drawFpsGraph(canvas, historyRef.current);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [visible, bootError]);

  return (
    <aside
      id="performance-menu"
      className="performance-menu"
      data-visible={visible}
      aria-hidden={!visible}
      aria-label="Performance"
    >
      {bootError ? (
        <p className="performance-menu__error">Boot error: {bootError}</p>
      ) : (
        <>
          <header className="performance-menu__header">
            <span className="performance-menu__title">Performance</span>
            <span className="performance-menu__fps">
              <span className="performance-menu__fps-label">FPS</span>
              <span className="performance-menu__fps-value">
                {fps ?? '...'}
              </span>
            </span>
          </header>

          <canvas
            ref={canvasRef}
            className="performance-menu__graph"
            aria-hidden="true"
          />
        </>
      )}
    </aside>
  );
};
