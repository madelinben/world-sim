export interface Position {
    x: number;
    y: number;
}

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
  | 'PLAYER'
  | 'VOID'
  | 'WOOD';

// Forward declarations to avoid circular dependencies
export interface POILike {
    type: string;
    position: Position;
    passable: boolean;
    customData?: Record<string, unknown>;
    render?(ctx: CanvasRenderingContext2D, x: number, y: number): void;
}

export interface NPCLike {
    type: string;
    position: Position;
    health: number;
    maxHealth: number;
    isDead(): boolean;
    renderSpriteOnly?(ctx: CanvasRenderingContext2D, x: number, y: number): void;
    update?(deltaTime: number, playerPosition: Position, context?: unknown): void;
    category?: string;
    isCurrentlyAttacking?(): boolean;
    getAttackTarget?(): Position | null;
    getHealth?(): number;
    getMaxHealth?(): number;
}

export interface TreeLike {
    getHealth(): number;
    getMaxHealth(): number;
}

export interface CactusLike {
    getHealth(): number;
    getMaxHealth(): number;
    getVariant(): unknown; // Allow any return type to be compatible with actual implementations
}

export interface VillageStructure {
    type: string;
    position: Position;
    poi?: POILike;
    npc?: NPCLike;
}

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
    trees?: TreeLike[];
    cactus?: CactusLike[];
    spriteId?: string;
    dirtTimer?: number;
    villageStructures?: VillageStructure[];
    // New lighting system properties
    lightLevel?: number; // Base light level (0.0 to 1.0)
    effectiveLightLevel?: number; // Final light level after torch effects
}

export enum TileTypeEnum {
    DEEP_WATER = 'DEEP_WATER',
    SHALLOW_WATER = 'SHALLOW_WATER',
    SAND = 'SAND',
    GRASS = 'GRASS',
    MUD = 'MUD',
    DARK_FOREST = 'DARK_FOREST',
    GRAVEL = 'GRAVEL',
    COBBLESTONE = 'COBBLESTONE',
    STONE = 'STONE',
    SNOW = 'SNOW'
}

export interface GameState {
    player: PlayerState;
    world: WorldState;
    timestamp: number;
}

export interface PlayerState {
    position: Position;
    inventory: InventoryItem[];
    health: number;
}

export interface WorldState {
    tiles: Tile[];
    npcs: NPCState[];
    pois: POIState[];
}

export interface InventoryItem {
    id: string;
    type: string;
    quantity: number;
    durability?: number;
    damage?: number;
}

export interface NPCState {
    id: string;
    position: Position;
    type: string;
}

export interface POIState {
    id: string;
    position: Position;
    type: string;
}

// Light level constants
export const LIGHT_LEVELS = {
    WORLD: 1.0,      // Full daylight
    MINE: 0.5,       // Low light
    DUNGEON: 0.0,    // Dark
    TORCH_RADIUS: 2.5, // 5x5 area around torch
    TORCH_INTENSITY: 0.8 // Maximum light boost from torches (increased to better illuminate dungeons)
} as const;

// Day/night cycle configuration (10 minutes day, 5 minutes night)
export const DAY_NIGHT_CYCLE = {
    DAY_DURATION: 10 * 60 * 1000,    // 10 minutes in milliseconds
    NIGHT_DURATION: 5 * 60 * 1000,   // 5 minutes in milliseconds
    TOTAL_CYCLE: 15 * 60 * 1000,     // 15 minutes total cycle
    NIGHT_DARKNESS: 0.8              // Maximum darkness opacity during night
} as const;

// Monster spawning thresholds
export const MONSTER_SPAWN_THRESHOLDS = {
    SPAWN_CHANCE_MULTIPLIER: 0.3, // Base spawn chance multiplier based on darkness
    MIN_LIGHT_FOR_NO_SPAWN: 0.3, // Light level above which monsters won't spawn (0.0 - 0.3)
    MAX_LIGHT_FOR_SPAWN: 1.0, // Light level below which monsters can spawn (0.5 - 1.0)
    DARK_SPAWN_THRESHOLD: 0.5 // Light level below which monsters have high spawn chance
} as const;

// Mine-specific structure type that works with actual classes
export interface MineStructure {
  type: string;
  position: Position;
  poi?: {
    type: string;
    position: Position;
    passable: boolean;
    interactable: boolean;
    customData?: Record<string, unknown>;
    render?(ctx: CanvasRenderingContext2D, x: number, y: number): void;
  };
  npc?: {
    type: string;
    position: Position;
    health: number;
    maxHealth: number;
    isDead(): boolean;
    renderHealthBar?(ctx: CanvasRenderingContext2D, x: number, y: number): void;
    renderSpriteOnly?(ctx: CanvasRenderingContext2D, x: number, y: number): void;
    update?(deltaTime: number, playerPosition: Position, context?: unknown): void;
  };
}

// Dungeon-specific structure type that works with actual classes
export interface DungeonStructure {
  type: string;
  position: Position;
  poi?: {
    type: string;
    position: Position;
    passable: boolean;
    interactable: boolean;
    customData?: Record<string, unknown>;
    render?(ctx: CanvasRenderingContext2D, x: number, y: number): void;
  };
  npc?: {
    type: string;
    position: Position;
    health: number;
    maxHealth: number;
    isDead(): boolean;
    renderHealthBar?(ctx: CanvasRenderingContext2D, x: number, y: number): void;
    renderSpriteOnly?(ctx: CanvasRenderingContext2D, x: number, y: number): void;
    update?(deltaTime: number, playerPosition: Position, context?: unknown): void;
  };
}