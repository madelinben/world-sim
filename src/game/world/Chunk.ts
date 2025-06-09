import type { Tile } from './WorldGenerator';
import type { WorldGenerator } from './WorldGenerator';
import type { Tree } from '../entities/structure/Tree';
import type { Cactus } from '../entities/structure/Cactus';
import type { VillageStructure } from './VillageGenerator';
import type { NPC } from '../entities/npc/NPC';

export interface ChunkEntityData {
  trees: Map<string, Tree>;
  cactus: Map<string, Cactus>;
  modifiedTiles: Map<string, Tile>;
  npcStructures: Map<string, VillageStructure>;
}

export class Chunk {
  public tiles: Tile[][];
  public readonly size: number;
  public readonly chunkX: number;
  public readonly chunkY: number;
  private generator: WorldGenerator;
  private entityData: ChunkEntityData;

  constructor(chunkX: number, chunkY: number, size: number, tiles: Tile[][], generator: WorldGenerator) {
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.size = size;
    this.tiles = tiles;
    this.generator = generator;
    this.entityData = {
      trees: new Map(),
      cactus: new Map(),
      modifiedTiles: new Map(),
      npcStructures: new Map()
    };
  }

  getTile(localX: number, localY: number): Tile | undefined {
    if (
      localX < 0 ||
      localY < 0 ||
      localX >= this.size ||
      localY >= this.size
    ) {
      return undefined;
    }
    this.tiles[localY] ??= [];
    if (!this.tiles[localY][localX]) {
      // Procedurally generate the tile if missing
      const worldX = this.chunkX * this.size + localX;
      const worldY = this.chunkY * this.size + localY;
      this.tiles[localY][localX] = this.generator.generateTile(worldX, worldY);
    }
    return this.tiles[localY][localX];
  }

  setTile(localX: number, localY: number, tile: Tile): void {
    if (
      localX < 0 ||
      localY < 0 ||
      localX >= this.size ||
      localY >= this.size
    ) {
      return;
    }
    this.tiles[localY] ??= [];
    this.tiles[localY][localX] = tile;

    // Store modified tile for optimization
    const tileKey = `${localX},${localY}`;
    this.entityData.modifiedTiles.set(tileKey, tile);
  }

  addTree(localX: number, localY: number, tree: Tree): void {
    const tileKey = `${localX},${localY}`;
    this.entityData.trees.set(tileKey, tree);
  }

  removeTree(localX: number, localY: number): void {
    const tileKey = `${localX},${localY}`;
    this.entityData.trees.delete(tileKey);
  }

  getTree(localX: number, localY: number): Tree | undefined {
    const tileKey = `${localX},${localY}`;
    return this.entityData.trees.get(tileKey);
  }

  addCactus(localX: number, localY: number, cactus: Cactus): void {
    const tileKey = `${localX},${localY}`;
    this.entityData.cactus.set(tileKey, cactus);
  }

  removeCactus(localX: number, localY: number): void {
    const tileKey = `${localX},${localY}`;
    this.entityData.cactus.delete(tileKey);
  }

  getCactus(localX: number, localY: number): Cactus | undefined {
    const tileKey = `${localX},${localY}`;
    return this.entityData.cactus.get(tileKey);
  }

  getAllTrees(): Map<string, Tree> {
    return this.entityData.trees;
  }

  getAllCactus(): Map<string, Cactus> {
    return this.entityData.cactus;
  }

  getModifiedTiles(): Map<string, Tile> {
    return this.entityData.modifiedTiles;
  }

  addNPC(localX: number, localY: number, npcStructure: VillageStructure): boolean {
    if (
      localX < 0 ||
      localY < 0 ||
      localX >= this.size ||
      localY >= this.size
    ) {
      return false;
    }

    const tileKey = `${localX},${localY}`;
    const tile = this.getTile(localX, localY);

    if (!tile) return false;

    // Check if tile is already occupied by another entity
    if (this.isTileOccupied(localX, localY)) {
      return false;
    }

    // Enhanced spacing check for NPCs to prevent clustering
    if (npcStructure.npc) {
      if (!this.hasAdequateNPCSpacing(localX, localY)) {
        return false;
      }
    }

    // Add to both chunk entity data and tile structure
    this.entityData.npcStructures.set(tileKey, npcStructure);

    // Add to tile's village structures
    tile.villageStructures = tile.villageStructures ?? [];
    tile.villageStructures.push(npcStructure);

    return true;
  }

  // Add method to check for adequate NPC spacing within the chunk
  private hasAdequateNPCSpacing(localX: number, localY: number): boolean {
    const minSpacingRadius = 2; // 2-tile minimum spacing

    // Check all tiles within the spacing radius
    for (let dx = -minSpacingRadius; dx <= minSpacingRadius; dx++) {
      for (let dy = -minSpacingRadius; dy <= minSpacingRadius; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip the center tile

        const checkX = localX + dx;
        const checkY = localY + dy;

        // Skip tiles outside this chunk (we can't check other chunks easily)
        if (checkX < 0 || checkX >= this.size || checkY < 0 || checkY >= this.size) {
          continue;
        }

        const checkKey = `${checkX},${checkY}`;

        // Check if there's already an NPC at this location
        const existingStructure = this.entityData.npcStructures.get(checkKey);
        if (existingStructure?.npc) {
          return false; // Too close to another NPC
        }

        // Also check tile's village structures for NPCs
        const tile = this.getTile(checkX, checkY);
        if (tile?.villageStructures) {
          for (const structure of tile.villageStructures) {
            if (structure.npc) {
              return false; // Too close to another NPC
            }
          }
        }
      }
    }

    return true;
  }

  removeNPC(localX: number, localY: number): boolean {
    if (
      localX < 0 ||
      localY < 0 ||
      localX >= this.size ||
      localY >= this.size
    ) {
      return false;
    }

    const tileKey = `${localX},${localY}`;
    const tile = this.getTile(localX, localY);

    if (!tile) return false;

    // Remove from chunk entity data
    const npcStructure = this.entityData.npcStructures.get(tileKey);
    if (!npcStructure) return false;

    this.entityData.npcStructures.delete(tileKey);

    // Remove from tile's village structures
    if (tile.villageStructures) {
      tile.villageStructures = tile.villageStructures.filter(structure => structure !== npcStructure);
      if (tile.villageStructures.length === 0) {
        delete tile.villageStructures;
      }
    }

    return true;
  }

  moveNPC(oldLocalX: number, oldLocalY: number, newLocalX: number, newLocalY: number): boolean {
    // Get the NPC structure from old position
    const oldTileKey = `${oldLocalX},${oldLocalY}`;
    const newTileKey = `${newLocalX},${newLocalY}`;
    const npcStructure = this.entityData.npcStructures.get(oldTileKey);

    if (!npcStructure?.npc) {
      return false;
    }

    // Check if moving to same position
    if (oldLocalX === newLocalX && oldLocalY === newLocalY) {
      return true; // No movement needed
    }

    // Check if new position is valid
    if (newLocalX < 0 || newLocalX >= this.size || newLocalY < 0 || newLocalY >= this.size) {
      return false;
    }

    const newTile = this.getTile(newLocalX, newLocalY);
    if (!newTile) {
      return false;
    }

    // Check if new tile is available (excluding the NPC we're moving)
    const isImpassableTerrain = newTile.value === 'DEEP_WATER' || newTile.value === 'STONE' || newTile.value === 'COBBLESTONE' || newTile.value === 'SNOW' || newTile.value === 'SHALLOW_WATER';
    const hasLivingTrees = newTile.trees?.some(tree => tree.getHealth() > 0) ?? false;
    // Cactus are now passable but will deal damage (removed cactus blocking logic)
    const isNewTileBlocked = isImpassableTerrain || hasLivingTrees;

    if (isNewTileBlocked) {
      return false;
    }

    // Check if new tile is occupied by other entities (excluding the moving NPC)
    if (this.isTileOccupied(newLocalX, newLocalY, npcStructure.npc)) {
      return false;
    }

    // Remove from old position
    this.removeNPC(oldLocalX, oldLocalY);

    // Add to new position
    this.entityData.npcStructures.set(newTileKey, npcStructure);
    newTile.villageStructures = newTile.villageStructures ?? [];
    newTile.villageStructures.push(npcStructure);

    // Update NPC position coordinates (convert local to world coordinates)
    const worldX = this.chunkX * this.size + newLocalX;
    const worldY = this.chunkY * this.size + newLocalY;
    npcStructure.position = { x: worldX * 16, y: worldY * 16 };
    npcStructure.npc.position = { x: worldX * 16, y: worldY * 16 };

    // Successfully moved
    return true;
  }

  isTileOccupied(localX: number, localY: number, excludeNPC?: NPC): boolean {
    const tile = this.getTile(localX, localY);
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

  getNPC(localX: number, localY: number): VillageStructure | undefined {
    const tileKey = `${localX},${localY}`;
    return this.entityData.npcStructures.get(tileKey);
  }

  getAllNPCs(): Map<string, VillageStructure> {
    return this.entityData.npcStructures;
  }

  // Method to register an already-generated NPC structure from village generation
  registerExistingNPC(localX: number, localY: number, npcStructure: VillageStructure): boolean {
    if (
      localX < 0 ||
      localY < 0 ||
      localX >= this.size ||
      localY >= this.size
    ) {
      return false;
    }

    const tileKey = `${localX},${localY}`;
    const tile = this.getTile(localX, localY);

    if (!tile || !npcStructure.npc) {
      return false;
    }

    // Ensure the NPC structure is already in the tile's village structures
    // (this should be the case from village generation)
    const existsInTile = tile.villageStructures?.some(structure => structure === npcStructure) ?? false;
    if (!existsInTile) {
      console.warn(`NPC structure ${npcStructure.type} not found in tile's village structures at (${localX}, ${localY})`);
      return false;
    }

    // Add to chunk's NPC tracking system
    this.entityData.npcStructures.set(tileKey, npcStructure);

    return true;
  }

  removeDeadNPC(localX: number, localY: number): VillageStructure | null {
    if (
      localX < 0 ||
      localY < 0 ||
      localX >= this.size ||
      localY >= this.size
    ) {
      return null;
    }

    const tileKey = `${localX},${localY}`;
    const tile = this.getTile(localX, localY);

    if (!tile) return null;

    // Get the NPC structure
    const npcStructure = this.entityData.npcStructures.get(tileKey);
    if (!npcStructure?.npc?.isDead()) {
      return null; // No dead NPC found
    }

    // Remove from chunk entity data
    this.entityData.npcStructures.delete(tileKey);

    // Remove from tile's village structures
    if (tile.villageStructures) {
      tile.villageStructures = tile.villageStructures.filter(structure => structure !== npcStructure);
      if (tile.villageStructures.length === 0) {
        delete tile.villageStructures;
      }
    }

    return npcStructure;
  }

  hasModifications(): boolean {
    return this.entityData.modifiedTiles.size > 0 ||
           this.entityData.trees.size > 0 ||
           this.entityData.cactus.size > 0 ||
           this.entityData.npcStructures.size > 0;
  }
}