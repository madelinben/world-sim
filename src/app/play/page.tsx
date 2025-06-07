'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Game } from '~/game/engine/Game';

function PlayGameComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    if (canvasRef.current) {
      const seed = searchParams?.get('seed') ?? undefined;
      gameRef.current = new Game(canvasRef.current, seed);
      gameRef.current.start();
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (gameRef.current) {
        gameRef.current.stop();
      }
    };
  }, [searchParams]);

  return (
    <div className="fixed inset-0 bg-gray-900">
      <canvas
        ref={canvasRef}
        className="w-full h-full block border-2 border-gray-700"
        style={{ display: 'block' }}
      />
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading World Simulator...</div>
      </div>
    }>
      <PlayGameComponent />
    </Suspense>
  );
}