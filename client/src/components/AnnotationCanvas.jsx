import { useRef, useEffect, useState } from 'react';
import { getSocket } from '../socket';

export default function AnnotationCanvas({ active, sessionId }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const contextRef = useRef(null);
  const [color, setColor] = useState('#ff3b30');
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState([]); // array of paths
  const [redoStack, setRedoStack] = useState([]);

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
      // add to history
      setHistory(h => [...h, { from: { x: drawData.fromX, y: drawData.fromY }, to: { x: drawData.toX, y: drawData.toY }, color: drawData.color, lineWidth: drawData.lineWidth }]);
    }

    function onClear() {
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    socket.on('annotation-draw', onRemoteDraw);
    socket.on('annotation-clear', onClear);
    socket.on('annotation-undo', onClearLast);

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

    // push to local history
    setHistory(h => [...h, { from: { x: lastPoint.x, y: lastPoint.y }, to: { x: currentPoint.x, y: currentPoint.y }, color, lineWidth }]);

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
    setHistory([]);
    setRedoStack([]);
  }

  function redrawFromHistory(h) {
    const ctx = contextRef.current;
    if (!ctx) return;
    const canvas = canvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    h.forEach(seg => {
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = seg.lineWidth;
      ctx.beginPath();
      ctx.moveTo(seg.from.x, seg.from.y);
      ctx.lineTo(seg.to.x, seg.to.y);
      ctx.stroke();
    });
  }

  function undoLast() {
    setHistory(h => {
      if (h.length === 0) return h;
      const copy = [...h];
      const last = copy.pop();
      setRedoStack(r => [...r, last]);
      const socket = getSocket();
      socket?.emit('annotation-undo', { sessionId });
      // redraw
      setTimeout(() => redrawFromHistory(copy), 0);
      return copy;
    });
  }

  function redo() {
    setRedoStack(r => {
      if (r.length === 0) return r;
      const copy = [...r];
      const next = copy.pop();
      setHistory(h => {
        const nh = [...h, next];
        // draw
        const ctx = contextRef.current;
        if (ctx) {
          ctx.strokeStyle = next.color;
          ctx.lineWidth = next.lineWidth;
          ctx.beginPath();
          ctx.moveTo(next.from.x, next.from.y);
          ctx.lineTo(next.to.x, next.to.y);
          ctx.stroke();
        }
        // notify peers
        getSocket()?.emit('annotation-draw', { sessionId, drawData: { fromX: next.from.x, fromY: next.from.y, toX: next.to.x, toY: next.to.y, color: next.color, lineWidth: next.lineWidth } });
        return nh;
      });
      return copy;
    });
  }

  function onClearLast() {
    // remote undo — remove last history entry and redraw
    setHistory(h => {
      if (h.length === 0) return h;
      const copy = [...h];
      copy.pop();
      setTimeout(() => redrawFromHistory(copy), 0);
      return copy;
    });
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
