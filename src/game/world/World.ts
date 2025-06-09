import { WorldGenerator, type Tile, type TileType } from './WorldGenerator';
import { Chunk } from './Chunk';
import type { Camera } from '../systems/Camera';
import { SpriteGenerator } from '../ui/SpriteGenerator';
import type { AnimationSystem } from '../systems/AnimationSystem';
import type { Position } from '../engine/types';
import type { InventoryItem } from '../entities/inventory/Inventory';
import { NPC } from '../entities/npc/NPC';
import type { VillageStructure } from './VillageGenerator';
import { POI } from '../entities/poi/POI';
import { Tombstone } from '../entities/poi/Tombstone';

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
    private camera: Camera;

    // Track NPCs that want to move to specific tiles this update cycle
    private movementIntentions = new Map<string, NPC>(); // tileKey -> NPC that wants to move there

    // Track current player position for collision detection
    private currentPlayerPosition?: Position;

    // Track tombstones by position
    private tombstones = new Map<string, Tombstone>();

    constructor(camera: Camera, generator?: WorldGenerator) {
        this.generator = generator ?? new WorldGenerator();
        this.spriteGenerator = new SpriteGenerator();
        this.camera = camera;
    }

    public setAnimationSystem(animationSystem: AnimationSystem): void {
        this.animationSystem = animationSystem;
    }

    public invalidateCache(): void {
        this.cacheValid = false;
    }

    private moveNPCBetweenTiles(npcStructure: VillageStructure, oldTileX: number, oldTileY: number, newTileX: number, newTileY: number): void {
        // Get the chunks for old and new positions
        const oldChunk = this.getOrCreateChunk(Math.floor(oldTileX / World.CHUNK_SIZE), Math.floor(oldTileY / World.CHUNK_SIZE));
        const newChunk = this.getOrCreateChunk(Math.floor(newTileX / World.CHUNK_SIZE), Math.floor(newTileY / World.CHUNK_SIZE));

        // Calculate local positions within chunks (handle negative coordinates)
        const oldLocalX = ((oldTileX % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
        const oldLocalY = ((oldTileY % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
        const newLocalX = ((newTileX % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
        const newLocalY = ((newTileY % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;

        // Check if the new tile is available (excluding the moving NPC)
        const isOccupied = newChunk.isTileOccupied(newLocalX, newLocalY, npcStructure.npc);

        if (isOccupied) {
            // Cannot move to occupied tile - revert NPC position
            if (npcStructure.npc) {
                npcStructure.npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
                npcStructure.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
            }
            return;
        }

        // If moving between different chunks, handle cross-chunk movement
        if (oldChunk !== newChunk) {
            // Remove from old chunk
            oldChunk.removeNPC(oldLocalX, oldLocalY);

            // Add to new chunk
            const success = newChunk.addNPC(newLocalX, newLocalY, npcStructure);
            if (!success) {
                // Failed to add to new chunk - revert position
                if (npcStructure.npc) {
                    npcStructure.npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
                    npcStructure.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
                }
                // Try to add back to old chunk
                oldChunk.addNPC(oldLocalX, oldLocalY, npcStructure);
            }
        } else {
            // Moving within same chunk
            const success = oldChunk.moveNPC(oldLocalX, oldLocalY, newLocalX, newLocalY);
            if (!success) {
                // Failed to move within chunk - revert position
                if (npcStructure.npc) {
                    npcStructure.npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
                    npcStructure.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
                }
            }
        }

        // Invalidate cache since tile occupancy changed
        this.invalidateCache();
    }

    public bounceBackNPC(currentTileX: number, currentTileY: number, npc: NPC): void {
        // Find the village structure containing this NPC
        const currentTile = this.getTile(currentTileX, currentTileY);
        if (!currentTile?.villageStructures) return;

        const npcStructure = currentTile.villageStructures.find(s => s.npc === npc);
        if (!npcStructure) return;

        // Calculate previous tile position
        const prevTileX = Math.floor(npc.previousPosition.x / WorldGenerator.TILE_SIZE);
        const prevTileY = Math.floor(npc.previousPosition.y / WorldGenerator.TILE_SIZE);

        // Move NPC back to previous position
        this.moveNPCBetweenTiles(npcStructure, currentTileX, currentTileY, prevTileX, prevTileY);
    }

    public update(deltaTime: number, playerPosition?: Position, playerInventory?: InventoryItem[]): void {
        this.updateDirtRegeneration(deltaTime);
        this.updateVillageStructures(deltaTime, playerPosition, playerInventory);
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

    private updateVillageStructures(deltaTime: number, playerPosition?: Position, playerInventory?: InventoryItem[]): void {
        if (!playerPosition) return;

        // Store current player position for collision detection
        this.currentPlayerPosition = playerPosition;

        // Clear movement intentions from previous update cycle
        this.movementIntentions.clear();

        // Calculate view radius in tiles based on camera dimensions
        // Add buffer for smooth transitions
        const camera = this.camera;
        const tileSize = WorldGenerator.TILE_SIZE;
        const viewWidthInTiles = Math.ceil(camera.viewWidth / tileSize) + 5; // +5 tile buffer
        const viewHeightInTiles = Math.ceil(camera.viewHeight / tileSize) + 5; // +5 tile buffer
        const viewRadiusInTiles = Math.max(viewWidthInTiles, viewHeightInTiles) / 2;

        // Collect all NPCs and village buildings for flocking algorithm
        const allNPCs: NPC[] = [];
        const allVillageBuildings: Position[] = [];
        const npcsToUpdate: { npc: NPC; structure: VillageStructure; tileX: number; tileY: number }[] = [];

        // First pass: collect all NPCs and village buildings from ALL chunks (not just visible)
        for (const chunk of this.chunks.values()) {
            // Get NPCs from chunk's tracking system
            for (const [tileKey, structure] of chunk.getAllNPCs()) {
                if (structure.npc && !structure.npc.isDead()) {
                    allNPCs.push(structure.npc);

                    // Check if NPC is within update radius of player
                    const npcDistance = Math.sqrt(
                        Math.pow(structure.npc.position.x - playerPosition.x, 2) +
                        Math.pow(structure.npc.position.y - playerPosition.y, 2)
                    ) / this.TILE_SIZE;

                    if (npcDistance <= viewRadiusInTiles) {
                        const tileCoords = tileKey.split(',').map(Number);
                        if (tileCoords.length === 2) {
                            npcsToUpdate.push({
                                npc: structure.npc,
                                structure,
                                tileX: chunk.chunkX * World.CHUNK_SIZE + tileCoords[0]!,
                                tileY: chunk.chunkY * World.CHUNK_SIZE + tileCoords[1]!
                            });
                        }
                    }
                }
            }
        }



        // Collect village buildings from visible tiles
        for (const [tileKey, tile] of this.visibleTileCache) {
            if (tile.villageStructures) {
                for (const structure of tile.villageStructures) {
                    if (structure.poi && (
                        structure.type.includes('market') ||
                        structure.type.includes('windmill')
                    )) {
                        allVillageBuildings.push(structure.position);
                    }
                }
            }
        }

        // Second pass: update POIs (from visible tiles) and NPCs (from camera culling)
        for (const [tileKey, tile] of this.visibleTileCache) {
            if (tile.villageStructures) {
                for (const structure of tile.villageStructures) {
                    // Update POI animations (windmills, etc.)
                    if (structure.poi) {
                        structure.poi.update(deltaTime);
                    }
                }
            }
        }

        // First phase: Collect movement intentions from all NPCs
        for (const npcData of npcsToUpdate) {
            const { npc } = npcData;
            const pos = playerPosition ?? { x: 0, y: 0 };
            const inventory = playerInventory ?? [];

            // Get nearby NPCs within reasonable distance (10 tiles)
            const nearbyNPCs = allNPCs.filter(otherNPC => {
                if (otherNPC === npc) return false;
                const distance = Math.sqrt(
                    Math.pow(otherNPC.position.x - npc.position.x, 2) +
                    Math.pow(otherNPC.position.y - npc.position.y, 2)
                ) / 16;
                return distance <= 10; // Within 10 tiles
            });

            // Get movement intention for this NPC
            const movementIntention = npc.getMovementIntention(pos, inventory, nearbyNPCs);
            if (movementIntention) {
                const targetTileX = Math.floor(movementIntention.x / this.TILE_SIZE);
                const targetTileY = Math.floor(movementIntention.y / this.TILE_SIZE);
                const targetTileKey = `${targetTileX},${targetTileY}`;
                this.movementIntentions.set(targetTileKey, npc);
            }
        }



        // Second phase: Update NPCs with movement intentions registered
        for (const npcData of npcsToUpdate) {
            const { npc, structure, tileX, tileY } = npcData;
            const pos = playerPosition ?? { x: 0, y: 0 };
            const inventory = playerInventory ?? [];

            // Get nearby NPCs within reasonable distance (10 tiles)
            const nearbyNPCs = allNPCs.filter(otherNPC => {
                if (otherNPC === npc) return false;
                const distance = Math.sqrt(
                    Math.pow(otherNPC.position.x - npc.position.x, 2) +
                    Math.pow(otherNPC.position.y - npc.position.y, 2)
                ) / 16;
                return distance <= 10; // Within 10 tiles
            });

            // Get nearby village buildings within reasonable distance (15 tiles)
            const nearbyBuildings = allVillageBuildings.filter(building => {
                const distance = Math.sqrt(
                    Math.pow(building.x - npc.position.x, 2) +
                    Math.pow(building.y - npc.position.y, 2)
                ) / 16;
                return distance <= 15; // Within 15 tiles
            });

            // Store old position for movement tracking
            const oldTileX = Math.floor(npc.position.x / this.TILE_SIZE);
            const oldTileY = Math.floor(npc.position.y / this.TILE_SIZE);

            npc.update(deltaTime, pos, inventory, nearbyNPCs, nearbyBuildings);

            // Check if NPC moved to a different tile
            const newTileX = Math.floor(npc.position.x / this.TILE_SIZE);
            const newTileY = Math.floor(npc.position.y / this.TILE_SIZE);

            if (oldTileX !== newTileX || oldTileY !== newTileY) {
                // NPC moved to a different tile, update tile occupancy
                this.moveNPCBetweenTiles(structure, oldTileX, oldTileY, newTileX, newTileY);
            }

            // Handle breeding requests
            if (npc.breedingRequest) {
                this.handleBreedingRequest(npc);
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

        // Render village structures if present
        if (tile.villageStructures) {
            for (const structure of tile.villageStructures) {
                // Render POIs first (buildings, etc.)
                if (structure.poi) {
                    structure.poi.render(ctx, tileX + 1, tileY + 1);
                }
            }

            // Render NPCs on top of POIs (sprites only, no health bars)
            for (const structure of tile.villageStructures) {
                if (structure.npc && !structure.npc.isDead()) {
                    structure.npc.renderSpriteOnly(ctx, tileX + 1, tileY + 1);
                }
            }
        }
    }

    public renderHealthBars(ctx: CanvasRenderingContext2D, camera: Camera): void {
        // Render health bars for NPCs on top of all sprites
        const visibleTiles = Array.from(this.visibleTileCache.values());
        for (const tile of visibleTiles) {
            if (tile.villageStructures) {
                const screenPos = camera.worldToScreen(tile.x * this.TILE_SIZE, tile.y * this.TILE_SIZE);
                const tileX = screenPos.x - (this.TILE_SIZE / 2);
                const tileY = screenPos.y - (this.TILE_SIZE / 2);

                for (const structure of tile.villageStructures) {
                    if (structure.npc && !structure.npc.isDead()) {
                        // Render health bar only if NPC is alive (health > 0) and damaged
                        if (structure.npc.getHealth() > 0 && structure.npc.getHealth() < structure.npc.getMaxHealth()) {
                            this.renderHealthBar(ctx, tileX + 1, tileY + 1, structure.npc.getHealth(), structure.npc.getMaxHealth());
                        }
                    }
                }
            }
        }
    }

    private renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, health: number, maxHealth: number): void {
        const barWidth = 14;
        const barHeight = 2;
        const healthPercent = health / maxHealth;

        // Background (red)
        ctx.fillStyle = 'red';
        ctx.fillRect(x + 1, y - 4, barWidth, barHeight);

        // Foreground (green)
        ctx.fillStyle = 'green';
        ctx.fillRect(x + 1, y - 4, barWidth * healthPercent, barHeight);
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
            case 'PLAYER': return 'transparent';
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

            // Register trees, cactus, and village structures with animation system
            if (this.animationSystem) {
                this.registerChunkTrees(chunk, tiles);
                this.registerChunkCactus(chunk, tiles);
                this.registerChunkVillageStructures(chunk, tiles);
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

    private registerChunkVillageStructures(chunk: Chunk, tiles: Tile[][]): void {
        for (const row of tiles) {
            for (const tile of row) {
                if (tile.villageStructures) {
                    let npcCount = 0;
                    let poiCount = 0;

                    // Count entities on this tile
                    for (const structure of tile.villageStructures) {
                        if (structure.npc) npcCount++;
                        if (structure.poi) poiCount++;
                    }

                    // Warn if multiple entities on same tile (violation of one-entity-per-tile rule)
                    if (npcCount + poiCount > 1) {
                        console.error(`[ERROR] Tile (${tile.x},${tile.y}) has ${npcCount} NPCs and ${poiCount} POIs - violates one-entity-per-tile rule!`);
                        console.error(`[ERROR] Structures:`, tile.villageStructures.map(s => s.type));
                    }

                    for (const structure of tile.villageStructures) {
                        if (structure.npc) {
                            // Set up collision callback for NPC
                            structure.npc.setTileCollisionCallback((position: Position) => {
                                const tileX = Math.floor(position.x / this.TILE_SIZE);
                                const tileY = Math.floor(position.y / this.TILE_SIZE);
                                return this.isTileOccupiedByOthers(tileX, tileY, structure.npc);
                            });

                            // Set up speculative movement callback for deadlock resolution
                            structure.npc.setSpeculativeMovementCallback((position: Position, movingNPC: NPC) => {
                                const tileX = Math.floor(position.x / this.TILE_SIZE);
                                const tileY = Math.floor(position.y / this.TILE_SIZE);
                                return this.checkSpeculativeMovement(tileX, tileY, movingNPC);
                            });

                            // Register NPCs in chunk's NPC tracking system
                            // Calculate correct tile coordinates from NPC's actual world position
                            const npcTileX = Math.floor(structure.npc.position.x / this.TILE_SIZE);
                            const npcTileY = Math.floor(structure.npc.position.y / this.TILE_SIZE);
                            const localX = ((npcTileX % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
                            const localY = ((npcTileY % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;

                            // Use registerExistingNPC method since the NPC was already generated and added to tile
                            const registerResult = chunk.registerExistingNPC(localX, localY, structure);
                            if (!registerResult) {
                                console.warn(`Failed to register existing NPC ${structure.type} at local position (${localX}, ${localY}) in chunk (${chunk.chunkX}, ${chunk.chunkY}). NPC world pos: (${structure.npc.position.x}, ${structure.npc.position.y}), tile: (${npcTileX}, ${npcTileY})`);
                                // Fallback: manually add to chunk tracking only
                                chunk.getAllNPCs().set(`${localX},${localY}`, structure);
                            } else {
                                console.log(`Successfully registered existing NPC ${structure.type} at local position (${localX}, ${localY}) in chunk (${chunk.chunkX}, ${chunk.chunkY}). NPC world pos: (${structure.npc.position.x}, ${structure.npc.position.y}), tile: (${npcTileX}, ${npcTileY})`);
                            }
                        }
                        if (structure.poi) {
                            // POIs handle their own animation updates
                            console.log(`Village POI ${structure.type} registered at ${tile.x},${tile.y}`);
                        }
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
        const tile = chunk.getTile(localX, localY);

        if (!tile) {
            // Should not happen, but fallback to generator
            const generatedTile = this.generator.generateTile(x, y);
            chunk.setTile(localX, localY, generatedTile);
            return generatedTile;
        }

        return tile;
    }

    public getPOIAt(tileX: number, tileY: number): POI | null {
        const tile = this.getTile(tileX, tileY);
        if (tile?.villageStructures) {
            for (const structure of tile.villageStructures) {
                if (structure.poi) {
                    return structure.poi;
                }
            }
        }
        return null;
    }

    public getNPCAt(tileX: number, tileY: number): NPC | null {
        const tile = this.getTile(tileX, tileY);
        if (tile?.villageStructures) {
            for (const structure of tile.villageStructures) {
                if (structure.npc && !structure.npc.isDead()) {
                    return structure.npc;
                }
            }
        }
        return null;
    }

    public removeDeadNPCAt(tileX: number, tileY: number): { type: string; quantity: number }[] {
        const chunkX = Math.floor(tileX / World.CHUNK_SIZE);
        const chunkY = Math.floor(tileY / World.CHUNK_SIZE);
        const chunk = this.getOrCreateChunk(chunkX, chunkY);

        const localX = ((tileX % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
        const localY = ((tileY % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;

        const deadNPCStructure = chunk.removeDeadNPC(localX, localY);
        if (deadNPCStructure?.npc) {
            this.invalidateCache();
            return deadNPCStructure.npc.getDropItems();
        }
        return [];
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
        }

        this.invalidateCache();
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

    private isTileOccupiedByOthers(tileX: number, tileY: number, movingNPC?: NPC): boolean {
        const chunkX = Math.floor(tileX / World.CHUNK_SIZE);
        const chunkY = Math.floor(tileY / World.CHUNK_SIZE);
        const localX = ((tileX % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
        const localY = ((tileY % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;

        const chunk = this.chunks.get(this.chunkKey(chunkX, chunkY));
        if (!chunk) return false; // Assume unloaded chunks are passable

        const tile = chunk.getTile(localX, localY);
        if (!tile) return true; // Treat invalid tiles as occupied

        // Check for impassable terrain
        if (tile.value === 'DEEP_WATER' || tile.value === 'STONE' || tile.value === 'COBBLESTONE' || tile.value === 'SNOW' || tile.value === 'SHALLOW_WATER') {
            return true;
        }

        // Check for living trees
        if (tile.trees?.some(tree => tree.getHealth() > 0)) {
            return true;
        }

        // Check for living cactus - these are impassable and will cause damage
        if (tile.cactus?.some(cactus => cactus.getHealth() > 0)) {
            return true;
        }

        // Check for village structures (POIs and NPCs), excluding the moving NPC
        if (tile.villageStructures) {
            for (const structure of tile.villageStructures) {
                // Check for impassable POIs
                if (structure.poi && !structure.poi.passable) {
                    return true;
                }
                // Check for living NPCs (excluding the one we're checking for)
                if (structure.npc && !structure.npc.isDead() && structure.npc !== movingNPC) {
                    return true;
                }
            }
        }

        // Check if tile is occupied by the player
        if (this.currentPlayerPosition) {
            const playerTileX = Math.floor(this.currentPlayerPosition.x / this.TILE_SIZE);
            const playerTileY = Math.floor(this.currentPlayerPosition.y / this.TILE_SIZE);
            if (playerTileX === tileX && playerTileY === tileY) {
                return true; // Player is on this tile
            }
        }

        return false;
    }

    private checkSpeculativeMovement(tileX: number, tileY: number, movingNPC: NPC): boolean {
        // Find the NPC currently occupying the target tile
        const chunkX = Math.floor(tileX / World.CHUNK_SIZE);
        const chunkY = Math.floor(tileY / World.CHUNK_SIZE);
        const localX = ((tileX % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
        const localY = ((tileY % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;

        const chunk = this.chunks.get(this.chunkKey(chunkX, chunkY));
        if (!chunk) return false;

        const tile = chunk.getTile(localX, localY);
        if (!tile?.villageStructures) return false;

        // Find the NPC occupying this tile
        let occupyingNPC: NPC | null = null;
        for (const structure of tile.villageStructures) {
            if (structure.npc && !structure.npc.isDead() && structure.npc !== movingNPC) {
                occupyingNPC = structure.npc;
                break;
            }
        }

        if (!occupyingNPC) return false;

        // Get current positions
        const movingNPCCurrentX = Math.floor(movingNPC.position.x / this.TILE_SIZE);
        const movingNPCCurrentY = Math.floor(movingNPC.position.y / this.TILE_SIZE);
        const movingNPCCurrentKey = `${movingNPCCurrentX},${movingNPCCurrentY}`;

        const occupyingNPCCurrentX = Math.floor(occupyingNPC.position.x / this.TILE_SIZE);
        const occupyingNPCCurrentY = Math.floor(occupyingNPC.position.y / this.TILE_SIZE);
        const occupyingNPCCurrentKey = `${occupyingNPCCurrentX},${occupyingNPCCurrentY}`;

        // Check if the NPCs are trying to swap positions (bidirectional)
        const intendedNPCForMovingTile = this.movementIntentions.get(movingNPCCurrentKey);
        const intendedNPCForOccupyingTile = this.movementIntentions.get(`${tileX},${tileY}`);

        if (intendedNPCForMovingTile === occupyingNPC && intendedNPCForOccupyingTile === movingNPC) {
            return true; // Allow the swap
        }

        // Check if occupying NPC has any movement intention (wants to move anywhere)
        let occupyingNPCWantsToMove = false;
        for (const [intentionTileKey, intentionNPC] of this.movementIntentions) {
            if (intentionNPC === occupyingNPC && intentionTileKey !== occupyingNPCCurrentKey) {
                occupyingNPCWantsToMove = true;
                break;
            }
        }

        if (occupyingNPCWantsToMove) {
            return true;
        }



        return false; // Cannot speculative move
    }

    private handleBreedingRequest(npc: NPC): void {
        const request = npc.breedingRequest;
        if (!request) return;

        try {
            // Create new NPC offspring
            const offspring = new NPC({
                type: request.offspringType,
                position: request.offspringPosition,
                aggressive: false
            });

            // Find appropriate chunk and tile for the offspring
            const offspringTileX = Math.floor(request.offspringPosition.x / this.TILE_SIZE);
            const offspringTileY = Math.floor(request.offspringPosition.y / this.TILE_SIZE);
            const chunkX = Math.floor(offspringTileX / World.CHUNK_SIZE);
            const chunkY = Math.floor(offspringTileY / World.CHUNK_SIZE);
            const localX = ((offspringTileX % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;
            const localY = ((offspringTileY % World.CHUNK_SIZE) + World.CHUNK_SIZE) % World.CHUNK_SIZE;

            const chunk = this.getOrCreateChunk(chunkX, chunkY);
            const tile = chunk.getTile(localX, localY);

            if (tile && !this.isTileOccupiedByOthers(offspringTileX, offspringTileY)) {
                // Create village structure for the offspring
                const offspringStructure = {
                    type: request.offspringType,
                    position: request.offspringPosition,
                    npc: offspring
                };

                // Set up collision callback for offspring NPC
                offspring.setTileCollisionCallback((position: Position) => {
                    const tileX = Math.floor(position.x / this.TILE_SIZE);
                    const tileY = Math.floor(position.y / this.TILE_SIZE);
                    return this.isTileOccupiedByOthers(tileX, tileY, offspring);
                });

                // Set up speculative movement callback for offspring NPC
                offspring.setSpeculativeMovementCallback((position: Position, movingNPC: NPC) => {
                    const tileX = Math.floor(position.x / this.TILE_SIZE);
                    const tileY = Math.floor(position.y / this.TILE_SIZE);
                    return this.checkSpeculativeMovement(tileX, tileY, movingNPC);
                });

                // Add to tile's village structures
                tile.villageStructures = tile.villageStructures ?? [];
                tile.villageStructures.push(offspringStructure);

                // Register in chunk's NPC tracking system
                chunk.getAllNPCs().set(`${localX},${localY}`, offspringStructure);


                          }
        } catch (error) {
            console.error(`❌ [BREEDING ERROR] Failed to create offspring:`, error);
        }

        // Clear the breeding request
        npc.breedingRequest = undefined;
    }

    public createTombstone(position: Position, deadEntityType: string, inventory: (InventoryItem | null)[], deadEntityName?: string): Tombstone {
        const tombstone = new Tombstone({
            position,
            inventory,
            deadEntityType,
            deadEntityName
        });

        const tileX = Math.floor(position.x / this.TILE_SIZE);
        const tileY = Math.floor(position.y / this.TILE_SIZE);
        const tombstoneKey = `${tileX},${tileY}`;

        this.tombstones.set(tombstoneKey, tombstone);

        // Add tombstone as a POI to the tile
        const tile = this.getTile(tileX, tileY);
        if (tile) {
            tile.villageStructures = tile.villageStructures ?? [];
            tile.villageStructures.push({
                type: 'tombstone',
                position,
                poi: new POI({
                    type: 'tombstone',
                    position,
                    interactable: true,
                    passable: false,
                    customData: { tombstoneVariant: tombstone.tombstoneVariant }
                })
            });
        }

        this.invalidateCache();
        return tombstone;
    }

    public handleAnimalDeath(animal: NPC, playerPosition: Position, playerInventory: { addItem: (type: string, quantity: number) => boolean }): void {
        // For animals killed by player, add inventory directly to player
        const animalInventory = animal.getInventoryItems();
        for (const item of animalInventory) {
            if (item) {
                const added = playerInventory.addItem(item.type, item.quantity);
                if (added) {
                    console.log(`🎒 Added ${item.quantity}x ${item.type} from ${animal.type} to player inventory`);
                } else {
                    console.log(`🎒 Could not add ${item.quantity}x ${item.type} to player inventory - full!`);
                }
            }
        }
    }

    public handlePlayerDeath(playerPosition: Position, playerInventory: (InventoryItem | null)[]): void {
        // Create tombstone with player's inventory
        const tombstone = this.createTombstone(
            playerPosition,
            'player',
            playerInventory,
            'Player'
        );

        console.log(`💀 Player died! Tombstone created at (${Math.floor(playerPosition.x / this.TILE_SIZE)}, ${Math.floor(playerPosition.y / this.TILE_SIZE)})`);

        // Player should respawn at 0,0 with empty inventory
        // This will be handled by the game engine
    }

    public handleNPCDeath(npc: NPC, npcPosition: Position): void {
        // Create tombstone with NPC's inventory for traders and monsters
        if (npc.category === 'friendly' || npc.category === 'monster') {
            const tombstone = this.createTombstone(
                npcPosition,
                npc.type,
                npc.getInventoryItems(),
                npc.type.replace('_', ' ')
            );

            console.log(`💀 ${npc.type} died! Tombstone created at (${Math.floor(npcPosition.x / this.TILE_SIZE)}, ${Math.floor(npcPosition.y / this.TILE_SIZE)})`);
        }

        // Remove the dead NPC from the tile
        const tileX = Math.floor(npcPosition.x / this.TILE_SIZE);
        const tileY = Math.floor(npcPosition.y / this.TILE_SIZE);
        this.removeDeadNPCAt(tileX, tileY);
    }

    public getTombstoneAt(tileX: number, tileY: number): Tombstone | null {
        const tombstoneKey = `${tileX},${tileY}`;
        return this.tombstones.get(tombstoneKey) ?? null;
    }

    public interactWithTombstone(tileX: number, tileY: number): { tombstone: Tombstone; success: boolean } | null {
        const tombstone = this.getTombstoneAt(tileX, tileY);
        if (!tombstone) return null;

        // Tombstone interaction will be handled by the UI system
        return { tombstone, success: true };
    }

    public removeTombstone(tileX: number, tileY: number): boolean {
        const tombstoneKey = `${tileX},${tileY}`;
        const tombstone = this.tombstones.get(tombstoneKey);

        if (tombstone?.isEmpty()) {
            this.tombstones.delete(tombstoneKey);

            // Remove tombstone POI from tile
            const tile = this.getTile(tileX, tileY);
            if (tile?.villageStructures) {
                tile.villageStructures = tile.villageStructures.filter(
                    structure => structure.type !== 'tombstone'
                );
                if (tile.villageStructures.length === 0) {
                    delete tile.villageStructures;
                }
            }

            this.invalidateCache();
            return true;
        }

        return false;
    }
}