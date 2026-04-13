import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';

type Props = {
  value?: string;
  onChange: (value: string) => void;
  height?: number;
};

export function SignaturePad({ value, onChange, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1f2937';

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, height);
        ctx.drawImage(img, 0, 0, rect.width, height);
      };
      img.src = value;
    } else {
      ctx.clearRect(0, 0, rect.width, height);
    }
  }, [height, value]);

  const pointFromEvent = (event: PointerEvent | ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    const point = pointFromEvent(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setHasStroke(true);
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const point = pointFromEvent(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-[var(--border-default)] bg-white">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height }}
          className="block touch-none rounded-xl"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-tertiary)]">
          {hasStroke ? 'Η υπογραφή καταγράφηκε.' : 'Υπογράψτε μέσα στο πλαίσιο.'}
        </span>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-[var(--border-strong)] px-2 py-1 text-[var(--text-secondary)]"
        >
          Καθαρισμός
        </button>
      </div>
    </div>
  );
}
