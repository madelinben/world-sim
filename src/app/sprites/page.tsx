'use client';

import { useEffect, useState } from 'react';
import { SpriteGenerator, type SpriteInfo } from '../../game/ui/SpriteGenerator';

function getTopLevelGroup(sprite: SpriteInfo) {
  // e.g. /sprites/Characters/champions/Okomo.png#0,0 => Characters
  const match = /^\/sprites\/([^\/]+)/.exec(sprite.id);
  return match ? match[1] : 'Other';
}

export default function SpritesPage() {
  const [sprites, setSprites] = useState<SpriteInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const spriteGen = new SpriteGenerator();
    const interval = setInterval(() => {
      const allSprites = spriteGen.getAllSprites();
      if (allSprites.length > 0) {
        setSprites(allSprites);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const drawSprite = (canvas: HTMLCanvasElement, sprite: SpriteInfo) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || !sprite.frames[0]) return;
    const frame = sprite.frames[0];
    ctx.drawImage(
      frame.image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      16,
      16
    );
  };

  // Filter sprites by search term
  const filteredSprites = sprites.filter(sprite =>
    sprite.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group sprites by top-level directory
  const groups: Record<string, SpriteInfo[]> = {};
  for (const sprite of filteredSprites) {
    const group = getTopLevelGroup(sprite);
    if (typeof group === 'string' && group) {
      (groups[group] ??= []).push(sprite);
    }
  }
  const groupNames = Object.keys(groups).sort();

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Sprite Viewer</h1>
      <input
        type="text"
        placeholder="Search by path..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="border p-2 rounded mb-4 w-full"
      />
      {groupNames.map(group => (
        <div key={group} className="mb-6">
          <button
            className="text-lg font-semibold mb-2 flex items-center"
            onClick={() => toggleGroup(group)}
          >
            <span className="mr-2">{expandedGroups[group] ? '▼' : '▶'}</span>
            {group}
          </button>
          {expandedGroups[group] && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {groups[group]?.map(sprite => (
                <div
                  key={sprite.id}
                  className="border rounded p-2 hover:shadow-lg transition-shadow"
                >
                  <div className="relative">
                    <canvas
                      width={16}
                      height={16}
                      className="w-16 h-16 border mx-auto"
                      ref={canvas => {
                        if (canvas) drawSprite(canvas, sprite);
                      }}
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-sm font-mono break-all">
                      {sprite.id}
                    </div>
                    <div className="text-xs text-gray-500">
                      {sprite.category}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {filteredSprites.length === 0 && (
        <div className="text-center text-gray-500 mt-8">
          No sprites found.
        </div>
      )}
    </div>
  );
}
