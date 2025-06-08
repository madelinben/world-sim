# World Simulator - Game Rules & Mechanics (Updated December 2024)

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
   - FOREST tiles also use textured grass variants for enhanced visual appeal

3. **Occupied Entity Layer** (Top)
   - Interactive game objects (NPCs, POIs, structures)
   - Animated sprites (animals, windmills, trees)
   - Only one entity per tile allowed
   - Rendered on top with proper collision detection

### **Tile Data Structure**
```typescript
interface Tile {
  // Base tile properties
  x: number;
  y: number;
  value: TileType;           // GRASS, WATER, etc. (determines base color)
  prevValue?: TileType;      // For player movement tracking
  interacted?: boolean;      // For player interaction state
  height: number;            // Elevation for world generation
  temperature: number;       // Climate data
  humidity: number;          // Climate data
  riverValue?: number;       // Water flow data
  flowDirection?: number;    // Water flow direction
  spriteId?: string;         // Background sprite path (e.g., TexturedGrass.png#1,0)
  dirtTimer?: number;        // For DIRT -> GRASS regeneration

  // Occupied entities (only one type per tile)
  trees?: Tree[];            // Animated tree structures
  cactus?: Cactus[];         // Animated cactus structures
  villageStructures?: VillageStructure[]; // Village POIs and NPCs
}
```

### **Tile Types**
| Tile Type | Description | Player Movement | NPC Movement | Color |
|-----------|-------------|-----------------|--------------|-------|
| `DEEP_WATER` | Deep ocean/lakes | ❌ Impassable | ❌ Impassable | Dark Blue (#00008B) |
| `SHALLOW_WATER` | Shallow water | ⚠️ Restricted (1/3 chance) | ❌ Impassable | Blue (#4169E1) |
| `RIVER` | Flowing water | ✅ Passable | ✅ Passable | Light Blue (#1E90FF) |
| `SAND` | Desert/beach sand | ✅ Passable | ✅ Passable | Sandy (#F4A460) |
| `GRASS` | Grasslands | ✅ Passable | ✅ Passable | Light Green (#90EE90) |
| `MUD` | Muddy terrain | ⚠️ Restricted (1/3 chance) | ✅ Passable | Dark Brown (#8B4513) |
| `DIRT` | Exposed soil | ✅ Passable | ✅ Passable | Light Brown (#CD853F) |
| `CLAY` | Clay deposits | ✅ Passable | ✅ Passable | Bronze (#CD7F32) |
| `FOREST` | Dense forest | ✅ Passable | ✅ Passable | Dark Green (#006400) |
| `GRAVEL` | Rocky ground | ✅ Passable | ✅ Passable | Gray (#B8B8B8) |
| `COBBLESTONE` | Stone paths | ✅ Passable | ❌ Impassable | Dark Gray (#A9A9A9) |
| `STONE` | Mountain/rock | ❌ Impassable | ❌ Impassable | Gray (#808080) |
| `SNOW` | Snow-covered | ⚠️ Restricted (1/4 chance) | ❌ Impassable | White (#FFFFFF) |
| `PLAYER` | Player position | Special | Special | Red (tracked separately) |

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
- High elevation: SNOW → STONE → COBBLESTONE (enhanced snow coverage at height > 0.75)
- High humidity: FOREST
- Low humidity: GRASS → STONE

**Temperate Regions (0.4 < temp < 0.7)**:
- High elevation: SNOW → STONE → COBBLESTONE (enhanced snow coverage at height > 0.65)
- High humidity: FOREST → GRASS
- Near water: CLAY/MUD mix
- Low humidity: SAND

**Hot Regions (temp > 0.7)**:
- High elevation: STONE → COBBLESTONE
- High humidity: GRASS
- Low humidity: SAND (70% chance)

### **Background Sprite System**
- **Grass Variants**: 6 different TexturedGrass.png variants (0-5) mapped to 3×2 grid
- **Forest Background**: FOREST tiles use the same textured grass variants for enhanced visual depth
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
- **Impassable Tiles**: Cannot move to DEEP_WATER, SHALLOW_WATER, STONE, COBBLESTONE, or SNOW
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
- **Slowed Movement Cooldown**: 1.2 seconds between normal moves (reduced from 0.6s for more realistic pacing)
- **Quick Retry**: 0.3 seconds retry when blocked (reduced from 0.6s)
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
| Item Type | Max Stack | Source | Special Properties |
|-----------|-----------|--------|--------------------|
| **Resources** | | | |
| `wood` | 64 | Destroyed trees | Basic building material |
| `cactus` | 64 | Destroyed cactus | Desert resource |
| `rock` | 64 | Player-placed | Construction material |
| **Food & Animal Products** | | | |
| `chicken_meat` | 64 | Chicken combat drops | Food item |
| `pork` | 64 | Pig combat drops | Food item |
| `mutton` | 64 | Sheep combat drops | Food item |
| `wool` | 64 | Sheep combat drops | Textile material |
| `wheat` | 64 | Wheat field harvest | Animal attraction item |
| **Potions** | | | |
| `health_potion` | 16 | Chests | Healing item |
| `poison_potion` | 16 | Chests | Harmful potion |
| `magic_potion` | 16 | Chests | Special effects |
| `stamina_potion` | 16 | Markets | Energy restoration |
| **Special Items** | | | |
| `health_heart` | 1 | Rare drops | Health boost |
| **Weapons & Tools** | | | |
| `hammer` | 1 | Markets | Damage: 15 |
| `sword` | 1 | Markets, Chests | Damage: 20 |
| `shield` | 1 | Markets | Defense item |
| `dagger` | 1 | Markets | Damage: 10 |
| **Ores & Ingots** | | | |
| `copper_ore` | 64 | Monster drops, Stone mining | Raw material |
| `iron_ore` | 64 | Stone mining | Raw material |
| `gold_ore` | 64 | Stone mining | Raw material |
| `copper_ingot` | 64 | Chests, Processed | Refined material |
| `iron_ingot` | 64 | Processed | Refined material |
| `gold_ingot` | 64 | Chests, Processed | Refined material |
| **Monster Drops** | | | |
| `monster_drop` | 64 | Defeated monsters | Monster essence |

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
- **Health**: 100 HP (max health)
- **Attack Range**: Adjacent tiles only (facing direction)
- **Attack Cooldown**: No cooldown (can attack continuously)
- **Health Restoration**: Available via water wells (+25 health)

### **Attack Mechanics**
- **Target Selection**: Attacks structure or NPC in facing direction
- **Damage Application**: Consistent 5 damage per attack
- **Health Tracking**: Target health decreases with each attack
- **Destruction Threshold**: Targets destroyed when health ≤ 0
- **Priority System**: Trees → Cactus → NPCs → Nothing

### **NPC Combat & Drops**
| NPC Type | Health | Drops When Defeated | Behavior When Attacked |
|----------|---------|-------------------|------------------------|
| **Chicken** | 20 HP | 1x Chicken Meat | Flees, becomes 'fleeing' state |
| **Pig** | 35 HP | 3x Pork | Flees, becomes 'fleeing' state |
| **Sheep** | 25 HP | 1x Mutton + 3x Wool | Flees, becomes 'fleeing' state |
| **Trader** | 50 HP | No drops | Flees, becomes 'fleeing' state |
| **Orc/Skeleton/Goblin** | 40 HP | 1x Copper Ore | Aggressive, continues attacking |

### **Combat Feedback**
- **Health Display**: NPCs show health bars when damaged
- **Death Removal**: Dead NPCs are automatically removed from tiles
- **Drop Collection**: Items automatically added to player inventory
- **Console Logging**: Real-time combat updates and health tracking

### **Combat Controls**
- **Attack**: `Q` key attacks target in facing direction
- **Target Display**: Console shows target tile and health status
- **Damage Feedback**: Real-time health updates displayed

## 🎮 **User Interface System**

### **Bubble-Style UI Design**
The game features a modern bubble-style UI with white backgrounds and rounded borders inspired by contemporary mobile interfaces:

#### **Text Box System (Pokemon DS-Inspired)**
- **Style**: Rounded bubble design with white background and subtle shadow
- **Positioning**: Bottom of screen with 20px padding
- **Activation**: Press `F` key on notice boards to display village information
- **Dismissal**: Any key press or player movement closes the text box
- **Content**: Village names, descriptions, and lore text
- **Typography**: Clean Arial font with proper hierarchy (bold titles, regular body text)
- **Responsive**: Adapts to screen width with proper text wrapping

#### **Inventory UI (3DS-Inspired)**
- **Style**: Bubble slots with rounded corners and modern aesthetics
- **Layout**: 9 vertical slots on the right side of screen
- **Slot Design**: White background bubbles with light blue selection highlighting
- **Visual Elements**:
  - Slot numbers (1-9) in top-left corner
  - Item icons with simplified colored representations
  - Quantity badges in bottom-right corner for stackable items
  - Selected slot highlighting with blue border and background tint
- **Interaction**: Click slots or use number keys 1-9 for selection
- **Drop Shadow**: Subtle shadow effects for depth perception

### **Notice Board System**
A comprehensive village information system that provides lore and character to settlements:

#### **Notice Board POI**
- **Type**: `notice_board` - Interactive POI structure
- **Placement**: 2-5 tiles from village center (water well)
- **Spawn Rate**: 1 per village (automatically generated)
- **Interaction**: Press `F` key to read village information
- **Visual**: Dedicated notice board sprite from asset system

#### **Village Name Generation**
- **Algorithm**: Deterministic name generation based on village grid coordinates
- **Components**: Combines friendly prefixes + descriptive suffixes
- **Cache System**: Same village always gets same name across game sessions
- **Child-Friendly**: All names use appropriate, positive language
- **Examples**: Sunnyville, Happybrook, Crystalmeadow, Goldenhaven

**Available Prefixes (50 options)**:
- Nature: Sunny, Happy, Green, Bright, Sweet, Peaceful, Golden, Silver, Crystal, Rainbow
- Emotions: Gentle, Cozy, Warm, Friendly
- Flora: Cherry, Apple, Maple, Willow, Rose, Daisy
- Elements: Honey, Sugar, Candy, Bubble, Sparkle, Twinkle, Star, Moon, Sun, Cloud
- Colors: Blue, Purple, Pink, Orange, White
- Seasons: Spring, Summer, Autumn, Winter
- Geography: Meadow, River, Lake, Hill, Valley, Garden, Forest, Field, Brook, Grove, Creek

**Available Suffixes (30 options)**:
- Towns: ville, town, burg, ham
- Nature: field, wood, brook, creek, dale, glen, haven, ridge, grove, meadow, valley, hills
- Water: springs, gardens, falls, pond, bridge, crossing, hollow, cove, bay, shore
- Elevation: view, heights, point, bend

#### **Village Information Display**
- **Dynamic Content**: Randomly generated welcome messages and village information
- **Personalization**: Each village has unique personality reflected in notice text
- **Contextual Messages**: References village features like wells, markets, and animals
- **Interactive Elements**: Clear visual feedback and user-friendly controls

### **UI Integration with Game Systems**
- **Inventory Sync**: Real-time updates when items are collected or used
- **Player Movement Detection**: Text boxes auto-dismiss on player movement
- **Key Handling**: Comprehensive input system for UI interaction
- **Canvas Rendering**: High-performance rendering with proper layering
- **Responsive Design**: UI adapts to different screen sizes and resolutions

## 🏘️ **Village Generation System**

### **Village Layout & Structure Types**
| Structure | Position | Spawn Rate | Interaction |
|-----------|----------|------------|-------------|
| **Water Well** | Village center | 1 per village | `F` key - Restores 25 health |
| **Notice Board** | 2-5 tiles from well | 1 per village | `F` key - Displays village info |
| **Windmill** | 6-10 tiles from well | 1 per village | Animated (2s cycle) |
| **Food Market** | 6-10 tiles from well | 1 per village | Trading interface |
| **Butcher Market** | 6-10 tiles from well | 1 per village | Meat & animal products |
| **Armory Market** | 6-10 tiles from well | 1 per village | Weapons & tools |
| **Cloth Market** | 6-10 tiles from well | 1 per village | Textiles & materials |

### **Village Naming & Identity System**
- **Grid-Based Assignment**: Villages assigned to 50x50 tile grid areas
- **Deterministic Generation**: Same seed produces same village names and locations
- **Name Storage**: Village names stored in POI customData for persistence
- **Cross-Reference System**: Notice boards can find nearby wells to get village names
- **Fallback Naming**: "Unknown Village" for edge cases or corrupted data

### **Village Rarity & Placement**
- **Noise-Based Grid System**: Uses dedicated village noise map with world seed for deterministic placement
- **Village Grid Areas**: 50x50 tile grid areas (800x800 pixels) - only one village per grid area
- **Village Center Selection**: Within each qualifying grid area, the tile with highest village noise value (>0.85 threshold) is selected as village center
- **Biome Restriction**: Villages only spawn on GRASS tiles
- **One Entity Per Tile**: Strict enforcement prevents multiple structures on same tile
- **Deterministic Placement**: Same seed always generates villages in same locations

### **Well-Centered Village Layout**
| Structure | Position | Spawn Rate | Requirements |
|-----------|----------|------------|--------------|
| **Water Well** | Village center (best noise tile in grid area) | 1 per grid area | GRASS tile, interactable (restores 25 health) |
| **Windmill** | Randomly placed 6-10 tiles from well | 1 per village | Valid terrain (not water/stone), animated (2-second cycle) |
| **Food Market** | Randomly placed 6-10 tiles from well | 1 per village | Valid terrain (not water/stone) |
| **Butcher Market** | Randomly placed 6-10 tiles from well | 1 per village | Valid terrain (not water/stone) |
| **Armory Market** | Randomly placed 6-10 tiles from well | 1 per village | Valid terrain (not water/stone) |
| **Cloth Market** | Randomly placed 6-10 tiles from well | 1 per village | Valid terrain (not water/stone) |

### **Village Structure Priority System**
1. **POI Structures (Highest Priority)**: Wells, windmills, markets placed first
2. **NPCs (Lowest Priority)**: Animals placed last to avoid conflicts with structures
3. **Conflict Resolution**: Village structure POIs take precedence when placing in tiles
4. **Random Placement**: Structures are placed in a spiral pattern around the well using deterministic randomization
5. **Distance Constraints**: POI structures (6-10 tiles from well), NPCs (12-15 tiles from well)

### **Village Animals**
- **Quantity**: Optimized spawn density around village perimeter
- **Types**: Chicken, Pig, Sheep (random selection with species grouping)
- **Placement**: 12-15 tiles from well center to avoid conflicts with POI structures
- **Enhanced Anti-Clustering**: 2-tile minimum spacing radius between all animals
- **Movement Space**: Each animal requires at least 3 adjacent passable tiles
- **Terrain Restriction**: Cannot spawn on DEEP_WATER, STONE, COBBLESTONE, SNOW, or SHALLOW_WATER
- **Spawn Probability**: 30% chance per suitable tile for balanced population density

### **Village Generation Process**
1. **Grid Area Evaluation**: Each 50x50 tile area is evaluated for village potential
2. **Best Tile Selection**: Within qualifying areas, the tile with highest village noise value becomes village center
3. **Well Placement**: Single water well placed at selected center tile
4. **POI Structure Distribution**: Windmill and markets placed randomly in 6-10 tile radius from well
5. **Animal Placement**: Village animals placed randomly in 12-15 tile radius from well during tile-by-tile generation
6. **Conflict Prevention**: Each tile is processed individually, ensuring POI structures take precedence over NPCs
7. **Area Marking**: Grid area marked as occupied to prevent duplicate villages

### **Biome Restrictions for Structures**
- **POI Structures** (wells, windmills, markets): Cannot be placed on DEEP_WATER, SHALLOW_WATER, STONE, COBBLESTONE, or SNOW tiles
- **NPC Animals**: Cannot be placed on DEEP_WATER, STONE, COBBLESTONE, SNOW, or SHALLOW_WATER tiles

### **Village Structure Spacing Requirements**
- **POI Structure Spacing**: Minimum 2-tile spacing radius between all POI structures (wells, windmills, markets)
- **Spacing Validation**: System prevents placement of POI structures too close to existing POI structures
- **Animal Spacing**: Minimum 2-tile spacing radius between all NPCs for adequate movement space
- **Priority System**: POI structures take precedence over NPCs during village generation

## 🏛️ **Points of Interest (POI) System**

### **Interactive Structures**

#### **Storage & Containers**
| POI Type | Interaction | Contents |
|----------|-------------|----------|
| `normal_chest` | F key to open | Basic loot (copper_ingot x2, health_potion x2) |
| `rare_chest` | F key to open | Rare loot (gold_ingot x3, magic_potion x1, sword x1) |
| `tombstone` | F key to loot | Player death inventory |

#### **Utilities & Services**
| POI Type | Interaction | Effect |
|----------|-------------|--------|
| `water_well` | F key to drink | Restores 25 health (village centers) |
| `notice_board` | F key to read | Displays village information with generated names and lore |
| `portal` | F key to teleport | Random teleportation |
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
- **Tile-Based Movement**: NPCs move one tile at a time with 1.2-second cooldowns (slowed for realism)
- **Movement Logic**: Direction-based movement towards/away from targets
- **Flexible Spacing**: Animals can move adjacent to each other, only avoiding overcrowded tiles (2+ neighbors)
- **Collision Avoidance**: NPCs avoid tiles occupied by other NPCs
- **Terrain Restrictions**: NPCs cannot move onto DEEP_WATER, STONE, COBBLESTONE, SNOW, or SHALLOW_WATER tiles
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
  - Impassable terrain (DEEP_WATER, SHALLOW_WATER, STONE, COBBLESTONE, SNOW)
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
- **World System Integration**: Breeding requests are handled by the World system for proper entity management

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
- **Interact**: `F` key - Interact with POIs and structures
  - **Notice Boards**: Displays village information in bubble-style text box
  - **Water Wells**: Restores 25 health points
  - **Other POIs**: Various context-specific interactions

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
3. **Background Sprite Layer**: TexturedGrass.png variants for GRASS and FOREST, Shore.png textures
4. **Player**: Red 10x10 square at screen center (renders behind entities)
5. **Occupied Entity Layer**: Structures and NPCs on tiles
   - Tree Sprites: 16x16 tree sprites with growth animations
   - Cactus Sprites: 16x16 cactus sprites with variant animations
   - POI Buildings: Wells, markets, windmills, chests, notice boards (static/animated)
   - NPC Animals: Walking animals with directional animations
6. **Bubble UI Layer**: Modern interface elements (front-most layer)
   - **Inventory UI**: Right-side bubble slots with rounded corners and shadows
   - **Text Box UI**: Bottom-screen bubble with village information and lore
   - **Interactive Elements**: Selection highlighting and visual feedback

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
- **Movement Cooldown**: 1.2-second delay between moves (slowed down for realistic animal behavior)
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
- **Priority-Based Placement**: POI structures placed before NPCs to avoid conflicts
- **Collision Detection**: Ensures only one structure per tile
- **Terrain Validation**: Real-time tile type checking during placement
- **Well-Centered Layout**: All village structures positioned relative to central water well
- **Random Distribution**: Deterministic randomization for natural village layouts

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

### **Anti-Clustering System**
- **Multi-Layer Validation**: Three-tier spacing enforcement (VillageGenerator, WorldGenerator, Chunk.ts)
- **2-Tile Minimum Radius**: Animals require at least 2 empty tiles around them
- **Adequate Movement Space**: Minimum 3 passable adjacent tiles for animal mobility
- **Spawn Rejection Logging**: Console feedback for blocked spawn attempts
- **Real-Time Validation**: Dynamic spacing checks during NPC addition to chunks

### **Species Grouping System**
- **Same-Type Attraction**: Animals are more likely to spawn near others of their species
- **Detection Radius**: 4-tile radius check for nearby animals of the same type
- **Grouping Bonus**: 3x higher spawn probability for same species when nearby animals detected
- **Natural Herds**: Creates realistic animal clustering (pig herds, chicken flocks, sheep groups)
- **Balanced Randomness**: Still allows diverse spawning while encouraging species grouping
- **Applied to All Animals**: Both village and wild animals use species-preference logic

### **Dynamic Cluster Behavior**
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

*This document reflects the current game implementation as a survival/resource management experience with procedural world generation, well-centered village systems, animated NPCs, enhanced snow mountain regions, slowed animal movement for realism, forest background sprites, comprehensive sprite-based graphics, advanced animal breeding system, and deterministic village naming. The game features a complete inventory system, combat mechanics, environmental interactions with priority-based structure placement, and modern bubble-style UI system inspired by contemporary mobile and handheld gaming interfaces.*