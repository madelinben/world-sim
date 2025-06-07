import type { Tile } from './WorldGenerator';
import type { WorldGenerator } from './WorldGenerator';

export class Chunk {
  public tiles: Tile[][];
  public readonly size: number;
  public readonly chunkX: number;
  public readonly chunkY: number;
  private generator: WorldGenerator;

  constructor(chunkX: number, chunkY: number, size: number, tiles: Tile[][], generator: WorldGenerator) {
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.size = size;
    this.tiles = tiles;
    this.generator = generator;
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
  }
}