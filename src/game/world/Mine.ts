import { createNoise2D } from 'simplex-noise';
import type { Position, Tile, NPCLike } from '../engine/types';
import { WorldGenerator } from './WorldGenerator';
import { POI } from '../entities/poi/POI';
import { NPC } from '../entities/npc/NPC';
import type { InventoryItem, Inventory } from '../entities/inventory/Inventory';
import type { Camera } from '../systems/Camera';
import { LightingSystem } from '../systems/LightingSystem';
import { Tombstone } from '../entities/poi/Tombstone';

interface MineChunk {
  tiles: (Tile | null)[][];
}

interface MineStructure {
  type: string;
  position: Position;
  poi?: POI;
  npc?: NPC;
}

// Simple mine structure interface that works with actual classes
interface MineTileStructure {
  type: string;
  position: Position;
  poi?: POI;
  npc?: NPC;
}

export class Mine {
  private tunnelNoise: (x: number, y: number) => number;
  private chestNoise: (x: number, y: number) => number;
  private torchNoise: (x: number, y: number) => number;
  private monsterNoise: (x: number, y: number) => number; // New noise for monster spawning
  private readonly TUNNEL_THRESHOLD = 0.4; // Tunnel threshold for noise
  private readonly TILE_SIZE = WorldGenerator.TILE_SIZE;
  private mineChunks = new Map<string, MineChunk>();
  private mineNames = new Map<string, string>(); // Cache mine names
  private currentEntrancePosition: Position | null = null; // Store current entrance position
  private chestCount = 0; // Track number of chests generated in current mine
  private readonly MAX_CHESTS = 15; // Maximum chests per mine (more than dungeons)

  // Track spawned entities for spacing during generation
  private spawnedBandits = new Set<string>(); // Track bandit positions as "x,y"
  private spawnedChests = new Set<string>(); // Track chest positions as "x,y"
  private spawnedTorches = new Set<string>(); // Track torch positions as "x,y"
  private spawnedWoodSupports = new Set<string>(); // Track wood support positions as "x,y"
  private spawnedMonsters = new Set<string>(); // Track monster positions as "x,y"

  // Mine name generation data
  private readonly MINE_PREFIXES = [
    'Old', 'Deep', 'Dark', 'Abandoned', 'Lost', 'Hidden', 'Ancient', 'Forgotten',
    'Rich', 'Golden', 'Silver', 'Copper', 'Iron', 'Coal', 'Granite', 'Marble',
    'Sunken', 'Flooded', 'Collapsed', 'Narrow', 'Wide', 'Twisted', 'Straight'
  ];

  private readonly MINE_SUFFIXES = [
    'Mine', 'Shaft', 'Pit', 'Quarry', 'Excavation', 'Tunnel', 'Passage',
    'Bore', 'Drift', 'Adit', 'Stope', 'Gallery', 'Chamber', 'Vein', 'Lode',
    'Workings', 'Diggings', 'Claim', 'Strike', 'Prospect'
  ];

  private lightingSystem: LightingSystem | null = null; // Reference to lighting system for torch registration
  private pendingLightingUpdates: Array<{ x: number; y: number; intensity: number; radius: number }> = [];

  // Track current player position for NPC collision detection
  private currentPlayerPosition: Position | null = null;

  constructor(seed?: string) {
    const actualSeed = seed ?? 'default_mine_seed';
    this.tunnelNoise = createNoise2D(() => this.hashSeed(actualSeed + '_tunnel'));
    this.chestNoise = createNoise2D(() => this.hashSeed(actualSeed + '_chest'));
    this.torchNoise = createNoise2D(() => this.hashSeed(actualSeed + '_torch'));
    this.monsterNoise = createNoise2D(() => this.hashSeed(actualSeed + '_monster'));
  }

  private hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to [0, 1]
  }

  public setEntrancePosition(position: Position | null): void {
    // Check if this is the same mine entrance
    const isSameMine = this.currentEntrancePosition && position &&
      Math.abs(this.currentEntrancePosition.x - position.x) < 1 &&
      Math.abs(this.currentEntrancePosition.y - position.y) < 1;

    // Only clear caches and reset counters if entering a different mine
    if (!isSameMine) {
      this.mineChunks.clear();
      this.chestCount = 0;

      // Clear tracking sets for new mine
      this.spawnedBandits.clear();
      this.spawnedChests.clear();
      this.spawnedTorches.clear();
      this.spawnedWoodSupports.clear();
      this.spawnedMonsters.clear();
    }

    this.currentEntrancePosition = position;
  }

  /**
   * Set current player position for NPC collision detection
   */
  public setPlayerPosition(position: Position): void {
    this.currentPlayerPosition = position;
  }

  private generateMineChunk(chunkX: number, chunkY: number): MineChunk {
    const chunk: MineChunk = {
      tiles: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => null))
    };

    for (let localY = 0; localY < 16; localY++) {
      for (let localX = 0; localX < 16; localX++) {
        const worldX = chunkX * 16 + localX;
        const worldY = chunkY * 16 + localY;

        chunk.tiles[localY]![localX] = this.generateMineTile(worldX, worldY, this.currentEntrancePosition ?? undefined);
      }
    }

    // Process any pending lighting updates after chunk generation is complete
    this.processPendingLightingUpdates();

    return chunk;
  }

  private generateMineTile(worldX: number, worldY: number, entrancePosition?: Position): Tile {
    const isPartOfTunnel = this.isPartOfTunnelSystem(worldX, worldY, entrancePosition);

    if (isPartOfTunnel) {
      // Create tunnel tile (passable dirt)
      const tile: Tile = {
        x: worldX,
        y: worldY,
        value: 'DIRT',
        height: 0.3, // Underground mine height
        temperature: 0.2, // Cool mine temperature
        humidity: 0.8, // High mine humidity
        interacted: false,
        villageStructures: [],
        lightLevel: 0.5, // Mine base light level
        effectiveLightLevel: 0.5 // Will be calculated with torch effects
      };

      // Add mine entrance at the EXACT entrance position (fix coordinate matching issue)
      if (entrancePosition) {
        const entranceWorldX = entrancePosition.x;
        const entranceWorldY = entrancePosition.y;
        const entranceTileX = Math.floor(entranceWorldX / this.TILE_SIZE);
        const entranceTileY = Math.floor(entranceWorldY / this.TILE_SIZE);

        if (worldX === entranceTileX && worldY === entranceTileY) {
          tile.villageStructures!.push({
            type: 'mine_entrance',
            position: { x: entranceWorldX, y: entranceWorldY }, // Use exact world coordinates
            poi: new POI({
              type: 'mine_entrance',
              position: { x: entranceWorldX, y: entranceWorldY },
              interactable: true,
              passable: true
            })
          });
        }
      }

      // Add mine features (chests, torches, bandits, monsters) but not at entrance
      if (!(entrancePosition &&
            Math.floor(entrancePosition.x / this.TILE_SIZE) === worldX &&
            Math.floor(entrancePosition.y / this.TILE_SIZE) === worldY)) {
        this.addMineFeatures(tile, worldX, worldY, entrancePosition);
      }

      return tile;
    } else {
      // Check if this position is tracked as a wood support location
      if (this.spawnedWoodSupports.has(`${worldX},${worldY}`)) {
        // Create wood support tile instead of stone
        const tile: Tile = {
          x: worldX,
          y: worldY,
          value: 'WOOD',
          height: 0.3, // Underground mine height
          temperature: 0.2, // Cool mine temperature
          humidity: 0.8, // High mine humidity
          interacted: false,
          villageStructures: [],
          lightLevel: 0.5, // Mine base light level
          effectiveLightLevel: 0.5 // Will be calculated with torch effects
        };
        return tile;
      }

      // Create stone wall tile
      const tile: Tile = {
        x: worldX,
        y: worldY,
        value: 'STONE',
        height: 0.3, // Underground mine height
        temperature: 0.2, // Cool mine temperature
        humidity: 0.8, // High mine humidity
        interacted: false,
        villageStructures: [],
        lightLevel: 0.5, // Mine base light level
        effectiveLightLevel: 0.5 // Will be calculated with torch effects
      };

      // Add wood support structures on tunnel edges with opposite supports
      if (this.shouldPlaceWoodSupport(worldX, worldY, entrancePosition)) {
        this.addWoodSupportPair(tile, worldX, worldY, entrancePosition);
      }

      return tile;
    }
  }

  private isPartOfTunnelSystem(worldX: number, worldY: number, entrancePosition?: Position): boolean {
    if (!entrancePosition) return false;

    const entranceX = Math.floor(entrancePosition.x / this.TILE_SIZE);
    const entranceY = Math.floor(entrancePosition.y / this.TILE_SIZE);

    // Distance from entrance
    const distance = Math.sqrt(Math.pow(worldX - entranceX, 2) + Math.pow(worldY - entranceY, 2));

    // Limit to 200x200 tile area (100 tile radius from entrance, same as dungeons)
    if (distance > 100) return false;

    // Fractal tree algorithm for mine shaft generation
    return this.generateFractalMineTunnels(worldX, worldY, entranceX, entranceY, distance);
  }

  private generateFractalMineTunnels(worldX: number, worldY: number, entranceX: number, entranceY: number, distance: number): boolean {
    const dx = worldX - entranceX;
    const dy = worldY - entranceY;

    // Main vertical shaft (entrance tunnel going down) - 2 tiles wide
    if (Math.abs(dx) <= 1 && dy >= 0 && dy <= 60) {
      return true;
    }

    // Generate straight-line branches using deterministic randomization
    return this.generateStraightTunnels(worldX, worldY, entranceX, entranceY, dx, dy);
  }

  private generateStraightTunnels(worldX: number, worldY: number, entranceX: number, entranceY: number, dx: number, dy: number): boolean {
    // Use deterministic random based on entrance position
    const seed = entranceX * 1000 + entranceY;

    // Define specific tunnel levels with straight lines
    const tunnelLevels = [
      { depth: 15, direction: 'horizontal', length: 25 },
      { depth: 25, direction: 'horizontal', length: 30 },
      { depth: 35, direction: 'horizontal', length: 20 },
      { depth: 45, direction: 'horizontal', length: 35 },
      { depth: 55, direction: 'horizontal', length: 25 }
    ];

    for (let i = 0; i < tunnelLevels.length; i++) {
      const level = tunnelLevels[i]!;
      const levelRandom = this.getSeededRandom(seed + i * 100);

      // 80% chance for each level to exist
      if (levelRandom < 0.8) {
        // Horizontal tunnel at this depth (2 tiles wide)
        if (dy >= level.depth - 1 && dy <= level.depth + 1) {
          // Left side tunnel
          if (dx >= -level.length && dx <= -2) {
            return true;
          }
          // Right side tunnel
          if (dx >= 2 && dx <= level.length) {
            return true;
          }
        }

        // Add vertical branches from tunnel ends (straight lines)
        const endBranchRandom = this.getSeededRandom(seed + i * 200);
        if (endBranchRandom < 0.6) {
          // Vertical branch from left end
          if (dx >= -level.length - 1 && dx <= -level.length + 1 &&
              dy >= level.depth && dy <= level.depth + 15) {
            return true;
          }
          // Vertical branch from right end
          if (dx >= level.length - 1 && dx <= level.length + 1 &&
              dy >= level.depth && dy <= level.depth + 15) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private getSeededRandom(seed: number): number {
    // Simple seeded random function
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  private isAdjacentToTunnel(worldX: number, worldY: number, entrancePosition?: Position): boolean {
    // Check if any adjacent tile is a tunnel
    const adjacentPositions = [
      { x: worldX + 1, y: worldY },
      { x: worldX - 1, y: worldY },
      { x: worldX, y: worldY + 1 },
      { x: worldX, y: worldY - 1 }
    ];

    return adjacentPositions.some(pos =>
      this.isPartOfTunnelSystem(pos.x, pos.y, entrancePosition)
    );
  }

  private shouldPlaceWoodSupport(worldX: number, worldY: number, entrancePosition?: Position): boolean {
    if (!entrancePosition) return false;

    // Check if this position is already tracked as a wood support location
    if (this.spawnedWoodSupports.has(`${worldX},${worldY}`)) {
      return false; // Already has or will have a wood support
    }

    // Check if this stone tile is adjacent to a tunnel
    if (!this.isAdjacentToTunnel(worldX, worldY, entrancePosition)) {
      return false;
    }

    // Get adjacent tunnel directions
    const tunnelDirections = this.getAdjacentTunnelDirections(worldX, worldY, entrancePosition);
    if (tunnelDirections.length === 0) return false;

    // Check if we already have a wood support nearby (avoid clustering)
    if (this.hasWoodSupportAt(worldX, worldY)) {
      return false;
    }

    // Use deterministic random based on position for consistent placement
    const random = this.getDeterministicRandom(worldX, worldY);

    // 15% chance to place wood support (reduced from previous values)
    return random < 0.15;
  }

  private getAdjacentTunnelDirections(worldX: number, worldY: number, entrancePosition?: Position): string[] {
    const directions: string[] = [];
    const adjacentPositions = [
      { x: worldX + 1, y: worldY, dir: 'east' },
      { x: worldX - 1, y: worldY, dir: 'west' },
      { x: worldX, y: worldY + 1, dir: 'south' },
      { x: worldX, y: worldY - 1, dir: 'north' }
    ];

    for (const pos of adjacentPositions) {
      if (this.isPartOfTunnelSystem(pos.x, pos.y, entrancePosition)) {
        directions.push(pos.dir);
      }
    }

    return directions;
  }

  private hasWoodSupportAt(worldX: number, worldY: number): boolean {
    // No spacing constraint - allow wood supports to be placed anywhere
    return false;
  }

  private getDeterministicRandom(x: number, y: number): number {
    // Simple deterministic random based on position
    const seed = x * 73856093 ^ y * 19349663;
    return Math.abs(Math.sin(seed)) % 1;
  }

  private addWoodSupportPair(tile: Tile, worldX: number, worldY: number, entrancePosition?: Position): void {
    // Change the tile type to WOOD instead of adding a POI structure
    tile.value = 'WOOD';

    // Track the primary wood support position
    this.spawnedWoodSupports.add(`${worldX},${worldY}`);
    console.log(`🪵 Placed primary wood support at (${worldX}, ${worldY})`);

    // Find the opposite side of the tunnel for the second support
    const oppositePosition = this.findOppositeWoodSupportPosition(worldX, worldY, entrancePosition);
    if (oppositePosition) {
      console.log(`🪵 Found opposite position at (${oppositePosition.x}, ${oppositePosition.y})`);

      // Check if opposite position is also a stone tile and not already occupied
      if (!this.isPartOfTunnelSystem(oppositePosition.x, oppositePosition.y, entrancePosition) &&
          !this.spawnedWoodSupports.has(`${oppositePosition.x},${oppositePosition.y}`)) {

        // Check if we can get the existing tile without triggering generation
        const oppositeTile = this.getExistingMineTile(oppositePosition.x, oppositePosition.y);
        if (oppositeTile && oppositeTile.value === 'STONE') {
          // Change the opposite tile type to WOOD as well
          oppositeTile.value = 'WOOD';

          // Track the opposite wood support position
          this.spawnedWoodSupports.add(`${oppositePosition.x},${oppositePosition.y}`);

          console.log(`🪵 Successfully spawned wood support pair at (${worldX}, ${worldY}) and (${oppositePosition.x}, ${oppositePosition.y})`);
        } else {
          // If opposite tile doesn't exist yet, just track it to prevent future generation there
          this.spawnedWoodSupports.add(`${oppositePosition.x},${oppositePosition.y}`);
          console.log(`🪵 Opposite tile not ready - tracking position (${oppositePosition.x}, ${oppositePosition.y}) for future placement`);
        }
      } else {
        console.log(`🪵 Opposite position (${oppositePosition.x}, ${oppositePosition.y}) is invalid - tunnel: ${this.isPartOfTunnelSystem(oppositePosition.x, oppositePosition.y, entrancePosition)}, occupied: ${this.spawnedWoodSupports.has(`${oppositePosition.x},${oppositePosition.y}`)}`);
      }
    } else {
      console.log(`🪵 No opposite position found for wood support at (${worldX}, ${worldY})`);
    }
  }

  private findOppositeWoodSupportPosition(worldX: number, worldY: number, entrancePosition?: Position): { x: number; y: number } | null {
    if (!entrancePosition) return null;

    // Check each direction to see if there's a tunnel adjacent to us
    const directions = [
      { dx: 0, dy: -1, name: 'north', opposite: { dx: 0, dy: 1 } },  // north tunnel -> 1 tile south (across tunnel)
      { dx: 0, dy: 1, name: 'south', opposite: { dx: 0, dy: -1 } },   // south tunnel -> 1 tile north (across tunnel)
      { dx: -1, dy: 0, name: 'west', opposite: { dx: 1, dy: 0 } },    // west tunnel -> 1 tile east (across tunnel)
      { dx: 1, dy: 0, name: 'east', opposite: { dx: -1, dy: 0 } }     // east tunnel -> 1 tile west (across tunnel)
    ];

    for (const dir of directions) {
      const tunnelX = worldX + dir.dx;
      const tunnelY = worldY + dir.dy;

      // Check if there's a tunnel in this direction
      if (this.isPartOfTunnelSystem(tunnelX, tunnelY, entrancePosition)) {
        console.log(`🪵 Found tunnel ${dir.name} of wood support at (${worldX}, ${worldY})`);

        // Place opposite support directly across the tunnel (1 tile across)
        const oppositeX = worldX + dir.dx + dir.opposite.dx;
        const oppositeY = worldY + dir.dy + dir.opposite.dy;

        console.log(`🪵 Calculated opposite position at (${oppositeX}, ${oppositeY}) across ${dir.name} tunnel`);
        return { x: oppositeX, y: oppositeY };
      }
    }

    console.log(`🪵 No adjacent tunnel found for wood support at (${worldX}, ${worldY})`);
    return null;
  }

  private addMineFeatures(tile: Tile, worldX: number, worldY: number, entrancePosition?: Position): void {
    if (!entrancePosition) return;

    const entranceX = Math.floor(entrancePosition.x / this.TILE_SIZE);
    const entranceY = Math.floor(entrancePosition.y / this.TILE_SIZE);
    const distanceFromEntrance = Math.sqrt(Math.pow(worldX - entranceX, 2) + Math.pow(worldY - entranceY, 2));

    // Skip features too close to entrance (first 8 tiles)
    if (distanceFromEntrance < 8) return;

    // Use high amplitude noise for feature placement (similar to dungeons)
    const featureNoise = Math.abs(this.chestNoise(worldX / 10, worldY / 10));
    const monsterSpawnNoise = Math.abs(this.monsterNoise(worldX / 8, worldY / 8));
    const torchSpawnNoise = Math.abs(this.torchNoise(worldX / 12, worldY / 12));

    // Get effective light level including torch effects
    const effectiveLightLevel = this.lightingSystem?.calculateTileEffectiveLight(tile, 'mine') ?? (tile.effectiveLightLevel ?? tile.lightLevel ?? 0.5);

    // Spawn monsters based on unified light level and noise system
    if (LightingSystem.canSpawnMonster(effectiveLightLevel, monsterSpawnNoise, 0.7) && distanceFromEntrance >= 15) {
      this.spawnMonster(tile, worldX, worldY, distanceFromEntrance);
    }
    // Spawn bandits (hostile NPCs using trader sprites)
    else if (featureNoise > 0.75 && distanceFromEntrance >= 10) { // Spawn in deeper areas
      this.spawnBandit(tile, worldX, worldY, distanceFromEntrance);
    }
    // Spawn normal chests (mine-specific loot)
    else if (featureNoise > 0.65 && this.chestCount < this.MAX_CHESTS) {
      this.spawnNormalChest(tile, worldX, worldY, distanceFromEntrance);
    }
    // Spawn torches for lighting (enhanced torch generation)
    else if (torchSpawnNoise > 0.6) {
      this.spawnTorch(tile, worldX, worldY);
    }
    // Spawn wood support pairs in STONE tiles adjacent to tunnels (structural supports)
    else if (tile.value === 'STONE' && this.shouldPlaceWoodSupport(worldX, worldY, entrancePosition)) {
      this.addWoodSupportPair(tile, worldX, worldY, entrancePosition);
    }
  }

  private spawnMonster(tile: Tile, worldX: number, worldY: number, distanceFromEntrance: number): void {
    // Check spacing constraint
    if (this.hasNearbySpawnedMonster(worldX, worldY, 4)) {
      return; // Too close to another monster
    }

    // Random monster type (similar to dungeon monsters)
    const monsterTypes: ('orc' | 'skeleton' | 'goblin' | 'slime')[] = [
      'orc', 'skeleton', 'goblin', 'slime'
    ];
    const monsterType = monsterTypes[Math.floor(Math.random() * monsterTypes.length)]!;

    const npc = new NPC({
      type: monsterType,
      position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      aggressive: true,
      health: this.getMonsterHealth(monsterType)
    });

    // Initialize monster inventory
    this.initializeMonsterInventory(npc, monsterType);

    // Set up collision detection for mine movement
    npc.setTileCollisionCallback((position: Position) => {
      const tileX = Math.floor(position.x / this.TILE_SIZE);
      const tileY = Math.floor(position.y / this.TILE_SIZE);
      const tile = this.getTile(tileX, tileY);

      if (!tile) {
        return true; // Treat invalid tiles as occupied
      }

      // Check for impassable terrain (STONE and WOOD tiles block movement in mines)
      if (tile.value === 'STONE' || tile.value === 'WOOD') {
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

      // Check for other NPCs and impassable structures
      if (tile.villageStructures) {
        for (const structure of tile.villageStructures) {
          // Check for impassable POIs
          if (structure.poi && !structure.poi.passable) {
            return true;
          }
          // Check for living NPCs (excluding self)
          if (structure.npc && !structure.npc.isDead() && structure.npc !== npc) {
            return true;
          }
        }
      }

      return false; // Tile is passable
    });

    tile.villageStructures = tile.villageStructures ?? [];
    tile.villageStructures.push({
      type: monsterType,
      position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      npc: npc // Use the actual NPC instance directly instead of wrapping it
    });

    this.spawnedMonsters.add(`${worldX},${worldY}`);
    console.log(`👹 Spawned ${monsterType} monster at distance ${distanceFromEntrance.toFixed(1)} from mine entrance`);
  }

  private getMonsterHealth(monsterType: string): number {
    switch (monsterType) {
      case 'orc': return 120;
      case 'skeleton': return 40;
      case 'goblin': return 40;
      case 'slime': return 40;
      default: return 40;
    }
  }

  private initializeMonsterInventory(npc: NPC, monsterType: string): void {
    // Monsters carry basic drops
    switch (monsterType) {
      case 'orc':
      case 'skeleton':
      case 'goblin':
        npc.inventory.addItem('copper_ore', 1);
        break;
      case 'slime':
        npc.inventory.addItem('monster_drop', 1);
        break;
    }
  }

  private spawnBandit(tile: Tile, worldX: number, worldY: number, distanceFromEntrance: number): void {
    // Check spacing constraint
    if (this.hasNearbySpawnedBandit(worldX, worldY, 5)) {
      return; // Too close to another bandit
    }

    // Random bandit type (using existing trader types but hostile behaviour)
    const banditTypes: ('axeman_trader' | 'swordsman_trader' | 'spearman_trader' | 'farmer_trader')[] = [
      'axeman_trader', 'swordsman_trader', 'spearman_trader', 'farmer_trader'
    ];
    const banditType = banditTypes[Math.floor(Math.random() * banditTypes.length)]!;

    const npc = new NPC({
      type: banditType,
      position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      aggressive: true, // Bandits are hostile but less aggressive than monsters
      health: 100 // Same health as traders
    });

    // Initialize bandit inventory with mine-appropriate items
    this.initializeBanditInventory(npc, distanceFromEntrance);

    // Set up collision detection for mine movement
    npc.setTileCollisionCallback((position: Position) => {
      const tileX = Math.floor(position.x / this.TILE_SIZE);
      const tileY = Math.floor(position.y / this.TILE_SIZE);
      const tile = this.getTile(tileX, tileY);

      if (!tile) {
        return true; // Treat invalid tiles as occupied
      }

      // Check for impassable terrain (STONE and WOOD tiles block movement in mines)
      if (tile.value === 'STONE' || tile.value === 'WOOD') {
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

      // Check for other NPCs and impassable structures
      if (tile.villageStructures) {
        for (const structure of tile.villageStructures) {
          // Check for impassable POIs
          if (structure.poi && !structure.poi.passable) {
            return true;
          }
          // Check for living NPCs (excluding self)
          if (structure.npc && !structure.npc.isDead() && structure.npc !== npc) {
            return true;
          }
        }
      }

      return false; // Tile is passable
    });

    tile.villageStructures = tile.villageStructures ?? [];
    tile.villageStructures.push({
      type: banditType,
      position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      npc: npc // Use the actual NPC instance directly instead of wrapping it
    });

    this.spawnedBandits.add(`${worldX},${worldY}`);
    console.log(`🏴‍☠️ Spawned ${banditType} bandit at distance ${distanceFromEntrance.toFixed(1)} from mine entrance`);
  }

  private initializeBanditInventory(npc: NPC, distanceFromEntrance: number): void {
    // Bandits carry similar loot to mine chests - they're essentially mobile treasure

    // Base mine loot - ores and mining materials (like mine chests)
    npc.inventory.addItem('copper_ore', Math.floor(Math.random() * 3) + 2);
    npc.inventory.addItem('coal', Math.floor(Math.random() * 4) + 3);

    // Deeper bandits have better loot (like deeper chests)
    if (distanceFromEntrance >= 20) {
      npc.inventory.addItem('iron_ore', Math.floor(Math.random() * 2) + 1);
    }
    if (distanceFromEntrance >= 30) {
      npc.inventory.addItem('silver_ore', Math.floor(Math.random() * 2) + 1);
    }
    if (distanceFromEntrance >= 40) {
      npc.inventory.addItem('gold_ore', Math.floor(Math.random() * 1) + 1);
    }

    // Always add torches and tools (like mine chests)
    npc.inventory.addItem('torch', Math.floor(Math.random() * 3) + 2);
    if (Math.random() < 0.3) {
      npc.inventory.addItem('pickaxe', 1);
    }

    // Add some weapons and armor (bandits are armed)
    const weapons = ['sword', 'dagger', 'axe'];
    const armour = ['leather_helmet', 'leather_chestplate', 'leather_leggings', 'leather_boots'];

    // Add 1-2 weapons
    const weaponCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < weaponCount; i++) {
      const weapon = weapons[Math.floor(Math.random() * weapons.length)]!;
      npc.inventory.addItem(weapon, 1);
    }

    // Add some armour pieces (1-2 pieces)
    const armourCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < armourCount; i++) {
      const armourPiece = armour[Math.floor(Math.random() * armour.length)]!;
      npc.inventory.addItem(armourPiece, 1);
    }
  }

  private spawnNormalChest(tile: Tile, worldX: number, worldY: number, distanceFromEntrance: number): void {
    // Check spacing constraint
    if (this.hasNearbySpawnedChest(worldX, worldY, 3)) {
      return; // Too close to another chest
    }

    const chestInventory = this.generateMineChestLoot(distanceFromEntrance);

    tile.villageStructures = tile.villageStructures ?? [];
    tile.villageStructures.push({
      type: 'normal_chest',
      position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      poi: new POI({
        type: 'normal_chest',
        position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
        interactable: true,
        passable: false,
        customData: {
          inventory: chestInventory,
          chestId: `mine_chest_${worldX}_${worldY}`
        }
      })
    });

    this.spawnedChests.add(`${worldX},${worldY}`);
    this.chestCount++;
    console.log(`📦 Spawned normal chest at distance ${distanceFromEntrance.toFixed(1)} from mine entrance (${this.chestCount}/${this.MAX_CHESTS})`);
  }

  private generateMineChestLoot(distanceFromEntrance: number): InventoryItem[] {
    const loot: InventoryItem[] = [];

    // Base mine loot - ores and mining materials
    loot.push({
      id: `item_${Date.now()}_copper_ore`,
      type: 'copper_ore',
      quantity: Math.floor(Math.random() * 3) + 2
    });

    loot.push({
      id: `item_${Date.now()}_coal`,
      type: 'coal',
      quantity: Math.floor(Math.random() * 4) + 3
    });

    // Deeper chests have better loot
    if (distanceFromEntrance >= 20) {
      loot.push({
        id: `item_${Date.now()}_iron_ore`,
        type: 'iron_ore',
        quantity: Math.floor(Math.random() * 2) + 1
      });
    }

    if (distanceFromEntrance >= 30) {
      loot.push({
        id: `item_${Date.now()}_silver_ore`,
        type: 'silver_ore',
        quantity: Math.floor(Math.random() * 2) + 1
      });
    }

    if (distanceFromEntrance >= 40) {
      loot.push({
        id: `item_${Date.now()}_gold_ore`,
        type: 'gold_ore',
        quantity: Math.floor(Math.random() * 1) + 1
      });
    }

    // Always add some torches and tools
    loot.push({
      id: `item_${Date.now()}_torch`,
      type: 'torch',
      quantity: Math.floor(Math.random() * 3) + 2
    });

    if (Math.random() < 0.3) {
      loot.push({
        id: `item_${Date.now()}_pickaxe`,
        type: 'pickaxe',
        quantity: 1
      });
    }

    return loot;
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

  private hasNearbySpawnedBandit(worldX: number, worldY: number, radius: number): boolean {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (this.spawnedBandits.has(`${worldX + dx},${worldY + dy}`)) {
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

  private spawnTorch(tile: Tile, worldX: number, worldY: number): void {
    // Check if there's already a torch nearby (3 tile spacing)
    if (this.hasNearbyTorch(worldX, worldY, 3)) {
      return;
    }

    // Add torch as POI with proper sprite
    tile.villageStructures = tile.villageStructures ?? [];
    tile.villageStructures.push({
      type: 'torch',
      position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
      poi: new POI({
        type: 'fireball_frame_0', // Use the fireball sprite for torch
        position: { x: worldX * this.TILE_SIZE, y: worldY * this.TILE_SIZE },
        interactable: false,
        passable: true,
        customData: {
          lightRadius: 5, // 5x5 area lighting
          lightIntensity: 0.6 // Same intensity as portal
        }
      })
    });

    // Register torch as light source with lighting system
    if (this.lightingSystem) {
      this.lightingSystem.addTorch(worldX, worldY);
    }

    // Set the torch tile itself to full brightness immediately
    tile.effectiveLightLevel = Math.min(1.0, 0.5 + 0.6); // Base light + full intensity
    console.log(`🔥 Torch tile (${worldX}, ${worldY}) set to full brightness: ${tile.effectiveLightLevel}`);

    // Defer lighting updates for surrounding tiles to avoid circular dependency during tile generation
    this.deferLightingUpdate(worldX, worldY, 0.6, 2.5);

    this.spawnedTorches.add(`${worldX},${worldY}`);
    console.log(`🔥 Spawned torch at (${worldX}, ${worldY})`);
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
          const tile = this.getExistingMineTile(tileX, tileY);
          if (tile) {
            // Check if this tile contains a torch (light source)
            const isLightSource = this.tileContainsLightSource(tile);

            // Calculate light falloff
            const falloff = 1.0 - (distance / radius);
            const lightBonus = intensity * falloff;

            // Light source tiles get full intensity regardless of distance
            const baseLightLevel = 0.5; // Mine base light
            let newEffectiveLight: number;

            if (isLightSource && (tileX === centerX && tileY === centerY)) {
              // This is the light source tile itself - give it full brightness
              newEffectiveLight = Math.min(1.0, baseLightLevel + intensity);
              console.log(`🔥 Torch tile (${tileX}, ${tileY}) - Full intensity: ${intensity}, effective=${newEffectiveLight.toFixed(2)}`);
            } else {
              // This is a surrounding tile - apply falloff
              newEffectiveLight = Math.min(1.0, baseLightLevel + lightBonus);
              console.log(`🔆 Updated mine tile (${tileX}, ${tileY}) light: distance=${distance.toFixed(2)}, falloff=${falloff.toFixed(2)}, bonus=${lightBonus.toFixed(2)}, effective=${newEffectiveLight.toFixed(2)}`);
            }

            tile.effectiveLightLevel = Math.max(tile.effectiveLightLevel ?? baseLightLevel, newEffectiveLight);
          }
        }
      }
    }
  }

  /**
   * Check if a tile contains a light source (torch)
   */
  private tileContainsLightSource(tile: Tile): boolean {
    if (!tile.villageStructures) return false;

    return tile.villageStructures.some(structure => {
      const poi = structure.poi;
      if (!poi) return false;

      // Check for torch (using fireball sprite)
      if (poi.type === 'fireball_frame_0' || structure.type === 'torch') {
        return true;
      }

      return false;
    });
  }

  /**
   * Get an existing mine tile without generating new chunks
   */
  private getExistingMineTile(worldX: number, worldY: number): Tile | null {
    const chunkX = Math.floor(worldX / 16);
    const chunkY = Math.floor(worldY / 16);
    const chunkKey = `${chunkX},${chunkY}`;

    const chunk = this.mineChunks.get(chunkKey);
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

  private hasNearbyTorch(worldX: number, worldY: number, radius: number): boolean {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (this.spawnedTorches.has(`${worldX + dx},${worldY + dy}`)) {
          return true;
        }
      }
    }
    return false;
  }

  public getTile(worldX: number, worldY: number): Tile | null {
    return this.getMineTile(worldX, worldY, this.currentEntrancePosition ?? undefined);
  }

  private getMineTile(x: number, y: number, entrancePosition?: Position): Tile | null {
    // Get or generate mine tile at world coordinates (similar to dungeon approach)
    const chunkX = Math.floor(x / 16);
    const chunkY = Math.floor(y / 16);

    // Handle negative coordinates properly by using modulo for local coordinates
    let localX = x % 16;
    let localY = y % 16;

    // JavaScript modulo can return negative values, so normalize to positive
    if (localX < 0) localX += 16;
    if (localY < 0) localY += 16;

    const chunkKey = `${chunkX},${chunkY}`;
    let chunk = this.mineChunks.get(chunkKey);
    if (!chunk) {
      chunk = this.generateMineChunk(chunkX, chunkY);
      this.mineChunks.set(chunkKey, chunk);
    }

    const tile = chunk.tiles[localY]?.[localX];
    return tile ?? null;
  }

  public update(deltaTime: number, playerPosition: Position, playerInventory: InventoryItem[], camera: Camera): void {
    // Update mine systems - NPCs, lighting, etc.
    this.setPlayerPosition(playerPosition);

    const playerTileX = Math.floor(playerPosition.x / this.TILE_SIZE);
    const playerTileY = Math.floor(playerPosition.y / this.TILE_SIZE);

    // Track NPCs that need to move between tiles
    const npcsToMove: Array<{
      npc: NPC;
      structure: MineStructure;
      oldTileX: number;
      oldTileY: number;
      newTileX: number;
      newTileY: number;
    }> = [];

    // Update NPCs in visible area and track movement
    const viewRadius = 20;
    for (let dx = -viewRadius; dx <= viewRadius; dx++) {
      for (let dy = -viewRadius; dy <= viewRadius; dy++) {
        const tileX = playerTileX + dx;
        const tileY = playerTileY + dy;
        const tile = this.getTile(tileX, tileY);

        if (tile?.villageStructures) {
          for (const structure of tile.villageStructures) {
            if (structure.npc?.update) {
              // Store old position before update
              const oldTileX = Math.floor(structure.npc.position.x / this.TILE_SIZE);
              const oldTileY = Math.floor(structure.npc.position.y / this.TILE_SIZE);

              // Update NPC
              structure.npc.update(deltaTime, playerPosition, playerInventory ?? []);

              // Check if NPC moved to a different tile
              const newTileX = Math.floor(structure.npc.position.x / this.TILE_SIZE);
              const newTileY = Math.floor(structure.npc.position.y / this.TILE_SIZE);

              if (oldTileX !== newTileX || oldTileY !== newTileY) {
                npcsToMove.push({
                  npc: structure.npc as NPC,
                  structure: structure as MineStructure,
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

    // Handle NPC movement between tiles
    for (const moveData of npcsToMove) {
      this.moveNPCBetweenTiles(moveData.structure, moveData.oldTileX, moveData.oldTileY, moveData.newTileX, moveData.newTileY);
    }

    // Process pending lighting updates
    this.processPendingLightingUpdates();
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Calculate visible area manually (same approach as dungeon)
    const startTileX = Math.floor(camera.position.x / this.TILE_SIZE);
    const endTileX = Math.ceil((camera.position.x + camera.viewWidth) / this.TILE_SIZE);
    const startTileY = Math.floor(camera.position.y / this.TILE_SIZE);
    const endTileY = Math.ceil((camera.position.y + camera.viewHeight) / this.TILE_SIZE);

    for (let tileX = startTileX; tileX <= endTileX; tileX++) {
      for (let tileY = startTileY; tileY <= endTileY; tileY++) {
        const tile = this.getMineTile(tileX, tileY, this.currentEntrancePosition ?? undefined);
        if (tile) {
          const screenPos = camera.worldToScreen(tileX * this.TILE_SIZE, tileY * this.TILE_SIZE);
          this.renderMineTile(ctx, tile, screenPos.x, screenPos.y);
        }
      }
    }
  }

  private renderMineTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number): void {
    const tileX = x - (this.TILE_SIZE / 2);
    const tileY = y - (this.TILE_SIZE / 2);

    // Render background color with 1px border gap (black background shows through) - same as dungeon
    ctx.fillStyle = this.getMineTileColor(tile.value);
    ctx.fillRect(tileX + 1, tileY + 1, this.TILE_SIZE - 2, this.TILE_SIZE - 2);

    // Render mine structures if present
    if (tile.villageStructures) {
      for (const structure of tile.villageStructures) {
        // Render POIs first (chests, torches, etc.)
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

  private getMineTileColor(tileValue: string): string {
    switch (tileValue) {
      case 'DIRT':
        return '#8B4513'; // Saddle brown (mine dirt)
      case 'STONE':
        return '#555555'; // Dark gray (mine stone walls)
      case 'COBBLESTONE':
        return '#778899'; // Light slate gray (mine floors)
      case 'GRAVEL':
        return '#A9A9A9'; // Dark gray (mine gravel)
      case 'WOOD':
        return '#654321'; // Dark brown (darker than dirt, no sprite needed)
      default:
        return '#8B4513'; // Default to mine dirt color
    }
  }

  public renderHealthBars(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Render health bars for NPCs on top of all sprites in mine (same approach as dungeon)
    // Calculate visible area manually
    const startTileX = Math.floor(camera.position.x / this.TILE_SIZE);
    const endTileX = Math.ceil((camera.position.x + camera.viewWidth) / this.TILE_SIZE);
    const startTileY = Math.floor(camera.position.y / this.TILE_SIZE);
    const endTileY = Math.ceil((camera.position.y + camera.viewHeight) / this.TILE_SIZE);

    for (let tileX = startTileX; tileX <= endTileX; tileX++) {
      for (let tileY = startTileY; tileY <= endTileY; tileY++) {
        const tile = this.getMineTile(tileX, tileY, this.currentEntrancePosition ?? undefined);
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

  /**
   * Set the lighting system reference for torch light registration
   */
  public setLightingSystem(lightingSystem: LightingSystem): void {
    this.lightingSystem = lightingSystem;

    // Register any existing torches with the lighting system
    this.registerExistingTorchesWithLighting();
  }

  /**
   * Register any existing torches in the mine with the lighting system
   */
  private registerExistingTorchesWithLighting(): void {
    if (!this.lightingSystem || !this.currentEntrancePosition) return;

    // Search through all generated chunks for existing torches
    for (const [chunkKey, chunk] of this.mineChunks) {
      for (const tileRow of chunk.tiles) {
        if (!tileRow) continue;
        for (const tile of tileRow) {
          if (tile?.villageStructures) {
            for (const structure of tile.villageStructures) {
              if (structure.poi?.type === 'torch') {
                // Found an existing torch - register it with lighting system
                const tileX = tile.x;
                const tileY = tile.y;
                this.lightingSystem.addTorch(tileX, tileY);
                console.log(`🔄 Retroactively registered existing torch at tile (${tileX}, ${tileY}) with lighting system`);
              }
            }
          }
        }
      }
    }
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

      console.log(`💀 Created tombstone in mine at (${tileX}, ${tileY})`);
    }
  }

  /**
   * Handle player death in mine - create tombstone with player's inventory
   */
  public handlePlayerDeath(playerPosition: Position, playerInventory: (InventoryItem | null)[], playerName?: string): void {
    // Create tombstone with player's inventory
    this.createTombstone(
      playerPosition,
      'player',
      playerInventory,
      playerName ?? 'Hero'
    );

    console.log(`💀 Player died in mine! Tombstone created at (${Math.floor(playerPosition.x / this.TILE_SIZE)}, ${Math.floor(playerPosition.y / this.TILE_SIZE)})`);
  }

  /**
   * Handle NPC death in mine - create tombstone with NPC's inventory
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
        `${npc.type} Bandit`
      );

      console.log(`💀 ${npc.type} died in mine! Tombstone created at (${Math.floor(npcPosition.x / this.TILE_SIZE)}, ${Math.floor(npcPosition.y / this.TILE_SIZE)})`);
    }

    // Remove the dead NPC from the tile
    const tileX = Math.floor(npcPosition.x / this.TILE_SIZE);
    const tileY = Math.floor(npcPosition.y / this.TILE_SIZE);
    const tile = this.getTile(tileX, tileY);

    if (tile && 'villageStructures' in tile && tile.villageStructures) {
      tile.villageStructures = tile.villageStructures.filter(
        structure => !(structure.npc && structure.npc.position.x === npcPosition.x && structure.npc.position.y === npcPosition.y)
      );
    }
  }

  /**
   * Handle animal death in mine - add drops to player inventory
   */
  public handleAnimalDeath(npc: NPCLike, playerPosition: Position, playerInventory: Inventory): void {
    console.log(`🐾 ${npc.type} died in mine - adding drops to player inventory`);

    // Remove the dead NPC from the tile
    const tileX = Math.floor(npc.position.x / this.TILE_SIZE);
    const tileY = Math.floor(npc.position.y / this.TILE_SIZE);
    const tile = this.getTile(tileX, tileY);

    if (tile && 'villageStructures' in tile && tile.villageStructures) {
      tile.villageStructures = tile.villageStructures.filter(
        structure => !(structure.npc && structure.npc.position.x === npc.position.x && structure.npc.position.y === npc.position.y)
      );
    }
  }

  private moveNPCBetweenTiles(structure: MineStructure, oldTileX: number, oldTileY: number, newTileX: number, newTileY: number): void {
    // Get both tiles
    const oldTile = this.getTile(oldTileX, oldTileY);
    const newTile = this.getTile(newTileX, newTileY);

    if (!oldTile || !newTile) {
      // Invalid tiles - revert NPC position
      if (structure.npc) {
        structure.npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
        structure.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
      }
      return;
    }

    // Check if the new tile is passable for NPCs
    if (newTile.value === 'STONE' || newTile.value === 'WOOD') {
      // Can't move to stone or wood tiles - revert position
      if (structure.npc) {
        structure.npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
        structure.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
      }
      return;
    }

    // Check if the new tile is already occupied by another NPC or impassable POI
    if (newTile.villageStructures) {
      for (const existingStructure of newTile.villageStructures) {
        // Check for impassable POIs
        if (existingStructure.poi && !existingStructure.poi.passable) {
          // Can't move to occupied tile - revert position
          if (structure.npc) {
            structure.npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
            structure.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
          }
          return;
        }
        // Check for other living NPCs (excluding self)
        if (existingStructure.npc && !existingStructure.npc.isDead() && existingStructure.npc !== structure.npc) {
          // Can't move to occupied tile - revert position
          if (structure.npc) {
            structure.npc.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
            structure.position = { x: oldTileX * this.TILE_SIZE, y: oldTileY * this.TILE_SIZE };
          }
          return;
        }
      }
    }

    // Remove NPC from old tile
    if (oldTile.villageStructures) {
      oldTile.villageStructures = oldTile.villageStructures.filter(
        existingStructure => existingStructure.npc !== structure.npc
      );
    }

    // Add NPC to new tile
    newTile.villageStructures = newTile.villageStructures ?? [];

    // Update structure position to match new tile
    structure.position = { x: newTileX * this.TILE_SIZE, y: newTileY * this.TILE_SIZE };

    // Add to new tile
    newTile.villageStructures.push(structure);

    console.log(`🚶 Moved ${structure.npc?.type} from tile (${oldTileX}, ${oldTileY}) to (${newTileX}, ${newTileY})`);
  }

  /**
   * Get tombstone at specific coordinates
   */
  public getTombstoneAt(tileX: number, tileY: number): Tombstone | null {
    const tile = this.getTile(tileX, tileY);
    if (!tile || !('villageStructures' in tile) || !tile.villageStructures) return null;

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
   * Remove tombstone from mine
   */
  public removeTombstone(tileX: number, tileY: number): boolean {
    const tile = this.getTile(tileX, tileY);
    if (!tile || !('villageStructures' in tile) || !tile.villageStructures) return false;

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
        console.log(`💀 Removed empty tombstone from mine at (${tileX}, ${tileY})`);
        return true;
      }
    }

    return false;
  }

  /**
   * Update tombstone inventory in mine
   */
  public updateTombstoneInventory(tileX: number, tileY: number, inventory: (InventoryItem | null)[]): void {
    const tile = this.getTile(tileX, tileY);
    if (!tile || !('villageStructures' in tile) || !tile.villageStructures) return;

    for (const structure of tile.villageStructures) {
      if (structure.type === 'tombstone' && structure.poi) {
        structure.poi.customData = structure.poi.customData ?? {};
        structure.poi.customData.inventory = inventory;
        console.log(`💾 Updated tombstone inventory in mine at (${tileX}, ${tileY})`);
        break;
      }
    }
  }
}