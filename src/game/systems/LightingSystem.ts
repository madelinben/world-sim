import type { Position, Tile } from '../engine/types';
import { LIGHT_LEVELS, DAY_NIGHT_CYCLE, MONSTER_SPAWN_THRESHOLDS } from '../engine/types';
import type { Camera } from './Camera';

export class LightingSystem {
  private gameStartTime: number;
  private torchPositions = new Map<string, { x: number; y: number }>(); // Track torch positions for light calculations
  private portalPositions = new Map<string, { x: number; y: number }>(); // Track portal positions for light calculations
  private lastDebugTime = 0; // For debug logging timing
  private tileProvider: ((x: number, y: number, mode: 'world' | 'dungeon' | 'mine') => Tile | null) | null = null;

  constructor() {
    this.gameStartTime = Date.now();
  }

  /**
   * Set the tile provider callback to access tiles from the appropriate world system
   */
  public setTileProvider(provider: (x: number, y: number, mode: 'world' | 'dungeon' | 'mine') => Tile | null): void {
    this.tileProvider = provider;
  }

  /**
   * Calculate the current world light level based on day/night cycle
   */
  public getWorldLightLevel(): number {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - this.gameStartTime) % DAY_NIGHT_CYCLE.TOTAL_CYCLE;

    if (elapsedTime < DAY_NIGHT_CYCLE.DAY_DURATION) {
      // Daytime - full light
      return 1.0;
    } else {
      // Nighttime - reduced light
      const nightProgress = (elapsedTime - DAY_NIGHT_CYCLE.DAY_DURATION) / DAY_NIGHT_CYCLE.NIGHT_DURATION;
      const nightDarkness = Math.sin(nightProgress * Math.PI) * DAY_NIGHT_CYCLE.NIGHT_DARKNESS;
      return Math.max(0.2, 1.0 - nightDarkness); // Minimum 20% light during darkest night
    }
  }

  /**
   * Calculate effective light level for a tile including torch effects
   */
  public calculateEffectiveLightLevel(tile: Tile, renderingMode: 'world' | 'dungeon' | 'mine'): number {
    let baseLightLevel: number;

    // Determine base light level based on environment
    switch (renderingMode) {
      case 'world':
        baseLightLevel = this.getWorldLightLevel();
        break;
      case 'mine':
        baseLightLevel = LIGHT_LEVELS.MINE;
        break;
      case 'dungeon':
        baseLightLevel = LIGHT_LEVELS.DUNGEON;
        break;
      default:
        baseLightLevel = 1.0;
    }

    // Apply torch lighting effects
    const torchBonus = this.calculateTorchLightBonus(tile.x, tile.y);
    const effectiveLight = Math.min(1.0, baseLightLevel + torchBonus);

    return effectiveLight;
  }

  /**
   * Calculate light bonus from nearby torches and portals
   */
  private calculateTorchLightBonus(tileX: number, tileY: number): number {
    let maxLightBonus = 0;

    // Check torch light sources
    for (const [torchKey, torchPos] of this.torchPositions) {
      const distance = Math.sqrt(
        Math.pow(tileX - torchPos.x, 2) +
        Math.pow(tileY - torchPos.y, 2)
      );

      if (distance <= LIGHT_LEVELS.TORCH_RADIUS) {
        // Calculate light falloff - closer tiles get more light
        const falloff = Math.max(0, 1.0 - (distance / LIGHT_LEVELS.TORCH_RADIUS));
        // Use full intensity for maximum light reduction
        const torchBonus = LIGHT_LEVELS.TORCH_INTENSITY * falloff;
        maxLightBonus = Math.max(maxLightBonus, torchBonus);
      }
    }

    // Check portal light sources (same radius and intensity as torches)
    for (const [portalKey, portalPos] of this.portalPositions) {
      const distance = Math.sqrt(
        Math.pow(tileX - portalPos.x, 2) +
        Math.pow(tileY - portalPos.y, 2)
      );

      if (distance <= LIGHT_LEVELS.TORCH_RADIUS) {
        // Calculate light falloff - closer tiles get more light
        const falloff = Math.max(0, 1.0 - (distance / LIGHT_LEVELS.TORCH_RADIUS));
        // Use full intensity for maximum light reduction
        const portalBonus = LIGHT_LEVELS.TORCH_INTENSITY * falloff;
        maxLightBonus = Math.max(maxLightBonus, portalBonus);
      }
    }

    return maxLightBonus;
  }

  /**
   * Register a torch position for light calculations
   */
  public addTorch(tileX: number, tileY: number): void {
    const torchKey = `${tileX},${tileY}`;
    this.torchPositions.set(torchKey, { x: tileX, y: tileY }); // Store as tile coordinates
    console.log(`🔥 Registered torch light source at tile (${tileX}, ${tileY})`);
  }

  /**
   * Remove a torch position
   */
  public removeTorch(tileX: number, tileY: number): void {
    const torchKey = `${tileX},${tileY}`;
    this.torchPositions.delete(torchKey);
  }

  /**
   * Clear all torch positions (useful when changing environments)
   */
  public clearTorches(): void {
    const previousCount = this.torchPositions.size;
    this.torchPositions.clear();
    console.log(`🧹 Cleared ${previousCount} torch positions from lighting system`);
  }

  /**
   * Register a portal position for light calculations
   */
  public addPortal(tileX: number, tileY: number): void {
    const portalKey = `${tileX},${tileY}`;
    this.portalPositions.set(portalKey, { x: tileX, y: tileY }); // Store as tile coordinates
    console.log(`✨ Registered portal light source at tile (${tileX}, ${tileY}) - Total portals: ${this.portalPositions.size}`);
  }

  /**
   * Remove a portal position
   */
  public removePortal(tileX: number, tileY: number): void {
    const portalKey = `${tileX},${tileY}`;
    this.portalPositions.delete(portalKey);
  }

  /**
   * Clear all portal positions (useful when changing dungeons)
   */
  public clearPortals(): void {
    const previousCount = this.portalPositions.size;
    this.portalPositions.clear();
    console.log(`🧹 Cleared ${previousCount} portal positions from lighting system`);
  }

  /**
   * Debug method to list all registered portals
   */
  public listPortals(): void {
    console.log(`🔍 Currently registered portals (${this.portalPositions.size}):`);
    for (const [key, pos] of this.portalPositions) {
      console.log(`  - Portal at tile (${pos.x}, ${pos.y})`);
    }
  }

  /**
   * Calculate monster spawn chance based on light level
   */
  public getMonsterSpawnChance(lightLevel: number): number {
    // Higher spawn chance in darker areas
    const darkness = 1.0 - lightLevel;
    return darkness * MONSTER_SPAWN_THRESHOLDS.SPAWN_CHANCE_MULTIPLIER;
  }

  /**
   * Check if monsters can spawn based on light level and noise
   */
  public static canSpawnMonster(lightLevel: number, monsterNoise: number, noiseThreshold = 0.7): boolean {
    // Don't spawn monsters in bright areas (light level above 0.3)
    if (lightLevel > MONSTER_SPAWN_THRESHOLDS.MIN_LIGHT_FOR_NO_SPAWN) {
      return false;
    }

    // Only spawn monsters in dark areas (light level 0.0 - 0.3)
    // This includes dungeons (0.0), very dark mines, and nighttime world
    if (lightLevel <= MONSTER_SPAWN_THRESHOLDS.MIN_LIGHT_FOR_NO_SPAWN) {
      // Check perlin noise threshold for spawn location
      return Math.abs(monsterNoise) > noiseThreshold;
    }

    // This condition should never be reached with the current logic, but kept for safety
    return false;
  }

  /**
   * Calculate effective light level including torch/portal effects
   */
  public calculateTileEffectiveLight(tile: Tile, renderingMode: 'world' | 'dungeon' | 'mine'): number {
    // Use existing effectiveLightLevel if available, otherwise calculate
    if (tile.effectiveLightLevel !== undefined) {
      return tile.effectiveLightLevel;
    }

    return this.calculateEffectiveLightLevel(tile, renderingMode);
  }

  /**
   * Render darkness overlay based on light level
   */
  public renderDarknessOverlay(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    renderingMode: 'world' | 'dungeon' | 'mine'
  ): void {
    if (renderingMode === 'world') {
      const worldLight = this.getWorldLightLevel();
      const darkness = 1.0 - worldLight;
      const opacity = Math.min(DAY_NIGHT_CYCLE.NIGHT_DARKNESS, darkness);

      if (opacity > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        ctx.fillRect(0, 0, camera.viewWidth, camera.viewHeight);
      }
    } else if (renderingMode === 'mine' || renderingMode === 'dungeon') {
      // Apply tile-by-tile darkness based on effective light levels
      this.renderTileBasedDarkness(ctx, camera, renderingMode);
    }
  }

  /**
   * Render tile-based darkness for underground areas
   */
  private renderTileBasedDarkness(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    renderingMode: 'mine' | 'dungeon'
  ): void {
    const startTileX = Math.floor(camera.position.x / 16);
    const endTileX = Math.ceil((camera.position.x + camera.viewWidth) / 16);
    const startTileY = Math.floor(camera.position.y / 16);
    const endTileY = Math.ceil((camera.position.y + camera.viewHeight) / 16);

    // Debug logging for portals (only once every 3 seconds)
    const now = Date.now();
    if (renderingMode === 'dungeon' && now - this.lastDebugTime > 3000) {
      console.log(`🔍 Dungeon lighting debug - Total portals: ${this.portalPositions.size}, Total torches: ${this.torchPositions.size}`);
      if (this.portalPositions.size > 0) {
        for (const [key, pos] of this.portalPositions) {
          console.log(`  - Portal at tile (${pos.x}, ${pos.y})`);
        }
      }
      this.lastDebugTime = now;
    }

    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        // Check if this tile contains a light source (torch or portal)
        const isLightSourceTile = this.tileContainsLightSource(tileX, tileY);

        let darknessOpacity = 0;

        if (isLightSourceTile) {
          // Light source tiles have no darkness overlay (full brightness)
          darknessOpacity = 0;
        } else {
          // Calculate light influence from nearby torches and portals
          const lightBonus = this.calculateTorchLightBonus(tileX, tileY);

          // Base darkness levels: dungeons = 0.8, mines = 0.3
          const baseDarkness = renderingMode === 'dungeon' ? 0.8 : 0.3;

          // Reduce darkness based on light sources (lightBonus reduces darkness)
          darknessOpacity = Math.max(0, baseDarkness - lightBonus);
        }

        // Apply darkness overlay if needed
        if (darknessOpacity > 0) {
          // Use the same coordinate transformation as tile rendering
          const screenPos = camera.worldToScreen(tileX * 16, tileY * 16);
          const x = screenPos.x - (16 / 2);
          const y = screenPos.y - (16 / 2);

          ctx.fillStyle = `rgba(0, 0, 0, ${darknessOpacity})`;
          ctx.fillRect(x, y, 16, 16);
        }
      }
    }
  }

  /**
   * Check if a tile contains a light source (torch or portal)
   */
  private tileContainsLightSource(tileX: number, tileY: number): boolean {
    const torchKey = `${tileX},${tileY}`;
    const portalKey = `${tileX},${tileY}`;

    return this.torchPositions.has(torchKey) || this.portalPositions.has(portalKey);
  }

  /**
   * Update the lighting system
   */
  public update(deltaTime: number): void {
    // Update torch positions if needed
    // This method can be extended for dynamic lighting effects
  }

  /**
   * Get current time of day for UI display
   */
  public getTimeOfDay(): { phase: 'day' | 'night'; progress: number } {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - this.gameStartTime) % DAY_NIGHT_CYCLE.TOTAL_CYCLE;

    if (elapsedTime < DAY_NIGHT_CYCLE.DAY_DURATION) {
      return {
        phase: 'day',
        progress: elapsedTime / DAY_NIGHT_CYCLE.DAY_DURATION
      };
    } else {
      return {
        phase: 'night',
        progress: (elapsedTime - DAY_NIGHT_CYCLE.DAY_DURATION) / DAY_NIGHT_CYCLE.NIGHT_DURATION
      };
    }
  }
}