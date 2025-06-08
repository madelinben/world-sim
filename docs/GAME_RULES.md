# World Simulator - Game Rules & Mechanics (Updated)

## 🌍 **World Generation**

### **Tile System**
- **Tile Size**: 16x16 pixels
- **Chunk System**: 16x16 tiles per chunk for efficient loading
- **Procedural Generation**: Uses simplex noise with configurable seeds
- **Grid Alignment**: Perfect tile grid with 1px black borders

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

### **Sprite System**
- **Grass Variants**: 6 different TexturedGrass.png variants (0-5) mapped to 3×2 grid
- **Water Tiles**: Shore.png sprites for shallow/deep water
- **Sand Tiles**: Shore.png sprite for sand
- **Automatic Assignment**: Tiles automatically get sprite IDs based on coordinates

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
- **Noise-Based Placement**: Uses dedicated village noise map with world seed
- **Village Rarity**: Villages spawn with 0.85+ noise threshold (extremely rare)
- **Village Radius**: 20 tiles (320 pixels) radius for village structures
- **Biome Restriction**: Villages only spawn on GRASS tiles

### **Village Layout**
| Structure | Position | Spawn Rate | Requirements |
|-----------|----------|------------|--------------|
| **Windmill** | Village center | 1 per village | GRASS tile, animated (2-second cycle) |
| **Food Market** | 8 tiles east of windmill | 1 per village | Valid terrain (not water/stone) |
| **Butcher Market** | 8 tiles west of windmill | 1 per village | Valid terrain (not water/stone) |
| **Armory Market** | 8 tiles south of windmill | 1 per village | Valid terrain (not water/stone) |
| **Cloth Market** | 8 tiles north of windmill | 1 per village | Valid terrain (not water/stone) |

### **Village Animals**
- **Quantity**: 6 animals per village
- **Types**: Chicken, Pig, Sheep (random selection)
- **Placement**: 4-6 tiles from village center in strategic positions
- **Terrain Restriction**: Cannot spawn on DEEP_WATER or STONE (can spawn in SHALLOW_WATER)

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
| **Mine Entrance** | 70% of underground spawns | STONE tiles, mine noise > 0.95 | Extremely rare |
| **Dungeon Entrance** | 30% of underground spawns | STONE tiles, mine noise > 0.95 | Extremely rare |

#### **Generation Rules**
- **Noise Threshold**: 0.95+ (even higher than villages for extreme rarity)
- **Noise Frequency**: 3x frequency for more variation
- **Biome Restriction**: Only spawn on STONE tiles
- **Functionality**: Teleport player underground when interacted with

## 🐾 **NPC & Animal System**

### **Animal Types & Behavior**
| Animal | Health | Aggression | Drops | Behavior |
|--------|--------|------------|-------|----------|
| `chicken` | 20 HP | Peaceful | 1 chicken_meat | Follows wheat, flees when attacked, 4-frame walking animation |
| `pig` | 35 HP | Peaceful | 2 pork | Follows wheat, slow movement, 4-frame walking animation |
| `sheep` | 25 HP | Peaceful | 1 wool, 1 mutton | Follows wheat, grazes peacefully, 4-frame walking animation |

### **NPC Movement & AI**
- **Detection Range**: 5 tiles radius
- **Wheat Attraction**: Animals follow players with wheat in inventory
- **Wandering**: Random movement within spawn area
- **Fleeing**: Non-aggressive NPCs flee when attacked
- **Health Bars**: Visible when damaged
- **Movement Speed**: Slower than player, realistic animal movement
- **Directional Animation**: 4 directions × 4 animation frames per direction
- **AI States**: idle, wandering, following, fleeing, attacking, dead

### **Animation System for NPCs**
- **Directional Sprites**: 4 directions (up, down, left, right)
- **Walking Animation**: 4 frames per direction, 1-second cycle
- **Direction Updates**: Direction changes based on movement
- **Animation Timing**: Frame updates tied to game loop deltaTime
- **State-Based**: Animation only when moving or performing actions

### **Wild Animal Generation**
- **Spawn Rate**: Animal noise > 0.95 (very rare)
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
1. **Black Background**: Canvas filled with black (#000000)
2. **Tile Colors**: 14x14 colored squares (2px border gap)
3. **Tile Sprites**: TexturedGrass.png variants and water sprites
4. **Player**: Red 10x10 square at screen center (renders behind structures)
5. **Tree Sprites**: 16x16 tree sprites on forest/grass tiles
6. **Cactus Sprites**: 16x16 cactus sprites on sand tiles
7. **Village Structures**: POI buildings and NPC animals
8. **Inventory UI**: Right-side inventory slots (front-most)

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

### **Game Loop**
- **Target FPS**: 60 FPS
- **Fixed Timestep**: Consistent 16.67ms updates
- **Delta Time**: Proper time-based calculations for animations
- **Update Throttling**: Expensive operations only when needed
- **Animation Updates**: Smooth frame transitions using game loop timing

---

*This document reflects the current game implementation as a survival/resource management experience with procedural world generation, village systems, animated NPCs, and comprehensive sprite-based graphics. The game features a complete inventory system, combat mechanics, and environmental interactions.*