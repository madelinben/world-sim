# World Simulator - Game Rules & Mechanics (Updated)

## 🌍 **World Generation**

### **Tile System**
- **Tile Size**: 16x16 pixels
- **Chunk System**: 16x16 tiles per chunk for efficient loading
- **Procedural Generation**: Uses simplex noise with configurable seeds
- **Grid Alignment**: Perfect tile grid with 1px black borders

### **Three-Layer Tile Rendering**
Each tile consists of three distinct visual layers rendered in order:

1. **Base Color Layer** (Bottom)
   - Solid color square representing the tile type (GRASS, WATER, etc.)
   - 14x14 pixels with 1px black border gap
   - Used for quick terrain identification

2. **Background Sprite Layer** (Middle)
   - Textured sprite overlay for visual detail (e.g., grass variants, water textures)
   - 16x16 pixel sprites from sprite sheets (TexturedGrass.png, Shore.png)
   - Optional - not all tile types have background sprites
   - GRASS tiles have 6 variants mapped deterministically by coordinates

3. **Occupied Entity Layer** (Top)
   - Interactive game objects (NPCs, POIs, structures)
   - Animated sprites (animals, windmills, trees)
   - Only one entity per tile allowed
   - Rendered on top with proper collision detection

### **Tile Data Structure**
```typescript
interface Tile {
  // Base tile properties
  value: TileType;           // GRASS, WATER, etc. (determines base color)
  spriteId?: string;         // Background sprite path (e.g., TexturedGrass.png#1,0)

  // Occupied entities (only one type per tile)
  trees?: Tree[];            // Animated tree structures
  cactus?: Cactus[];         // Animated cactus structures
  villageStructures?: {      // Village POIs and NPCs
    poi?: POI;               // Buildings, chests, etc.
    npc?: NPC;               // Animals, traders, monsters
  }[];
}
```

### **Tile Types**
| Tile Type | Description | Movement | Color |
|-----------|-------------|----------|-------|
| `DEEP_WATER` | Deep ocean/lakes | ❌ Impassable | Dark Blue (#00008B) |
| `SHALLOW_WATER` | Shallow water | ⚠️ Restricted (1/3 chance) | Blue (#4169E1) |
| `RIVER` | Flowing water | ✅ Passable | Light Blue (#1E90FF) |
| `SAND` | Desert/beach sand | ✅ Passable | Sandy (#F4A460) |
| `GRASS` | Grasslands | ✅ Passable | Light Green (#90EE90) |
| `MUD` | Muddy terrain | ⚠️ Restricted (1/3 chance) | Dark Brown (#8B4513) |
| `DIRT` | Exposed soil | ✅ Passable | Light Brown (#CD853F) |
| `CLAY` | Clay deposits | ✅ Passable | Bronze (#CD7F32) |
| `FOREST` | Dense forest | ✅ Passable | Dark Green (#006400) |
| `GRAVEL` | Rocky ground | ✅ Passable | Gray (#B8B8B8) |
| `COBBLESTONE` | Stone paths | ✅ Passable | Dark Gray (#A9A9A9) |
| `STONE` | Mountain/rock | ❌ Impassable | Gray (#808080) |
| `SNOW` | Snow-covered | ⚠️ Restricted (1/4 chance) | White (#FFFFFF) |

### **DIRT Tile Regeneration**
- **Creation**: DIRT tiles are created when trees are destroyed
- **Regeneration Time**: 30 seconds to convert back to GRASS
- **Appearance**: Light brown color (#CD853F) distinguishes from MUD
- **Purpose**: Temporary tile type showing environmental recovery

### **Biome Generation**
The world generates based on three noise layers:

1. **Height Map** (elevation)
2. **Temperature Map** (climate zones)
3. **Humidity Map** (moisture levels)

### **Biome Distribution**
Generated based on temperature and humidity:

**Cold Regions (temp < 0.2)**:
- High elevation: SNOW → STONE → COBBLESTONE
- High humidity: FOREST
- Low humidity: GRASS → STONE

**Temperate Regions (0.4 < temp < 0.7)**:
- High elevation: STONE → COBBLESTONE
- High humidity: FOREST → GRASS
- Near water: CLAY/MUD mix
- Low humidity: SAND

**Hot Regions (temp > 0.7)**:
- High elevation: STONE → COBBLESTONE
- High humidity: GRASS
- Low humidity: SAND (70% chance)

### **Background Sprite System**
- **Grass Variants**: 6 different TexturedGrass.png variants (0-5) mapped to 3×2 grid
- **Water Tiles**: Shore.png sprites for shallow/deep water (variants 2 and 4)
- **Sand Tiles**: Shore.png sprite for sand (variant 0)
- **Automatic Assignment**: Tiles automatically get sprite IDs based on coordinates
- **Deterministic Mapping**: Same coordinates always get same grass variant
- **Performance**: Background sprites render behind all entities

## 🚶 **Movement System**

### **Basic Movement**
- **Controls**: WASD or Arrow Keys
- **Grid-Based**: Player moves one tile at a time
- **Tile Snapping**: Player position snaps to tile centers
- **Cooldown**: 120ms between moves when holding keys

### **Movement Rules**
- **Impassable Tiles**: Cannot move to DEEP_WATER or STONE
- **Living Structure Blocking**: Cannot move to tiles with alive trees/cactus (health > 0)
- **Destroyed Structure Passage**: Can move through destroyed structures (health ≤ 0)
- **Mud Restriction**: Only 1/3 chance to move when standing on MUD
- **Snow Restriction**: Only 1/4 chance to move when standing on SNOW
- **Shallow Water Restriction**: Only 1/3 chance to move when standing on SHALLOW_WATER
- **Village Structure Blocking**: Cannot move to tiles with non-passable POIs or living NPCs

### **Direction Tracking**
- **Facing Direction**: Always updated when movement keys pressed (even if blocked)
- **Facing Tile Logging**: Shows tile info including structure health
- **Movement Blocking**: Logs which tile type prevented movement

### **Camera System**
- **Player-Centered**: Player always renders at screen center
- **Mouse Drag**: Click and drag to move camera view
- **Tile Alignment**: World grid aligns perfectly with player position

### **NPC Movement System**
- **Tile-Based Movement**: NPCs move between 16x16 pixel tiles like the player
- **Fast Movement Cooldown**: 0.6 seconds between normal moves (increased from 1.0s)
- **Quick Retry**: 0.15 seconds retry when blocked (reduced from 0.3s)
- **High Activity**: 80% chance to attempt movement each cycle for active animals
- **Anti-Stuck Mechanism**: Force movement after 5 seconds of inactivity
- **Reduced Spacing Restrictions**: 40% avoidance of adjacent tiles (down from 70%)
- **Staggered Timing**: Random initial delays prevent synchronized movement
- **Movement Tracking**: System monitors and prevents prolonged idle periods
- **Direction Consistency**: NPCs only change facing direction when actually moving to new tiles
- **Tile Validation**: Movement only occurs when successfully changing tile coordinates
- **Negative Coordinate Support**: Fixed coordinate calculation issues for animals in negative tile positions
- **Player Collision Prevention**: NPCs cannot move to tiles occupied by the player
- **Deadlock Resolution System**: Two-phase movement with speculative coordination to prevent clustering deadlocks
  - **Movement Intention Collection**: All NPCs declare intended movements before any actual movement
  - **Coordinated Swapping**: Animals can swap positions when both want each other's tiles
  - **Chain Movement**: If one animal wants to move away, others can coordinate to take their place
  - **Deterministic Behavior**: Movement decisions cached for 100ms to ensure consistent intention-execution matching
  - **Escape Mechanism**: Long-stuck animals (8+ seconds) get increased randomness to break deadlocks

## 🎒 **Inventory System**

### **Inventory Structure**
- **Slots**: 9 inventory slots (accessible via keys 1-9)
- **Stacking**: Items stack up to their max stack size
- **Selection**: Number keys 1-9 select inventory slots
- **Display**: Visual UI on right side of screen with sprites

### **Inventory Controls**
- **Selection**: `1-9` keys select inventory slots
- **Mouse Selection**: Click inventory slots to select items
- **Open Inventory**: `E` key displays full inventory state in console
- **Auto-Collection**: Items automatically added when structures destroyed
- **Stack Management**: Intelligent stacking fills existing stacks first

### **Item Types & Stack Sizes**
| Item Type | Max Stack | Source |
|-----------|-----------|---------|
| `wood` | 64 | Destroyed trees |
| `cactus` | 64 | Destroyed cactus |
| `wheat` | 64 | Wheat fields |
| `health_potion` | 16 | Chests |
| `poison_potion` | 16 | Chests |
| `magic_potion` | 16 | Chests |
| `stamina_potion` | 16 | Markets |
| `health_heart` | 1 | Rare drops |
| `hammer` | 1 | Markets |
| `sword` | 1 | Markets, Chests |
| `shield` | 1 | Markets |
| `dagger` | 1 | Markets |
| `rock` | 64 | Player-placed |
| `copper_ore` | 64 | Stone mining |
| `iron_ore` | 64 | Stone mining |
| `gold_ore` | 64 | Stone mining |
| `copper_ingot` | 64 | Processed |
| `iron_ingot` | 64 | Processed |
| `gold_ingot` | 64 | Processed |
| `chicken_meat` | 64 | Animal drops |
| `pork` | 64 | Animal drops |
| `wool` | 64 | Animal drops |
| `mutton` | 64 | Animal drops |

### **Inventory UI**
- **Visual Display**: 9 inventory slots rendered on right side of screen
- **Slot Selection**: Visual highlighting of selected slot
- **Item Sprites**: Items display their actual sprite icons from UI sprite sheets
- **Quantity Display**: Stack quantities shown in bottom-right of slots
- **Slot Numbers**: Slots numbered 1-9 for easy reference
- **Mouse Interaction**: Click slots to select items

## 🏗️ **Structure System**

### **Base Structure Mechanics**
- **Health Points**: All structures have health values
- **Damage System**: Structures take damage when attacked
- **Drop System**: Structures drop items when destroyed
- **Visual Feedback**: Health displayed in facing tile logs

### **Structure Types**

#### **Trees**
- **Health**: 50 HP
- **Attack Damage Taken**: 5 per attack (10 attacks to destroy)
- **Drops**: 5 wood when destroyed
- **Destruction Behavior**: Becomes broken stump (passable, visible)
- **Sprite**: Shows broken tree (stage 0) when destroyed
- **Growth Stages**: CUT_DOWN (0) → YOUNG (1) → TALL (2) → FULL (3)
- **Growth Time**: 1 hour per stage (3.6 million milliseconds)
- **Spawning**: 100% on FOREST tiles, 5% on GRASS tiles

#### **Cactus**
- **Health**: 15 HP
- **Attack Damage Taken**: 5 per attack (3 attacks to destroy)
- **Drops**: 1 cactus when destroyed
- **Destruction Behavior**: Completely removed from tile
- **Tile Conversion**: Destroyed cactus converts tile to SAND
- **Variants**: 3 different growth patterns with different frame sequences
- **Growth Time**: 10 minutes per stage (600,000 milliseconds)
- **Spawning**: 5% chance on SAND tiles

## 🌳 **Tree Growth System**

### **Tree Growth Stages**
| Stage | ID | Description | Visual | Health |
|-------|----|-----------|---------|---------|
| Cut Down | 0 | Tree stump (passable) | Sprite frame 0 | N/A |
| Young | 1 | Small sapling | Sprite frame 1 | 50 HP |
| Tall | 2 | Growing tree | Sprite frame 2 | 50 HP |
| Full | 3 | Mature tree | Sprite frame 3 | 50 HP |

### **Growth Mechanics**
- **Growth Time**: 1 hour per stage (3.6 million milliseconds)
- **Progression**: CUT_DOWN → YOUNG → TALL → FULL
- **Final Stage**: Trees stop growing at FULL stage
- **Real-Time**: Growth continues based on game time

### **Tree Destruction**
- **Broken Stumps**: Destroyed trees become CUT_DOWN stage (sprite index 0)
- **Passable**: Broken stumps allow player movement through them
- **Visual Persistence**: Stumps remain visible on tile
- **No Removal**: Trees remain as stumps, don't disappear

## 🌵 **Cactus Growth System**

### **Cactus Variants & Growth Stages**
| Variant | Growth Sequence | Description | Health |
|---------|----------------|-------------|---------|
| **Variant 1** | Frame 4 → Frame 3 | 2-stage growth (young → mature) | 15 HP |
| **Variant 2** | Frame 5 → Frame 6 → Frame 7 | 3-stage growth (young → middle → mature) | 15 HP |
| **Variant 3** | Frame 1 → Frame 0 | 2-stage growth (young → mature) | 15 HP |

### **Cactus Growth Mechanics**
- **Growth Time**: 10 minutes per stage (600,000 milliseconds)
- **Variant-Specific**: Each variant has different frame sequences
- **Final Stage**: Cactus stop growing at final stage for their variant
- **Real-Time**: Growth continues based on game time

### **Cactus Destruction**
- **Complete Removal**: Destroyed cactus are completely removed from tile
- **No Stumps**: Unlike trees, no visual remains after destruction
- **Tile Conversion**: Tile converts to SAND (permanent)
- **Animation System**: Cactus removed from rendering system

## ⚔️ **Combat System**

### **Player Combat Stats**
- **Attack Damage**: 5 damage per attack
- **Health**: 100 HP
- **Attack Range**: Adjacent tiles only (facing direction)
- **Attack Cooldown**: No cooldown (can attack continuously)

### **Attack Mechanics**
- **Target Selection**: Attacks structure in facing direction
- **Damage Application**: Consistent 5 damage per attack
- **Health Tracking**: Structure health decreases with each attack
- **Destruction Threshold**: Structures destroyed when health ≤ 0

### **Combat Controls**
- **Attack**: `Q` key attacks structure in facing direction
- **Target Display**: Console shows target tile and structure health
- **Damage Feedback**: Real-time health updates displayed

## 🏘️ **Village Generation System**

### **Village Rarity & Placement**
- **Noise-Based Grid System**: Uses dedicated village noise map with world seed for deterministic placement
- **Village Grid Areas**: 50x50 tile grid areas (800x800 pixels) - only one village per grid area
- **Village Center Selection**: Within each qualifying grid area, the tile with highest village noise value (>0.85 threshold) is selected as village center
- **Biome Restriction**: Villages only spawn on GRASS tiles
- **One Entity Per Tile**: Strict enforcement prevents multiple structures on same tile
- **Deterministic Placement**: Same seed always generates villages in same locations

### **Village Layout**
| Structure | Position | Spawn Rate | Requirements |
|-----------|----------|------------|--------------|
| **Windmill** | Village center (best noise tile in grid area) | 1 per grid area | GRASS tile, animated (2-second cycle) |
| **Food Market** | Exactly 8 tiles east of windmill | 1 per village | Valid terrain (not water/stone) |
| **Butcher Market** | Exactly 8 tiles west of windmill | 1 per village | Valid terrain (not water/stone) |
| **Armory Market** | Exactly 8 tiles south of windmill | 1 per village | Valid terrain (not water/stone) |
| **Cloth Market** | Exactly 8 tiles north of windmill | 1 per village | Valid terrain (not water/stone) |

### **Village Animals**
- **Quantity**: Optimized spawn density (12 strategic positions around village centers)
- **Types**: Chicken, Pig, Sheep (random selection)
- **Placement**: 5-7 tiles from village center with strategic spacing to prevent clustering
- **Enhanced Anti-Clustering**: 2-tile minimum spacing radius between all animals
- **Multi-Layer Spacing Checks**:
  - VillageGenerator: Checks 2-tile radius for existing animals
  - Chunk: Validates spacing before adding NPCs
  - WorldGenerator: Enhanced occupancy tracking during generation
- **Movement Space**: Each animal requires at least 3 adjacent passable tiles
- **Terrain Restriction**: Cannot spawn on DEEP_WATER or STONE (can spawn in SHALLOW_WATER)
- **One Entity Per Tile**: Only one structure/NPC per tile (strict enforcement)

### **Village Generation Process**
1. **Grid Area Evaluation**: Each 50x50 tile area is evaluated for village potential
2. **Best Tile Selection**: Within qualifying areas, the tile with highest village noise value becomes village center
3. **Windmill Placement**: Single windmill placed at selected center tile
4. **Market Distribution**: Markets placed exactly 8 tiles away in cardinal directions during tile-by-tile generation
5. **Animal Placement**: Village animals placed at predetermined offsets (±4, ±6 tiles) from village center during tile-by-tile generation
6. **Conflict Prevention**: Each tile is processed individually, ensuring no two entities occupy the same tile
7. **Area Marking**: Grid area marked as occupied to prevent duplicate villages

### **Biome Restrictions for Structures**
- **POI Structures** (windmills, markets): Cannot be placed on DEEP_WATER, SHALLOW_WATER, or STONE tiles
- **NPC Animals**: Cannot be placed on DEEP_WATER or STONE tiles, but CAN be placed in SHALLOW_WATER

## 🏛️ **Points of Interest (POI) System**

### **Interactive Structures**

#### **Storage & Containers**
| POI Type | Interaction | Contents |
|----------|-------------|----------|
| `normal_chest` | F key to open | Basic loot (copper_ingot, health_potion) |
| `rare_chest` | F key to open | Rare loot (gold_ingot, magic_potion, sword) |
| `tombstone` | F key to loot | Player death inventory |

#### **Utilities & Services**
| POI Type | Interaction | Effect |
|----------|-------------|--------|
| `water_well` | F key to drink | Restores 25 health |
| `portal` | F key to teleport | Random teleportation |
| `notice_board` | F key to read/write | Message system |
| `empty_notice_board` | F key to post | Empty message board |

#### **Transportation**
| POI Type | Interaction | Effect |
|----------|-------------|--------|
| `boat_vertical` | F key to board | Allows water travel (up/down) |
| `boat_horizontal` | F key to board | Allows water travel (left/right) |

#### **Harvestable Resources**
| POI Type | Growth Stages | Harvest Yield | Requirements |
|----------|---------------|---------------|--------------|
| `wheat_field_0` | 4 stages (animated) | 3 wheat | Fully grown (stage 3) |

#### **Dangerous POI**
| POI Type | Damage | Animation | Effect |
|----------|--------|-----------|--------|
| `fireball_frame_0` | 25 damage | 2 frames | Damages player on same tile |
| `magic_fire_frame_0` | 35 damage | 2 frames | Enhanced fire damage |

### **Markets & Trading**
| Market Type | Items Available | Location |
|-------------|----------------|----------|
| `food_market` | Food, potions | Villages |
| `butcher_market` | Meat, animal products | Villages |
| `armory_market` | Weapons, tools, armor | Villages |
| `cloth_market` | Textiles, materials | Villages |

### **Mine & Dungeon Generation**

#### **Underground Structures**
| Structure | Spawn Rate | Requirements | Rarity |
|-----------|------------|--------------|--------|
| **Mine Entrance** | 70% of underground spawns | STONE tiles, mine noise > 0.98 | Extremely rare |
| **Dungeon Entrance** | 30% of underground spawns | STONE tiles, mine noise > 0.98 | Extremely rare |

#### **Generation Rules**
- **Noise Threshold**: 0.98+ (even higher than villages 0.85 for extreme rarity)
- **Noise Frequency**: 3x frequency for more variation
- **Biome Restriction**: Only spawn on STONE tiles
- **Functionality**: Teleport player underground when interacted with
- **Spacing**: Minimum 15 tiles between underground structures

## 🐾 **NPC & Animal System**

### **Animal Types & Behavior**
| Animal | Health | Aggression | Drops | Behavior |
|--------|--------|------------|-------|----------|
| `chicken` | 20 HP | Peaceful | 1 chicken_meat | Follows wheat, flees when attacked, 4-frame walking animation |
| `pig` | 35 HP | Peaceful | 2 pork | Follows wheat, slow movement, 4-frame walking animation |
| `sheep` | 25 HP | Peaceful | 1 wool, 1 mutton | Follows wheat, grazes peacefully, 4-frame walking animation |

### **NPC Movement & AI**
- **Detection Range**: 5 tiles radius
- **Wheat Attraction**: Animals follow players with wheat in inventory (5-tile radius)
- **Dynamic Same-Type Attraction**: Variable attraction rates (6-40%) based on local animal density
- **Tile-Based Movement**: NPCs move one tile at a time with 0.6-second cooldowns
- **Movement Logic**: Direction-based movement towards/away from targets
- **Flexible Spacing**: Animals can move adjacent to each other, only avoiding overcrowded tiles (2+ neighbors)
- **Collision Avoidance**: NPCs avoid tiles occupied by other NPCs
- **Personal Space System**: Animals actively escape when surrounded by 3+ same-type animals
- **Exploration Behavior**: 25% chance for random exploration overriding attraction
- **Crowded Repulsion**: Animals move away from cluster centers when feeling crowded
- **Fleeing**: Non-aggressive NPCs flee when attacked or when avoiding monsters
- **Health Bars**: Visible when damaged
- **Movement Restrictions**: NPCs stay within 5 tiles of spawn point, 10 tiles maximum
- **Directional Animation**: 4 directions × 4 animation frames per direction (1-second cycle)
- **AI States**: idle, wandering, following, fleeing, attacking, dead
- **Camera-Based Optimization**: Only NPCs within camera view + 5-tile buffer are updated for performance
- **Continuous Updates**: NPCs updated every frame for smooth movement and animation
- **Reduced Logging**: Only logs successful movements and important errors to avoid console spam

### **Tile-Based Movement Rules**
- **One Entity Per Tile**: Only one structure, POI, or NPC can occupy a single tile at any time
- **Collision Detection**: NPCs check tile availability before moving to new positions
- **Spacing Preferences**: Animals and friendly NPCs prefer tiles that maintain 1-tile spacing from other NPCs
- **Fallback Movement**: If no spaced tiles available, NPCs fall back to basic collision avoidance
- **Movement Blocking**: NPCs cannot move to tiles occupied by:
  - Living trees or cactus (health > 0)
  - Impassable POIs (markets, windmills, chests)
  - Other living NPCs
  - Impassable terrain (DEEP_WATER, STONE)
- **Direction Updates**: NPC facing direction is updated before moving to new tile
- **Movement Validation**: If target tile is occupied, NPC velocity is reduced to prevent jittering
- **Chunk-Based Tracking**: NPC positions are tracked per chunk for efficient collision detection

### **Animal Breeding System**
- **Breeding Conditions**: Two animals of the same species must be adjacent and facing each other
- **Species Compatibility**: Only identical animal types can breed (chicken + chicken, pig + pig, sheep + sheep)
- **Breeding Cooldown**: 30-second cooldown between breeding attempts per animal
- **Facing Requirement**: Both animals must be facing directly towards each other
- **Offspring Placement**: New animals spawn in adjacent tiles near the parents
- **Real-Time Breeding**: Breeding attempts occur during normal game updates
- **Breeding Success**: Successful breeding creates a new NPC of the same type with full health
- **Breeding Failure**: If no suitable adjacent tile is available, breeding fails but animals can try again after cooldown
- **Population Growth**: Allows for dynamic animal population expansion in villages and wild areas
- **Visual Feedback**: Console logs successful breeding events with parent locations

### **Animation System for NPCs**
- **Directional Sprites**: 4 directions (up, down, left, right)
- **Walking Animation**: 4 frames per direction, 1-second cycle
- **Direction Updates**: Direction changes based on movement
- **Animation Timing**: Frame updates tied to game loop deltaTime
- **State-Based**: Animation only when moving or performing actions

### **Wild Animal Generation**
- **Spawn Rate**: Animal noise > 0.85 (increased from 0.95 for more common spawns)
- **Biome**: GRASS tiles only (outside villages)
- **Types**: Chicken, Pig, Sheep with full AI and animations
- **Behavior**: Same as village animals but more scattered

## 🎮 **Controls & Input**

### **Movement Controls**
- **Movement**: `WASD` or Arrow Keys
- **Direction**: Updates facing direction even when movement blocked

### **Combat Controls**
- **Attack**: `Q` key - Attack structure in facing direction

### **Interaction Controls**
- **Interact**: `F` key - Interact with POIs and structures (currently logs interaction, full functionality in development)

### **Inventory Controls**
- **Slot Selection**: `1-9` keys select inventory slots
- **Mouse Selection**: Click inventory slots to select items
- **Open Inventory**: `E` key displays full inventory state

### **Mouse Controls**
- **Camera Drag**: Click and drag to move camera view
- **Inventory Interaction**: Click inventory slots to select items
- **Click Detection**: Distinguishes between clicks and drags (< 5 pixel threshold)

### **Console Logging**
- **Key Operations**: Shows meaningful key mappings (e.g., "q → attack")
- **Tile Information**: Current tile and facing tile with structure details
- **Inventory Changes**: Real-time inventory updates
- **Combat Feedback**: Attack results and damage dealt
- **Village Generation**: Logs when villages, markets, and NPCs are created

## 🎨 **Visual System**

### **Rendering Order**
1. **Black Background**: Canvas filled with black (#000000) for tile borders
2. **Base Color Layer**: 14x14 colored squares representing tile types
3. **Background Sprite Layer**: TexturedGrass.png variants, Shore.png textures
4. **Player**: Red 10x10 square at screen center (renders behind entities)
5. **Occupied Entity Layer**: Structures and NPCs on tiles
   - Tree Sprites: 16x16 tree sprites with growth animations
   - Cactus Sprites: 16x16 cactus sprites with variant animations
   - POI Buildings: Markets, windmills, chests (static/animated)
   - NPC Animals: Walking animals with directional animations
6. **Inventory UI**: Right-side inventory slots (front-most layer)

### **Animation System**
- **Windmill Animation**: 3-frame animation (frames 3, 4, 5) with 2-second cycle
- **Animal Walking**: 4-frame directional animation (frames 0-3) with 1-second cycle
- **Wheat Growth**: 4-stage animated growth cycle
- **Fire Effects**: 2-frame animation for fireball and magic fire
- **Frame-Based Rendering**: Proper sprite sheet indexing with animation state
- **Game Loop Integration**: Animations updated every frame via deltaTime

### **Sprite System**
- **Size**: 16x16 pixels per sprite
- **Format**: Sprite sheets with frame indexing
- **Animation**: Time-based frame progression with configurable durations
- **Alignment**: Sprites align perfectly with tile grid
- **Depth**: Player renders behind structures for proper depth

### **Border System**
- **Style**: 1px black borders around all tiles
- **Method**: Tile rendering leaves 1px gaps, black background shows through
- **Performance**: Zero-cost border rendering

## 🎯 **Game Objectives & Gameplay**

Currently a **survival/resource gathering game** with:

### **Core Gameplay Loop**
1. **Exploration**: Navigate different biomes and discover structures
2. **Resource Gathering**: Attack trees and cactus to collect materials
3. **Inventory Management**: Organize collected items in 9-slot inventory
4. **Environmental Interaction**: Observe tile regeneration and structure growth
5. **Village Discovery**: Find rare villages with animated windmills and NPCs
6. **POI Interaction**: Use chests, wells, markets, and other structures

### **Resource Management**
- **Wood Collection**: Attack trees to gather wood
- **Cactus Harvesting**: Destroy cactus for cactus items
- **Inventory Organization**: Use number keys to manage 9 inventory slots
- **Stack Optimization**: Items automatically stack to save space

### **Environmental Systems**
- **Dynamic World**: Structures grow over time
- **Tile Recovery**: DIRT tiles regenerate to GRASS after 30 seconds
- **Persistent Changes**: Destroyed structures leave environmental impact
- **Living Villages**: Animated windmills and walking animals create vibrant settlements

## 🔧 **Technical Implementation**

### **Tile-Based Movement System**
- **Movement Cooldown**: 1.5-second delay between moves (slower than player's 120ms)
- **Movement Logic**: NPCs choose one adjacent tile based on current state:
  - **Following**: Move towards player (when has wheat)
  - **Fleeing**: Move away from player/monsters (when damaged)
  - **Attacking**: Move towards player (monsters only)
  - **Wandering**: Random adjacent tile (default state)
- **Collision Detection**: NPCs check for occupied tiles and avoid other NPCs
- **Boundary Enforcement**: 5-tile wandering radius, 10-tile maximum from spawn
- **Tile Selection**: Prioritizes movement based on direction with largest distance component
- **Performance**: NPCs updated within 35-tile radius of player (matches camera view)

### **Chunk-Based Entity Management**
- **NPC Tracking**: Each chunk maintains a map of NPCs by tile coordinates
- **Cross-Chunk Movement**: NPCs can move between chunks with proper state transfer
- **Collision Detection**: Real-time tile occupancy checking prevents entity overlap
- **Entity Registration**: NPCs automatically registered in chunk system during village generation
- **Memory Efficiency**: Only loaded chunks track entity positions

### **Seed-Based Generation**
- **Deterministic World**: Same seed always generates identical worlds
- **Multiple Noise Maps**: Separate noise functions for villages, animals, mines
- **Noise Scaling**: Different frequency scales for different feature types
- **Hash Function**: Converts string seeds to numeric values for noise generation
- **Structure Persistence**: Generated structures stored in world state

### **Animation Architecture**
- **POI Animation**: 2-second cycles for windmills, configurable frame sequences
- **NPC Animation**: 1-second cycles for animals, directional sprite sheets
- **Game Loop Integration**: Animations updated via deltaTime in world update
- **Performance Optimization**: Only visible tiles updated for animations
- **Frame Management**: Proper frame indexing and timing systems

### **Village Structure System**
- **Two-Pass Generation**: First pass generates tiles, second pass distributes structures
- **Collision Detection**: Ensures only one structure per tile
- **Terrain Validation**: Real-time tile type checking during placement
- **Anti-Clustering**: Spacing enforcement prevents structure overlap

### **Game State**
```typescript
{
  player: {
    position: { x: number, y: number },
    inventory: InventoryItem[],
    health: number,
    attackDamage: number
  },
  world: {
    tiles: Tile[],
    villageStructures: VillageStructure[]
  }
}
```

### **Player Entity**
- **Attack Damage**: 5 points
- **Health**: 100 HP
- **Direction Tracking**: Maintains facing direction for combat
- **Inventory Integration**: Direct access to 9-slot inventory system

### **Performance Optimization**
- **Visibility Culling**: Only render visible tiles and structures
- **Tile Caching**: Cache visible tiles to avoid recalculation
- **Change Detection**: Only update when camera/player moves
- **Animation System**: Efficient structure rendering and updates
- **Chunk-Based Loading**: 16x16 tile chunks for efficient world streaming
- **Camera-Based NPC Updates**: NPCs only updated within camera view + 5-tile buffer (adaptive to screen resolution)
- **Dynamic View Radius**: Update radius calculated from camera dimensions (canvas width/height in tiles)

### **Game Loop**
- **Target FPS**: 60 FPS
- **Fixed Timestep**: Consistent 16.67ms updates
- **Delta Time**: Proper time-based calculations for animations
- **Update Throttling**: Expensive operations only when needed
- **Animation Updates**: Smooth frame transitions using game loop timing

### Anti-Clustering System
- **Multi-Layer Validation**: Three-tier spacing enforcement (VillageGenerator, WorldGenerator, Chunk.ts)
- **2-Tile Minimum Radius**: Animals require at least 2 empty tiles around them
- **Adequate Movement Space**: Minimum 3 passable adjacent tiles for animal mobility
- **Spawn Rejection Logging**: Console feedback for blocked spawn attempts
- **Real-Time Validation**: Dynamic spacing checks during NPC addition to chunks

### Species Grouping System
- **Same-Type Attraction**: Animals are more likely to spawn near others of their species
- **Detection Radius**: 4-tile radius check for nearby animals of the same type
- **Grouping Bonus**: 3x higher spawn probability for same species when nearby animals detected
- **Natural Herds**: Creates realistic animal clustering (pig herds, chicken flocks, sheep groups)
- **Balanced Randomness**: Still allows diverse spawning while encouraging species grouping
- **Applied to All Animals**: Both village and wild animals use species-preference logic

### Dynamic Cluster Behavior
- **Personal Space Mechanism**: Animals escape when surrounded by 3+ same-type animals within 2 tiles
- **Crowded Repulsion**: 40% chance to move away from cluster center when feeling crowded
- **Clustered Movement Boost**: Animals near others have 90% movement chance (vs 80% isolated)
- **Enhanced Avoidance**: 30% chance to move away from nearby animals when clustered (vs 20% isolated)
- **Boosted Exploration**: 35% chance for exploration when clustered (vs 25% isolated)
- **Restlessness System**: Movement probability increases by up to 30% after 3+ seconds of inactivity
- **Reduced Attraction Penalties**: Less severe attraction reduction when near same-type animals
- **Distance-Based Attraction**: Attraction strength decreases when already near other same-type animals
- **Isolation Response**: Isolated animals have 50% higher attraction to find their species
- **Dynamic Attraction Rates**: 10-40% attraction chance based on local population density
- **Edge Liberation**: Animals on cluster edges can now move outward for exploration
- **Adjacent Movement Allowed**: Animals can move next to each other, only avoiding overcrowded situations

---

*This document reflects the current game implementation as a survival/resource management experience with procedural world generation, village systems, animated NPCs, and comprehensive sprite-based graphics. The game features a complete inventory system, combat mechanics, and environmental interactions.*