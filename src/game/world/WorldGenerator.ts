import { createNoise2D } from 'simplex-noise';
import alea from 'alea';
import { Tree, TreeGrowthStage } from '../entities/structure/Tree';
import { Cactus, CactusVariant } from '../entities/structure/Cactus';

export type TileType =
  | 'DEEP_WATER'
  | 'SHALLOW_WATER'
  | 'RIVER'
  | 'SAND'
  | 'GRASS'
  | 'MUD'
  | 'DIRT'
  | 'CLAY'
  | 'FOREST'
  | 'GRAVEL'
  | 'COBBLESTONE'
  | 'STONE'
  | 'SNOW'
  | 'PLAYER';

export interface Tile {
  x: number;
  y: number;
  value: TileType;
  prevValue?: TileType;
  interacted?: boolean;
  height: number;
  temperature: number;
  humidity: number;
  riverValue?: number;
  flowDirection?: number;
  trees?: Tree[];
  cactus?: Cactus[];
  spriteId?: string;
  dirtTimer?: number; // For DIRT -> GRASS regeneration
}

export class WorldGenerator {
  private heightNoise: (x: number, y: number) => number;
  private temperatureNoise: (x: number, y: number) => number;
  private humidityNoise: (x: number, y: number) => number;
  private riverNoise: (x: number, y: number) => number;
  private riverPathNoise: (x: number, y: number) => number;
  public static TILE_SIZE = 16;
  public readonly seed: string;

  constructor(seed?: string) {
    this.seed = seed ?? Math.random().toString(36).substring(2);
    const prng = alea(this.seed);
    this.heightNoise = createNoise2D(prng);
    this.temperatureNoise = createNoise2D(prng);
    this.humidityNoise = createNoise2D(prng);
    this.riverNoise = createNoise2D(prng);
    this.riverPathNoise = createNoise2D(prng);
  }

  generateChunk(chunkX: number, chunkY: number, chunkSize: number): Tile[][] {
    const tiles: Tile[][] = [];
    for (let y = 0; y < chunkSize; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < chunkSize; x++) {
        const worldX = chunkX * chunkSize + x;
        const worldY = chunkY * chunkSize + y;
        const height = this.generateHeight(worldX, worldY);
        const temperature = this.generateTemperature(worldX, worldY);
        const humidity = this.generateHumidity(worldX, worldY);
        const { value: riverValue, flowDirection } = this.generateRiver(worldX, worldY, height);
        const value = this.getTileTypeFromClimate(height, temperature, humidity, riverValue, flowDirection);

        const tile: Tile = {
          x: worldX,
          y: worldY,
          value,
          height,
          temperature,
          humidity,
          riverValue,
          flowDirection
        };

        // Add trees to FOREST tiles (common) and GRASS tiles (rare)
        if (value === 'FOREST') {
          tile.trees = this.generateTrees(worldX, worldY, 1.0); // 100% chance for forest
        } else if (value === 'GRASS') {
          tile.trees = this.generateTrees(worldX, worldY, 0.05); // 5% chance for grass
        }

        // Add cactus to SAND tiles (5% chance)
        if (value === 'SAND') {
          tile.cactus = this.generateCactus(worldX, worldY, 0.05); // 5% chance for sand
        }

        // Add sprite information (only if sprite exists)
        const spriteId = this.getSpriteIdForTile(value);
        if (spriteId) {
          tile.spriteId = spriteId;
        }

        row.push(tile);
      }
      tiles.push(row);
    }
    return tiles;
  }

  public generateHeight(x: number, y: number): number {
    const scale = 0.02;
    const nx = x * scale;
    const ny = y * scale;

    let height = this.heightNoise(nx, ny) * 0.5;
    height += this.heightNoise(nx * 2, ny * 2) * 0.25;
    height += this.heightNoise(nx * 4, ny * 4) * 0.125;
    height += this.heightNoise(nx * 8, ny * 8) * 0.0625;

    height = (height + 1) / 2;
    height = Math.pow(height, 1.2);

    return height;
  }

  public generateTemperature(x: number, y: number): number {
    const scale = 0.01;
    const nx = x * scale;
    const ny = y * scale;

    let temp = this.temperatureNoise(nx, ny) * 0.5;
    temp += this.temperatureNoise(nx * 2, ny * 2) * 0.25;
    temp += this.temperatureNoise(nx * 4, ny * 4) * 0.125;

    temp = (temp + 1) / 2;
    return temp;
  }

  public generateHumidity(x: number, y: number): number {
    const scale = 0.015;
    const nx = x * scale;
    const ny = y * scale;

    let humidity = this.humidityNoise(nx, ny) * 0.5;
    humidity += this.humidityNoise(nx * 2, ny * 2) * 0.25;
    humidity += this.humidityNoise(nx * 4, ny * 4) * 0.125;

    humidity = (humidity + 1) / 2;
    return humidity;
  }

  public generateRiver(x: number, y: number, height: number): { value: number; flowDirection: number } {
    const scale = 0.03;
    const nx = x * scale;
    const ny = y * scale;

    // Generate base river noise
    let river = this.riverNoise(nx, ny) * 0.5;
    river += this.riverNoise(nx * 2, ny * 2) * 0.25;
    river += this.riverNoise(nx * 4, ny * 4) * 0.125;

    // Generate river path noise for winding effect
    const pathScale = 0.05;
    let path = this.riverPathNoise(x * pathScale, y * pathScale) * 0.5;
    path += this.riverPathNoise(x * pathScale * 2, y * pathScale * 2) * 0.25;
    path += this.riverPathNoise(x * pathScale * 4, y * pathScale * 4) * 0.125;
    path = (path + 1) / 2;

    // Calculate flow direction based on height gradient
    const flowDirection = this.calculateFlowDirection(x, y, height);

    // Modify river value based on height and path
    const heightFactor = Math.pow(1 - Math.abs(height - 0.3), 2);
    river *= heightFactor;
    river *= (0.5 + path * 0.5); // Use path to create winding effect

    // Add some randomness to make rivers more natural
    river += (Math.random() - 0.5) * 0.05;

    return { value: river, flowDirection };
  }

  private calculateFlowDirection(x: number, y: number, height: number): number {
    // Sample heights in 8 directions
    const directions = [
      { dx: 1, dy: 0 },   // right
      { dx: 1, dy: 1 },   // bottom-right
      { dx: 0, dy: 1 },   // bottom
      { dx: -1, dy: 1 },  // bottom-left
      { dx: -1, dy: 0 },  // left
      { dx: -1, dy: -1 }, // top-left
      { dx: 0, dy: -1 },  // top
      { dx: 1, dy: -1 }   // top-right
    ];

    let lowestHeight = height;
    let flowDirection = 0;

    directions.forEach((dir, index) => {
      const sampleHeight = this.generateHeight(x + dir.dx, y + dir.dy);
      if (sampleHeight < lowestHeight) {
        lowestHeight = sampleHeight;
        flowDirection = index * (Math.PI / 4); // Convert to radians
      }
    });

    return flowDirection;
  }

  public getTileTypeFromClimate(height: number, temperature: number, humidity: number, riverValue: number, flowDirection?: number): TileType {
    // First check if this is a river
    if (riverValue > 0.75 && height > 0.2 && height < 0.8) {
      // Make rivers thinner and more winding
      const riverWidth = 0.1; // Controls river width
      const riverWinding = Math.sin(flowDirection! * 2) * 0.1; // Add winding effect
      if (Math.abs(riverValue - 0.75) < riverWidth + riverWinding) {
        return 'RIVER';
      }
      // Add sand around rivers
      if (Math.abs(riverValue - 0.75) < riverWidth + riverWinding + 0.05) {
        return 'SAND';
      }
    }

    // Then determine if it's water based on height
    if (height < 0.35) {
      return height < 0.3 ? 'DEEP_WATER' : 'SHALLOW_WATER';
    }

    // For land tiles, combine temperature and humidity to determine biome
    if (temperature < 0.2) {
      // Cold regions
      if (height > 0.8) return 'SNOW';
      if (height > 0.7) return 'STONE';
      if (height > 0.65) return 'COBBLESTONE';
      if (humidity > 0.6) return 'FOREST';
      if (humidity > 0.3) return 'GRASS';
      return 'STONE'; // Changed from GRAVEL to STONE
    } else if (temperature < 0.4) {
      // Cool regions
      if (height > 0.7) return 'SNOW';
      if (height > 0.65) return 'STONE';
      if (height > 0.6) return 'COBBLESTONE';
      if (humidity > 0.7) return 'FOREST';
      if (humidity > 0.4) return 'GRASS';
      if (humidity > 0.2) return 'SAND'; // Added sand for low humidity areas
      return 'STONE'; // Changed from GRAVEL to STONE
    } else if (temperature < 0.7) {
      // Temperate regions
      if (height > 0.6) return 'STONE';
      if (height > 0.55) return 'COBBLESTONE';
      if (humidity > 0.7) return 'FOREST';
      if (humidity > 0.4) return 'GRASS';
      // Near water or in humid areas, mix mud and clay
      if (height < 0.25 && humidity > 0.3) {
        return Math.random() < 0.7 ? 'CLAY' : 'MUD';
      }
      // Beach areas
      if (height < 0.25) return 'SAND';
      if (humidity < 0.3) return 'SAND'; // Added sand for low humidity areas
      return 'GRASS';
    } else {
      // Hot regions
      if (height > 0.5) return 'STONE';
      if (height > 0.45) return 'COBBLESTONE';
      if (humidity > 0.6) return 'GRASS';
      // Near water in hot regions
      if (height < 0.25) {
        if (humidity > 0.3) {
          return Math.random() < 0.8 ? 'CLAY' : 'MUD';
        }
        return 'SAND';
      }
      // Increased sand generation in hot regions
      if (humidity < 0.5) return 'SAND';
      if (Math.random() < 0.7) return 'SAND'; // 70% chance of sand in hot regions
      return 'GRASS';
    }
  }

  public generateTile(x: number, y: number): Tile {
    const height = this.generateHeight(x, y);
    const temperature = this.generateTemperature(x, y);
    const humidity = this.generateHumidity(x, y);
    const { value: riverValue, flowDirection } = this.generateRiver(x, y, height);
    const value = this.getTileTypeFromClimate(height, temperature, humidity, riverValue, flowDirection);

    const tile: Tile = { x, y, value, height, temperature, humidity, riverValue, flowDirection };

        // Add trees to FOREST tiles (common) and GRASS tiles (rare)
    if (value === 'FOREST') {
      tile.trees = this.generateTrees(x, y, 1.0); // 100% chance for forest
    } else if (value === 'GRASS') {
      tile.trees = this.generateTrees(x, y, 0.05); // 5% chance for grass
    }

    // Add cactus to SAND tiles (5% chance)
    if (value === 'SAND') {
      tile.cactus = this.generateCactus(x, y, 0.05); // 5% chance for sand
    }

    // Add sprite information (only if sprite exists)
    const spriteId = this.getSpriteIdForTile(value);
    if (spriteId) {
      tile.spriteId = spriteId;
    }

    return tile;
  }

      private generateTrees(x: number, y: number, probability = 1.0): Tree[] {
    const trees: Tree[] = [];

    // Check if we should generate a tree based on probability
    if (Math.random() > probability) {
      return trees; // No tree for this tile
    }

    // Only generate 1 tree per tile
    // Center the tree in the tile (no random offset to avoid overlap)
    const treeX = x * WorldGenerator.TILE_SIZE + (WorldGenerator.TILE_SIZE / 2);
    const treeY = y * WorldGenerator.TILE_SIZE + (WorldGenerator.TILE_SIZE / 2);

    // Determine random growth stage (mostly young trees, some mature)
    const random = Math.random();
    let stage = TreeGrowthStage.YOUNG;
    if (random < 0.1) {
      stage = TreeGrowthStage.FULL; // 10% chance of full grown
    } else if (random < 0.3) {
      stage = TreeGrowthStage.TALL; // 20% chance of tall
    }

    const tree = new Tree({
      x: treeX,
      y: treeY,
      initialStage: stage,
      growthTimePerStage: 3600000 // 1 hour in milliseconds
    });

    trees.push(tree);
    return trees;
  }

  private generateCactus(x: number, y: number, probability = 1.0): Cactus[] {
    const cactus: Cactus[] = [];

    // Check if we should generate a cactus based on probability
    if (Math.random() > probability) {
      return cactus; // No cactus for this tile
    }

    // Only generate 1 cactus per tile
    // Center the cactus in the tile (no random offset to avoid overlap)
    const cactusX = x * WorldGenerator.TILE_SIZE + (WorldGenerator.TILE_SIZE / 2);
    const cactusY = y * WorldGenerator.TILE_SIZE + (WorldGenerator.TILE_SIZE / 2);

    // Random variant selection
    const variants = [CactusVariant.VARIANT_1, CactusVariant.VARIANT_2, CactusVariant.VARIANT_3];
    const randomVariant = variants[Math.floor(Math.random() * variants.length)];

    // Determine random growth stage (mostly young cactus, some mature)
    const random = Math.random();
    let stage = 0; // Start young
    if (random < 0.2) {
      // 20% chance of being more mature
      stage = 1; // For variants 1 and 3, this is mature. For variant 2, this is middle stage
      if (randomVariant === CactusVariant.VARIANT_2 && random < 0.1) {
        stage = 2; // 10% chance of being fully mature for variant 2
      }
    }

    const cactusEntity = new Cactus({
      x: cactusX,
      y: cactusY,
      variant: randomVariant,
      initialStage: stage,
      growthTimePerStage: 600000 // 10 minutes in milliseconds
    });

    cactus.push(cactusEntity);
    return cactus;
  }

      public getSpriteIdForTile(tileType: TileType): string | undefined {
    // No tile sprites - only Trees and Cactus render sprites via AnimationSystem
    return undefined;
  }
}