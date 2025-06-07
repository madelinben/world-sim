import { WorldGenerator, type Tile, type TileType } from './WorldGenerator';
import { Chunk } from './Chunk';
import type { Camera } from '../systems/Camera';
import { SpriteGenerator } from '../ui/SpriteGenerator';
import type { AnimationSystem } from '../systems/AnimationSystem';

export class World {
    public readonly TILE_SIZE = WorldGenerator.TILE_SIZE;
    public static CHUNK_SIZE = 16;
    private chunks = new Map<string, Chunk>();
    private generator: WorldGenerator;
    private spriteGenerator: SpriteGenerator;
    private animationSystem?: AnimationSystem;
    private visibleTileCache = new Map<string, Tile>();
    private lastCameraX = 0;
    private lastCameraY = 0;
    private lastViewWidth = 0;
    private lastViewHeight = 0;
    private cacheValid = false;

    constructor(generator?: WorldGenerator) {
        this.generator = generator ?? new WorldGenerator();
        this.spriteGenerator = new SpriteGenerator();
    }

    public setAnimationSystem(animationSystem: AnimationSystem): void {
        this.animationSystem = animationSystem;
    }

    public invalidateCache(): void {
        this.cacheValid = false;
    }

    public update(deltaTime: number): void {
        this.updateDirtRegeneration(deltaTime);
    }

    private updateDirtRegeneration(deltaTime: number): void {
        const DIRT_TO_GRASS_TIME = 30000; // 30 seconds in milliseconds

        // Check tiles in visible area for dirt regeneration
        for (const [tileKey, tile] of this.visibleTileCache) {
            if (tile.value === 'DIRT') {
                // Initialize dirt timer if not set
                tile.dirtTimer ??= 0;

                tile.dirtTimer += deltaTime * 1000; // Convert to milliseconds

                if (tile.dirtTimer >= DIRT_TO_GRASS_TIME) {
                    // Convert back to grass
                    tile.value = 'GRASS';
                    tile.dirtTimer = undefined;
                    this.invalidateCache();
                    console.log(`DIRT tile regenerated to GRASS at (${tile.x}, ${tile.y})`);
                }
            }
        }
    }

    public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
        // Check if camera view has changed
        const cameraChanged = this.lastCameraX !== camera.position.x ||
                             this.lastCameraY !== camera.position.y ||
                             this.lastViewWidth !== camera.viewWidth ||
                             this.lastViewHeight !== camera.viewHeight;

        if (cameraChanged || !this.cacheValid) {
            this.updateVisibleTileCache(camera, ctx);
            this.lastCameraX = camera.position.x;
            this.lastCameraY = camera.position.y;
            this.lastViewWidth = camera.viewWidth;
            this.lastViewHeight = camera.viewHeight;
            this.cacheValid = true;
        }

        // Render cached visible tiles
        for (const [tileKey, tile] of this.visibleTileCache) {
            const coords = tileKey.split(',').map(Number);
            if (coords.length !== 2 || coords[0] === undefined || coords[1] === undefined) continue;
            const worldX = coords[0];
            const worldY = coords[1];
            const screenPos = camera.worldToScreen(
                worldX * this.TILE_SIZE,
                worldY * this.TILE_SIZE
            );
            this.renderTile(ctx, tile, screenPos.x, screenPos.y);
        }
    }

    private updateVisibleTileCache(camera: Camera, ctx: CanvasRenderingContext2D): void {
        this.visibleTileCache.clear();

        // Calculate visible area in tile coordinates with padding
        const padding = 2; // Extra tiles for smooth scrolling
        const startX = Math.floor(camera.position.x / this.TILE_SIZE) - padding;
        const startY = Math.floor(camera.position.y / this.TILE_SIZE) - padding;
        const tilesX = Math.ceil(ctx.canvas.width / this.TILE_SIZE) + padding * 2;
        const tilesY = Math.ceil(ctx.canvas.height / this.TILE_SIZE) + padding * 2;

        for (let y = 0; y <= tilesY; y++) {
            for (let x = 0; x <= tilesX; x++) {
                const worldX = startX + x;
                const worldY = startY + y;
                const tile = this.getTile(worldX, worldY);
                const tileKey = `${worldX},${worldY}`;
                this.visibleTileCache.set(tileKey, tile);
            }
        }
    }

                    private renderTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number): void {
        const tileX = x - (this.TILE_SIZE / 2);
        const tileY = y - (this.TILE_SIZE / 2);

        // Render background color with 1px border gap (black background shows through)
        ctx.fillStyle = this.getTileColor(tile.value);
        ctx.fillRect(tileX + 1, tileY + 1, this.TILE_SIZE - 2, this.TILE_SIZE - 2);

        // Render sprite on top if available
        if (tile.spriteId) {
            this.spriteGenerator.renderSprite(ctx, tile.spriteId, tileX + 1, tileY + 1);
        }
    }



    public getTileColor(type: TileType): string {
        switch (type) {
            case 'DEEP_WATER': return '#00008B';
            case 'SHALLOW_WATER': return '#4169E1';
            case 'RIVER': return '#1E90FF';
            case 'SAND': return '#F4A460';
            case 'GRASS': return '#90EE90';
            case 'MUD': return '#8B4513'; // Dark brown
            case 'DIRT': return '#CD853F'; // Light brown (Peru color)
            case 'CLAY': return '#CD7F32';
            case 'FOREST': return '#006400';
            case 'GRAVEL': return '#B8B8B8';
            case 'COBBLESTONE': return '#A9A9A9';
            case 'STONE': return '#808080';
            case 'SNOW': return '#FFFFFF';
            case 'PLAYER': return 'red';
            default: return '#000000';
        }
    }

    private chunkKey(chunkX: number, chunkY: number): string {
        return `${chunkX},${chunkY}`;
    }

    private getOrCreateChunk(chunkX: number, chunkY: number): Chunk {
        const key = this.chunkKey(chunkX, chunkY);
        let chunk = this.chunks.get(key);
        if (!chunk) {
            const tiles = this.generator.generateChunk(chunkX, chunkY, World.CHUNK_SIZE);
            chunk = new Chunk(chunkX, chunkY, World.CHUNK_SIZE, tiles, this.generator);
            this.chunks.set(key, chunk);

            // Register trees and cactus with animation system
            if (this.animationSystem) {
                this.registerChunkTrees(chunk, tiles);
                this.registerChunkCactus(chunk, tiles);
            }
        }
        return chunk;
    }

    private registerChunkTrees(chunk: Chunk, tiles: Tile[][]): void {
        if (!this.animationSystem) return;

        for (const row of tiles) {
            for (const tile of row) {
                if (tile.trees) {
                    for (const tree of tile.trees) {
                        const tileKey = `${tile.x},${tile.y}`;
                        this.animationSystem.addTree(tileKey, tree);
                    }
                }
            }
        }
    }

    private registerChunkCactus(chunk: Chunk, tiles: Tile[][]): void {
        if (!this.animationSystem) return;

        for (const row of tiles) {
            for (const tile of row) {
                if (tile.cactus) {
                    for (const cactusEntity of tile.cactus) {
                        const tileKey = `${tile.x},${tile.y}`;
                        this.animationSystem.addCactus(tileKey, cactusEntity);
                    }
                }
            }
        }
    }

    getTile(x: number, y: number): Tile {
        const chunkX = Math.floor(x / World.CHUNK_SIZE);
        const chunkY = Math.floor(y / World.CHUNK_SIZE);
        const localX = ((x % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
        const localY = ((y % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
        const chunk = this.getOrCreateChunk(chunkX, chunkY);
        let tile = chunk.getTile(localX, localY);
        if (!tile) {
            // Should not happen, but fallback to generator
            tile = this.generator.generateTile(x, y);
            chunk.setTile(localX, localY, tile);
        }
        return tile;
    }

    setTile(x: number, y: number, newValue: TileType): void {
        const chunkX = Math.floor(x / World.CHUNK_SIZE);
        const chunkY = Math.floor(y / World.CHUNK_SIZE);
        const localX = ((x % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
        const localY = ((y % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
        const chunk = this.getOrCreateChunk(chunkX, chunkY);
        const tile = chunk.getTile(localX, localY);
        if (tile) {
            tile.prevValue = tile.value;
            tile.value = newValue;
            tile.interacted = true;
            chunk.setTile(localX, localY, tile);
            this.invalidateCache(); // Invalidate cache when tiles change
        }
    }

    setPlayerPosition(oldX: number, oldY: number, newX: number, newY: number): void {
        // Set previous tile back to its previous value or regenerate
        const prevTile = this.getTile(oldX, oldY);
        if (prevTile) {
            prevTile.value = prevTile.prevValue ?? this.generator.generateTile(oldX, oldY).value;
            prevTile.interacted = false;
        }
        // Set new tile to PLAYER
        const newTile = this.getTile(newX, newY);
        if (newTile) {
            newTile.prevValue = newTile.value;
            newTile.value = 'PLAYER';
            newTile.interacted = true;
        }
        this.invalidateCache(); // Invalidate cache when player moves
    }

    getVisibleChunks(cameraX: number, cameraY: number, viewWidth: number, viewHeight: number): Chunk[] {
        const tileSize = WorldGenerator.TILE_SIZE;
        const minX = Math.floor(cameraX / tileSize);
        const minY = Math.floor(cameraY / tileSize);
        const maxX = Math.ceil((cameraX + viewWidth) / tileSize);
        const maxY = Math.ceil((cameraY + viewHeight) / tileSize);
        const chunks: Chunk[] = [];
        for (let y = Math.floor(minY / World.CHUNK_SIZE); y <= Math.floor(maxY / World.CHUNK_SIZE); y++) {
            for (let x = Math.floor(minX / World.CHUNK_SIZE); x <= Math.floor(maxX / World.CHUNK_SIZE); x++) {
                chunks.push(this.getOrCreateChunk(x, y));
            }
        }
        return chunks;
    }
}