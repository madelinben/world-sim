import { createNoise2D } from 'simplex-noise';
import type { Position } from '../engine/types';
import { POI } from '../entities/poi/POI';
import { NPC } from '../entities/npc/NPC';

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

  // Village name generation data
  private readonly VILLAGE_NAME_PREFIXES = [
    'Sunny', 'Happy', 'Green', 'Bright', 'Sweet', 'Peaceful', 'Golden', 'Silver', 'Crystal', 'Rainbow',
    'Gentle', 'Cozy', 'Warm', 'Friendly', 'Cherry', 'Apple', 'Maple', 'Willow', 'Rose', 'Daisy',
    'Honey', 'Sugar', 'Candy', 'Bubble', 'Sparkle', 'Twinkle', 'Star', 'Moon', 'Sun', 'Cloud',
    'Blue', 'Purple', 'Pink', 'Orange', 'White', 'Spring', 'Summer', 'Autumn', 'Winter', 'Meadow',
    'River', 'Lake', 'Hill', 'Valley', 'Garden', 'Forest', 'Field', 'Brook', 'Grove', 'Creek'
  ];

  private readonly VILLAGE_NAME_SUFFIXES = [
    'ville', 'town', 'burg', 'ham', 'field', 'wood', 'brook', 'creek', 'dale', 'glen',
    'haven', 'ridge', 'grove', 'meadow', 'valley', 'hills', 'springs', 'gardens', 'falls', 'pond',
    'bridge', 'crossing', 'hollow', 'cove', 'bay', 'shore', 'view', 'heights', 'point', 'bend'
  ];

  // Village names cache to ensure same village always gets same name
  private villageNamesCache = new Map<string, string>();

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

      // Only generate well if this is the designated best tile
      if (bestTile && bestTile.x === tileX && bestTile.y === tileY) {
        // Generate village name for this village
        const villageName = this.generateVillageName(villageGridX, villageGridY);
        console.log(`🏘️ Generating village center well at designated tile (${tileX}, ${tileY}) in grid area (${villageGridX}, ${villageGridY}) - Village: ${villageName}`);

        // Register the well at village center
        const worldX = tileX * 16;
        const worldY = tileY * 16;
        const well: VillageStructure = {
          type: 'water_well',
          position: { x: worldX, y: worldY },
          poi: new POI({
            type: 'water_well',
            position: { x: worldX, y: worldY },
            interactable: true,
            passable: false,
            customData: { villageName }
          })
        };

        structures.push(well);
        existingStructures.set(tileKey, well);
        existingStructures.set(villageAreaKey, well); // Mark area as having a village
        console.log(`Generated water well at village center tile (${tileX}, ${tileY}) for village: ${villageName}`);

        // Generate additional POI structures around the well (6-10 tile radius)
        const numStructures = Math.floor(Math.random() * 3) + 2; // 2-4 structures
        const structureTypes = ['windmill', 'market_stall'];

        console.log(`🏘️ About to generate ${numStructures} POI structures around well for village: ${villageName}`);

        for (let i = 0; i < numStructures; i++) {
          const structureType = structureTypes[Math.floor(Math.random() * structureTypes.length)]!;
          let placed = false;
          let attempts = 0;
          const maxAttempts = 30; // Increased attempts

          while (!placed && attempts < maxAttempts) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = 6 + Math.random() * 4; // 6-10 tiles from center
            const structX = Math.round(tileX + Math.cos(angle) * distance);
            const structY = Math.round(tileY + Math.sin(angle) * distance);

            const structTileKey = `${structX},${structY}`;
            const wellTileKey = `${tileX},${tileY}`;

            // Ensure we don't place on the well tile or already occupied tiles
            if (structTileKey !== wellTileKey &&
                !existingStructures.has(structTileKey) &&
                !tileOccupancyChecker?.(structX, structY) &&
                this.hasAdequatePOISpacing(structX, structY, existingStructures) &&
                this.getTileTypeForCoords(structX, structY) === 'GRASS') {

              const structWorldX = structX * 16;
              const structWorldY = structY * 16;
              const structure: VillageStructure = {
                type: structureType,
                position: { x: structWorldX, y: structWorldY },
                poi: new POI({
                  type: structureType,
                  position: { x: structWorldX, y: structWorldY },
                  interactable: false,
                  passable: false,
                  animated: structureType === 'windmill',
                  customData: { villageName }
                })
              };
              structures.push(structure);
              existingStructures.set(structTileKey, structure); // Register the structure to prevent conflicts
              placed = true;
              console.log(`Generated ${structureType} at tile (${structX}, ${structY}) around well at (${tileX}, ${tileY})`);
            }
            attempts++;
          }

          if (!placed) {
            console.warn(`Failed to place ${structureType} around well at (${tileX}, ${tileY}) after ${maxAttempts} attempts`);
          }
        }

        // Generate 5 trader NPCs around the village well
        console.log(`🏘️ About to call generateVillageTraders for village: ${villageName} at well (${tileX}, ${tileY})`);
        this.generateVillageTraders(tileX, tileY, villageName, existingStructures, structures, tileOccupancyChecker);
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

          // Generate 5 monsters near dungeon entrances
          if (mineStructure.type === 'dungeon_entrance') {
            this.generateDungeonMonsters(tileX, tileY, existingStructures, structures, tileOccupancyChecker);
          }
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
    if ((tileType === 'FOREST' || tileType === 'STONE' || tileType === 'GRAVEL' || tileType === 'MUD') && villageValue < this.VILLAGE_THRESHOLD - 0.2) {
      const monsterStructure = this.generateMonster(tileX, tileY, existingStructures, tileType);
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
    // Check if this tile is within 6-10 tiles from any village center (well)
    // Generate windmill and markets randomly around the well
    const maxDistance = 10;
    const minDistance = 6;

    // Search for nearby wells within reasonable distance
    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      for (let dy = -maxDistance; dy <= maxDistance; dy++) {
        const wellX = tileX + dx;
        const wellY = tileY + dy;
        const wellKey = `${wellX},${wellY}`;
        const wellStructure = existingStructures.get(wellKey);

        if (wellStructure && wellStructure.type === 'water_well') {
          const distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance

          // Only place structures within the valid distance range
          if (distance >= minDistance && distance <= maxDistance && this.isValidPOITerrain(tileType)) {
            // Check for adequate spacing between POI structures (minimum 2 tiles apart)
            if (!this.hasAdequatePOISpacing(tileX, tileY, existingStructures)) {
              return; // Skip placement if too close to other POI structures
            }

            // Determine what structure to place based on random seed and distance
            const structureType = this.getRandomVillageStructureType(tileX, tileY, wellX, wellY, existingStructures);

            if (structureType) {
              const structurePos = { x: tileX * 16, y: tileY * 16 };
              // Get village name from the well
              const villageName = wellStructure.poi?.customData?.villageName as string ?? 'Unknown Village';
              const structure = this.createStructurePOI(structureType, structurePos, villageName);
              if (structure) {
                structures.push(structure);
                existingStructures.set(`${tileX},${tileY}`, structure);
                console.log(`Generated ${structureType} at tile (${tileX}, ${tileY}) for village centered at well (${wellX}, ${wellY})`);
                return; // Only place one structure per tile
              }
            }
          }
        }
      }
    }
  }

  private getCirclePositions(centerX: number, centerY: number, radius: number): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];

    // Generate positions in a rough circle pattern
    for (let angle = 0; angle < 360; angle += 30) { // Every 30 degrees
      const radians = (angle * Math.PI) / 180;
      const x = Math.round(centerX + radius * Math.cos(radians));
      const y = Math.round(centerY + radius * Math.sin(radians));
      positions.push({ x, y });
    }

    return positions;
  }

  private getRandomVillageStructureType(
    tileX: number,
    tileY: number,
    wellX: number,
    wellY: number,
    existingStructures: Map<string, VillageStructure>
  ): string | null {
    // Use deterministic random based on tile position relative to well
    const seed = (tileX - wellX) * 31 + (tileY - wellY) * 37 + wellX * 13 + wellY * 17;
    const random = Math.abs(Math.sin(seed)) % 1;

    // Count existing structures around this well to ensure variety
    const villageStructureTypes = ['windmill_frame_0', 'food_market', 'butcher_market', 'armory_market', 'cloth_market', 'notice_board'];
    const existingTypesNearWell = new Set<string>();

    // Check what structures already exist near this well (within 10 tiles)
    for (let dx = -10; dx <= 10; dx++) {
      for (let dy = -10; dy <= 10; dy++) {
        const checkX = wellX + dx;
        const checkY = wellY + dy;
        const checkKey = `${checkX},${checkY}`;
        const structure = existingStructures.get(checkKey);
        if (structure && villageStructureTypes.includes(structure.type)) {
          existingTypesNearWell.add(structure.type);
        }
      }
    }

    // Find missing structure types that haven't been placed yet
    const missingTypes = villageStructureTypes.filter(type => !existingTypesNearWell.has(type));

    if (missingTypes.length === 0) {
      return null; // All structures already placed for this village
    }

    // Select from missing types using deterministic random
    const selectedIndex = Math.floor(random * missingTypes.length);
    return missingTypes[selectedIndex] ?? null;
  }

  // Helper method to get tile type for coordinates (simplified but more accurate)
  private getTileTypeForCoords(x: number, y: number): string {
    // This is a simplified version - in a real implementation you'd call the world generator
    // For now, use basic noise-based terrain detection similar to WorldGenerator
    const worldX = x * 16;
    const worldY = y * 16;

    // Use simple noise for basic terrain detection
    const noiseX = worldX / 1000;
    const noiseY = worldY / 1000;
    const heightValue = this.villageNoise(noiseX * 2, noiseY * 2); // Reuse village noise for height
    const tempValue = this.structureNoise(noiseX * 1.5, noiseY * 1.5); // Use structure noise for temperature

    // Basic terrain rules (simplified from WorldGenerator)
    if (heightValue < 0.3) {
      return heightValue < 0.2 ? 'DEEP_WATER' : 'SHALLOW_WATER';
    }

    if (heightValue > 0.8) {
      return tempValue < 0.3 ? 'SNOW' : 'STONE';
    }

    if (heightValue > 0.7) {
      return 'COBBLESTONE';
    }

    if (tempValue > 0.7 && heightValue < 0.4) {
      return heightValue < 0.25 ? 'MUD' : 'SAND';
    }

    if (tempValue > 0.6) {
      return 'FOREST';
    }

    return 'GRASS'; // Default to grass for most areas
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

    // Generate well at center tile (only on valid terrain)
    const wellTileKey = `${centerTileX},${centerTileY}`;
    if (!existingStructures.has(wellTileKey) && !(tileOccupancyChecker?.(centerTileX, centerTileY))) {
      const centerTileType = getTileType(centerTileX, centerTileY);
      if (this.isValidPOITerrain(centerTileType)) {
        const wellPos = { x: centerTileX * 16, y: centerTileY * 16 };
        const well = this.createStructurePOI('water_well', wellPos);
        if (well) {
          structures.push(well);
          existingStructures.set(wellTileKey, well);
          console.log(`Generated well at village center tile (${centerTileX}, ${centerTileY})`);
        }
      }
    }

    // Generate markets and windmill randomly around the well (6-10 tiles away)
    const villageStructures = ['windmill_frame_0', 'food_market', 'butcher_market', 'armory_market', 'cloth_market'];
    let structuresPlaced = 0;

    // Try to place structures in a spiral pattern around the well
    for (let radius = 6; radius <= 10 && structuresPlaced < villageStructures.length; radius++) {
      const positions = this.getCirclePositions(centerTileX, centerTileY, radius);

      for (const pos of positions) {
        if (structuresPlaced >= villageStructures.length) break;

        const structureTileKey = `${pos.x},${pos.y}`;
        if (!existingStructures.has(structureTileKey) && !(tileOccupancyChecker?.(pos.x, pos.y))) {
          const structureTileType = getTileType(pos.x, pos.y);
          if (this.isValidPOITerrain(structureTileType)) {
            const structureType = villageStructures[structuresPlaced]!;
            const worldPos = { x: pos.x * 16, y: pos.y * 16 };
            const structurePOI = this.createStructurePOI(structureType, worldPos);
            if (structurePOI) {
              structures.push(structurePOI);
              existingStructures.set(structureTileKey, structurePOI);
              console.log(`Generated ${structureType} at tile (${pos.x}, ${pos.y})`);
              structuresPlaced++;
            }
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
                // Animal generated successfully
              }
            }
          } else {
            // Skip animal - insufficient space
          }
        }
      }
    }

    // Generate traders near markets (1 per village, near a random market)
    const marketTypes = ['food_market', 'butcher_market', 'armory_market', 'cloth_market'];
    if (Math.random() < 0.8) { // 80% chance to have a trader
      // Find a placed market structure near this village center
      let marketPosition: { x: number; y: number } | null = null;

      // Search for markets within 15 tiles of village center
      for (let dx = -15; dx <= 15 && !marketPosition; dx++) {
        for (let dy = -15; dy <= 15 && !marketPosition; dy++) {
          const checkX = centerTileX + dx;
          const checkY = centerTileY + dy;
          const checkKey = `${checkX},${checkY}`;
          const structure = existingStructures.get(checkKey);

          if (structure && marketTypes.includes(structure.type)) {
            marketPosition = { x: checkX, y: checkY };
          }
        }
      }

      if (marketPosition) {
        const traderPos = { x: marketPosition.x + 1, y: marketPosition.y + 1 }; // 1 tile away from market
        const traderTileKey = `${traderPos.x},${traderPos.y}`;

        if (!existingStructures.has(traderTileKey) && !(tileOccupancyChecker?.(traderPos.x, traderPos.y))) {
          const traderTileType = getTileType(traderPos.x, traderPos.y);
          if (this.isValidNPCTerrain(traderTileType)) {
            const worldPos = { x: traderPos.x * 16, y: traderPos.y * 16 };
            const trader = this.createTraderNPC('trader', worldPos);
            if (trader) {
              structures.push(trader);
              existingStructures.set(traderTileKey, trader);
              // Trader generated successfully
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

    // BACK TO NORMAL: Original threshold for wild animals
    if (animalValue < 0.85) { // Changed back from 0.3 to 0.85
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
      console.log(`🐾 Generated wild ${animalType} at tile (${tileX}, ${tileY})`);
    }

    return animal;
  }

  private generateMonster(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>,
    tileType: string
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

    // BACK TO NORMAL: Original threshold for monsters
    if (monsterValue < 0.98) { // Changed back from 0.7 to 0.98
      return null;
    }

    // Add back the additional randomness check
    if (Math.random() > 0.2) {
      return null;
    }

    // Select monster type based on biome
    let monsterType: string;
    if (tileType === 'MUD') {
      // Slimes only spawn in mud biomes
      monsterType = Math.random() < 0.2 ? 'mega_slime_blue' : 'slime'; // 20% chance for mega slime, 80% for regular slime
    } else {
      // Other monsters spawn in FOREST, STONE, GRAVEL
      const otherMonsters = ['archer_goblin', 'club_goblin', 'farmer_goblin', 'orc', 'orc_shaman', 'spear_goblin'];
      monsterType = otherMonsters[Math.floor(Math.random() * otherMonsters.length)]!;
    }

    const worldPos = { x: worldX, y: worldY };
    const monster = this.createMonsterNPC(monsterType, worldPos);

    if (monster) {
      existingStructures.set(tileKey, monster);
      console.log(`👹 Generated wild ${monsterType} at tile (${tileX}, ${tileY}) on ${tileType}`);
    }

    return monster;
  }

  private createStructurePOI(type: string, position: Position, villageName?: string): VillageStructure | null {
    try {
      const customData: Record<string, unknown> = {};

      if (villageName) {
        customData.villageName = villageName;

        // For notice boards, also add the title and text content
        if (type === 'notice_board') {
          customData.noticeTitle = `${villageName} Notice Board`;
          customData.noticeText = this.generateNoticeText(villageName);
        }
      }

      const poi = new POI({
        type,
        position,
        interactable: true,
        passable: type.includes('entrance'),
        animated: type === 'windmill_frame_0',
        customData
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
        type: type as 'orc' | 'skeleton' | 'goblin' | 'archer_goblin' | 'club_goblin' | 'farmer_goblin' | 'orc_shaman' | 'spear_goblin' | 'mega_slime_blue' | 'slime',
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
    console.log(`🏪 Creating trader NPC of type ${type} at position (${position.x}, ${position.y})`);
    try {
      const npc = new NPC({
        type: type as 'trader' | 'axeman_trader' | 'swordsman_trader' | 'spearman_trader' | 'farmer_trader',
        position,
        aggressive: false
      });

      console.log(`✅ Successfully created ${type} NPC at (${position.x}, ${position.y})`);
      return {
        type,
        position,
        npc
      };
    } catch (error) {
      console.error(`❌ Failed to create trader NPC ${type}:`, error);
      return null;
    }
  }

  private generateVillageTraders(
    centerTileX: number,
    centerTileY: number,
    villageName: string,
    existingStructures: Map<string, VillageStructure>,
    structures: VillageStructure[],
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): void {
    console.log(`🏪 Starting trader generation for village: ${villageName} at center (${centerTileX}, ${centerTileY})`);
    const traderTypes = ['axeman_trader', 'swordsman_trader', 'spearman_trader', 'farmer_trader'];
    let tradersPlaced = 0;
    const maxTraders = 5;

    // Search for suitable tiles around the village well (5-20 tiles away)
    const maxDistance = 20;
    const minDistance = 5;

    // Create array of potential positions around the well
    const potentialPositions: { x: number; y: number; distance: number }[] = [];

    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      for (let dy = -maxDistance; dy <= maxDistance; dy++) {
        const distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance

        // Only consider tiles within the valid distance range
        if (distance >= minDistance && distance <= maxDistance) {
          const tileX = centerTileX + dx;
          const tileY = centerTileY + dy;
          potentialPositions.push({ x: tileX, y: tileY, distance });
        }
      }
    }

    // Sort by distance (prefer closer positions to well)
    potentialPositions.sort((a, b) => a.distance - b.distance);

    let tilesChecked = 0;
    let occupiedCount = 0;
    let badTerrainCount = 0;
    let badSpacingCount = 0;
    let insufficientSpaceCount = 0;

    // Try to place traders on suitable tiles
    for (const pos of potentialPositions) {
      if (tradersPlaced >= maxTraders) break;
      tilesChecked++;

      const tileKey = `${pos.x},${pos.y}`;

      // CRITICAL: Never place traders on the well center tile
      if (pos.x === centerTileX && pos.y === centerTileY) {
        occupiedCount++;
        console.log(`🚫 Tile (${pos.x}, ${pos.y}) blocked - this is the village well center tile`);
        continue; // Skip the well tile entirely
      }

      // Check if tile already has a structure in our existing structures map
      if (existingStructures.has(tileKey)) {
        occupiedCount++;
        continue; // Skip tiles that already have structures
      }

      // For traders, check for impassable POIs (like wells) and living NPCs specifically
      // Don't use the overly restrictive tileOccupancyChecker that marks trees/etc as occupied
      let isActuallyOccupied = false;

      // Check if there's an existing structure at this exact tile that would block trader placement
      const existingStructure = existingStructures.get(tileKey);
      if (existingStructure) {
        // Check if it's an impassable POI (like wells, markets, windmills) or an NPC
        if (existingStructure.poi && !existingStructure.poi.passable) {
          isActuallyOccupied = true; // Impassable POI blocks placement (wells, markets, etc.)
          console.log(`🚫 Tile (${pos.x}, ${pos.y}) blocked by impassable POI: ${existingStructure.type}`);
        } else if (existingStructure.npc && !existingStructure.npc.isDead()) {
          isActuallyOccupied = true; // Living NPC blocks placement
          console.log(`🚫 Tile (${pos.x}, ${pos.y}) blocked by living NPC: ${existingStructure.type}`);
        }
      }

      // Also check with tileOccupancyChecker but only for critical blocking entities
      // This should catch wells and other POIs that might not be in existingStructures yet
      if (!isActuallyOccupied && tileOccupancyChecker) {
        const isBlockedByChecker = tileOccupancyChecker(pos.x, pos.y);
        if (isBlockedByChecker) {
          // Only treat as occupied if it's truly impassable (like wells)
          // But be permissive about trees and other passable obstacles for traders
          isActuallyOccupied = true;
          console.log(`🚫 Tile (${pos.x}, ${pos.y}) blocked by tile occupancy checker (likely well or important POI)`);
        }
      }

      if (isActuallyOccupied) {
        occupiedCount++;
        continue; // Skip truly occupied tiles
      }

      // Use a more permissive terrain check - get actual tile type from world generation
      // instead of the unreliable getTileTypeForCoords method
      let tileType: string;
      try {
        // Try to get the actual tile type - this should use the world generator's actual method
        // For now, be very permissive about terrain
        tileType = this.getTileTypeForCoords(pos.x, pos.y);

        // Be much more permissive - traders can spawn on more terrain types than animals
        // Focus on allowing GRASS tiles specifically
        const isValidTerrain = tileType === 'GRASS' || tileType === 'DIRT' || tileType === 'FOREST' ||
                              tileType === 'MUD' || tileType === 'CLAY' || tileType === 'GRAVEL' ||
                              tileType === 'SAND' || tileType === 'RIVER' || tileType === 'SHALLOW_WATER';

        if (!isValidTerrain) {
          badTerrainCount++;
          continue; // Skip unsuitable terrain
        }
      } catch (error) {
        // If terrain detection fails, assume it's valid (GRASS)
        console.warn(`Failed to get terrain for tile (${pos.x}, ${pos.y}), assuming GRASS`);
        tileType = 'GRASS';
      }

      // Use a more permissive spacing check
      if (!this.hasAdequateTraderSpacingPermissive(pos.x, pos.y, existingStructures, tileOccupancyChecker)) {
        badSpacingCount++;
        continue; // Skip if too close to other NPCs
      }

      // Use a more permissive adjacent space check
      if (!this.hasMinimalAdjacentSpace(pos.x, pos.y, existingStructures, tileOccupancyChecker)) {
        insufficientSpaceCount++;
        continue; // Skip if insufficient movement space
      }

      // Select random trader type
      const traderType = traderTypes[Math.floor(Math.random() * traderTypes.length)]!;
      const worldPos = { x: pos.x * 16, y: pos.y * 16 };

      console.log(`🏪 Attempting to create ${traderType} at tile (${pos.x}, ${pos.y}) with terrain ${tileType}`);
      const trader = this.createTraderNPC(traderType, worldPos);

      if (trader) {
        structures.push(trader);
        existingStructures.set(tileKey, trader);
        tradersPlaced++;
        console.log(`✅ Generated ${traderType} at tile (${pos.x}, ${pos.y}) for village: ${villageName} on ${tileType} (distance: ${pos.distance})`);
      } else {
        console.warn(`❌ Failed to create trader NPC ${traderType} at (${pos.x}, ${pos.y})`);
      }
    }

    console.log(`🏪 Finished trader generation for ${villageName}: ${tradersPlaced}/5 traders placed`);
    console.log(`📊 Trader generation stats: ${tilesChecked} tiles checked, ${occupiedCount} occupied, ${badTerrainCount} bad terrain, ${badSpacingCount} bad spacing, ${insufficientSpaceCount} insufficient space`);
  }

  // More permissive spacing check for traders
  private hasAdequateTraderSpacingPermissive(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>,
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): boolean {
    const tileKey = `${tileX},${tileY}`;

    // Don't place if tile already has structure
    if (existingStructures.has(tileKey)) {
      return false;
    }

    // Only check immediately adjacent tiles (not diagonal, more permissive than before)
    const adjacentTiles = [
      { x: tileX + 1, y: tileY },     // right
      { x: tileX - 1, y: tileY },     // left
      { x: tileX, y: tileY + 1 },     // down
      { x: tileX, y: tileY - 1 }      // up
    ];

    // Check if any immediately adjacent tile has an NPC (to avoid direct overlapping)
    for (const adjacentTile of adjacentTiles) {
      const adjacentKey = `${adjacentTile.x},${adjacentTile.y}`;
      const existingStructure = existingStructures.get(adjacentKey);
      if (existingStructure?.npc) {
        return false; // Too close to another NPC
      }
    }

    return true; // More permissive - just avoid immediate adjacent NPCs
  }

  // Minimal adjacent space check for traders
  private hasMinimalAdjacentSpace(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>,
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): boolean {
    const tileKey = `${tileX},${tileY}`;

    // Don't place if tile already has structure
    if (existingStructures.has(tileKey)) {
      return false;
    }

    // For traders, we're very permissive about adjacent space
    // Don't use the restrictive tileOccupancyChecker - just ensure no immediate NPC conflicts
    const adjacentTiles = [
      { x: tileX + 1, y: tileY },     // right
      { x: tileX - 1, y: tileY },     // left
      { x: tileX, y: tileY + 1 },     // down
      { x: tileX, y: tileY - 1 }      // up
    ];

    // Just check that not ALL adjacent tiles have NPCs
    let npcAdjacentCount = 0;
    for (const adjacentTile of adjacentTiles) {
      const adjacentKey = `${adjacentTile.x},${adjacentTile.y}`;
      const existingStructure = existingStructures.get(adjacentKey);
      if (existingStructure?.npc) {
        npcAdjacentCount++;
      }
    }

    // Allow placement even if surrounded by structures, just not if completely surrounded by NPCs
    return npcAdjacentCount < 4; // Allow placement unless completely surrounded by NPCs
  }

  private generateDungeonMonsters(
    dungeonTileX: number,
    dungeonTileY: number,
    existingStructures: Map<string, VillageStructure>,
    structures: VillageStructure[],
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): void {
    const monsterTypes = ['archer_goblin', 'club_goblin', 'farmer_goblin', 'orc', 'orc_shaman', 'spear_goblin', 'mega_slime_blue', 'slime'];
    let monstersPlaced = 0;
    const maxMonsters = 5;

    // Try to place 5 monsters around the dungeon entrance (3-8 tiles away)
    for (let attempts = 0; attempts < 50 && monstersPlaced < maxMonsters; attempts++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = 3 + Math.random() * 5; // 3-8 tiles from dungeon
      const monsterX = Math.round(dungeonTileX + Math.cos(angle) * distance);
      const monsterY = Math.round(dungeonTileY + Math.sin(angle) * distance);

      const tileKey = `${monsterX},${monsterY}`;
      if (!existingStructures.has(tileKey) &&
          !(tileOccupancyChecker?.(monsterX, monsterY)) &&
          this.hasAdequateNPCSpacing(monsterX, monsterY, existingStructures, tileOccupancyChecker)) {

        // Select random monster type
        const monsterType = monsterTypes[Math.floor(Math.random() * monsterTypes.length)]!;
        const worldPos = { x: monsterX * 16, y: monsterY * 16 };
        const monster = this.createMonsterNPC(monsterType, worldPos);

        if (monster) {
          structures.push(monster);
          existingStructures.set(tileKey, monster);
          monstersPlaced++;
          console.log(`Generated ${monsterType} at tile (${monsterX}, ${monsterY}) near dungeon (${dungeonTileX}, ${dungeonTileY})`);
        }
      }
    }

    console.log(`✅ Generated ${monstersPlaced}/5 monsters near dungeon at (${dungeonTileX}, ${dungeonTileY})`);
  }

  private hasAdequateNPCSpacing(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>,
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): boolean {
    const minSpacingRadius = 2; // Require 2-tile minimum spacing between NPCs

    // Check all tiles within the spacing radius
    for (let dx = -minSpacingRadius; dx <= minSpacingRadius; dx++) {
      for (let dy = -minSpacingRadius; dy <= minSpacingRadius; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip the center tile

        const checkX = tileX + dx;
        const checkY = tileY + dy;
        const checkKey = `${checkX},${checkY}`;

        // Check if there's already an NPC at this location
        const existingStructure = existingStructures.get(checkKey);
        if (existingStructure?.npc) {
          return false; // Too close to another NPC
        }

        // Also check via occupancy checker for NPCs
        if (tileOccupancyChecker?.(checkX, checkY)) {
          const distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance
          if (distance <= 1) { // Immediately adjacent tiles must be free
            return false;
          }
        }
      }
    }

    return true;
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
    // POI structures (windmills, markets) cannot be placed on water, stone, cobblestone, or snow
    return tileType !== 'DEEP_WATER' && tileType !== 'SHALLOW_WATER' && tileType !== 'STONE' && tileType !== 'COBBLESTONE' && tileType !== 'SNOW';
  }

  private isValidNPCTerrain(tileType: string): boolean {
    // NPCs cannot be placed on deep water, stone, cobblestone, snow, or shallow water
    return tileType !== 'DEEP_WATER' && tileType !== 'STONE' && tileType !== 'COBBLESTONE' && tileType !== 'SNOW' && tileType !== 'SHALLOW_WATER';
  }

  private checkForVillageAnimalPlacement(
    tileX: number,
    tileY: number,
    tileType: string,
    existingStructures: Map<string, VillageStructure>,
    structures: VillageStructure[]
  ): void {
    // Check if this tile is within 12-15 tiles from any village center (well)
    // Animals should be placed further out than POI structures to avoid conflicts
    const maxDistance = 15;
    const minDistance = 12;

    // Search for nearby wells within reasonable distance
    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      for (let dy = -maxDistance; dy <= maxDistance; dy++) {
        const wellX = tileX + dx;
        const wellY = tileY + dy;
        const wellKey = `${wellX},${wellY}`;
        const wellStructure = existingStructures.get(wellKey);

        if (wellStructure && wellStructure.type === 'water_well') {
          const distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance

          // Only place animals within the valid distance range and appropriate terrain
          if (distance >= minDistance && distance <= maxDistance && this.isValidNPCTerrain(tileType)) {
            // Check if this position has enough adjacent passable space
            if (this.hasAdjacentPassableSpace(tileX, tileY, existingStructures)) {
              // Use deterministic random to decide if animal should spawn here (15% chance)
              const seed = tileX * 31 + tileY * 37 + wellX * 13 + wellY * 17;
              const random = Math.abs(Math.sin(seed)) % 1;

              if (random < 0.15) { // 15% chance to spawn animal (reduced from 30%)
                // Use species grouping logic for animal selection
                const animalType = this.selectAnimalTypeWithGrouping(tileX, tileY, existingStructures);

                if (animalType) {
                  const animalPos = { x: tileX * 16, y: tileY * 16 };
                  const animal = this.createAnimalNPC(animalType, animalPos);
                  if (animal) {
                    structures.push(animal);
                    existingStructures.set(`${tileX},${tileY}`, animal);
                    console.log(`🏘️ Generated village ${animalType} at tile (${tileX}, ${tileY}) for village centered at well (${wellX}, ${wellY}) with species grouping`);
                    return; // Only place one animal per tile
                  } else {
                    console.warn(`❌ Failed to create village animal ${animalType} at tile (${tileX}, ${tileY})`);
                  }
                } else {
                  console.log(`❌ No animal type selected for village animal at tile (${tileX}, ${tileY})`);
                }
              } else {
                console.log(`🎲 Village animal spawn chance failed at tile (${tileX}, ${tileY}) - random: ${random.toFixed(3)}`);
              }
            } else {
              console.log(`❌ Village animal has insufficient adjacent passable space at tile (${tileX}, ${tileY})`);
            }
          }
        }
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
          return false; // Too close to another animal
        }

        // Also check via occupancy checker for NPCs
        if (tileOccupancyChecker?.(checkX, checkY)) {
          // We need to be more specific about what type of occupancy this is
          // For now, we'll be conservative and avoid any occupied tiles nearby
          const distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance
          if (distance <= 1) { // Immediately adjacent tiles must be free
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
        if (this.isValidNPCTerrain(tileType)) {
          passableCount++;
        }
      }
    }

    if (passableCount < 3) {
      return false;
    }

    return true;
  }

  // Keep the old method for backward compatibility but make it less strict than before
  private hasAdjacentPassableSpace(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>,
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): boolean {
    const tileKey = `${tileX},${tileY}`;

    // Don't place if tile already has structure
    if (existingStructures.has(tileKey)) {
      return false;
    }

    // Simple check: just ensure the tile isn't obviously blocked
    // Don't use the overly restrictive occupancy checker
    return true;
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
        // Applying grouping bonus for nearby animals
      } else {
        // Add single entry for types without nearby animals
        weightedTypes.push(animalType);
      }
    }

    // Select randomly from weighted list
    const selectedType = weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
    return selectedType ?? animalTypes[0]!
  }

  // New method to check POI structure spacing
  private hasAdequatePOISpacing(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>
  ): boolean {
    const minSpacingRadius = 2; // Require 2-tile minimum spacing between POI structures
    const poiStructureTypes = ['water_well', 'windmill_frame_0', 'food_market', 'butcher_market', 'armory_market', 'cloth_market', 'notice_board'];

    // Check all tiles within the spacing radius
    for (let dx = -minSpacingRadius; dx <= minSpacingRadius; dx++) {
      for (let dy = -minSpacingRadius; dy <= minSpacingRadius; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip the center tile

        const checkX = tileX + dx;
        const checkY = tileY + dy;
        const checkKey = `${checkX},${checkY}`;

        // Check if there's already a POI structure at this location
        const existingStructure = existingStructures.get(checkKey);
        if (existingStructure?.poi && poiStructureTypes.includes(existingStructure.type)) {
          return false; // Too close to another POI structure
        }
      }
    }

    return true; // Adequate spacing found
  }

  private generateVillageName(villageGridX: number, villageGridY: number): string {
    const villageKey = `village_${villageGridX}_${villageGridY}`;

    // Return cached name if already generated
    if (this.villageNamesCache.has(villageKey)) {
      return this.villageNamesCache.get(villageKey)!;
    }

    // Generate completely random name using random selection from prefixes and suffixes
    const prefixIndex = Math.floor(Math.random() * this.VILLAGE_NAME_PREFIXES.length);
    const suffixIndex = Math.floor(Math.random() * this.VILLAGE_NAME_SUFFIXES.length);

    const prefix = this.VILLAGE_NAME_PREFIXES[prefixIndex] ?? 'Sunny';
    const suffix = this.VILLAGE_NAME_SUFFIXES[suffixIndex] ?? 'ville';

    const villageName = `${prefix}${suffix}`;
    this.villageNamesCache.set(villageKey, villageName);

    return villageName;
  }

  private generateNoticeText(villageName: string): string {
    const welcomeMessages = [
      `Welcome to ${villageName}!`,
      `Greetings, traveler! You have arrived at ${villageName}.`,
      `${villageName} welcomes you, adventurer!`,
      `You've discovered the peaceful village of ${villageName}.`
    ];

    const villageInfo = [
      'This village is home to friendly animals and hardworking villagers.',
      'Our markets offer fresh goods and supplies for your journey.',
      'The windmill provides grain for the whole community.',
      'Feel free to explore and meet our animal friends!',
      'The village well provides clean water for all residents.',
      'Trade with our merchants to stock up on supplies.',
      'Our community has thrived here for many generations.'
    ];

    // Use deterministic random based on village name
    const nameHash = villageName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const welcomeIndex = nameHash % welcomeMessages.length;
    const infoIndex = (nameHash * 7) % villageInfo.length;

    const selectedWelcome = welcomeMessages[welcomeIndex] ?? welcomeMessages[0]!;
    const selectedInfo = villageInfo[infoIndex] ?? villageInfo[0]!;

    return `${selectedWelcome}\n\n${selectedInfo}\n\nPress any key to continue...`;
  }

  private hasAdequateTraderSpacing(
    tileX: number,
    tileY: number,
    existingStructures: Map<string, VillageStructure>,
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): boolean {
    const tileKey = `${tileX},${tileY}`;

    // Don't place if tile already has structure
    if (existingStructures.has(tileKey)) {
      return false;
    }

    // Check for 2-tile minimum spacing from other NPCs (similar to animals)
    const minSpacingRadius = 2;

    for (let dx = -minSpacingRadius; dx <= minSpacingRadius; dx++) {
      for (let dy = -minSpacingRadius; dy <= minSpacingRadius; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip the center tile

        const checkX = tileX + dx;
        const checkY = tileY + dy;
        const checkKey = `${checkX},${checkY}`;

        // Check if there's already an NPC at this location
        const existingStructure = existingStructures.get(checkKey);
        if (existingStructure?.npc) {
          return false; // Too close to another NPC
        }

        // Also check via occupancy checker for NPCs in adjacent tiles
        if (tileOccupancyChecker?.(checkX, checkY)) {
          const distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance
          if (distance <= 1) { // Immediately adjacent tiles must be free
            return false;
          }
        }
      }
    }

    // Ensure at least 3 adjacent tiles are passable for movement (like animals)
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
        if (this.isValidTraderTerrain(tileType)) {
          passableCount++;
        }
      }
    }

    // Need at least 3 adjacent passable tiles for good movement
    return passableCount >= 3;
  }

  // Helper method to find unoccupied tiles in a radius with proper occupancy checking
  private findUnoccupiedTilesInRadius(
    centerX: number,
    centerY: number,
    radius: number,
    existingStructures: Map<string, VillageStructure>,
    tileOccupancyChecker?: (x: number, y: number) => boolean
  ): { x: number; y: number }[] {
    const tiles: { x: number; y: number }[] = [];

    // Check tiles in a circle pattern at this radius
    for (let angle = 0; angle < 360; angle += 15) { // Every 15 degrees
      const radians = (angle * Math.PI) / 180;
      const x = Math.round(centerX + radius * Math.cos(radians));
      const y = Math.round(centerY + radius * Math.sin(radians));
      const tileKey = `${x},${y}`;

      // Check if tile is unoccupied using both structure map and occupancy checker
      if (!existingStructures.has(tileKey) && !(tileOccupancyChecker?.(x, y))) {
        tiles.push({ x, y });
      }
    }

    return tiles;
  }

  // Special terrain validation for traders (less strict than normal NPCs)
  private isValidTraderTerrain(tileType: string): boolean {
    // Traders can be placed on more terrain types than animals
    // They can handle SHALLOW_WATER (representing beaches/docks) and MUD
    return tileType !== 'DEEP_WATER' && tileType !== 'STONE' && tileType !== 'COBBLESTONE' && tileType !== 'SNOW';
  }
}