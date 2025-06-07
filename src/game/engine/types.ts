export interface Position {
    x: number;
    y: number;
}

export interface Tile {
    type: TileType;
    height: number;
    position: Position;
}

export enum TileType {
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