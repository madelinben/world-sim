import { createNoise2D } from 'simplex-noise';
import type { Position, Tile, DungeonStructure, NPCLike } from '../engine/types';
import { WorldGenerator } from './WorldGenerator';
import { POI } from '../entities/poi/POI';
import { NPC } from '../entities/npc/NPC';
import type { InventoryItem, Inventory } from '../entities/inventory/Inventory';
import type { Camera } from '../systems/Camera';
import { LightingSystem } from '../systems/LightingSystem';
import { Tombstone } from '../entities/poi/Tombstone';

interface DungeonChunk {
  tiles: (Tile | null)[][];
}

// Simple dungeon structure interface that works with actual classes
interface DungeonTileStructure {
  type: string;
  position: Position;
  poi?: POI;
  npc?: NPC;
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
  private lightingSystem: LightingSystem | null = null; // Reference to lighting system for portal registration
  private pendingLightingUpdates: Array<{ x: number; y: number; intensity: number; radius: number }> = [];

  // Track current player position for NPC collision detection
  private currentPlayerPosition: Position | null = null;

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
    const tiles: (Tile | null)[][] = [];

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
      tiles
    };

    const chunkKey = `${chunkX},${chunkY}`;
    this.dungeonChunks.set(chunkKey, chunk);

    // Process any pending lighting updates after chunk generation is complete
    this.processPendingLightingUpdates();

    return chunk;
  }

  private generateDungeonTile(worldX: number, worldY: number, entrancePosition?: Position): Tile | null {
    // Default to stone (impassable walls)
    let tileType: 'STONE' | 'COBBLESTONE' | 'DIRT' = 'STONE';

    // Check if this tile is part of the tunnel system
    const isTunnel = this.isPartOfTunnel(worldX, worldY, entrancePosition);

    if (isTunnel) {
      // Random mix of COBBLESTONE (60%) and DIRT (40%) for tunnel floors
      tileType = Math.random() < 0.6 ? 'COBBLESTONE' : 'DIRT';
    }

    // Create base tile with proper light levels
    const tile: Tile = {
      x: worldX,
      y: worldY,
      value: tileType,
      height: 0.5, // Default dungeon height
      temperature: 0.3, // Cool dungeon temperature
      humidity: 0.7, // High dungeon humidity
      interacted: false,
      villageStructures: [],
      lightLevel: 0.0, // Dungeons are completely dark
      effectiveLightLevel: 0.0 // Will be calculated with torch effects
    };

    // Add entrance at the exact entrance position
    if (entrancePosition &&
        Math.floor(entrancePosition.x / this.TILE_SIZE) === worldX &&
        Math.floor(entrancePosition.y / this.TILE_SIZE) === worldY) {

      // Ensure entrance tile is passable
      tile.value = 'COBBLESTONE';

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
    if (isTunnel && (tileType === 'COBBLESTONE' || tileType === 'DIRT') &&
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
        // Check if monster can spawn based on light level and noise
        const effectiveLightLevel = this.lightingSystem?.calculateTileEffectiveLight(tile, 'dungeon') ?? (tile.effectiveLightLevel ?? tile.lightLevel ?? 0.0);
        if (LightingSystem.canSpawnMonster(effectiveLightLevel, entityNoiseValue, 0.6) && this.spawnMonster(tile, worldX, worldY, distanceFromEntrance)) {
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

  /**
   * Set the lighting system reference for portal light registration
   */
  public setLightingSystem(lightingSystem: LightingSystem): void {
    this.lightingSystem = lightingSystem;

    // Register any existing portals with the lighting system
    this.registerExistingPortalsWithLighting();
  }

  /**
   * Register any existing portals in the dungeon with the lighting system
   */
  private registerExistingPortalsWithLighting(): void {
    if (!this.lightingSystem || !this.currentEntrancePosition) return;

    // Use cached portal position if available
    if (this.portalPosition) {
      const portalTileX = Math.floor(this.portalPosition.x / this.TILE_SIZE);
      const portalTileY = Math.floor(this.portalPosition.y / this.TILE_SIZE);

      // Register with lighting system
      this.lightingSystem.addPortal(portalTileX, portalTileY);

      // Update the portal tile and surrounding tiles with proper lighting
      const portalTile = this.getExistingDungeonTile(portalTileX, portalTileY);
      if (portalTile) {
        // Set portal tile to full brightness
        portalTile.effectiveLightLevel = Math.min(1.0, 0.0 + 0.6);
        console.log(`💡 Cached portal tile (${portalTileX}, ${portalTileY}) set to full brightness: ${portalTile.effectiveLightLevel}`);

        // Update surrounding tiles
        this.updateSurroundingTileLightLevels(portalTileX, portalTileY, 0.6, 2.5);
      }

      console.log(`🔄 Registered cached portal at tile (${portalTileX}, ${portalTileY}) with lighting system`);
    } else {
      // Fallback: Search through all generated chunks for existing portals
      for (const [chunkKey, chunk] of this.dungeonChunks) {
        for (const tileRow of chunk.tiles) {
          if (!tileRow) continue;
          for (const tile of tileRow) {
            if (tile?.villageStructures) {
              for (const structure of tile.villageStructures) {
                if (structure.poi?.type === 'dungeon_portal') {
                  // Found an existing portal - register it with lighting system
                  const tileX = tile.x;
                  const tileY = tile.y;
                  this.lightingSystem.addPortal(tileX, tileY);

                  // Set portal tile to full brightness
                  tile.effectiveLightLevel = Math.min(1.0, 0.0 + 0.6);
                  console.log(`💡 Found portal tile (${tileX}, ${tileY}) set to full brightness: ${tile.effectiveLightLevel}`);

                  // Update surrounding tiles
                  this.updateSurroundingTileLightLevels(tileX, tileY, 0.6, 2.5);

                  console.log(`🔄 Retroactively registered existing portal at tile (${tileX}, ${tileY}) with lighting system`);
                }
              }
            }
          }
        }
      }
    }

    console.log(`🔄 Completed retroactive portal registration. Total portals: ${this.lightingSystem ? 'registered' : 'none'}`);
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
        passable: false,
        customData: {
          lightRadius: 5, // 5x5 area lighting (same as torches)
          lightIntensity: 0.6 // Same intensity as torches
        }
        })
      });

    // Register portal as light source with lighting system
    if (this.lightingSystem) {
      this.lightingSystem.addPortal(worldX, worldY);
      console.log(`🚪 Portal registered with lighting system at tile (${worldX}, ${worldY})`);
    } else {
      console.warn(`⚠️ No lighting system available to register portal at tile (${worldX}, ${worldY})`);
    }

    // Set the portal tile itself to full brightness immediately
    tile.effectiveLightLevel = Math.min(1.0, 0.0 + 0.6); // Base light + full intensity
    console.log(`💡 Portal tile (${worldX}, ${worldY}) set to full brightness: ${tile.effectiveLightLevel}`);

    // Defer lighting updates for surrounding tiles to avoid circular dependency during tile generation
    this.deferLightingUpdate(worldX, worldY, 0.6, 2.5);

      this.portalGenerated = true; // Mark portal as generated
    console.log(`🚪 Spawned dungeon portal at tile (${worldX}, ${worldY}) - distance ${distanceFromEntrance.toFixed(1)} from entrance`);
  }

      /**
   * Update light levels for tiles around a light source
   */
  private updateSurroundingTileLightLevels(centerX: number, centerY: number, intensity: number, radius: number): void {
    const radiusCeil = Math.ceil(radius);

    for (let dx = -radiusCeil; dx <= radiusCeil; dx++) {
      for (let dy = -radiusCeil; dy <= radiusCeil; dy++) {
        const tileX = centerX + dx;
        const tileY = centerY + dy;

        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= radius) {
          // Only update existing tiles - don't generate new ones to avoid circular dependency
          const tile = this.getExistingDungeonTile(tileX, tileY);
          if (tile) {
            // Check if this tile contains a portal or torch (light source)
            const isLightSource = this.tileContainsLightSource(tile);

            // Calculate light falloff
            const falloff = 1.0 - (distance / radius);
            const lightBonus = intensity * falloff;

            // Light source tiles get full intensity regardless of distance
            const baseLightLevel = 0.0; // Dungeon base light
            let newEffectiveLight: number;

            if (isLightSource && (tileX === centerX && tileY === centerY)) {
              // This is the light source tile itself - give it full brightness
              newEffectiveLight = Math.min(1.0, baseLightLevel + intensity);
              console.log(`💡 Light source tile (${tileX}, ${tileY}) - Full intensity: ${intensity}, effective=${newEffectiveLight.toFixed(2)}`);
    } else {
              // This is a surrounding tile - apply falloff
              newEffectiveLight = Math.min(1.0, baseLightLevel + lightBonus);
              console.log(`🔆 Updated tile (${tileX}, ${tileY}) light: distance=${distance.toFixed(2)}, falloff=${falloff.toFixed(2)}, bonus=${lightBonus.toFixed(2)}, effective=${newEffectiveLight.toFixed(2)}`);
            }

            tile.effectiveLightLevel = Math.max(tile.effectiveLightLevel ?? 0, newEffectiveLight);
          }
        }
      }
    }
  }

  /**
   * Check if a tile contains a light source (portal only in dungeons)
   */
  private tileContainsLightSource(tile: Tile): boolean {
    if (!tile.villageStructures) return false;

    return tile.villageStructures.some(structure => {
      const poi = structure.poi;
      if (!poi) return false;

      // Check for portal only - no torches in dungeons
      if (poi.type === 'dungeon_portal' || structure.type === 'dungeon_portal') {
        return true;
      }

      return false;
    });
  }

    /**
   * Get an existing dungeon tile without generating new chunks
   */
  private getExistingDungeonTile(worldX: number, worldY: number): Tile | null {
    const chunkX = Math.floor(worldX / 16);
    const chunkY = Math.floor(worldY / 16);
    const chunkKey = `${chunkX},${chunkY}`;

    const chunk = this.dungeonChunks.get(chunkKey);
    if (!chunk) {
      return null; // Don't generate new chunks
    }

    const localX = worldX - chunkX * 16;
    const localY = worldY - chunkY * 16;

    if (localX < 0 || localX >= 16 || localY < 0 || localY >= 16) {
      return null;
    }

    return chunk.tiles[localY]?.[localX] ?? null;
  }

  /**
   * Defer lighting updates to avoid circular dependency during tile generation
   */
  private deferLightingUpdate(x: number, y: number, intensity: number, radius: number): void {
    this.pendingLightingUpdates.push({ x, y, intensity, radius });
  }

  /**
   * Process all pending lighting updates
   */
  private processPendingLightingUpdates(): void {
    for (const update of this.pendingLightingUpdates) {
      this.updateSurroundingTileLightLevels(update.x, update.y, update.intensity, update.radius);
    }
    this.pendingLightingUpdates = [];
  }

  private spawnMonster(tile: Tile, worldX: number, worldY: number, distanceFromEntrance: number): boolean {
    // Check spacing constraint
    if (this.hasNearbySpawnedMonster(worldX, worldY, 3)) {
      return false; // Too close to another monster
    }

        const monsterType = this.selectDungeonMonster();
    const npc = new NPC({
          type: monsterType,
          position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      aggressive: true,
      health: this.getMonsterHealth(monsterType)
    });

    // Initialize monster inventory
    this.initializeMonsterInventory(npc, monsterType);

    // Set up collision detection for dungeon movement
    npc.setTileCollisionCallback((position: Position) => {
      const tileX = Math.floor(position.x / this.TILE_SIZE);
      const tileY = Math.floor(position.y / this.TILE_SIZE);
      const tile = this.getTile(tileX, tileY);

      if (!tile) {
        return true; // Treat invalid tiles as occupied
      }

      // Check for impassable terrain (STONE tiles block movement in dungeons)
      if (tile.value === 'STONE') {
        return true;
      }

      // Check if this tile is occupied by the player
      if (this.currentPlayerPosition) {
        const playerTileX = Math.floor(this.currentPlayerPosition.x / this.TILE_SIZE);
        const playerTileY = Math.floor(this.currentPlayerPosition.y / this.TILE_SIZE);
        if (playerTileX === tileX && playerTileY === tileY) {
          return true; // Player is on this tile
        }
      }

      // Check for village structures (POIs and NPCs)
      if (tile.villageStructures) {
        for (const structure of tile.villageStructures) {
          // Check for impassable POIs
          if (structure.poi && !structure.poi.passable) {
            return true;
          }
          // Check for living NPCs (excluding self by position comparison)
          if (structure.npc && !structure.npc.isDead() &&
              (structure.npc.position.x !== npc.position.x || structure.npc.position.y !== npc.position.y)) {
            return true;
          }
        }
      }

      return false;
        });

        tile.villageStructures = tile.villageStructures ?? [];
        tile.villageStructures.push({
          type: monsterType,
          position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      npc: npc // Use the actual NPC instance directly instead of wrapping it
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

  private getMonsterHealth(monsterType: string): number {
    switch (monsterType) {
      case 'orc': return 120;
      case 'skeleton': return 40;
      case 'goblin': return 40;
      case 'archer_goblin': return 45;
      case 'club_goblin': return 50;
      case 'farmer_goblin': return 35;
      case 'orc_shaman': return 80;
      case 'spear_goblin': return 45;
      case 'slime': return 40;
      default: return 40;
    }
  }

  private initializeMonsterInventory(npc: NPC, monsterType: string): void {
    // Monsters carry loot similar to rare chests - they're essentially mobile treasure

    // Base dungeon loot - ores and materials (like rare chests)
    npc.inventory.addItem('copper_ore', Math.floor(Math.random() * 3) + 1);
    npc.inventory.addItem('coal', Math.floor(Math.random() * 2) + 1);

    // Add bones for all monsters (classic dungeon drop)
    npc.inventory.addItem('bone', Math.floor(Math.random() * 5) + 1);

    // Better loot based on monster type (stronger monsters = better loot)
    switch (monsterType) {
      case 'orc':
      case 'orc_shaman':
        // Orcs are strong - give them rare materials
        if (Math.random() < 0.4) npc.inventory.addItem('iron_ore', Math.floor(Math.random() * 2) + 1);
        if (Math.random() < 0.3) npc.inventory.addItem('silver_ore', 1);
        if (Math.random() < 0.2) npc.inventory.addItem('gold_ore', 1);
        break;

      case 'skeleton':
        // Skeletons have ancient treasures
        if (Math.random() < 0.3) npc.inventory.addItem('iron_ore', 1);
        if (Math.random() < 0.2) npc.inventory.addItem('gold_ingot', 1);
        break;

      case 'goblin':
      case 'archer_goblin':
      case 'club_goblin':
      case 'farmer_goblin':
      case 'spear_goblin':
        // Goblins hoard shiny things
        if (Math.random() < 0.3) npc.inventory.addItem('iron_ore', 1);
        if (Math.random() < 0.15) npc.inventory.addItem('silver_ore', 1);
        break;

      case 'slime':
        // Slimes absorb materials from the dungeon
        if (Math.random() < 0.2) npc.inventory.addItem('iron_ore', 1);
        npc.inventory.addItem('monster_drop', 1); // Special slime drop
        break;
    }

    // Random chance for rare materials (like rare chests)
    if (Math.random() < 0.1) {
      npc.inventory.addItem('gold_ingot', 1);
    }
  }

  private hasNearbySpawnedMonster(worldX: number, worldY: number, radius: number): boolean {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (this.spawnedMonsters.has(`${worldX + dx},${worldY + dy}`)) {
          return true;
        }
      }
    }
    return false;
  }

  private hasNearbySpawnedChest(worldX: number, worldY: number, radius: number): boolean {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (this.spawnedChests.has(`${worldX + dx},${worldY + dy}`)) {
          return true;
        }
      }
    }
    return false;
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
              if (structure.npc.health > 0 && structure.npc.health < structure.npc.maxHealth) {
                this.renderHealthBar(ctx, screenTileX + 1, screenTileY + 1, structure.npc.health, structure.npc.maxHealth);
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

    // Handle negative coordinates properly by using modulo for local coordinates
    let localX = x % 16;
    let localY = y % 16;

    // JavaScript modulo can return negative values, so normalize to positive
    if (localX < 0) localX += 16;
    if (localY < 0) localY += 16;

    const chunk = this.getDungeonChunk(chunkX, chunkY) ?? this.generateDungeonChunk(chunkX, chunkY, 16, entrancePosition);

    const tile = chunk.tiles[localY]?.[localX];
    return tile ?? undefined;
  }

  private renderDungeonTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number): void {
    const tileX = x - (this.TILE_SIZE / 2);
    const tileY = y - (this.TILE_SIZE / 2);

    // Render background color with 1px border gap (black background shows through) - same as World class
    ctx.fillStyle = this.getDungeonTileColor(tile.value);
    ctx.fillRect(tileX + 1, tileY + 1, this.TILE_SIZE - 2, this.TILE_SIZE - 2);

    // Render dungeon structures if present
    if (tile.villageStructures) {
      for (const structure of tile.villageStructures) {
        // Render POIs first (chests, portals, etc.)
        if (structure.poi?.render) {
          structure.poi.render(ctx, tileX + 1, tileY + 1);
        }
      }

      // Render NPCs on top of POIs (sprites only, no health bars)
      for (const structure of tile.villageStructures) {
        if (structure.npc && !structure.npc.isDead() && structure.npc.renderSpriteOnly) {
          structure.npc.renderSpriteOnly(ctx, tileX + 1, tileY + 1);
        }
      }
    }
  }

  private getDungeonTileColor(tileType: string): string {
    switch (tileType) {
      case 'STONE': return '#000000'; // Black for underground stone walls
      case 'COBBLESTONE': return '#A9A9A9';
      case 'DIRT': return '#696969';
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

      // Clear portal positions from lighting system when entering new dungeon
      if (this.lightingSystem) {
        this.lightingSystem.clearPortals();
        // Also clear any torch positions to ensure only portals provide light in dungeons
        this.lightingSystem.clearTorches();
      }

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

  public getTile(tileX: number, tileY: number): Tile | undefined {
    return this.getDungeonTile(tileX, tileY, this.currentEntrancePosition ?? undefined);
  }

  public getPortalPosition(): Position | null {
    return this.portalPosition;
  }

  /**
   * Update the current player position for NPC collision detection
   */
  public setPlayerPosition(playerPosition: Position): void {
    this.currentPlayerPosition = playerPosition;
  }

  public update(deltaTime: number, playerPosition?: Position, playerInventory?: InventoryItem[], camera?: Camera): void {
    if (!playerPosition || !camera) return;

    // Update player position for NPC collision detection
    this.setPlayerPosition(playerPosition);

    // Track NPCs that need to move between tiles
    const npcsToMove: Array<{
      npc: NPC;
      structure: DungeonStructure;
      oldTileX: number;
      oldTileY: number;
      newTileX: number;
      newTileY: number;
    }> = [];

    // Update NPCs in visible area and track movement
    const viewRadius = 20;
    for (let dx = -viewRadius; dx <= viewRadius; dx++) {
      for (let dy = -viewRadius; dy <= viewRadius; dy++) {
        const tileX = Math.floor(playerPosition.x / this.TILE_SIZE) + dx;
        const tileY = Math.floor(playerPosition.y / this.TILE_SIZE) + dy;
        const tile = this.getTile(tileX, tileY);

        if (tile?.villageStructures) {
          for (const structure of tile.villageStructures) {
            if (structure.npc?.update && 'position' in structure.npc) {
              const npc = structure.npc as NPC; // Type assertion to access NPC properties

              // Store old position before update
              const oldTileX = Math.floor(npc.position.x / this.TILE_SIZE);
              const oldTileY = Math.floor(npc.position.y / this.TILE_SIZE);

              // Update the NPC
              npc.update(deltaTime, playerPosition, playerInventory ?? []);

              // Check if NPC moved to a different tile
              const newTileX = Math.floor(npc.position.x / this.TILE_SIZE);
              const newTileY = Math.floor(npc.position.y / this.TILE_SIZE);

              if (oldTileX !== newTileX || oldTileY !== newTileY) {
                // Check if monster NPC is trying to move to player's tile
                if (npc.category === 'monster' && newTileX === Math.floor(playerPosition.x / this.TILE_SIZE) && newTileY === Math.floor(playerPosition.y / this.TILE_SIZE)) {
                  // Prevent monster from moving to player's tile - revert position
                  npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
                  console.log(`🚫 Prevented ${npc.type} from moving to player tile (${Math.floor(playerPosition.x / this.TILE_SIZE)}, ${Math.floor(playerPosition.y / this.TILE_SIZE)})`);
                  continue; // Skip processing this movement
                }

                // NPC moved to a different tile, queue for movement handling
                npcsToMove.push({
                  npc,
                  structure: structure as DungeonStructure,
                  oldTileX,
                  oldTileY,
                  newTileX,
                  newTileY
                });
              }
            }
          }
        }
      }
    }

    // Process NPC movements between tiles
    for (const moveData of npcsToMove) {
      this.moveNPCBetweenTiles(moveData.structure, moveData.oldTileX, moveData.oldTileY, moveData.newTileX, moveData.newTileY);
    }
  }

  /**
   * Move an NPC from one tile to another, updating the cached dungeon tile data
   */
  private moveNPCBetweenTiles(npcStructure: DungeonStructure, oldTileX: number, oldTileY: number, newTileX: number, newTileY: number): void {
    // Get both tiles
    const oldTile = this.getTile(oldTileX, oldTileY);
    const newTile = this.getTile(newTileX, newTileY);

    if (!oldTile || !newTile) {
      // Invalid tiles - revert NPC position
      if (npcStructure.npc) {
        npcStructure.npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
        npcStructure.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
      }
      return;
    }

    // Check if the new tile is passable for NPCs
    if (newTile.value === 'STONE') {
      // Can't move to stone tiles - revert position
      if (npcStructure.npc) {
        npcStructure.npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
        npcStructure.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
      }
      return;
    }

    // Check if the new tile is already occupied by another NPC or impassable POI
    if (newTile.villageStructures) {
      for (const structure of newTile.villageStructures) {
        // Check for impassable POIs
        if (structure.poi && !structure.poi.passable) {
          // Can't move to occupied tile - revert position
          if (npcStructure.npc) {
            npcStructure.npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
            npcStructure.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
          }
          return;
        }
        // Check for other living NPCs (excluding self)
        if (structure.npc && !structure.npc.isDead() && structure.npc !== npcStructure.npc) {
          // Can't move to occupied tile - revert position
          if (npcStructure.npc) {
            npcStructure.npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
            npcStructure.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
          }
          return;
        }
      }
    }

    // Remove NPC from old tile
    if (oldTile.villageStructures) {
      oldTile.villageStructures = oldTile.villageStructures.filter(
        structure => structure.npc !== npcStructure.npc
      );
    }

    // Add NPC to new tile
    newTile.villageStructures = newTile.villageStructures ?? [];

    // Update structure position to match new tile
    npcStructure.position = { x: newTileX * this.TILE_SIZE, y: newTileY * this.TILE_SIZE };

    // Add to new tile
    newTile.villageStructures.push(npcStructure);

    console.log(`🚶 Moved ${npcStructure.npc?.type} from tile (${oldTileX}, ${oldTileY}) to (${newTileX}, ${newTileY})`);
  }

  private isDungeonTileOccupied(tileX: number, tileY: number, playerPosition: Position, excludeNPC?: NPC): boolean {
    const tile = this.getTile(tileX, tileY);
    if (!tile) {
      return true; // Treat invalid tiles as occupied
    }

    // Check for impassable terrain (STONE tiles block movement in dungeons)
    if (tile.value === 'STONE') {
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
        // Check for living NPCs (excluding the specified excludeNPC)
        if (structure.npc && !structure.npc.isDead() && structure.npc !== excludeNPC) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Create a tombstone at the specified position with the given inventory
   */
  private createTombstone(position: Position, deadEntityType: string, inventory: (InventoryItem | null)[], deadEntityName?: string): void {
    const tombstone = new Tombstone({
      position,
      inventory,
      deadEntityType,
      deadEntityName
    });

    const tileX = Math.floor(position.x / this.TILE_SIZE);
    const tileY = Math.floor(position.y / this.TILE_SIZE);
    const tile = this.getTile(tileX, tileY);

    if (tile) {
      // Add tombstone as a POI to the tile
      tile.villageStructures = tile.villageStructures ?? [];
      tile.villageStructures.push({
        type: 'tombstone',
        position,
        poi: new POI({
          type: 'tombstone',
          position,
          interactable: true,
          passable: false,
          customData: {
            tombstoneVariant: tombstone.tombstoneVariant,
            inventory: inventory,
            deadEntityType: deadEntityType,
            deadEntityName: deadEntityName
          }
        })
      });

      console.log(`💀 Created tombstone in dungeon at (${tileX}, ${tileY})`);
    }
  }

  /**
   * Handle player death in dungeon - create tombstone with player's inventory
   */
  public handlePlayerDeath(playerPosition: Position, playerInventory: (InventoryItem | null)[], playerName?: string): void {
    // Create tombstone with player's inventory
    this.createTombstone(
      playerPosition,
      'player',
      playerInventory,
      playerName ?? 'Hero'
    );

    console.log(`💀 Player died in dungeon! Tombstone created at (${Math.floor(playerPosition.x / this.TILE_SIZE)}, ${Math.floor(playerPosition.y / this.TILE_SIZE)})`);
  }

  /**
   * Handle NPC death in dungeon - create tombstone with NPC's inventory
   */
  public handleNPCDeath(npc: NPCLike, npcPosition: Position): void {
    // Create tombstone with NPC's inventory for traders and monsters
    if (npc.category === 'friendly' || npc.category === 'monster') {
      // Get NPC inventory if available
      const npcInventory: (InventoryItem | null)[] = [];
      if ('inventory' in npc && npc.inventory && typeof npc.inventory === 'object' && 'getItem' in npc.inventory) {
        const inventory = npc.inventory as Inventory;
        for (let i = 0; i < 9; i++) {
          const item = inventory.getItem(i);
          npcInventory.push(item);
        }
      }

      this.createTombstone(
        npcPosition,
        npc.type,
        npcInventory,
        `${npc.type} Monster`
      );

      console.log(`💀 ${npc.type} died in dungeon! Tombstone created at (${Math.floor(npcPosition.x / this.TILE_SIZE)}, ${Math.floor(npcPosition.y / this.TILE_SIZE)})`);
    }

    // Remove the dead NPC from the tile
    const tileX = Math.floor(npcPosition.x / this.TILE_SIZE);
    const tileY = Math.floor(npcPosition.y / this.TILE_SIZE);
    const tile = this.getTile(tileX, tileY);

    if (tile?.villageStructures) {
      tile.villageStructures = tile.villageStructures.filter(
        structure => !(structure.npc && structure.npc.position.x === npcPosition.x && structure.npc.position.y === npcPosition.y)
      );
    }
  }

  /**
   * Handle animal death in dungeon - add drops to player inventory
   */
  public handleAnimalDeath(npc: NPCLike, playerPosition: Position, playerInventory: Inventory): void {
    console.log(`🐾 ${npc.type} died in dungeon - adding drops to player inventory`);

    // Remove the dead NPC from the tile
    const tileX = Math.floor(npc.position.x / this.TILE_SIZE);
    const tileY = Math.floor(npc.position.y / this.TILE_SIZE);
    const tile = this.getTile(tileX, tileY);

    if (tile?.villageStructures) {
      tile.villageStructures = tile.villageStructures.filter(
        structure => !(structure.npc && structure.npc.position.x === npc.position.x && structure.npc.position.y === npc.position.y)
      );
    }
  }

  /**
   * Get tombstone at specific coordinates
   */
  public getTombstoneAt(tileX: number, tileY: number): Tombstone | null {
    const tile = this.getTile(tileX, tileY);
    if (!tile?.villageStructures) return null;

    for (const structure of tile.villageStructures) {
      if (structure.type === 'tombstone' && structure.poi) {
        // Create a temporary Tombstone object from the POI data
        const tombstoneVariant = structure.poi.customData?.tombstoneVariant ?? 0;
        const inventory = structure.poi.customData?.inventory as (InventoryItem | null)[] ?? [];
        const deadEntityType = structure.poi.customData?.deadEntityType as string ?? 'unknown';
        const deadEntityName = structure.poi.customData?.deadEntityName as string;

        return new Tombstone({
          position: structure.position,
          inventory,
          deadEntityType,
          deadEntityName
        });
      }
    }
    return null;
  }

  /**
   * Remove tombstone from dungeon
   */
  public removeTombstone(tileX: number, tileY: number): boolean {
    const tile = this.getTile(tileX, tileY);
    if (!tile?.villageStructures) return false;

    const tombstoneIndex = tile.villageStructures.findIndex(
      structure => structure.type === 'tombstone'
    );

    if (tombstoneIndex !== -1) {
      // Check if tombstone is empty before removing
      const tombstone = this.getTombstoneAt(tileX, tileY);
      if (tombstone?.isEmpty()) {
        tile.villageStructures.splice(tombstoneIndex, 1);
        if (tile.villageStructures.length === 0) {
          delete tile.villageStructures;
        }
        console.log(`💀 Removed empty tombstone from dungeon at (${tileX}, ${tileY})`);
        return true;
      }
    }

    return false;
  }

  /**
   * Update tombstone inventory in dungeon
   */
  public updateTombstoneInventory(tileX: number, tileY: number, inventory: (InventoryItem | null)[]): void {
    const tile = this.getTile(tileX, tileY);
    if (!tile?.villageStructures) return;

    for (const structure of tile.villageStructures) {
      if (structure.type === 'tombstone' && structure.poi) {
        structure.poi.customData = structure.poi.customData ?? {};
        structure.poi.customData.inventory = inventory;
        console.log(`💾 Updated tombstone inventory in dungeon at (${tileX}, ${tileY})`);
        break;
      }
    }
  }
}