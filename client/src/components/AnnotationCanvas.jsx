import { useRef, useEffect, useState } from 'react';
import { getSocket } from '../socket';

export default function AnnotationCanvas({ active, sessionId }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const contextRef = useRef(null);
  const [color, setColor] = useState('#ff3b30');
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    contextRef.current = ctx;
  }, [color, lineWidth]);

  // Listen for remote drawing events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onRemoteDraw({ drawData }) {
      const ctx = contextRef.current;
      if (!ctx) return;
      ctx.strokeStyle = drawData.color;
      ctx.lineWidth = drawData.lineWidth;
      ctx.beginPath();
      ctx.moveTo(drawData.fromX, drawData.fromY);
      ctx.lineTo(drawData.toX, drawData.toY);
      ctx.stroke();
    }

    function onClear() {
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    socket.on('annotation-draw', onRemoteDraw);
    socket.on('annotation-clear', onClear);

    return () => {
      socket.off('annotation-draw', onRemoteDraw);
      socket.off('annotation-clear', onClear);
    };
  }, []);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onPointerDown(e) {
    if (!active) return;
    isDrawingRef.current = true;
    lastPointRef.current = getPos(e, canvasRef.current);
  }

  function onPointerMove(e) {
    if (!active || !isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const socket = getSocket();
    const currentPoint = getPos(e, canvas);
    const lastPoint = lastPointRef.current;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    socket?.emit('annotation-draw', {
      sessionId,
      drawData: {
        fromX: lastPoint.x, fromY: lastPoint.y,
        toX: currentPoint.x, toY: currentPoint.y,
        color, lineWidth,
      },
    });

    lastPointRef.current = currentPoint;
  }

  function onPointerUp() {
    isDrawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    getSocket()?.emit('annotation-clear', { sessionId });
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          cursor: active ? 'crosshair' : 'default',
          pointerEvents: active ? 'all' : 'none',
          zIndex: 10,
        }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      />

      {/* Annotation toolbar — only visible when annotation is active */}
      {active && (
        <div style={{
          position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '8px', alignItems: 'center',
          background: 'rgba(0,0,0,0.8)', borderRadius: '8px',
          padding: '6px 12px', zIndex: 20,
        }}>
          {['#ff3b30', '#ff9500', '#34c759', '#007aff', '#ffffff'].map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: c,
                border: color === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer',
              }}
            />
          ))}
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />
          <input
            type="range" min="2" max="12" value={lineWidth}
            onChange={e => setLineWidth(parseInt(e.target.value))}
            style={{ width: '60px', cursor: 'pointer' }}
          />
          <button
            onClick={clearCanvas}
            style={{
              background: 'none', border: 'none', color: '#fff',
              fontSize: '12px', cursor: 'pointer', opacity: 0.7,
            }}
          >
            Clear
          </button>
        </div>
      )}
    </>
  );
}
