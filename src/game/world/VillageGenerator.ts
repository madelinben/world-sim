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
    existingStructures: Map<string, VillageStructure>,
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): VillageStructure[] {
    const structures: VillageStructure[] = [];

    // Check if this tile already has a structure
    const tileKey = `${tileX},${tileY}`;
    if (existingStructures.has(tileKey) || (tileOccupancyChecker?.(tileX, tileY))) {
      return []; // Only one structure per tile
    }

    // Convert tile coordinates to world coordinates (pixel positions)
    const worldX = tileX * 16; // TILE_SIZE = 16
    const worldY = tileY * 16;

    // Convert world coordinates to noise coordinates (scaled down)
    const noiseX = worldX / 1000;
    const noiseY = worldY / 1000;

    // Check for village center using village grid system
    const villageValue = this.villageNoise(noiseX, noiseY);

    if (villageValue > this.VILLAGE_THRESHOLD && tileType === 'GRASS') {
      // Check if this is the designated village center tile for this area
      const villageGridSize = 50; // 50 tiles = ~800 pixels village areas
      const villageGridX = Math.floor(tileX / villageGridSize);
      const villageGridY = Math.floor(tileY / villageGridSize);
      const villageAreaKey = `village_area_${villageGridX}_${villageGridY}`;

      // Check if this village area already has a windmill
      if (existingStructures.has(villageAreaKey)) {
        return []; // Village already exists in this area
      }

      // Find the best tile in this grid area for the village center
      const bestTile = this.findBestVillageCenterInArea(
        villageGridX * villageGridSize,
        villageGridY * villageGridSize,
        villageGridSize,
        existingStructures,
        tileOccupancyChecker
      );

      // Only generate windmill if this is the designated best tile
      if (bestTile && bestTile.x === tileX && bestTile.y === tileY) {
        console.log(`🏘️ Generating village center windmill at designated tile (${tileX}, ${tileY}) in grid area (${villageGridX}, ${villageGridY})`);

        const windmillPos = { x: worldX, y: worldY };
        const windmill = this.createStructurePOI('windmill_frame_0', windmillPos);
        if (windmill) {
          structures.push(windmill);
          existingStructures.set(tileKey, windmill);
          existingStructures.set(villageAreaKey, windmill); // Mark area as having a village
          console.log(`Generated windmill at village center tile (${tileX}, ${tileY})`);

          // DON'T generate the complete village here - it will be generated tile-by-tile
          // This prevents conflicts and ensures proper tile occupancy checking
        }
      }
    }

    // Check for markets exactly 8 tiles from village centers
    this.checkForMarketPlacement(tileX, tileY, tileType, existingStructures, structures);

    // Check for village animals at predetermined offsets from village centers
    this.checkForVillageAnimalPlacement(tileX, tileY, tileType, existingStructures, structures);

    // Check for mines and dungeons on STONE tiles
    if (tileType === 'STONE') {
      const mineValue = this.mineNoise(noiseX * 3, noiseY * 3); // Higher frequency for more variation

      // Much stricter threshold and additional spacing checks
      if (mineValue > 0.98) { // Even rarer than villages (0.98 vs 0.85)
        const mineStructure = this.generateMineOrDungeon(tileX, tileY, existingStructures);
        if (mineStructure) {
          structures.push(mineStructure);
        }
      }
    }

    // Generate random animals on GRASS tiles (if far from villages)
    if (tileType === 'GRASS' && villageValue < this.VILLAGE_THRESHOLD - 0.2) {
      const animalStructure = this.generateAnimal(tileX, tileY, existingStructures);
      if (animalStructure) {
        structures.push(animalStructure);
      }
    }

    // Generate monsters on various terrains (very rare, avoiding villages)
    if ((tileType === 'FOREST' || tileType === 'STONE' || tileType === 'GRAVEL') && villageValue < this.VILLAGE_THRESHOLD - 0.2) {
      const monsterStructure = this.generateMonster(tileX, tileY, existingStructures);
      if (monsterStructure) {
        structures.push(monsterStructure);
      }
    }

    return structures;
  }

  private findBestVillageCenterInArea(
    startX: number,
    startY: number,
    gridSize: number,
    existingStructures: Map<string, VillageStructure>,
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): { x: number; y: number; value: number } | null {
    let bestTile: { x: number; y: number; value: number } | null = null;

    // Sample a smaller area within the grid to find the best spot
    const sampleSize = Math.min(gridSize, 20); // Sample up to 20x20 area
    const centerX = startX + Math.floor(gridSize / 2);
    const centerY = startY + Math.floor(gridSize / 2);
    const sampleStartX = centerX - Math.floor(sampleSize / 2);
    const sampleStartY = centerY - Math.floor(sampleSize / 2);

    for (let y = sampleStartY; y < sampleStartY + sampleSize; y++) {
      for (let x = sampleStartX; x < sampleStartX + sampleSize; x++) {
        const tileKey = `${x},${y}`;
        if (existingStructures.has(tileKey) || (tileOccupancyChecker?.(x, y))) {
          continue; // Skip occupied tiles
        }

        // Check if this is valid terrain (GRASS)
        const tileType = this.getTileTypeForCoords(x, y);
        if (tileType !== 'GRASS') {
          continue;
        }

        // Calculate village noise value for this tile
        const worldX = x * 16;
        const worldY = y * 16;
        const noiseX = worldX / 1000;
        const noiseY = worldY / 1000;
        const villageValue = this.villageNoise(noiseX, noiseY);

        if (villageValue > this.VILLAGE_THRESHOLD) {
          if (!bestTile || villageValue > bestTile.value) {
            bestTile = { x, y, value: villageValue };
          }
        }
      }
    }

    return bestTile;
  }

  private checkForMarketPlacement(
    tileX: number,
    tileY: number,
    tileType: string,
    existingStructures: Map<string, VillageStructure>,
    structures: VillageStructure[]
  ): void {
    // Check if this tile is exactly 8 tiles from any village center
    const marketOffsets = [
      { dx: 8, dy: 0, type: 'food_market' },    // 8 tiles east
      { dx: -8, dy: 0, type: 'butcher_market' }, // 8 tiles west
      { dx: 0, dy: 8, type: 'armory_market' },   // 8 tiles south
      { dx: 0, dy: -8, type: 'cloth_market' }    // 8 tiles north
    ];

    for (const offset of marketOffsets) {
      const windmillX = tileX - offset.dx;
      const windmillY = tileY - offset.dy;
      const windmillKey = `${windmillX},${windmillY}`;
      const windmillStructure = existingStructures.get(windmillKey);

      if (windmillStructure && windmillStructure.type === 'windmill_frame_0') {
        // This tile should have a market
        if (this.isValidPOITerrain(tileType)) {
          const marketPos = { x: tileX * 16, y: tileY * 16 };
          const market = this.createStructurePOI(offset.type, marketPos);
          if (market) {
            structures.push(market);
            existingStructures.set(`${tileX},${tileY}`, market);
            console.log(`Generated ${offset.type} at tile (${tileX}, ${tileY}) for village at (${windmillX}, ${windmillY})`);
          }
        }
        break; // Only one market per tile
      }
    }
  }

  // Helper method to get tile type for coordinates (simplified)
  private getTileTypeForCoords(x: number, y: number): string {
    // This is a simplified version - in a real implementation you'd call the world generator
    // For now, assume most tiles are GRASS unless they're clearly water/stone based on position
    const worldX = x * 16;
    const worldY = y * 16;

    // Simple heuristic - you could make this more sophisticated
    if (Math.abs(worldX % 1000) < 100 || Math.abs(worldY % 1000) < 100) {
      return 'STONE'; // Some areas are stone
    }
    return 'GRASS'; // Default to grass for village generation
  }

  private generateVillage(
    centerTileX: number,
    centerTileY: number,
    existingStructures: Map<string, VillageStructure>,
    getTileType: (x: number, y: number) => string = () => 'GRASS',
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): VillageStructure[] {
    const structures: VillageStructure[] = [];

    // Check if village already exists in this area (using tile coordinates)
    const villageKey = `village_${Math.floor(centerTileX / 20)}_${Math.floor(centerTileY / 20)}`; // 20 tiles radius
    if (existingStructures.has(villageKey)) {
      return [];
    }

    // Generate windmill at center tile (only on valid terrain)
    const windmillTileKey = `${centerTileX},${centerTileY}`;
    if (!existingStructures.has(windmillTileKey) && !(tileOccupancyChecker?.(centerTileX, centerTileY))) {
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
      if (!existingStructures.has(marketTileKey) && !(tileOccupancyChecker?.(market.x, market.y))) {
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

    // Generate animals around the village (fewer animals, better spacing)
    const animalTypes = ['chicken', 'pig', 'sheep'];
    const animalTilePositions = [
      // Core positions with good spacing
      { x: centerTileX + 5, y: centerTileY + 5 },   // Southeast, 5 tiles away
      { x: centerTileX - 5, y: centerTileY + 5 },   // Southwest, 5 tiles away
      { x: centerTileX + 5, y: centerTileY - 5 },   // Northeast, 5 tiles away
      { x: centerTileX - 5, y: centerTileY - 5 },   // Northwest, 5 tiles away

      // Cardinal directions with good spacing
      { x: centerTileX + 7, y: centerTileY },       // East, 7 tiles away
      { x: centerTileX - 7, y: centerTileY },       // West, 7 tiles away
      { x: centerTileX, y: centerTileY + 7 },       // South, 7 tiles away
      { x: centerTileX, y: centerTileY - 7 },       // North, 7 tiles away

      // Additional spread-out positions
      { x: centerTileX + 3, y: centerTileY + 7 },   // Southeast, far
      { x: centerTileX - 3, y: centerTileY + 7 },   // Southwest, far
      { x: centerTileX + 7, y: centerTileY + 3 },   // Northeast, far
      { x: centerTileX - 7, y: centerTileY - 3 }    // Northwest, far
    ];

    for (const tilePos of animalTilePositions) {
      const animalTileKey = `${tilePos.x},${tilePos.y}`;

      if (!existingStructures.has(animalTileKey) && !(tileOccupancyChecker?.(tilePos.x, tilePos.y))) {
        const animalTileType = getTileType(tilePos.x, tilePos.y);
        if (this.isValidNPCTerrain(animalTileType)) {
          // Check if this position has enough adjacent passable space
          if (this.hasAdjacentPassableSpace(tilePos.x, tilePos.y, existingStructures, tileOccupancyChecker)) {
            const animalType = animalTypes[Math.floor(Math.random() * animalTypes.length)];
            if (animalType) {
              const worldPos = { x: tilePos.x * 16, y: tilePos.y * 16 };
              const animal = this.createAnimalNPC(animalType, worldPos);
              if (animal) {
                structures.push(animal);
                existingStructures.set(animalTileKey, animal);
                console.log(`Generated ${animalType} at tile (${tilePos.x}, ${tilePos.y}) with adequate movement space`);
              }
            }
          } else {
            console.log(`Skipped animal spawn at (${tilePos.x}, ${tilePos.y}) - insufficient adjacent passable space`);
          }
        }
      }
    }

    // Generate traders near markets (1 per village, near a random market)
    const marketTypes = ['food_market', 'butcher_market', 'armory_market', 'cloth_market'];
    if (Math.random() < 0.8) { // 80% chance to have a trader
      const randomMarket = markets[Math.floor(Math.random() * markets.length)];
      if (randomMarket) {
        const traderPos = { x: randomMarket.x + 1, y: randomMarket.y + 1 }; // 1 tile away from market
        const traderTileKey = `${traderPos.x},${traderPos.y}`;

        if (!existingStructures.has(traderTileKey) && !(tileOccupancyChecker?.(traderPos.x, traderPos.y))) {
          const traderTileType = getTileType(traderPos.x, traderPos.y);
          if (this.isValidNPCTerrain(traderTileType)) {
            const worldPos = { x: traderPos.x * 16, y: traderPos.y * 16 };
            const trader = this.createTraderNPC('trader', worldPos);
            if (trader) {
              structures.push(trader);
              existingStructures.set(traderTileKey, trader);
              console.log(`Generated trader at tile (${traderPos.x}, ${traderPos.y})`);
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

    // Increased chance for wild animals
    if (animalValue < 0.85) {
      return null;
    }

    // Check if this position has enough adjacent passable space
    if (!this.hasAdjacentPassableSpace(tileX, tileY, existingStructures)) {
      return null; // Skip if surrounded
    }

    const worldPos = { x: worldX, y: worldY };
    // Use species grouping for wild animals too
    const animalType = this.selectAnimalTypeWithGrouping(tileX, tileY, existingStructures);

    if (!animalType) return null;

    const animal = this.createAnimalNPC(animalType, worldPos);

    if (animal) {
      existingStructures.set(tileKey, animal);
      console.log(`Generated wild ${animalType} at tile (${tileX}, ${tileY}) with species grouping`);
    }

    return animal;
  }

  private generateMonster(
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
    const noiseX = worldX / 800; // Different frequency for monsters
    const noiseY = worldY / 800;
    const monsterValue = this.animalNoise(noiseX, noiseY); // Reuse animal noise but different scale

    // Very low chance for monsters
    if (monsterValue < 0.98) { // Even rarer than animals
      return null;
    }

    // Additional randomness - only 20% chance even if noise threshold is met
    if (Math.random() > 0.2) {
      return null;
    }

    const worldPos = { x: worldX, y: worldY };
    const monster = this.createMonsterNPC('orc', worldPos);

    if (monster) {
      existingStructures.set(tileKey, monster);
    }

    return monster;
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

  private createMonsterNPC(type: string, position: Position): VillageStructure | null {
    try {
      const npc = new NPC({
        type: type as 'orc' | 'skeleton' | 'goblin',
        position,
        aggressive: true
      });

      return {
        type,
        position,
        npc
      };
    } catch (error) {
      console.warn(`Failed to create monster NPC ${type}:`, error);
      return null;
    }
  }

  private createTraderNPC(type: string, position: Position): VillageStructure | null {
    try {
      const npc = new NPC({
        type: type as 'trader',
        position,
        aggressive: false
      });

      return {
        type,
        position,
        npc
      };
    } catch (error) {
      console.warn(`Failed to create trader NPC ${type}:`, error);
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

  private checkForVillageAnimalPlacement(
    tileX: number,
    tileY: number,
    tileType: string,
    existingStructures: Map<string, VillageStructure>,
    structures: VillageStructure[]
  ): void {
    // Check if this tile is at predetermined animal offsets from any village center
    const animalOffsets = [
      // Core positions with good spacing (matching the village generation)
      { dx: 5, dy: 5 },   // Southeast, 5 tiles away
      { dx: -5, dy: 5 },  // Southwest, 5 tiles away
      { dx: 5, dy: -5 },  // Northeast, 5 tiles away
      { dx: -5, dy: -5 }, // Northwest, 5 tiles away

      // Cardinal directions with good spacing
      { dx: 7, dy: 0 },   // East, 7 tiles away
      { dx: -7, dy: 0 },  // West, 7 tiles away
      { dx: 0, dy: 7 },   // South, 7 tiles away
      { dx: 0, dy: -7 },  // North, 7 tiles away

      // Additional spread-out positions
      { dx: 3, dy: 7 },   // Southeast, far
      { dx: -3, dy: 7 },  // Southwest, far
      { dx: 7, dy: 3 },   // Northeast, far
      { dx: -7, dy: -3 }  // Northwest, far
    ];

    for (const offset of animalOffsets) {
      const windmillX = tileX - offset.dx;
      const windmillY = tileY - offset.dy;
      const windmillKey = `${windmillX},${windmillY}`;
      const windmillStructure = existingStructures.get(windmillKey);

      if (windmillStructure && windmillStructure.type === 'windmill_frame_0') {
        // This tile should have a village animal
        if (this.isValidNPCTerrain(tileType)) {
          // Check if this position has enough adjacent passable space
          if (this.hasAdjacentPassableSpace(tileX, tileY, existingStructures)) {
            // Use species grouping logic for animal selection
            const animalType = this.selectAnimalTypeWithGrouping(tileX, tileY, existingStructures);

            if (animalType) {
              const animalPos = { x: tileX * 16, y: tileY * 16 };
              const animal = this.createAnimalNPC(animalType, animalPos);
              if (animal) {
                structures.push(animal);
                existingStructures.set(`${tileX},${tileY}`, animal);
                console.log(`Generated village ${animalType} at tile (${tileX}, ${tileY}) for village at (${windmillX}, ${windmillY}) with species grouping`);
              }
            }
          } else {
            console.log(`Skipped village animal at (${tileX}, ${tileY}) - insufficient movement space`);
          }
        }
        break; // Only one animal per tile
      }
    }
  }

  // Enhanced helper method to check if a tile has adequate spacing from other animals
  private hasAdequateAnimalSpacing(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>,
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): boolean {
    const minSpacingRadius = 2; // Require 2-tile minimum spacing between animals

    // Check all tiles within the spacing radius
    for (let dx = -minSpacingRadius; dx <= minSpacingRadius; dx++) {
      for (let dy = -minSpacingRadius; dy <= minSpacingRadius; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip the center tile

        const checkX = tileX + dx;
        const checkY = tileY + dy;
        const checkKey = `${checkX},${checkY}`;

        // Check if there's already an animal at this location
        const existingStructure = existingStructures.get(checkKey);
        if (existingStructure?.npc) {
          console.log(`Spacing violation: Animal already exists at (${checkX},${checkY}), too close to proposed spawn at (${tileX},${tileY})`);
          return false; // Too close to another animal
        }

        // Also check via occupancy checker for NPCs
        if (tileOccupancyChecker?.(checkX, checkY)) {
          // We need to be more specific about what type of occupancy this is
          // For now, we'll be conservative and avoid any occupied tiles nearby
          const distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance
          if (distance <= 1) { // Immediately adjacent tiles must be free
            console.log(`Spacing violation: Adjacent tile (${checkX},${checkY}) is occupied, blocking spawn at (${tileX},${tileY})`);
            return false;
          }
        }
      }
    }

    // Additionally, ensure at least 3 adjacent tiles are passable for movement
    const adjacentTiles = [
      { x: tileX + 1, y: tileY },     // right
      { x: tileX - 1, y: tileY },     // left
      { x: tileX, y: tileY + 1 },     // down
      { x: tileX, y: tileY - 1 }      // up
    ];

    let passableCount = 0;
    for (const adjacentTile of adjacentTiles) {
      const adjacentKey = `${adjacentTile.x},${adjacentTile.y}`;

      // Check if adjacent tile is not occupied
      if (!existingStructures.has(adjacentKey) && !(tileOccupancyChecker?.(adjacentTile.x, adjacentTile.y))) {
        // Check if it's valid terrain for movement
        const tileType = this.getTileTypeForCoords(adjacentTile.x, adjacentTile.y);
        if (this.isValidNPCTerrain(tileType) && tileType !== 'DEEP_WATER' && tileType !== 'STONE') {
          passableCount++;
        }
      }
    }

    if (passableCount < 3) {
      console.log(`Movement violation: Only ${passableCount} passable adjacent tiles at (${tileX},${tileY}), need at least 3`);
      return false;
    }

    return true;
  }

  // Keep the old method for backward compatibility but make it more strict
  private hasAdjacentPassableSpace(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>,
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): boolean {
    // Use the new enhanced method
    return this.hasAdequateAnimalSpacing(tileX, tileY, existingStructures, tileOccupancyChecker);
  }

    // Enhanced method to select animal type based on nearby animals (species grouping)
  private selectAnimalTypeWithGrouping(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>
  ): string {
    const animalTypes = ['chicken', 'pig', 'sheep'];
    const detectionRadius = 4; // Check within 4 tiles for same species
    const groupingBonus = 3; // Multiply spawn chance by this for same species

    // Count nearby animals by type
    const nearbyAnimals: Record<string, number> = {
      chicken: 0,
      pig: 0,
      sheep: 0
    };

    // Check all tiles within detection radius
    for (let dx = -detectionRadius; dx <= detectionRadius; dx++) {
      for (let dy = -detectionRadius; dy <= detectionRadius; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip center tile

        const checkX = tileX + dx;
        const checkY = tileY + dy;
        const checkKey = `${checkX},${checkY}`;

        const structure = existingStructures.get(checkKey);
        if (structure?.npc && structure.type && animalTypes.includes(structure.type)) {
          nearbyAnimals[structure.type] = (nearbyAnimals[structure.type] ?? 0) + 1;
        }
      }
    }

    // Create weighted selection based on nearby animals
    const weightedTypes: string[] = [];

    for (const animalType of animalTypes) {
      const nearbyCount = nearbyAnimals[animalType] ?? 0;

      if (nearbyCount > 0) {
        // Add multiple entries for types with nearby animals (grouping bonus)
        for (let i = 0; i < groupingBonus; i++) {
          weightedTypes.push(animalType);
        }
        console.log(`Found ${nearbyCount} nearby ${animalType}(s), applying grouping bonus`);
      } else {
        // Add single entry for types without nearby animals
        weightedTypes.push(animalType);
      }
    }

    // Select randomly from weighted list
    const selectedType = weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
    return selectedType ?? animalTypes[0]!
  }
}