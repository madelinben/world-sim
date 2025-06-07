import type { Tile } from './WorldGenerator';
import type { WorldGenerator } from './WorldGenerator';
import type { Tree } from '../entities/structure/Tree';
import type { Cactus } from '../entities/structure/Cactus';

export interface ChunkEntityData {
  trees: Map<string, Tree>;
  cactus: Map<string, Cactus>;
  modifiedTiles: Map<string, Tile>;
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
      modifiedTiles: new Map()
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

  hasModifications(): boolean {
    return this.entityData.modifiedTiles.size > 0 ||
           this.entityData.trees.size > 0 ||
           this.entityData.cactus.size > 0;
  }
}