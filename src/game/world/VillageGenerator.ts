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

        for (let i = 0; i < numStructures; i++) {
          const structureType = structureTypes[Math.floor(Math.random() * structureTypes.length)]!;
          let placed = false;
          let attempts = 0;
          const maxAttempts = 20;

          while (!placed && attempts < maxAttempts) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = 6 + Math.random() * 4; // 6-10 tiles from center
            const structX = Math.round(tileX + Math.cos(angle) * distance);
            const structY = Math.round(tileY + Math.sin(angle) * distance);

            if (tileOccupancyChecker && !tileOccupancyChecker(structX, structY) &&
                this.hasAdequatePOISpacing(structX, structY, existingStructures)) {

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
              placed = true;
            }
            attempts++;
          }
        }



        // DON'T generate the complete village here - it will be generated tile-by-tile
        // This prevents conflicts and ensures proper tile occupancy checking
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
      // Wild animal generated successfully
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
              // Use deterministic random to decide if animal should spawn here (30% chance)
              const seed = tileX * 31 + tileY * 37 + wellX * 13 + wellY * 17;
              const random = Math.abs(Math.sin(seed)) % 1;

              if (random < 0.3) { // 30% chance to spawn animal
                // Use species grouping logic for animal selection
                const animalType = this.selectAnimalTypeWithGrouping(tileX, tileY, existingStructures);

                if (animalType) {
                  const animalPos = { x: tileX * 16, y: tileY * 16 };
                  const animal = this.createAnimalNPC(animalType, animalPos);
                  if (animal) {
                    structures.push(animal);
                    existingStructures.set(`${tileX},${tileY}`, animal);
                    console.log(`Generated village ${animalType} at tile (${tileX}, ${tileY}) for village centered at well (${wellX}, ${wellY}) with species grouping`);
                    return; // Only place one animal per tile
                  }
                }
              }
            } else {
              // Skip animal - insufficient movement space
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

    // Generate deterministic name based on grid coordinates
    const seed = villageGridX * 31 + villageGridY * 37;
    const prefixIndex = Math.floor(Math.abs(Math.sin(seed)) * this.VILLAGE_NAME_PREFIXES.length);
    const suffixIndex = Math.floor(Math.abs(Math.sin(seed + 1)) * this.VILLAGE_NAME_SUFFIXES.length);

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
}