import { createNoise2D } from 'simplex-noise';
import type { Position } from '../engine/types';
import type { Tile } from './WorldGenerator';
import { WorldGenerator } from './WorldGenerator';
import { NPC } from '../entities/npc/NPC';
import { POI } from '../entities/poi/POI';
import type { VillageStructure } from './VillageGenerator';
import type { Camera } from '../systems/Camera';
import type { InventoryItem } from '../entities/inventory/Inventory';

export interface DungeonChunk {
  chunkX: number;
  chunkY: number;
  tiles: Tile[][];
}

export class Dungeon {
  private tunnelNoise: (x: number, y: number) => number;
  private monsterNoise: (x: number, y: number) => number;
  private chestNoise: (x: number, y: number) => number;
  private entityNoise: (x: number, y: number) => number; // High amplitude noise for entity placement
    private readonly TUNNEL_THRESHOLD = 0.3; // Tunnel threshold for noise
  private readonly TILE_SIZE = WorldGenerator.TILE_SIZE;
  private dungeonChunks = new Map<string, DungeonChunk>();
  private dungeonNames = new Map<string, string>(); // Cache dungeon names
  private currentEntrancePosition: Position | null = null; // Store current entrance position
  private portalGenerated = false; // Track if portal has been generated for this dungeon
  private portalPosition: Position | null = null; // Store portal position for this dungeon
  private chestCount = 0; // Track number of chests generated in current dungeon
  private readonly MAX_CHESTS = 10; // Maximum chests per dungeon

  // Track spawned entities for spacing during generation
  private spawnedMonsters = new Set<string>(); // Track monster positions as "x,y"
  private spawnedChests = new Set<string>(); // Track chest positions as "x,y"

  // Dungeon name generation data
  private readonly DUNGEON_PREFIXES = [
    'Dark', 'Shadow', 'Ancient', 'Forgotten', 'Lost', 'Cursed', 'Haunted', 'Mystic',
    'Crystal', 'Iron', 'Dragon', 'Skull', 'Blood', 'Frost', 'Fire', 'Storm',
    'Deep', 'Black', 'Silent', 'Whispering', 'Echoing', 'Twisted', 'Broken', 'Fallen'
  ];

  private readonly DUNGEON_SUFFIXES = [
    'Cavern', 'Depths', 'Hollow', 'Grotto', 'Tunnel', 'Passage', 'Chamber',
    'Sanctum', 'Vault', 'Crypt', 'Den', 'Lair', 'Mine', 'Pit', 'Chasm',
    'Catacombs', 'Labyrinth', 'Dungeon', 'Abyss', 'Warren', 'Burrow'
  ];

  constructor(seed?: string) {
    const hashSeed = seed ? this.hashSeed(seed) : Math.random();
    this.tunnelNoise = createNoise2D(() => hashSeed);
    this.monsterNoise = createNoise2D(() => hashSeed * 1.337);
    this.chestNoise = createNoise2D(() => hashSeed * 2.718);
    this.entityNoise = createNoise2D(() => hashSeed * 3.141); // High amplitude noise for entity placement
  }

  private hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  public generateDungeonChunk(chunkX: number, chunkY: number, chunkSize: number, entrancePosition?: Position): DungeonChunk {
    const tiles: Tile[][] = [];

    // Initialize chunk with void tiles
    for (let y = 0; y < chunkSize; y++) {
      tiles[y] = [];
      for (let x = 0; x < chunkSize; x++) {
        const worldX = chunkX * chunkSize + x;
        const worldY = chunkY * chunkSize + y;

        tiles[y]![x] = this.generateDungeonTile(worldX, worldY, entrancePosition);
      }
    }

    const chunk: DungeonChunk = {
      chunkX,
      chunkY,
      tiles
    };

    const chunkKey = `${chunkX},${chunkY}`;
    this.dungeonChunks.set(chunkKey, chunk);

    return chunk;
  }

  private generateDungeonTile(worldX: number, worldY: number, entrancePosition?: Position): Tile {
    // Default to void
    let tileType: 'STONE' | 'COBBLESTONE' | 'VOID' = 'VOID';

    // Check if this tile is part of the tunnel system
    const isTunnel = this.isPartOfTunnel(worldX, worldY, entrancePosition);

    if (isTunnel) {
      tileType = this.getTunnelTileType(worldX, worldY);
    }

    // Create base tile
    const tile: Tile = {
      x: worldX,
      y: worldY,
      value: tileType,
      height: 0.5, // Default dungeon height
      temperature: 0.3, // Cool dungeon temperature
      humidity: 0.7, // High dungeon humidity
      interacted: false
    };

    // Add entrance at the exact entrance position
    if (entrancePosition &&
        Math.floor(entrancePosition.x / this.TILE_SIZE) === worldX &&
        Math.floor(entrancePosition.y / this.TILE_SIZE) === worldY) {

      // Ensure entrance tile is passable
      tile.value = 'STONE';

      // Add entrance POI
      tile.villageStructures = tile.villageStructures ?? [];
      tile.villageStructures.push({
        type: 'dungeon_entrance',
        position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
        poi: new POI({
          type: 'dungeon_entrance',
          position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
          interactable: true,
          passable: false
        })
      });
    }

    // Add dungeon features if this is a tunnel tile (but not the entrance)
    if (isTunnel && tileType !== 'VOID' &&
        !(entrancePosition &&
          Math.floor(entrancePosition.x / this.TILE_SIZE) === worldX &&
          Math.floor(entrancePosition.y / this.TILE_SIZE) === worldY)) {
      this.addDungeonFeatures(tile, worldX, worldY, entrancePosition);
    }

    return tile;
  }

  private isPartOfTunnel(worldX: number, worldY: number, entrancePosition?: Position): boolean {
    if (!entrancePosition) {
      // Without entrance position, create a small default tunnel area
      return Math.abs(worldX) < 5 && Math.abs(worldY) < 5;
    }

    const entranceX = Math.floor(entrancePosition.x / this.TILE_SIZE);
    const entranceY = Math.floor(entrancePosition.y / this.TILE_SIZE);

    // Generate a more compact winding tunnel path from entrance
    const distance = Math.sqrt(Math.pow(worldX - entranceX, 2) + Math.pow(worldY - entranceY, 2));

    // Doubled main tunnel distance from 25 to 50 tiles
    const maxMainDistance = 50;

    // Main tunnel path - creates a winding corridor with INCREASED width for NPC movement
    const mainPathNoise = this.tunnelNoise((worldX - entranceX) / 20.0, (worldY - entranceY) / 20.0);

    // Create main path with MORE generous tunnel generation for NPC movement
    const isMainPath = distance < maxMainDistance && Math.abs(mainPathNoise) < 0.5; // Increased from 0.35 to 0.5

    // SIGNIFICANTLY increased branching and room creation for NPC movement space
    const branchNoise = this.tunnelNoise((worldX - entranceX) / 12.0, (worldY - entranceY) / 12.0);
    const roomNoise = this.tunnelNoise((worldX - entranceX) / 8.0, (worldY - entranceY) / 8.0);

    // More extensive branching and room system
    const isBranch = distance < 35 && distance > 10 && Math.abs(branchNoise) < 0.3; // Increased from 0.2 to 0.3
    const isRoom = distance < 25 && Math.abs(roomNoise) < 0.25; // New room areas for NPCs to move in

    // Extended entrance area for initial NPC movement
    const isNearEntrance = distance < 8; // Increased from 5 to 8

    // Create connecting corridors between rooms
    const corridorNoise = this.tunnelNoise((worldX - entranceX) / 6.0, (worldY - entranceY) / 6.0);
    const isCorridor = distance < 40 && Math.abs(corridorNoise) < 0.15;

    return isMainPath || isBranch || isRoom || isNearEntrance || isCorridor;
  }

  private getTunnelTileType(worldX: number, worldY: number): 'STONE' | 'COBBLESTONE' {
    // Use simple random to mix stone and cobblestone
    const random = Math.abs(Math.sin(worldX * 12.9898 + worldY * 78.233)) % 1;
    return random < 0.6 ? 'STONE' : 'COBBLESTONE';
  }

  private addDungeonFeatures(tile: Tile, worldX: number, worldY: number, entrancePosition?: Position): void {
    if (!entrancePosition) return;

    const entranceX = Math.floor(entrancePosition.x / this.TILE_SIZE);
    const entranceY = Math.floor(entrancePosition.y / this.TILE_SIZE);
    const distanceFromEntrance = Math.sqrt(Math.pow(worldX - entranceX, 2) + Math.pow(worldY - entranceY, 2));

    // Check if this tile is the cached portal location
    if (this.portalPosition) {
      const portalTileX = Math.floor(this.portalPosition.x / this.TILE_SIZE);
      const portalTileY = Math.floor(this.portalPosition.y / this.TILE_SIZE);

      if (worldX === portalTileX && worldY === portalTileY) {
        // This is the cached portal location - spawn the portal here
        this.spawnPortal(tile, worldX, worldY, distanceFromEntrance);
        return; // Don't add other features on portal tile
      }
    }

    // Prevent entity spawning in exclusion zone around entrance
    if (distanceFromEntrance < 10) {
      return; // Skip all entity spawning near entrance
    }

    // Get high amplitude entity noise value for this tile (for monsters and chests only)
    const entityNoiseValue = this.entityNoise(worldX / 50.0, worldY / 50.0);
    const spawnType = Dungeon.getEntitySpawnType(entityNoiseValue, 'dungeon');

    // Spawn entities based on noise-determined type (excluding portal)
    switch (spawnType) {
      case 'monster':
        if (this.spawnMonster(tile, worldX, worldY, distanceFromEntrance)) {
          return; // Don't add chest on monster tile
        }
        break;

      case 'chest':
        if (this.chestCount < this.MAX_CHESTS && distanceFromEntrance > 8) {
          this.spawnChest(tile, worldX, worldY, distanceFromEntrance, entranceX, entranceY);
        }
        break;

      // Portal is handled separately via cached location
      case 'portal':
      default:
        // No entity spawned
        break;
    }
  }

  private spawnPortal(tile: Tile, worldX: number, worldY: number, distanceFromEntrance: number): void {
    tile.villageStructures = tile.villageStructures ?? [];
    tile.villageStructures.push({
      type: 'dungeon_portal',
      position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      poi: new POI({
        type: 'dungeon_portal',
        position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
        interactable: true,
        passable: false
      })
    });
    this.portalGenerated = true; // Mark portal as generated
    console.log(`🚪 Spawned dungeon portal at tile (${worldX}, ${worldY}) - distance ${distanceFromEntrance.toFixed(1)} from entrance`);
  }

  private spawnMonster(tile: Tile, worldX: number, worldY: number, distanceFromEntrance: number): boolean {
    // Check spacing constraint
    if (this.hasNearbySpawnedMonster(worldX, worldY, 3)) {
      return false; // Too close to another monster
    }

    const monsterType = this.selectDungeonMonster();
    const monster = new NPC({
      type: monsterType,
      position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      aggressive: true
    });

    tile.villageStructures = tile.villageStructures ?? [];
    tile.villageStructures.push({
      type: monsterType,
      position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      npc: monster
    });

    // Track spawned monster for spacing
    this.spawnedMonsters.add(`${worldX},${worldY}`);

    // Reduced logging for performance
    if (Math.random() < 0.1) { // Only log 10% of spawns to reduce console spam
      console.log(`👹 Spawned ${monsterType} at distance ${distanceFromEntrance.toFixed(1)} from entrance`);
    }

    return true;
  }

  private spawnChest(tile: Tile, worldX: number, worldY: number, distanceFromEntrance: number, entranceX: number, entranceY: number): void {
    // Check spacing constraint
    if (this.hasNearbySpawnedChest(worldX, worldY, 4)) {
      return; // Too close to another chest
    }

    // Generate deterministic chest inventory
    const chestSeed = entranceX * 1000 + entranceY + worldX + worldY;
    const chestInventory = this.generateRareChestInventory(distanceFromEntrance, chestSeed);

    tile.villageStructures = tile.villageStructures ?? [];
    tile.villageStructures.push({
      type: 'rare_chest',
      position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      poi: new POI({
        type: 'rare_chest',
        position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
        interactable: true,
        passable: false,
        customData: {
          inventory: chestInventory,
          chestId: `chest_${entranceX}_${entranceY}_${worldX}_${worldY}` // Unique ID for save/load
        }
      })
    });

    // Track spawned chest for spacing
    this.spawnedChests.add(`${worldX},${worldY}`);

    this.chestCount++; // Increment chest counter
    // Reduced logging for performance
    if (this.chestCount <= 3 || this.chestCount % 3 === 0) { // Only log first 3 chests and every 3rd chest
      console.log(`💰 Spawned rare chest ${this.chestCount}/${this.MAX_CHESTS} at distance ${distanceFromEntrance.toFixed(1)} from entrance with ${chestInventory.filter(i => i !== null).length} items`);
    }
  }

  /**
   * Reusable entity spawning system using high amplitude noise
   * Can be used across different environments (dungeons, caves, etc.)
   */
  public static getEntitySpawnType(
    noiseValue: number,
    environment: 'dungeon' | 'cave' | 'forest' = 'dungeon'
  ): 'monster' | 'chest' | 'portal' | 'rare' | null {
    const absNoise = Math.abs(noiseValue);

        // Environment-specific thresholds
    const thresholds = {
      dungeon: {
        monster: { min: 0.6, max: 0.85 },   // 25% of tiles (increased from 15%)
        chest: { min: 0.85, max: 0.95 },    // 10% of tiles
        portal: { min: 0.95, max: 1.0 }     // 5% of tiles (rarest)
      },
      cave: {
        monster: { min: 0.6, max: 0.8 },    // 20% of tiles (more monsters in caves)
        chest: { min: 0.8, max: 0.95 },     // 15% of tiles
        rare: { min: 0.95, max: 1.0 }       // 5% of tiles (rare minerals)
      },
      forest: {
        monster: { min: 0.75, max: 0.9 },   // 15% of tiles
        chest: { min: 0.9, max: 1.0 }       // 10% of tiles (treasure chests)
      }
    };

    const envThresholds = thresholds[environment];

    // Check in order of priority (rarest first)
    if ('portal' in envThresholds && absNoise >= envThresholds.portal.min) return 'portal';
    if ('rare' in envThresholds && absNoise >= envThresholds.rare.min) return 'rare';
    if ('chest' in envThresholds && absNoise >= envThresholds.chest.min) return 'chest';
    if ('monster' in envThresholds && absNoise >= envThresholds.monster.min) return 'monster';

    return null;
  }

  private selectDungeonMonster(): 'orc' | 'skeleton' | 'goblin' | 'archer_goblin' | 'club_goblin' | 'farmer_goblin' | 'orc_shaman' | 'spear_goblin' | 'slime' {
    const monsters = ['orc', 'skeleton', 'goblin', 'archer_goblin', 'club_goblin', 'farmer_goblin', 'orc_shaman', 'spear_goblin', 'slime'] as const;
    const randomIndex = Math.floor(Math.random() * monsters.length);
    return monsters[randomIndex] ?? 'goblin'; // Fallback to goblin if index is invalid
  }

  private generateRareChestInventory(distanceFromEntrance: number, seed: number): (InventoryItem | null)[] {
    // Create deterministic random based on seed
    const seededRandom = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    const inventory: (InventoryItem | null)[] = new Array<InventoryItem | null>(9).fill(null);
    let itemIndex = 0;

    // Define possible items with their spawn chances
    const possibleItems = [
      { type: 'copper_ore', maxQuantity: 5, chance: 0.7 },
      { type: 'iron_ore', maxQuantity: 3, chance: 0.6 },
      { type: 'gold_ore', maxQuantity: 2, chance: 0.5 },
      { type: 'coal', maxQuantity: 4, chance: 0.6 },
      { type: 'silver_ore', maxQuantity: 3, chance: 0.4 },
      { type: 'gold_ingot', maxQuantity: 2, chance: 0.3 },
      { type: 'bone', maxQuantity: 15, chance: 0.5 }
    ];

    // Generate items based on distance and seed
    for (let i = 0; i < possibleItems.length && itemIndex < 9; i++) {
      const item = possibleItems[i]!;
      const itemSeed = seed + i * 137; // Prime number for better distribution
      const spawnChance = seededRandom(itemSeed);

      if (spawnChance < item.chance) {
        const quantitySeed = seed + i * 239;
        const quantity = Math.floor(seededRandom(quantitySeed) * item.maxQuantity) + 1;

        if (quantity > 0) {
          inventory[itemIndex] = {
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type: item.type,
            quantity: quantity
          };
          itemIndex++;
        }
      }
    }

    return inventory;
  }

  private isNearPosition(x: number, y: number, position: Position, radius: number): boolean {
    const distance = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
    return distance <= radius;
  }

  private isFarthestAccessiblePoint(worldX: number, worldY: number, entrancePosition?: Position): boolean {
    if (!entrancePosition) return false;

    const entranceX = Math.floor(entrancePosition.x / this.TILE_SIZE);
    const entranceY = Math.floor(entrancePosition.y / this.TILE_SIZE);
    const distance = Math.sqrt(Math.pow(worldX - entranceX, 2) + Math.pow(worldY - entranceY, 2));

    // This is a simplified check - in a real implementation you'd trace the tunnel path
    // For now, consider points that are far from entrance and have low tunnel connectivity
    return distance > 50 && Math.random() < 0.01; // Very rare, far from entrance
  }

  public generateDungeonName(dungeonPosition: Position): string {
    const posKey = `${Math.floor(dungeonPosition.x / this.TILE_SIZE)},${Math.floor(dungeonPosition.y / this.TILE_SIZE)}`;

    if (this.dungeonNames.has(posKey)) {
      return this.dungeonNames.get(posKey)!;
    }

    // Generate deterministic random name based on position
    const x = Math.floor(dungeonPosition.x / this.TILE_SIZE);
    const y = Math.floor(dungeonPosition.y / this.TILE_SIZE);
    const seed = Math.abs(Math.sin(x * 12.9898 + y * 78.233)) % 1;

    const prefixIndex = Math.floor(seed * this.DUNGEON_PREFIXES.length);
    const suffixIndex = Math.floor((seed * 7919) % 1 * this.DUNGEON_SUFFIXES.length);

    const prefix = this.DUNGEON_PREFIXES[prefixIndex] ?? 'Dark';
    const suffix = this.DUNGEON_SUFFIXES[suffixIndex] ?? 'Cavern';

    const name = `${prefix} ${suffix}`;
    this.dungeonNames.set(posKey, name);

    return name;
  }

  public getDungeonChunk(chunkX: number, chunkY: number): DungeonChunk | undefined {
    const chunkKey = `${chunkX},${chunkY}`;
    return this.dungeonChunks.get(chunkKey);
  }

  public isTunnelTile(worldX: number, worldY: number): boolean {
    const noiseX = worldX / 100.0;
    const noiseY = worldY / 100.0;
    const tunnelValue = this.tunnelNoise(noiseX, noiseY);
    return tunnelValue > this.TUNNEL_THRESHOLD;
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Calculate visible area manually
    const startTileX = Math.floor(camera.position.x / this.TILE_SIZE);
    const endTileX = Math.ceil((camera.position.x + camera.viewWidth) / this.TILE_SIZE);
    const startTileY = Math.floor(camera.position.y / this.TILE_SIZE);
    const endTileY = Math.ceil((camera.position.y + camera.viewHeight) / this.TILE_SIZE);

    for (let tileX = startTileX; tileX <= endTileX; tileX++) {
      for (let tileY = startTileY; tileY <= endTileY; tileY++) {
        const tile = this.getDungeonTile(tileX, tileY, this.currentEntrancePosition ?? undefined);
        if (tile) {
          const screenPos = camera.worldToScreen(tileX * this.TILE_SIZE, tileY * this.TILE_SIZE);
          this.renderDungeonTile(ctx, tile, screenPos.x, screenPos.y);
        }
      }
    }
  }

  public renderHealthBars(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Render health bars for NPCs on top of all sprites in dungeon
    // Calculate visible area manually
    const startTileX = Math.floor(camera.position.x / this.TILE_SIZE);
    const endTileX = Math.ceil((camera.position.x + camera.viewWidth) / this.TILE_SIZE);
    const startTileY = Math.floor(camera.position.y / this.TILE_SIZE);
    const endTileY = Math.ceil((camera.position.y + camera.viewHeight) / this.TILE_SIZE);

    for (let tileX = startTileX; tileX <= endTileX; tileX++) {
      for (let tileY = startTileY; tileY <= endTileY; tileY++) {
        const tile = this.getDungeonTile(tileX, tileY, this.currentEntrancePosition ?? undefined);
        if (tile?.villageStructures) {
          const screenPos = camera.worldToScreen(tileX * this.TILE_SIZE, tileY * this.TILE_SIZE);
          const screenTileX = screenPos.x - (this.TILE_SIZE / 2);
          const screenTileY = screenPos.y - (this.TILE_SIZE / 2);

          for (const structure of tile.villageStructures) {
            if (structure.npc && !structure.npc.isDead()) {
              // Render health bar only if NPC is alive (health > 0) and damaged
              if (structure.npc.getHealth() > 0 && structure.npc.getHealth() < structure.npc.getMaxHealth()) {
                this.renderHealthBar(ctx, screenTileX + 1, screenTileY + 1, structure.npc.getHealth(), structure.npc.getMaxHealth());
              }
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

  private getDungeonTile(x: number, y: number, entrancePosition?: Position): Tile | undefined {
    // Get or generate dungeon tile at world coordinates
    const chunkX = Math.floor(x / 16);
    const chunkY = Math.floor(y / 16);
    const localX = x - (chunkX * 16);
    const localY = y - (chunkY * 16);

    const chunk = this.getDungeonChunk(chunkX, chunkY) ?? this.generateDungeonChunk(chunkX, chunkY, 16, entrancePosition);

    return chunk.tiles[localY]?.[localX];
  }

  private renderDungeonTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number): void {
    const tileX = x - (this.TILE_SIZE / 2);
    const tileY = y - (this.TILE_SIZE / 2);

    // Render background color with 1px border gap (black background shows through)
    ctx.fillStyle = this.getDungeonTileColor(tile.value);
    ctx.fillRect(tileX + 1, tileY + 1, this.TILE_SIZE - 2, this.TILE_SIZE - 2);

    // Render dungeon structures if present
    if (tile.villageStructures) {
      for (const structure of tile.villageStructures) {
        // Render POIs first (chests, portals, etc.)
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

  private getDungeonTileColor(tileType: string): string {
    switch (tileType) {
      case 'STONE': return '#808080';
      case 'COBBLESTONE': return '#A9A9A9';
      case 'VOID': return '#000000';
      default: return '#333333';
    }
  }

  public setEntrancePosition(position: Position | null): void {
    // Check if this is the same dungeon entrance
    const isSameDungeon = this.currentEntrancePosition && position &&
      Math.abs(this.currentEntrancePosition.x - position.x) < 1 &&
      Math.abs(this.currentEntrancePosition.y - position.y) < 1;

    // Only clear caches and reset counters if entering a different dungeon
    if (!isSameDungeon) {
      // Reset dungeon-specific counters when entering new dungeon
      this.portalGenerated = false;
      this.portalPosition = null; // Clear portal position for new dungeon
      this.chestCount = 0;

      // Clear spawned entity tracking
      this.spawnedMonsters.clear();
      this.spawnedChests.clear();

      // Clear cached chunks when entering a new dungeon to ensure fresh generation
      this.dungeonChunks.clear();
      this.dungeonNames.clear();

      console.log(`🏚️ Entering new dungeon at ${position ? `(${position.x}, ${position.y})` : 'null'} - cleared caches`);
    } else {
      console.log(`🏚️ Re-entering same dungeon at ${position ? `(${position.x}, ${position.y})` : 'null'} - preserving portal location`);
    }

    this.currentEntrancePosition = position;

    // If this is a new dungeon and we have an entrance position, find and cache the portal location
    if (!isSameDungeon && position && !this.portalPosition) {
      this.findAndCachePortalLocation(position);
    }
  }

  private findAndCachePortalLocation(entrancePosition: Position): void {
    const entranceX = Math.floor(entrancePosition.x / this.TILE_SIZE);
    const entranceY = Math.floor(entrancePosition.y / this.TILE_SIZE);

    let furthestTile: { x: number; y: number; distance: number } | null = null;

    // Search in a large radius around the entrance to find all tunnel tiles
    const searchRadius = 60; // Large enough to cover the entire dungeon

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const worldX = entranceX + dx;
        const worldY = entranceY + dy;

        // Check if this tile is part of the tunnel system
        if (this.isPartOfTunnel(worldX, worldY, entrancePosition)) {
          const distance = Math.sqrt(Math.pow(worldX - entranceX, 2) + Math.pow(worldY - entranceY, 2));

          // Only consider tiles that are far enough from entrance (45+ tiles)
          if (distance >= 45) {
            if (!furthestTile || distance > furthestTile.distance) {
              furthestTile = { x: worldX, y: worldY, distance };
            }
          }
        }
      }
    }

    if (furthestTile) {
      // Cache the portal position
      this.portalPosition = {
        x: furthestTile.x * this.TILE_SIZE,
        y: furthestTile.y * this.TILE_SIZE
      };
      console.log(`🚪 Cached portal location at tile (${furthestTile.x}, ${furthestTile.y}) - distance ${furthestTile.distance.toFixed(1)} from entrance`);
    } else {
      console.warn('⚠️ No valid portal location found in dungeon');
    }
  }

  private hasNearbyMonster(centerX: number, centerY: number, radius: number): boolean {
    // Check in a radius around the center position for existing monsters
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let y = centerY - radius; y <= centerY + radius; y++) {
        const tile = this.getTile(x, y);
        if (tile?.villageStructures) {
          for (const structure of tile.villageStructures) {
            if (structure.npc && !structure.npc.isDead()) {
              return true; // Found a nearby monster
            }
          }
        }
      }
    }
    return false;
  }

  private hasNearbyChest(centerX: number, centerY: number, radius: number): boolean {
    // Check in a radius around the center position for existing chests
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let y = centerY - radius; y <= centerY + radius; y++) {
        const tile = this.getTile(x, y);
        if (tile?.villageStructures) {
          for (const structure of tile.villageStructures) {
            if (structure.poi && structure.poi.type === 'rare_chest') {
              return true; // Found a nearby chest
            }
          }
        }
      }
    }
    return false;
  }

  private hasNearbySpawnedMonster(centerX: number, centerY: number, radius: number): boolean {
    // Check in a radius around the center position for already spawned monsters
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let y = centerY - radius; y <= centerY + radius; y++) {
        // Skip center tile
        if (x === centerX && y === centerY) continue;

        if (this.spawnedMonsters.has(`${x},${y}`)) {
          return true; // Found a monster nearby
        }
      }
    }
    return false;
  }

  private hasNearbySpawnedChest(centerX: number, centerY: number, radius: number): boolean {
    // Check in a radius around the center position for already spawned chests
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let y = centerY - radius; y <= centerY + radius; y++) {
        // Skip center tile
        if (x === centerX && y === centerY) continue;

        if (this.spawnedChests.has(`${x},${y}`)) {
          return true; // Found a chest nearby
        }
      }
    }
    return false;
  }

  public getTile(tileX: number, tileY: number): Tile | undefined {
    return this.getDungeonTile(tileX, tileY, this.currentEntrancePosition ?? undefined);
  }

  public getPortalPosition(): Position | null {
    return this.portalPosition;
  }

  public update(deltaTime: number, playerPosition?: Position, playerInventory?: InventoryItem[], camera?: Camera): void {
    if (!playerPosition || !camera) return;

    // Calculate view radius in tiles based on camera dimensions (like world system)
    // Add buffer for smooth transitions
    const tileSize = this.TILE_SIZE;
    const viewWidthInTiles = Math.ceil(camera.viewWidth / tileSize) + 5; // +5 tile buffer
    const viewHeightInTiles = Math.ceil(camera.viewHeight / tileSize) + 5; // +5 tile buffer
    const viewRadiusInTiles = Math.max(viewWidthInTiles, viewHeightInTiles) / 2;

    // Collect all NPCs and village buildings for flocking algorithm (like world system)
    const allNPCs: NPC[] = [];
    const allVillageBuildings: Position[] = [];
    const npcsToUpdate: { npc: NPC; tileX: number; tileY: number }[] = [];

    // Search much larger area around player to find ALL dungeon NPCs
    const playerTileX = Math.floor(playerPosition.x / this.TILE_SIZE);
    const playerTileY = Math.floor(playerPosition.y / this.TILE_SIZE);

    // First pass: collect ALL NPCs from entire dungeon area (like world system)
    // Use a large search radius to find all NPCs for flocking algorithm
    const searchRadiusInTiles = 75; // Large radius to find all NPCs in dungeon
    for (let dx = -searchRadiusInTiles; dx <= searchRadiusInTiles; dx++) {
      for (let dy = -searchRadiusInTiles; dy <= searchRadiusInTiles; dy++) {
        const tileX = playerTileX + dx;
        const tileY = playerTileY + dy;
        const tile = this.getTile(tileX, tileY);

        if (tile?.villageStructures) {
          for (const structure of tile.villageStructures) {
            // Collect ALL NPCs for flocking algorithm
            if (structure.npc && !structure.npc.isDead()) {
              allNPCs.push(structure.npc);

              // Check if NPC is within camera view radius (like world system)
              const npcDistance = Math.sqrt(
                Math.pow(structure.npc.position.x - playerPosition.x, 2) +
                Math.pow(structure.npc.position.y - playerPosition.y, 2)
              ) / this.TILE_SIZE;

              // Update NPCs within camera view radius (camera-based, not player-proximity)
              if (npcDistance <= viewRadiusInTiles) {
                npcsToUpdate.push({ npc: structure.npc, tileX, tileY });
              }
            }

            // Collect structures (for trader behavior)
            if (structure.poi && structure.poi.type !== 'dungeon_portal') {
              allVillageBuildings.push(structure.position);
            }
          }
        }
      }
    }

    // Clear movement intentions from previous update cycle (like world system)
    const movementIntentions = new Map<string, NPC>(); // tileKey -> NPC that wants to move there

    // First phase: Collect movement intentions from all NPCs (like world system)
    for (const npcData of npcsToUpdate) {
      const { npc } = npcData;
      const pos = playerPosition;
      const inventory = playerInventory ?? [];

      // Get nearby NPCs within reasonable distance (10 tiles) for flocking
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
        movementIntentions.set(targetTileKey, npc);
      }
    }

    // Second phase: Update NPCs with movement intentions registered (like world system)
    for (const npcData of npcsToUpdate) {
      const { npc, tileX, tileY } = npcData;
      const pos = playerPosition;
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

      // Set tile collision callback for dungeon tiles
      npc.setTileCollisionCallback((position: Position) => {
        const checkTileX = Math.floor(position.x / this.TILE_SIZE);
        const checkTileY = Math.floor(position.y / this.TILE_SIZE);

        return this.isDungeonTileOccupied(checkTileX, checkTileY, pos, npc);
      });

      // Set speculative movement callback for coordination (enhanced with movement intentions)
      npc.setSpeculativeMovementCallback((position: Position, movingNPC: NPC) => {
        const targetTileX = Math.floor(position.x / this.TILE_SIZE);
        const targetTileY = Math.floor(position.y / this.TILE_SIZE);
        const targetTileKey = `${targetTileX},${targetTileY}`;

        // Check if there's an NPC on the target tile
        const targetTile = this.getTile(targetTileX, targetTileY);
        if (!targetTile?.villageStructures) return false;

        for (const structure of targetTile.villageStructures) {
          if (structure.npc && !structure.npc.isDead() && structure.npc !== movingNPC) {
            // Check if the other NPC has movement intentions that conflict
            const movingNPCTileX = Math.floor(movingNPC.position.x / this.TILE_SIZE);
            const movingNPCTileY = Math.floor(movingNPC.position.y / this.TILE_SIZE);
            const movingNPCTileKey = `${movingNPCTileX},${movingNPCTileY}`;

            // Allow movement if the other NPC wants to move to our current tile (swap)
            const otherNPCIntention = movementIntentions.get(movingNPCTileKey);
            if (otherNPCIntention === structure.npc) {
              console.log(`🏚️ Speculative movement: Allowing ${movingNPC.type} to swap with ${structure.npc.type}`);
              return true;
            }
          }
        }

        return false;
      });

      // Update NPC with flocking behavior
      npc.update(deltaTime, pos, inventory, nearbyNPCs, nearbyBuildings);

      // Check if NPC moved to a different tile
      const newTileX = Math.floor(npc.position.x / this.TILE_SIZE);
      const newTileY = Math.floor(npc.position.y / this.TILE_SIZE);

      if (oldTileX !== newTileX || oldTileY !== newTileY) {
        // NPC moved to a different tile, update tile occupancy
        console.log(`🏚️ ${npc.type} moved from (${oldTileX}, ${oldTileY}) to (${newTileX}, ${newTileY}) in dungeon`);
        this.moveNPCBetweenTiles(npc, oldTileX, oldTileY, newTileX, newTileY);
      }
    }

    console.log(`🏚️ Dungeon update: Found ${npcsToUpdate.length} NPCs to update, ${allNPCs.length} total NPCs`);
  }

  private moveNPCBetweenTiles(npc: NPC, oldTileX: number, oldTileY: number, newTileX: number, newTileY: number): void {
    // Trust the NPC's movement logic - if it moved successfully, update tile structures
    // The NPC has already done collision detection, so don't second-guess it

    // Remove NPC from old tile
    const oldTile = this.getTile(oldTileX, oldTileY);
    if (oldTile?.villageStructures) {
      const index = oldTile.villageStructures.findIndex(s => s.npc === npc);
      if (index !== -1) {
        const npcStructure = oldTile.villageStructures[index];
        oldTile.villageStructures.splice(index, 1);

        // Add NPC to new tile (create as passable tunnel tile if it doesn't exist)
        let newTile = this.getTile(newTileX, newTileY);
        if (!newTile || newTile.value === 'VOID') {
          // Create a passable tile for the NPC to move on
          newTile = {
            x: newTileX,
            y: newTileY,
            value: 'STONE',
            height: 0.5,
            temperature: 0.3,
            humidity: 0.7,
            interacted: false
          };

          // Update the cached dungeon tile
          const chunkX = Math.floor(newTileX / 16);
          const chunkY = Math.floor(newTileY / 16);
          const localX = newTileX - (chunkX * 16);
          const localY = newTileY - (chunkY * 16);
          const chunk = this.getDungeonChunk(chunkX, chunkY);
          if (chunk?.tiles[localY]) {
            chunk.tiles[localY][localX] = newTile;
          }
        }

        // Ensure villageStructures array exists
        newTile.villageStructures ??= [];

        // Update the structure's position to match the NPC's actual position
        npcStructure!.position = { x: npc.position.x, y: npc.position.y };
        newTile.villageStructures.push(npcStructure!);

        console.log(`🏚️ Successfully moved ${npc.type} from (${oldTileX}, ${oldTileY}) to (${newTileX}, ${newTileY})`);
      }
    }
  }

  private isDungeonTileOccupied(tileX: number, tileY: number, playerPosition: Position, excludeNPC?: NPC): boolean {
    const tile = this.getTile(tileX, tileY);
    if (!tile) {
      return true; // Treat invalid tiles as occupied
    }

    // Check for impassable terrain (VOID tiles block movement in dungeons)
    if (tile.value === 'VOID') {
      return true;
    }

    // Check if player is on this tile
    const playerTileX = Math.floor(playerPosition.x / this.TILE_SIZE);
    const playerTileY = Math.floor(playerPosition.y / this.TILE_SIZE);
    if (playerTileX === tileX && playerTileY === tileY) {
      return true; // Player is on this tile
    }

    // Check for village structures (POIs and NPCs)
    if (tile.villageStructures) {
      for (const structure of tile.villageStructures) {
        // Check for impassable POIs
        if (structure.poi && !structure.poi.passable) {
          return true;
        }
        // Check for living NPCs (excluding the one we're checking for)
        if (structure.npc && !structure.npc.isDead() && structure.npc !== excludeNPC) {
          return true;
        }
      }
    }

    return false;
  }
}