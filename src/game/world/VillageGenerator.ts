import { createNoise2D } from 'simplex-noise';
import type { Position } from '../engine/types';
import { POI } from '../entities/poi/POI';
import { NPC } from '../entities/npc/NPC';
import { getStructureAssets, getAnimalAssets } from '../assets/AssetMap';

export interface VillageStructure {
  type: string;
  position: Position;
  poi?: POI;
  npc?: NPC;
}

export class VillageGenerator {
  private villageNoise: (x: number, y: number) => number;
  private structureNoise: (x: number, y: number) => number;
  private animalNoise: (x: number, y: number) => number;
  private mineNoise: (x: number, y: number) => number;

  private readonly VILLAGE_THRESHOLD = 0.85; // Very rare villages

  constructor(seed?: string) {
    const seedValue = this.hashSeed(seed ?? 'default');

    // Create different noise functions for different features
    this.villageNoise = createNoise2D(() => seedValue * 1.1);
    this.structureNoise = createNoise2D(() => seedValue * 2.3);
    this.animalNoise = createNoise2D(() => seedValue * 3.7);
    this.mineNoise = createNoise2D(() => seedValue * 4.9);
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

    public generateVillageStructures(
    tileX: number,
    tileY: number,
    tileType: string,
    existingStructures: Map<string, VillageStructure>
  ): VillageStructure[] {
    const structures: VillageStructure[] = [];

    // Check if this tile already has a structure
    const tileKey = `${tileX},${tileY}`;
    if (existingStructures.has(tileKey)) {
      return []; // Only one structure per tile
    }

    // Convert tile coordinates to world coordinates (pixel positions)
    const worldX = tileX * 16; // TILE_SIZE = 16
    const worldY = tileY * 16;

    // Convert world coordinates to noise coordinates (scaled down)
    const noiseX = worldX / 1000;
    const noiseY = worldY / 1000;

    // Check for village center
    const villageValue = this.villageNoise(noiseX, noiseY);

    if (villageValue > this.VILLAGE_THRESHOLD && tileType === 'GRASS') {
      // This is a village center - generate village structures
      console.log(`🏘️ Generating village at tile (${tileX}, ${tileY})`);
      // Simple tile type checker for village generation (assumes GRASS for simplicity)
      const getTileType = (x: number, y: number) => 'GRASS';
      const villageStructures = this.generateVillage(tileX, tileY, existingStructures, getTileType);
      structures.push(...villageStructures);
      console.log(`🏘️ Village generated ${villageStructures.length} structures`);
    }

    // Check for mines and dungeons on STONE tiles
    if (tileType === 'STONE') {
      const mineValue = this.mineNoise(noiseX * 3, noiseY * 3); // Higher frequency for more variation

      // Much stricter threshold and additional spacing checks
      if (mineValue > 0.95) { // Even rarer than villages
        const mineStructure = this.generateMineOrDungeon(tileX, tileY, existingStructures);
        if (mineStructure) {
          structures.push(mineStructure);
        }
      }
    }

    // Generate random animals on GRASS tiles (not in villages)
    if (tileType === 'GRASS' && villageValue < this.VILLAGE_THRESHOLD) {
      const animalStructure = this.generateAnimal(tileX, tileY, existingStructures);
      if (animalStructure) {
        structures.push(animalStructure);
      }
    }

    return structures;
  }

    private generateVillage(
    centerTileX: number,
    centerTileY: number,
    existingStructures: Map<string, VillageStructure>,
    getTileType: (x: number, y: number) => string = () => 'GRASS'
  ): VillageStructure[] {
    const structures: VillageStructure[] = [];

    // Check if village already exists in this area (using tile coordinates)
    const villageKey = `village_${Math.floor(centerTileX / 20)}_${Math.floor(centerTileY / 20)}`; // 20 tiles radius
    if (existingStructures.has(villageKey)) {
      return [];
    }

    // Generate windmill at center tile (only on valid terrain)
    const windmillTileKey = `${centerTileX},${centerTileY}`;
    if (!existingStructures.has(windmillTileKey)) {
      const centerTileType = getTileType(centerTileX, centerTileY);
      if (this.isValidPOITerrain(centerTileType)) {
        const windmillPos = { x: centerTileX * 16, y: centerTileY * 16 };
        const windmill = this.createStructurePOI('windmill_frame_0', windmillPos);
        if (windmill) {
          structures.push(windmill);
          existingStructures.set(windmillTileKey, windmill);
          console.log(`Generated windmill at tile (${centerTileX}, ${centerTileY})`);
        }
      }
    }

            // Generate markets around the windmill (well spaced)
    const markets = [
      { type: 'food_market', x: centerTileX + 8, y: centerTileY },      // 8 tiles east
      { type: 'butcher_market', x: centerTileX - 8, y: centerTileY },   // 8 tiles west
      { type: 'armory_market', x: centerTileX, y: centerTileY + 8 },    // 8 tiles south
      { type: 'cloth_market', x: centerTileX, y: centerTileY - 8 }      // 8 tiles north
    ];

    for (const market of markets) {
      const marketTileKey = `${market.x},${market.y}`;
      if (!existingStructures.has(marketTileKey)) {
        const marketTileType = getTileType(market.x, market.y);
        if (this.isValidPOITerrain(marketTileType)) {
          const worldPos = { x: market.x * 16, y: market.y * 16 };
          const marketPOI = this.createStructurePOI(market.type, worldPos);
          if (marketPOI) {
            structures.push(marketPOI);
            existingStructures.set(marketTileKey, marketPOI);
            console.log(`Generated ${market.type} at tile (${market.x}, ${market.y})`);
          }
        }
      }
    }

    // Generate animals around the village (well spaced, avoiding markets)
    const animalTypes = ['chicken', 'pig', 'sheep'];
    const animalTilePositions = [
      { x: centerTileX + 4, y: centerTileY + 4 },   // Southeast, 4 tiles away
      { x: centerTileX - 4, y: centerTileY + 4 },   // Southwest, 4 tiles away
      { x: centerTileX + 4, y: centerTileY - 4 },   // Northeast, 4 tiles away
      { x: centerTileX - 4, y: centerTileY - 4 },   // Northwest, 4 tiles away
      { x: centerTileX + 6, y: centerTileY + 2 },   // Far southeast
      { x: centerTileX - 6, y: centerTileY - 2 }    // Far northwest
    ];

    for (const tilePos of animalTilePositions) {
      const animalTileKey = `${tilePos.x},${tilePos.y}`;

      if (!existingStructures.has(animalTileKey)) {
        const animalTileType = getTileType(tilePos.x, tilePos.y);
        if (this.isValidNPCTerrain(animalTileType)) {
          const animalType = animalTypes[Math.floor(Math.random() * animalTypes.length)];
          if (animalType) {
            const worldPos = { x: tilePos.x * 16, y: tilePos.y * 16 };
            const animal = this.createAnimalNPC(animalType, worldPos);
            if (animal) {
              structures.push(animal);
              existingStructures.set(animalTileKey, animal);
              console.log(`Generated ${animalType} at tile (${tilePos.x}, ${tilePos.y})`);
            }
          }
        }
      }
    }

    // Mark village as generated
    existingStructures.set(villageKey, { type: 'village_marker', position: { x: centerTileX * 16, y: centerTileY * 16 } });

    return structures;
  }

    private generateMineOrDungeon(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>
  ): VillageStructure | null {
    const tileKey = `${tileX},${tileY}`;

    if (existingStructures.has(tileKey)) {
      return null; // Only one structure per tile
    }

    // Check for nearby mines/dungeons to prevent clustering
    const minSpacing = 15; // 15 tiles minimum distance between mines
    for (let dx = -minSpacing; dx <= minSpacing; dx++) {
      for (let dy = -minSpacing; dy <= minSpacing; dy++) {
        if (dx === 0 && dy === 0) continue;

        const nearbyKey = `${tileX + dx},${tileY + dy}`;
        const nearbyStructure = existingStructures.get(nearbyKey);

        if (nearbyStructure && (
          nearbyStructure.type === 'mine_entrance' ||
          nearbyStructure.type === 'dungeon_entrance'
        )) {
          return null; // Too close to another mine/dungeon
        }
      }
    }

    // Add additional randomness - only 30% chance even if noise threshold is met
    if (Math.random() > 0.3) {
      return null;
    }

    // Convert to world coordinates
    const worldPos = { x: tileX * 16, y: tileY * 16 };

    // Randomly choose between mine and dungeon
    const structureType = Math.random() < 0.7 ? 'mine_entrance' : 'dungeon_entrance';
    const structure = this.createStructurePOI(structureType, worldPos);

    if (structure) {
      existingStructures.set(tileKey, structure);
    }

    return structure;
  }

    private generateAnimal(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>
  ): VillageStructure | null {
    const tileKey = `${tileX},${tileY}`;

    if (existingStructures.has(tileKey)) {
      return null; // Only one structure per tile
    }

    // Convert to world coordinates for noise calculation
    const worldX = tileX * 16;
    const worldY = tileY * 16;
    const noiseX = worldX / 500;
    const noiseY = worldY / 500;
    const animalValue = this.animalNoise(noiseX, noiseY);

    // Lower chance for wild animals
    if (animalValue < 0.95) {
      return null;
    }

    const worldPos = { x: worldX, y: worldY };
    const animalTypes = ['chicken', 'pig', 'sheep'];
    const animalType = animalTypes[Math.floor(Math.random() * animalTypes.length)];

    if (!animalType) return null;

    const animal = this.createAnimalNPC(animalType, worldPos);

    if (animal) {
      existingStructures.set(tileKey, animal);
    }

    return animal;
  }

  private createStructurePOI(type: string, position: Position): VillageStructure | null {
    try {
      const poi = new POI({
        type,
        position,
        interactable: true,
        passable: type.includes('entrance'),
        animated: type === 'windmill_frame_0'
      });

      return {
        type,
        position,
        poi
      };
    } catch (error) {
      console.warn(`Failed to create POI structure ${type}:`, error);
      return null;
    }
  }

  private createAnimalNPC(type: string, position: Position): VillageStructure | null {
    try {
      const npc = new NPC({
        type: type as 'chicken' | 'pig' | 'sheep',
        position,
        aggressive: false
      });

      return {
        type,
        position,
        npc
      };
    } catch (error) {
      console.warn(`Failed to create animal NPC ${type}:`, error);
      return null;
    }
  }



    public getVillageCenter(worldX: number, worldY: number): Position | null {
    const noiseX = worldX / 1000;
    const noiseY = worldY / 1000;
    const villageValue = this.villageNoise(noiseX, noiseY);

    if (villageValue > this.VILLAGE_THRESHOLD) {
      // Convert to tile coordinates and snap to village grid (20 tile radius)
      const tileX = Math.floor(worldX / 16);
      const tileY = Math.floor(worldY / 16);
      const villageGridX = Math.floor(tileX / 20) * 20;
      const villageGridY = Math.floor(tileY / 20) * 20;

      return { x: villageGridX * 16, y: villageGridY * 16 };
    }

    return null;
  }



  private isValidPOITerrain(tileType: string): boolean {
    // POI structures (windmills, markets) cannot be placed on water or stone
    return tileType !== 'DEEP_WATER' && tileType !== 'SHALLOW_WATER' && tileType !== 'STONE';
  }

  private isValidNPCTerrain(tileType: string): boolean {
    // NPCs can be placed in shallow water but not deep water or stone
    return tileType !== 'DEEP_WATER' && tileType !== 'STONE';
  }
}