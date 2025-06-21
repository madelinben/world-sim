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
| `VOID` | Cave void areas | ❌ Impassable | ❌ Impassable | Black (#000000) |

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
- **Living Structure Blocking**: Cannot move to tiles with alive trees (health > 0)
- **Cactus Collision System**: Living cactus (health > 0) are impassable and cause bounce-back
  - **Damage**: 5 HP damage when attempting to move onto cactus
  - **Bounce-back**: Entity remains at previous position, movement blocked
  - **Cooldown**: 1-second damage immunity prevents repeated damage
  - **All Entities**: Affects player, NPCs, animals, traders, and monsters
- **Destroyed Structure Passage**: Can move through destroyed structures (health ≤ 0)
- **Mud Restriction**: Only 1/3 chance to move when standing on MUD
- **Village Structure Blocking**: Cannot move to tiles with non-passable POIs (wells, markets, windmills, entrances) or living NPCs
- **UI Movement Restrictions**: Arrow keys disabled for player movement when inventory UI is open
  - **Other UI Types**: Text box and tombstone UI also pause movement through game logic pause
  - **Directional Updates**: Player facing direction still updates when UI is open
  - **Action Blocking**: Attack and interact actions disabled during UI display

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

## 💀 **Death & Tombstone System**

### **Entity Death Mechanics**
- **Player Death**: When player health ≤ 0
  - Creates tombstone at death location with player's complete 9-slot inventory
  - Player respawns at world origin (0,0) with full health and empty inventory
  - Player must retrieve items from tombstone by interacting with it
- **Animal Death** (chicken, pig, sheep): When killed by player
  - Inventory items automatically transferred to player inventory
  - No tombstone created (animals consumed immediately)
- **Trader/Monster Death**: When health ≤ 0
  - Creates tombstone with NPC's 9-slot inventory
  - Tombstone becomes interactable POI on the tile
  - Original NPC removed from world

### **Tombstone Interaction System**
- **Activation**: Press `F` key while facing a tombstone to open inventory UI
- **Navigation**: Use `Left/Right` arrow keys to navigate through 9 inventory slots
- **Item Selection**: Selected slot highlighted with blue border
- **Take Selected Item**: Press `X` key to take only the selected item
- **Take All Items**: Press `Z` key to transfer all tombstone items to player inventory
- **Close Interface**: Press `F` key again to close tombstone inventory UI
- **Inventory Management**: Items stack with existing player inventory when possible
- **Auto-Cleanup**: Tombstones automatically disappear when inventory becomes empty

### **Tombstone UI Features**
- **3x3 Grid Layout**: Tombstone inventory displayed in organized grid format
- **Entity Identification**: Title shows deceased entity name (e.g., "Player's Tombstone", "Orc's Tombstone")
- **Item Counter**: Real-time display of remaining items (e.g., "Items: 5/9")
- **Visual Feedback**: Selected slot highlighted, item quantities displayed
- **Bubble Design**: Modern rounded UI matching game's aesthetic
- **Instruction Text**: Built-in help text showing available controls

### **Tombstone System**
- **Sprite Variants**: Random selection from 8 tombstone variants (Tombstones.png index 0-7)
- **Inventory Storage**: Each tombstone holds 9 inventory slots from dead entity
- **Position Tracking**: Tombstones placed at exact death location
- **Automatic Cleanup**: Tombstones disappear when inventory becomes empty
- **Naming**: Tombstones display entity type (e.g., "Player's Grave", "Orc Grave")

### **NPC Inventory System**
All NPCs now have 9-slot inventories with randomly generated items:

**Animal Inventories**:
- **Chicken**: 1-3 chicken_meat, 1-2 feather
- **Pig**: 2-5 pork, 1-2 leather
- **Sheep**: 1-3 mutton, 2-5 wool

**Trader Inventories**:
- **All Traders**: 5-14 gold, 1-3 bread, 1-2 potion

**Monster Inventories**:
- **Orcs/Goblins/Skeletons**: 1-3 bone, 0-1 dark_gem, 0-1 weapon_part

**Slime Inventories**:
- **All Slimes**: 2-6 slime, 1-3 blue_essence

## 🏚️ **Dungeon System**

### **Enhanced Dungeon Generation**
- **Connected Tunnel System**: Uses entrance position to generate a single winding tunnel path
- **Extended Main Tunnel**: Primary corridor extends up to 50 tiles from entrance using noise-based pathfinding
- **Enhanced NPC Movement Space**: Significantly expanded passable areas for NPC movement throughout dungeons
- **Moderate Branching**: Secondary tunnels (15-30 tiles) with 25% spawn chance for exploration variety
- **Larger Size**: Total dungeon area approximately 500 tiles for substantial exploration
- **Deterministic Generation**: Same entrance always generates same dungeon layout based on entrance world coordinates
- **Monster Exclusion Zone**: 10x10 tile area around dungeon entrance prevents monster spawning for safe entry

### **Enhanced Tunnel Architecture for NPC Movement**
- **Entrance Area**: 8-tile radius around entrance guaranteed to be tunnel (increased from 5 tiles for safe spawn zone)
- **Main Corridor**: Winding path up to 50 tiles deep using generous noise values < 0.5 (increased from 0.35)
- **Branch Tunnels**: Enhanced paths (15-35 tiles) with noise values < 0.3 (increased from 0.2) and 25% spawn chance
- **Room System**: New room areas (distance < 25, noise < 0.25) providing large movement spaces for NPCs
- **Connecting Corridors**: Additional corridor system (distance < 40, noise < 0.15) linking rooms and branches
- **Void Boundaries**: All non-tunnel areas are VOID tiles (impassable black areas)
- **Mixed Flooring**: Random mix of STONE (60%) and COBBLESTONE (40%) for visual variety

### **Camera-View-Based NPC Updates**
The dungeon implements the same sophisticated NPC update system as the world:
- **Camera-Based Radius**: NPCs updated within camera view + 5-tile buffer (adaptive to screen resolution)
- **Performance Optimization**: Only visible NPCs are updated for smooth gameplay
- **Two-Phase Movement**: Same advanced movement coordination as world system
- **Flocking Algorithm**: All NPCs share movement intentions for deadlock resolution

### **Rare Chest System**
- **Maximum Limit**: Up to 10 rare chests per dungeon for balanced treasure distribution
- **Even Distribution**: Grid-based spawning system (6-tile spacing) ensures chests are evenly distributed throughout dungeon
- **High Spawn Rates**: 15% base chance for common chest generation throughout dungeon areas
- **Distance Requirement**: Chests spawn 8+ tiles from entrance to avoid overcrowding entry area
- **No Noise Threshold**: Simplified generation removes complex noise requirements for more reliable spawning
- **Impassable Barriers**: Chests block both player and NPC movement
- **Random Inventory Generation**: Each chest contains 0-7 randomly selected items:
  - **Ores**: Copper ore (0-5), iron ore (0-3), gold ore (0-2), coal (0-4)
  - **Precious Materials**: Silver ore (0-3), gold ingots (0-2)
  - **Monster Parts**: Bones (0-15)
- **Deterministic Content**: Same chest always contains same items based on entrance position seed
- **Dual Inventory UI**: Player inventory (left 50%) and chest inventory (right 50%)
- **Bidirectional Transfers**: Arrow keys navigate between inventories, X/Z keys transfer items
- **Persistent Storage**: Chest inventories saved in tile cache data

### **Portal Discovery System** - Enhanced December 2024
- **Single Persistent Portal**: Exactly one portal spawns at the furthest accessible point (45-50 tiles from entrance)
- **Deterministic Placement**: Portal spawns at the furthest valid tunnel location from entrance using noise-based selection
- **Cached Position**: Portal location is permanently stored in dungeon tile cache data for consistency
- **Cross-Session Persistence**: Portal remains in same location when re-entering the same dungeon entrance
- **Console UI Integration**: Portal position displayed in console UI when in dungeon mode
- **Famous Game Quotes**: Random selection from Zelda, Skyrim, D&D, Mario, Minecraft:
  - "It's dangerous to go alone! Take this." (Zelda)
  - "You have found something truly special!"
  - "The portal shimmers with ancient magic..."
  - "A gateway to adventure awaits!"
- **Two-Stage Interaction**: First interaction shows discovery message, second interaction teleports
- **Safe Return**: Portal returns player to nearest unoccupied tile near dungeon entrance
- **Guaranteed Generation**: System ensures exactly one portal is generated per dungeon
- **No "NOT FOUND" Display**: Console UI always shows portal location once generated

### **Advanced Dungeon NPC Movement System**

#### **Two-Phase Movement Coordination (Like World System)**
The dungeon implements the same sophisticated flocking algorithm as the world system:
- **Phase 1**: Collect movement intentions from ALL NPCs within 50-tile radius for coordination
- **Phase 2**: Execute updates with registered movement intentions for deadlock resolution

#### **Enhanced Search and Update Radius**
- **NPC Collection Radius**: 50-tile radius to find ALL dungeon NPCs (expanded from 15 tiles)
- **Update Radius**: 30-tile radius for actual NPC updates (expanded from 15 tiles)
- **Flocking Coordination**: All NPCs share movement intentions for swapping and coordination
- **Speculative Movement**: NPCs can coordinate to swap positions when blocked

#### **Movement Intention System**
- **Intention Collection**: NPCs declare movement targets before any actual movement
- **Coordinated Swapping**: NPCs can swap positions when both want each other's tiles
- **Chain Movement**: If one NPC wants to move away, others can coordinate to take their place
- **Deterministic Behavior**: Movement decisions cached for 100ms to ensure consistent intention-execution matching
- **Escape Mechanism**: Long-stuck NPCs (8+ seconds) get increased randomness to break deadlocks

#### **Dungeon-Specific Collision System**
- **VOID Tile Blocking**: Only VOID tiles and impassable structures block movement in dungeons
- **World Content Isolation**: World trees, cactus, and world NPCs don't affect dungeon movement
- **Dynamic Tile Creation**: System creates passable STONE tiles for NPCs when moving to VOID areas
- **Automatic Cache Updates**: Dungeon tile cache automatically updates when NPCs create new passable areas

### **Player Movement & Tile Validation**
- **Rendering Mode-Based Movement**: Movement system automatically switches between world and dungeon tile checking
- **Dungeon Movement Rules**: In dungeon mode, only VOID tiles and impassable structures block movement
- **World Movement Rules**: In world mode, standard world passability rules apply (water, stone, trees, etc.)
- **Isolated Systems**: World content (trees, cactus, world NPCs) completely isolated from dungeon movement
- **Smart Tile Detection**: System automatically uses appropriate tile source based on camera rendering mode

### **Dungeon Entrances & Exits**
- **Surface Entrance**: POI remains at exact world coordinates in both world and dungeon views
- **Entrance Interaction**: F key switches camera to dungeon rendering mode
- **Smart Player Spawning**: Player spawns at nearest unoccupied tile to entrance (searches up to 10 tiles)
- **Single Portal Generation**: Exactly one portal spawns 45-50 tiles from entrance (30% chance per valid tile)
- **Guaranteed Exit**: Portal generation ensures players can always return to surface
- **Portal Exit**: F key interaction returns to surface at nearest unoccupied tile to entrance
- **Smart Cache Management**: Dungeon chunks preserved when re-entering same dungeon, cleared only when entering different dungeons
- **Portal Position Persistence**: Portal location cached and preserved across dungeon visits for consistency

### **Rendering System Isolation**
- **Complete Isolation**: Dungeon mode shows only dungeon content (no world trees/NPCs/health bars)
- **World Animation Blocking**: Animation system and world health bars disabled in dungeon mode
- **Camera Mode Toggle**: Seamless switching between world and dungeon views
- **Entrance Position Tracking**: Dungeon system stores entrance coordinates for consistent generation
- **Visual Consistency**: Clean dungeon-only rendering with proper tile colors and structure sprites
- **Health Bar Integration**: Dungeon NPCs show health bars when damaged (same system as world NPCs)

### **Dungeon Features & Rewards**

#### **High Amplitude Noise Entity System**
- **Single Noise Function**: Uses high amplitude noise to determine all entity placement (monsters, chests, portals)
- **Threshold-Based Spawning**: Different noise amplitude ranges spawn different entity types
- **Environment-Agnostic**: Reusable system for dungeons, caves, forests with different thresholds
- **No Circular Dependencies**: Clean architecture eliminates complex tile-checking during generation

#### **Dungeon Entity Thresholds** - Updated December 2024
- **Monsters**: 60-85% noise amplitude (25% of tunnel tiles, increased from 15%)
- **Chests**: 85-95% noise amplitude (10% of tunnel tiles)
- **Portals**: 95-100% noise amplitude (5% of tunnel tiles, rarest)

#### **Enhanced Monster Distribution** - Updated December 2024
- **Increased Spawn Rate**: Monsters spawn at high noise peaks (60-85% amplitude, increased from 70-85%)
- **Higher Monster Frequency**: 25% increase in monster encounters throughout dungeons
- **Minimum Spacing**: 3-tile minimum distance between monsters prevents overcrowding
- **Monster Variety**: Same types as surface (orcs, skeletons, goblins, slimes, etc.)
- **Aggressive Behavior**: All dungeon monsters are hostile by default
- **Entrance Exclusion**: 10-tile radius around entrance remains monster-free for safe entry
- **Performance Optimized**: Reduced console logging (only 10% of spawns logged) to prevent lag during generation

#### **Treasure Chest System**
- **Amplitude-Based Placement**: Chests spawn at highest noise peaks (85-95% amplitude)
- **Minimum Spacing**: 4-tile minimum distance between chests prevents overcrowding
- **Maximum Limit**: 10 chests per dungeon for balanced treasure distribution
- **Quality Scaling**: Loot quality improves with distance from entrance (adjusted for 50-tile depth)
- **Chest Contents by Depth**:
  - **Shallow (0-20 tiles)**: Copper ore, iron ore, gold ore, leather
  - **Medium (20-35 tiles)**: Above + gold ingots, rare gems
  - **Deep (35-50 tiles)**: Above + magic potions, ancient artifacts
- **Deterministic Generation**: Same entrance position always generates same chest locations and contents
- **Performance Optimized**: Reduced console logging (only first 3 chests and every 3rd chest logged) to prevent lag during generation

#### **Reusable Entity Spawning System**
- **Static Utility Method**: `Dungeon.getEntitySpawnType()` for cross-environment use
- **Environment Support**: Dungeons, caves, forests with different entity types and thresholds
- **Extensible Design**: Easy to add new environments and entity types
- **Clean Architecture**: Single noise evaluation per tile, no complex proximity checking during generation

### **Player Experience** - Updated December 2024
- **Safe Entry**: Entrance area guaranteed passable for player spawning
- **Substantial Exploration**: Larger tunnel system provides meaningful adventure while maintaining clear progression
- **Progressive Difficulty**: Monsters and rewards increase with exploration depth over 50-tile journey
- **Single Guaranteed Exit**: Exactly one portal ensures focused exit strategy and prevents confusion
- **Increased Monster Encounters**: 25% increase in monster spawn rates guarantees more frequent combat
- **Enhanced Tunnel Width**: Expanded tunnel generation (0.5 threshold vs 0.35) provides more movement space
- **Improved NPC Movement**: Extended branching, room systems, and connecting corridors for better NPC navigation
- **Clean Interface**: No world content bleeding into dungeon view for immersive experience
- **Balanced Risk vs Reward**: Better loot deeper in dungeon balances increased monster danger and exploration time

## 🎒 **Inventory System**

### **Inventory Structure**
- **Slots**: 9 inventory slots (accessible via keys 1-9) in 3x3 grid layout
- **Stacking**: Items stack up to their max stack size
- **Selection**: Number keys 1-9 select inventory slots
- **Display**: Visual UI on right side of screen with sprites

### **Equipment & Armor System**
- **Armor Slots**: 7 dedicated equipment slots for character customization
- **Slot Types**:
  - **Head**: Helmets, hats, crowns
  - **Torso**: Chestplates, robes, shirts
  - **Arms**: Gloves, gauntlets, bracers
  - **Legs**: Leggings, pants, leg armor
  - **Feet**: Boots, shoes, sandals
  - **Left Hand**: Shields, torches, off-hand items
  - **Wearable**: Necklaces, amulets, accessories
- **Visual Layout**: Two-row layout in player inventory UI (4 slots top row, 3 slots bottom row)
- **Character Enhancement**: Equipment provides stat bonuses and visual changes
- **Future Expansion**: System designed to support equipment effects and visual customization

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
| `copper_ore` | 64 | Monster drops, Stone mining | Raw material |
| `gold_ingot` | 64 | Trader drops, Chests | Refined material |

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
- **Health Bars**: Structures show health bars when damaged (14px wide, 2px high, 4px above sprite)
  - Red background bar shows total health capacity
  - Green foreground bar shows current health percentage

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

### **Cactus Damage System**
- **Environmental Hazard**: Living cactus deal damage to entities standing on their tiles
- **Damage Amount**: 5 damage per frame to any entity (player, NPCs) on living cactus tiles
- **Area of Effect**: 20-tile radius checking around player for efficient damage application
- **Entity Filtering**: Only affects entities with health > 0 (living entities)
- **Console Logging**: Damage events logged for debugging and feedback

## ⚔️ **Combat System**

### **Player Combat Stats**
- **Attack Damage**: 5 damage per attack (reduced from 10)
- **Health**: 100 HP (max health)
- **Attack Range**: Adjacent tiles only (facing direction)
- **Attack Cooldown**: No cooldown (can attack continuously)
- **Health Restoration**: Available via water wells (+25 health)
- **Blocking**: G key to block attacks, reduces incoming damage from 5 to 1

### **Attack Mechanics**
- **Target Selection**: Attacks structure or NPC in facing direction
- **Damage Application**: Consistent 5 damage per attack for player
- **Health Tracking**: Target health decreases with each attack
- **Destruction Threshold**: Targets destroyed when health ≤ 0
- **Priority System**: Trees → Cactus → NPCs → Nothing
- **Blocking System**: Hold G key to reduce incoming damage to 1 (from any amount)

### **Enhanced NPC Combat System**

#### **Trader Defensive Combat**
Trader NPCs implement sophisticated defensive behavior when encountering monsters:
- **Monster Detection**: Traders detect monsters within 5-tile radius
- **Defensive Attacks**: When not being attacked, traders can attack adjacent monsters dealing 5 damage
- **Auto-Blocking Mechanism**: When being attacked by monsters, traders automatically block, reducing damage from 5 to 1
- **Attack State Detection**: Traders check if monsters are currently attacking them before deciding to counter-attack
- **Priority System**: Defensive combat takes priority over village structure attraction
- **Loot Collection**: Traders collect drops from monsters they kill
- **Flee Behavior**: Traders still flee from monsters when not in defensive position
- **Console Feedback**: System logs when traders block attacks: "🛡️ [TraderType] blocks attack from [MonsterType]!"

#### **Monster Combat Behavior**
Monsters implement aggressive combat with multiple target types:
- **Primary Targets**: Animals, traders, and players (player has priority 2, NPCs priority 1)
- **Attack Damage**: 5 damage to friendly NPCs and players
- **Monster vs Monster**: 10% chance to attack other monsters, dealing 3 damage
- **No Blocking**: Monsters never block attacks, always take full damage
- **Loot Collection**: Monsters collect drops from any NPCs they kill (including other monsters)
- **Attack Cooldown**: 1 second between attacks

#### **Player Combat Enhancements**
- **Attack Damage**: 5 damage per attack (standardized with NPCs)
- **Blocking**: Hold G key to reduce incoming damage to 1
- **Monster Damage**: Takes 5 damage from monster attacks when not blocking
- **Blocking Feedback**: Console shows damage reduction when blocking successfully

### **Combat Damage Matrix**
| Attacker | Target | Base Damage | Blocked Damage | Notes |
|----------|--------|-------------|----------------|-------|
| **Player** | Any NPC/Structure | 5 | N/A | Standard attack damage |
| **Monster** | Player | 5 | 1 (if blocking) | Player can block with G key |
| **Monster** | Friendly NPC | 5 | 1 (auto-block) | Traders auto-block when being attacked |
| **Monster** | Other Monster | 3 | 3 (no blocking) | Monsters never block |
| **Trader** | Monster | 5 | N/A | Defensive combat only |

### **Monster Drop Collection System**
- **Automatic Collection**: When monster NPCs kill other NPCs, victim drops are automatically added to monster inventory
- **Inventory Integration**: Monster NPCs have 9-slot inventories that intelligently stack items
- **Smart Stacking**: Items of same type automatically combine up to stack limits
- **Console Logging**: Real-time feedback shows successful collections: "🎯 [MonsterType] collected [quantity]x [item]"
- **Inventory Full Handling**: Monsters with full inventories display warning: "⚠️ [MonsterType] inventory full, couldn't collect [item]"
- **No Tombstone Creation**: When monsters kill NPCs, items go directly to monster inventory (no tombstone spawned)
- **Monster Death Drops**: When monsters die, their collected items drop normally creating tombstones

### **NPC Combat & Drops**
| NPC Type | Health | Drops When Defeated | Behavior When Attacked |
|----------|---------|-------------------|------------------------|
| **Chicken** | 20 HP | 1x Chicken Meat | Flees, becomes 'fleeing' state |
| **Pig** | 35 HP | 3x Pork | Flees, becomes 'fleeing' state |
| **Sheep** | 25 HP | 1x Mutton + 3x Wool | Flees, becomes 'fleeing' state |
| **Trader NPCs** | 50 HP | 1x Gold Ingot | Defends against monsters, flees from player |
| **Orc/Skeleton/Goblin** | 40 HP | 1x Copper Ore | Aggressive, attacks all friendly NPCs and players |
| **Archer Goblin** | 60 HP | 1x Monster Drop | Aggressive, attacks all friendly NPCs and players |
| **Club Goblin** | 80 HP | 1x Monster Drop | Aggressive, attacks all friendly NPCs and players |
| **Farmer Goblin** | 70 HP | 1x Monster Drop | Aggressive, attacks all friendly NPCs and players |
| **Orc Shaman** | 100 HP | 2x Monster Drop | Aggressive, attacks all friendly NPCs and players |
| **Spear Goblin** | 90 HP | 1x Monster Drop | Wide attack (2 tiles), aggressive |
| **Mega Slime Blue** | 150 HP | 3x Monster Drop | Aggressive, attacks all friendly NPCs and players |
| **Slime** | 40 HP | 1x Monster Drop | Aggressive, attacks all friendly NPCs and players |

### **Attack Animation System**
All NPCs feature comprehensive attack animation systems:
- **Directional Attacks**: 4-direction attack sprites (up, down, left, right)
- **Attack Duration**: 600ms attack animation cycles
- **Attack Cooldown**: 1 second between attacks for NPCs
- **Facing Direction**: NPCs automatically face their attack target
- **Wide Attack System**: SpearGoblin features special 2-tile wide attacks
  - Renders attack animation on both player tile and facing tile
  - Uses dedicated wide attack sprite frames

### **Monster Flocking Algorithm**
Monsters implement sophisticated flocking behavior:
- **Target Acquisition**: Actively seek out friendly NPCs and players within detection range
- **Flocking Movement**: Move towards nearest friendly targets when not adjacent
- **Combat Engagement**: Attack when adjacent to targets, dealing 5 damage
- **Priority Targeting**: Player has higher priority (2) than NPCs (1)
- **Attack Cooldown**: 1 second between monster attacks
- **Monster vs Monster**: Occasional attacks on other monsters (10% chance, 3 damage)

### **Combat Feedback**
- **Health Display**: NPCs show health bars when damaged
- **Structure Health Bars**: Trees and cactus display health bars when damaged (red background, green foreground, 4px above sprite)
- **Death Removal**: Dead NPCs are automatically removed from tiles
- **Drop Collection**: Items automatically added to player inventory
- **Console Logging**: Real-time combat updates and health tracking
- **Attack Animation**: Visual feedback during combat with proper sprite frames
- **Blocking Feedback**: Console shows damage reduction for both player and trader blocking

### **Combat Controls**
- **Attack**: `Q` key attacks target in facing direction
- **Block**: `G` key (hold) to block incoming attacks, reducing damage to 1
- **Interact with Combat Animation**: `F` key triggers interaction with attack animation for visual feedback
- **Target Display**: Console shows target tile and health status
- **Damage Feedback**: Real-time health updates displayed
- **Animation Integration**: Both attack and interact actions trigger player attack animation

## 🏆 **Player Score System**

### **Village-Based Reputation**
The game features a comprehensive reputation system that tracks player actions within each village:
- **Score Range**: -50 to +100 points per village
- **Village Detection**: 50x50 tile grid areas, automatic village discovery
- **Persistent Tracking**: Scores stored per village with unique IDs
- **Area-Based**: Actions only affect score when within village boundaries

### **Score Modifiers**
| Action | Score Change | Description |
|--------|-------------|-------------|
| **Task Completion** | +5 points | Complete village quests or objectives |
| **Monster Defeated** | +1 point | Kill monsters within village area |
| **Animal Attacked** | -3 points | Attack village animals (chicken, pig, sheep) |
| **Trader Attacked** | -5 points | Attack village traders |
| **Village Defended** | +2 points | Defend village from threats |

### **RPG Dialogue System**
Trader interactions display score-based messages from popular RPG games:
- **35+ Authentic Quotes**: Sourced from Skyrim, Oblivion, Fallout, Zelda, Mario
- **Score Range System**: Uses minScore/maxScore ranges instead of exact thresholds
- **Random Comment Selection**: Randomly selects from multiple comments within appropriate score range
- **Dynamic Responses**: Comments change based on player reputation
- **Village Context**: Dialogue includes village name and context

#### **Dialogue Score Ranges**
| Score Range | Category | Sample Dialogue | Source Game |
|-------------|----------|-----------------|-------------|
| **-50 to -21** | Hostile | "We don't like your kind around here!" | Skyrim |
| **-20 to -1** | Cold | "I got nothing to say to you." | Fallout |
| **0 to 19** | Neutral | "What do you want?" | Skyrim |
| **20 to 49** | Friendly | "It's a pleasure to meet you!" | Skyrim |
| **50 to 79** | Respected | "The whole village speaks well of you." | Skyrim |
| **80 to 100** | Hero | "You are the stuff of legend, my friend!" | Zelda |

### **Interaction System**
- **Trader Dialogue**: Press `F` near traders to trigger score-based dialogue
- **Village Discovery**: Walking near village wells automatically initializes score tracking
- **Score Display**: Console logging shows score changes and current reputation
- **Cross-Village**: Each village maintains independent reputation scores

## 🎮 **User Interface System**

### **Enhanced Inventory UI System (December 2024)**

#### **Player Inventory UI Layout Redesign**
The player inventory UI has been completely redesigned for optimal space utilization and user experience:

- **Left Side (50% width)**: Player inventory with 3×3 grid layout for 9 items
- **Right Side (50% width)**: Character view with armor slots and animated player sprite
- **Armor Slot Layout**: Three-column arrangement positioned to the left of player sprite:
  - **Column 1**: head, torso, legs, feet (4 vertical slots)
  - **Column 2**: left_hand, arms (right_hand), wearable (3 vertical slots, aligned at top)
  - **Column 3**: (reserved for future expansion)
- **Player Sprite Animation**: Continuously animated walking down sprite (4-frame cycle, 800ms duration)
  - **Sprite Source**: Uses RedDemon.png to match the actual player character sprite
  - **Continuous Animation**: Updates regardless of game state for dynamic character display
- **Height-Aware Sizing**: Slot sizes calculated based on both width AND height constraints to prevent overflow
- **Minimum Slot Size**: 30px minimum ensures slots remain usable on smaller screens

#### **Enhanced Navigation System**
- **Arrow Key Navigation**: Full 4-directional navigation between inventory grid and armor slots
- **Cross-Section Movement**: Seamless navigation from 3×3 inventory grid to armor slots and vice versa
- **Grid-Based Logic**: Smart navigation using row/column calculations for intuitive movement
- **Wrap-Around Behavior**: Navigation wraps within sections for continuous movement
- **Visual Feedback**: Selected slots highlighted with blue background and border

#### **Trade Inventory UI Improvements**
- **Dual-Container Layout**: Player inventory (left 50%) and chest/tombstone inventory (right 50%)
- **3x3 Grid Layout**: Both player and container inventories use 3x3 (9 slot) grids
- **4-Directional Navigation**: Up/down/left/right arrow keys for full grid navigation
- **Height-Aware Sizing**: Same responsive sizing system as player inventory
- **Bidirectional Transfers**: X key for selected item, Z key for all items
- **Mode Switching**: Left/right arrows switch between player and container inventories

### **Atomic OOP Architecture & Game Loop Optimization**

#### **InputSystem Implementation**
- **Centralized Input Processing**: Single system handles all input with action queue architecture
- **Priority-Based Processing**: ESC key processed first, then UI-specific inputs, then game inputs
- **Action Interface**: Structured InputAction objects with type, direction, key, and data fields
- **UI Context Awareness**: Different input handling for player inventory, chest, menu, and textbox UIs
- **Clean Separation**: Input processing completely separated from action execution

#### **ActionSystem Implementation**
- **Atomic Action Processing**: Each action processed independently with proper error handling
- **Single Responsibility**: Dedicated methods for attack, interact, UI navigation, and menu actions
- **Environment-Aware**: Automatic switching between world and dungeon action handling
- **Type-Safe Actions**: Strongly typed action system with TypeScript interfaces
- **Modular Design**: Easy to extend with new action types and behaviors

#### **Game Loop Optimization**
- **UI-Aware Updates**: Game logic pauses when UI is visible, but animations continue
- **Continuous UI Animations**: Player sprite and UI animations update regardless of game state
- **Efficient Input Processing**: Input actions processed before game logic updates
- **Clean State Management**: Proper separation between UI state and game state

### **Bubble-Style UI Design**
The game features a modern bubble-style UI with white backgrounds and rounded borders inspired by contemporary mobile interfaces:

### **Responsive UI Architecture**
The game implements a sophisticated responsive layout system that adapts to different screen sizes:

#### **Layout Calculation System**
- **Fixed Right Panel**: 74px width for inventory items (50px slot + 24px padding)
- **Available Space**: Canvas width minus inventory panel width and edge spacing (15px)
- **Shared UI Width**: Available space minus UI padding (20px × 2) for consistent sizing
- **Dynamic Centering**: All UI overlays center horizontally within available space
- **Height Consistency**: Inventory UI overlay matches inventory panel height exactly

#### **Component Relationships**
- **Text Box ↔ Inventory UI**: Both use identical width and centering calculations
- **Inventory Panel ↔ Inventory UI**: Overlay matches panel height for visual alignment
- **Responsive Breakpoints**: UI automatically adjusts as canvas resizes
- **Consistent Spacing**: All components maintain proportional spacing at any resolution

#### **Text Box System (Pokemon DS-Inspired)**
- **Style**: Rounded bubble design with white background and subtle shadow
- **Positioning**: Bottom of screen with responsive padding
- **Activation**: Press `F` key on notice boards to display village information
- **Dismissal**: Any key press, `ESC` key, or player movement closes the text box
- **Content**: Village names, descriptions, and lore text
- **Typography**: Clean Arial font with proper hierarchy (bold titles, regular body text)
- **Game Pause**: Game logic pauses while text box is displayed
- **Responsive Layout System**:
  - **Width Calculation**: Uses available canvas width minus right-side inventory panel width
  - **Dynamic Centering**: Automatically centers horizontally in available space
  - **Shared Dimensions**: Uses same width calculation as inventory UI overlay for consistency
  - **Text Wrapping**: Content automatically wraps based on calculated responsive width

#### **Inventory UI (3DS-Inspired)**
- **Style**: Bubble slots with rounded corners and modern aesthetics
- **Layout**: 9 vertical slots on the right side of screen (inventory panel) + detailed overlay when opened
- **Slot Design**: White background bubbles with light blue selection highlighting
- **Visual Elements**:
  - Slot numbers (1-9) in top-left corner
  - Item icons with simplified colored representations
  - Quantity badges in bottom-right corner for stackable items
  - Selected slot highlighting with blue border and background tint
- **Interaction**: Click slots or use number keys 1-9 for selection
- **Drop Shadow**: Subtle shadow effects for depth perception
- **Toggle Feature**: Press `E` key to open/close detailed inventory UI overlay
- **Emergency Close**: Press `ESC` key to immediately close inventory UI
- **Movement Restriction**: Arrow keys do not move player when inventory UI is open
- **Game Pause**: Game logic pauses while inventory UI is displayed
- **Responsive Layout System**:
  - **Shared Width**: Inventory UI overlay matches text box width exactly
  - **Shared Height**: Inventory UI overlay matches right-side inventory panel height exactly
  - **Available Space Calculation**: Both components use remaining canvas width minus inventory panel width
  - **Dynamic Resizing**: UI components automatically adjust to canvas size changes
  - **Consistent Centering**: Both UI overlays use identical horizontal centering logic

#### **Player Inventory UI System** (Primary) - Updated December 2024
- **Style**: Full-width bubble design with modern responsive layout
- **Layout**: Split-screen design with inventory management (left 50%) and character view (right 50%)
- **Left Side - Player Inventory**:
  - **3×3 Inventory Grid**: Items arranged in organized grid at top of left section
  - **Height-Aware Sizing**: Slots sized to fit available height without overflow
  - **Responsive Width**: Fills 50% of container width with optimal slot sizing
  - **No Armor Slots**: Armor slots moved to right side for better organization
- **Right Side - Character View with Armor Slots**:
  - **Player Name**: Displays character name at top
  - **Armor Slot Layout**: Two-column arrangement to left of player sprite:
    - **Column 1**: head, torso, legs, feet (4 slots vertically)
    - **Column 2**: left_hand, wearable, arms (3 slots vertically)
  - **Animated Player Sprite**: Continuously animated walking down sprite (4-frame cycle, 800ms)
  - **Minimum Sprite Size**: 32px minimum ensures visibility on all screen sizes
  - **Debug Support**: Placeholder shown if sprite fails to load

#### **Player Inventory UI Navigation** - Enhanced December 2024
- **Natural Directional Navigation**: Arrow keys follow visual layout directions
  - **Left/Right**: Navigate between left inventory grid and right armor slots
  - **Up/Down**: Navigate within sections (inventory grid or armor columns)
- **Visual Direction Mapping**:
  - **Right Arrow**: From inventory grid moves to corresponding armor slots
  - **Left Arrow**: From armor slots returns to corresponding inventory positions
- **Grid-Based Movement**: Intelligent navigation using row/column calculations
- **Cross-Section Navigation**: Seamless movement between inventory grid and armor slots
- **Position Preservation**: When switching sections, maintains relative row/column position
- **Visual Feedback**: Selected slot highlighted with blue background and border
- **Slot Layout**:
  - **Inventory Slots**: 0-8 (3×3 grid on left side)
  - **Armor Slots**: 9-15 (three-column layout on right side)
    - **Column 1**: 9-12 (head, torso, legs, feet)
    - **Column 2**: 13-15 (left_hand, arms/right_hand, wearable)
- **Navigation Logic**:
  - **Within Inventory**: Standard 3×3 grid navigation with wrap-around
  - **Within Armor**: Three-column navigation with vertical movement in each column
  - **Between Sections**: Left/right arrows move between inventory and armor areas naturally
- **Full-Width Container**: Uses entire canvas width when open (hides right-side inventory panel)
- **Activation**: Press `E` key to toggle player inventory UI
- **Close Options**: `E` key or `ESC` key to close interface
- **Game Pause**: Game logic pauses while player inventory UI is displayed

#### **Trade Inventory UI System** (Chests & Tombstones) - Enhanced December 2024
- **Style**: Full-width bubble design with responsive layout
- **Layout**: Split-screen design with player inventory (left 50%) and container inventory (right 50%)
- **Player Side**: Shows all 9 player inventory slots in 3×3 grid
- **Container Side**: Shows chest/tombstone inventory in 3×3 grid with entity name
- **Height-Aware Sizing**: Slots sized based on both width and height constraints (minimum 30px)
- **Seamless Grid Navigation**: Arrow keys provide intuitive movement similar to player inventory UI
  - **Up/Down**: Navigate within current 3×3 grid with wrap-around (same as player inventory)
  - **Left/Right**: Seamless movement between player and container grids
    - **From Player Right Edge**: Moves to corresponding row in container (leftmost column)
    - **From Container Left Edge**: Moves to corresponding row in player (rightmost column)
    - **Within Grid**: Normal horizontal movement with wrap-around at edges
  - **Position Mapping**: Maintains row correspondence when switching between grids
- **Position Preservation**: When switching sides, maintains relative grid position
- **Grid Navigation**: Proper 3×3 grid movement with row/column calculations
- **Item Transfer**:
  - `X` key transfers currently selected item to opposite inventory
  - `Z` key transfers all items from current inventory to opposite
- **Visual Feedback**: Selected inventory side and slot highlighted with blue borders
- **Mode Indicators**: Clear visual indication of which inventory is currently selected
- **Bidirectional**: Items can move from player to container and vice versa
- **Persistent Storage**: Container inventories saved in tile cache data
- **Full-Width Container**: Uses entire canvas width when open (hides right-side inventory panel)
- **Close Options**: `F` key or `ESC` key to close interface
- **Game Pause**: Game logic pauses while trade inventory UI is displayed

#### **Selectable Inventory Panel** (Right-Side)
- **Style**: Vertical column of 9 inventory slots on right side of canvas
- **Visibility**: Hidden when any inventory UI component is visible
- **Selection**: Number keys 1-9 select inventory slots
- **Mouse Interaction**: Click slots to select items
- **Visual Feedback**: Selected slot highlighted with blue border
- **Purpose**: Quick access to inventory items during gameplay
- **Auto-Hide**: Automatically hidden when player inventory, trade inventory, chest, or tombstone UI is open

#### **Console UI System**
- **Style**: Black background containers with white text for high contrast visibility
- **Positioning**: Bottom-left corner of the canvas with 10px padding
- **Layout**: Vertical stack with persistent information entries
- **Entry Design**: Each info line has its own black bubble container sized to text width
- **Text Styling**: White text using pixel font (Press Start 2P) or Arial fallback
- **Auto-Sizing**: Container width automatically adjusts to text content (max 400px)
- **Persistent Information Display**: Always shows current game state information:
  - **Player Position**: Current tile coordinates (e.g., "Player Position: 15, -23")
  - **Nearest Village Well Position**: Closest water well coordinates or "NOT FOUND"
  - **Nearest Mine Entrance Position**: Closest mine entrance coordinates or "NOT FOUND"
  - **Nearest Dungeon Entrance Position**: Closest dungeon entrance coordinates or "NOT FOUND"
  - **Nearest Portal Position**: Portal coordinates when in dungeon mode or "NOT FOUND"
- **Real-Time Updates**: Information refreshes when player moves to new tile coordinates
- **Search Algorithm**: Uses expanding radius search up to 100 tiles for efficient structure detection
- **Mode-Aware Display**: Portal position only shown when in dungeon rendering mode

#### **Menu System**
- **Activation**: Press `ESC` key to open game menu when no other UI is active
- **Style**: Centered bubble design with rounded corners and modern styling
- **Options**:
  - **Back to Game**: Returns to gameplay (also accessible via ESC)
  - **Save Game**: Saves current game state to localStorage
- **Navigation**: Use `Up/Down` arrow keys to select options, `Enter` to confirm
- **Game Pause**: Game logic pauses while menu is visible
- **Save Confirmation**: Shows success/error message after save attempt
- **Data Storage**: Saves player position, health, inventory, and world timestamp
- **Load System**: Basic save detection (full loading not yet implemented)

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

### **UI Component Architecture**

#### **Main UI Structure**
The game implements a hierarchical UI system with the following components:

**Primary UI Container (`ui/`)**:
- **Inventory Container** (`inventory/`): Main inventory management system
  - **Player Inventory**: Full-featured inventory with character view and armor slots
  - **Trade Inventory**: Dual-container system for chest/tombstone interactions
- **TextBox Container**: Bubble-style message display with responsive layout
- **Selectable Inventory Panel**: Right-side quick-access inventory slots

#### **Inventory System Hierarchy**
```
ui/
├── inventory/ (inventory container)
│   ├── player-inventory/ (player inventory items, armor slots, sprite view)
│   └── trade-inventory/ (reusable container for player ↔ NPC/storage interactions)
├── textbox/ (textbox container with title, content, dismissal instructions)
└── selectable-inventory/ (right-side panel, hidden when other inventory UI visible)
```

#### **Character & Equipment System**
- **Player Character Data**: Name, sprite, and equipment tracking
- **Armor Slots**: 7 equipment slots (head, torso, arms, legs, feet, left_hand, wearable)
- **Character Sprite**: Scalable player sprite rendering with facing direction
- **Future Expansion**: System designed to support viewing NPCs and other players

### **UI Integration with Game Systems**
- **Inventory Sync**: Real-time updates when items are collected or used
- **Player Movement Detection**: Text boxes auto-dismiss on player movement
- **Key Handling**: Comprehensive input system for UI interaction
- **Canvas Rendering**: High-performance rendering with proper layering
- **Responsive Design**: UI adapts to different screen sizes and resolutions
- **Full-Width Layouts**: Inventory containers use entire canvas width for optimal space utilization
- **Auto-Hide System**: Right-side inventory panel automatically hidden when full UI components are open
- **Layout Coordination**: All UI components use shared responsive calculation methods
- **Console Integration**: Real-time logging system with automatic position tracking and structure detection
- **Movement Logging**: Console UI automatically logs player position and nearest important structures
- **Bubble Effects**: Consistent rounded corners, shadows, and modern styling throughout

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

### **Village Trader Generation**
Each village automatically generates 5 friendly trader NPCs:
- **Spawn Location**: 6-10 tiles from village center (water well)
- **Trader Types**: Axeman Trader, Swordsman Trader, Spearman Trader, Farmer Trader
- **Behavior**: Flocking algorithm similar to animals with specific attractions
  - **Village Structure Attraction**: Attracted to village buildings (wells, markets, windmills)
  - **Monster Avoidance**: Flee from hostile monsters within detection range
  - **Player Neutrality**: NOT attracted to player (unlike animals with wheat)
  - **Spacing**: Maintain 2+ tile minimum distance from other NPCs
- **Health**: 50 HP each
- **Drops**: 1x Gold Ingot when defeated
- **Interaction**: `F` key triggers RPG dialogue system
- **Movement**: 1.2 second cooldown, avoid player collision

### **Village Naming & Identity System**
- **Grid-Based Assignment**: Villages assigned to 50x50 tile grid areas
- **Random Name Generation**: Villages get completely random names using `Math.random()` for prefix/suffix selection
- **Name Caching**: Generated names cached per village grid to ensure consistency across sessions
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

#### **Transportation & Entrances**
| POI Type | Interaction | Effect | Passable |
|----------|-------------|--------|----------|
| `boat_vertical` | F key to board | Allows water travel (up/down) | Variable |
| `boat_horizontal` | F key to board | Allows water travel (left/right) | Variable |
| `mine_entrance` | F key to enter | Teleport to underground mine | ❌ Impassable |
| `dungeon_entrance` | F key to enter | Switch to dungeon rendering view | ❌ Impassable |
| `dungeon_portal` | F key to exit | Return to surface world rendering | ❌ Impassable |

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
| **Mine Entrance** | 70% of underground spawns | STONE/COBBLESTONE/GRAVEL/GRASS tiles, mine noise > 0.1 | Extremely common (testing) |
| **Dungeon Entrance** | 30% of underground spawns | STONE/COBBLESTONE/GRAVEL/GRASS tiles, mine noise > 0.1 | Extremely common (testing) |

#### **Generation Rules**
- **Noise Threshold**: 0.1+ (extremely common for testing purposes)
- **Noise Frequency**: 3x frequency for more variation
- **Biome Restriction**: Spawn on STONE, COBBLESTONE, GRAVEL, and GRASS tiles (testing)
- **Functionality**: Teleport player underground when interacted with
- **Spacing**: Minimum 2 tiles between underground structures (testing values)
- **Additional Spawn Chance**: 95% chance when noise threshold is met (testing values)

#### **Dungeon Monster Generation**
Each dungeon entrance automatically generates 5 hostile monsters:
- **Spawn Location**: 3-8 tiles from dungeon entrance
- **Monster Types**: Archer Goblin, Club Goblin, Farmer Goblin, Orc Shaman, Spear Goblin, Mega Slime Blue, Slime
- **Behavior**: Aggressive flocking towards friendly NPCs and players
- **Combat**: 5 damage attacks with 1 second cooldown
- **Health**: Varies by type (40-150 HP)
- **Drops**: Monster Drops (1-3 quantity based on type)

## 🐾 **NPC & Animal System**

### **NPC Types & Behavior**

#### **Animals**
| Animal | Health | Aggression | Drops | Behavior |
|--------|--------|------------|-------|----------|
| `chicken` | 20 HP | Peaceful | 1 chicken_meat | Follows wheat, flees when attacked, 4-frame walking animation |
| `pig` | 35 HP | Peaceful | 3 pork | Follows wheat, slow movement, 4-frame walking animation |
| `sheep` | 25 HP | Peaceful | 1 mutton, 3 wool | Follows wheat, grazes peacefully, 4-frame walking animation |

#### **Friendly Traders**
| Trader | Health | Aggression | Drops | Behavior |
|--------|--------|------------|-------|----------|
| `axeman_trader` | 50 HP | Peaceful | 1 gold_ingot | Flocking: attracted to village buildings, flees monsters, dialogue system |
| `swordsman_trader` | 50 HP | Peaceful | 1 gold_ingot | Flocking: attracted to village buildings, flees monsters, dialogue system |
| `spearman_trader` | 50 HP | Peaceful | 1 gold_ingot | Flocking: attracted to village buildings, flees monsters, dialogue system |
| `farmer_trader` | 50 HP | Peaceful | 1 gold_ingot | Flocking: attracted to village buildings, flees monsters, dialogue system |

#### **Hostile Monsters**
| Monster | Health | Aggression | Drops | Behavior |
|---------|--------|------------|-------|----------|
| `orc` | 120 HP | Aggressive | 1 copper_ore | Flocking behavior, attacks friendly NPCs |
| `skeleton` | 40 HP | Aggressive | 1 copper_ore | Flocking behavior, attacks friendly NPCs |
| `goblin` | 40 HP | Aggressive | 1 copper_ore | Flocking behavior, attacks friendly NPCs |
| `archer_goblin` | 60 HP | Aggressive | 1 monster_drop | Advanced flocking, 5-frame attack animation |
| `club_goblin` | 80 HP | Aggressive | 1 monster_drop | Advanced flocking, 5-frame attack animation |
| `farmer_goblin` | 70 HP | Aggressive | 1 monster_drop | Advanced flocking, 5-frame attack animation |
| `orc_shaman` | 100 HP | Aggressive | 2 monster_drop | Advanced flocking, 5-frame attack animation |
| `spear_goblin` | 90 HP | Aggressive | 1 monster_drop | Wide attack (2 tiles), 5-frame attack animation |
| `mega_slime_blue` | 150 HP | Aggressive | 3 monster_drop | Advanced flocking, 6-frame attack animation |
| `slime` | 40 HP | Aggressive | 1 monster_drop | Advanced flocking, 6-frame attack animation |

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

#### **Trader-Specific Flocking Behavior**
Trader NPCs implement specialized flocking AI distinct from animal behavior:
- **Village Structure Attraction**: Actively move towards nearby village buildings within 5-tile detection range
  - **Primary Targets**: Water wells, markets, windmills, notice boards
  - **Attraction Strength**: Similar to animal wheat-following but for structures
- **Monster Avoidance**: Flee from hostile monsters (orcs, goblins, skeletons, slimes) within detection range
  - **Avoidance Priority**: Monster avoidance overrides structure attraction
  - **Flee Distance**: Move away from monsters until outside detection range
- **Player Neutrality**: Traders do NOT follow or avoid players unless attacked
  - **No Wheat Response**: Unlike animals, traders ignore players carrying wheat
  - **Combat Response**: Only flee from player if attacked (enters 'fleeing' state)
- **Trader Clustering**: Traders avoid crowding around same structures
  - **Spacing**: Maintain 2+ tile minimum distance from other NPCs
  - **Structure Distribution**: Multiple traders spread across different village buildings

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
- **Block**: `G` key (hold) - Block incoming attacks, reducing damage to 1

### **Interaction Controls**
- **Interact**: `F` key - Interact with POIs and structures
  - **Notice Boards**: Displays village information in bubble-style text box
  - **Water Wells**: Restores 25 health points
  - **Trader NPCs**: Triggers merchant-specific greetings and phrases
  - **Animals**: Shows animal sounds and noises
  - **Monsters**: Displays monster grunts and famous quotes
  - **Tombstones**: Opens tombstone inventory UI for item retrieval
  - **Dungeon Entrances**: Switches camera to dungeon rendering mode
  - **Dungeon Portals**: Returns camera to surface world rendering mode
  - **Rare Chests**: Opens dual inventory UI for item management
  - **Other POIs**: Various context-specific interactions

### **Inventory & Menu Controls**

#### **Primary Inventory Controls**
- **Open Player Inventory**: `E` key opens full-featured player inventory UI with character view and armor slots
- **Close Player Inventory**: `E` key or `ESC` key to close player inventory UI
- **Arrow Key Navigation**: `Up/Down/Left/Right` arrow keys navigate between inventory and armor slots when player inventory UI is open
- **Quick Slot Selection**: `1-9` keys select inventory slots (when right-side panel visible)
- **Mouse Selection**: Click inventory slots to select items (when right-side panel visible)
- **Menu System**: `ESC` key opens game menu with save/load options
- **Menu Navigation**: `Up/Down` arrow keys, `Enter` to select, `ESC` to close

#### **Trade Inventory System** (Chests & Tombstones)
- **Auto-Open**: Trade inventory UI automatically opens when interacting with chests/tombstones
- **Navigation**: Seamless grid-to-grid movement like player inventory UI
  - `Up/Down` arrow keys navigate within current 3×3 grid with wrap-around
  - `Left/Right` arrow keys provide seamless cross-grid movement:
    - **Within Grid**: Normal horizontal movement with wrap-around at edges
    - **Cross-Grid**: From rightmost player slot → leftmost container slot (same row)
    - **Cross-Grid**: From leftmost container slot → rightmost player slot (same row)
  - **Row Preservation**: Maintains row position when switching between grids
- **Transfer Selected**: `X` key transfers currently selected item between inventories
- **Transfer All**: `Z` key transfers all items from current inventory to opposite
- **Close Interface**: `F` key or `ESC` key closes trade inventory UI
- **Bidirectional**: Items can move from player to container and vice versa

#### **Inventory Panel Behavior**
- **Auto-Hide**: Right-side inventory panel automatically hidden when any full inventory UI is open
- **Quick Access**: Right-side panel provides quick inventory access during gameplay
- **Full-Width Mode**: Player and trade inventory UIs use entire canvas width for optimal space

### **UI Controls**
- **Close Any UI**: `ESC` key - Universal close key for all UI components
- **Movement Restriction**: Arrow keys disabled when inventory UI is open
- **Game Pause**: Game logic pauses when any UI component is open

## 🌐 **Translation & Interaction System**

### **Structured Translation Files**
The game features a comprehensive translation system organized by entity type:

#### **Animal Translations** (`src/game/translations/animals.ts`)
- **Chicken Sounds**: "Cluck cluck!", "Bawk bawk bawk!", "*happy chicken noises*"
- **Pig Sounds**: "Oink oink!", "Snort snort!", "*rolls in mud*"
- **Sheep Sounds**: "Baa baa!", "*gentle bleating*", "*peaceful grazing*"
- **Interactive Feedback**: Press F near animals to hear random sounds

#### **Monster Translations** (`src/game/translations/monsters.ts`)
- **Orc Quotes**: "Lok'tar!", "Zug zug!", "For the Horde!", "Blood and thunder!"
- **Goblin Sounds**: "Grr!", "Hehehe!", "*goblin cackle*", "Mine! Mine!"
- **Skeleton Sounds**: "*bone rattling*", "*eerie silence*", "*haunting moan*"
- **Specialized Types**: Each monster variant has unique sound sets
- **Famous Game References**: Includes authentic Warcraft, D&D, and fantasy quotes

#### **Trader Translations** (`src/game/translations/traders.ts`)
- **Axeman Trader**: "Sharp axes for sale!", "Wood you like to buy something?"
- **Swordsman Trader**: "Fine blades for warriors!", "Steel yourself for adventure!"
- **Spearman Trader**: "Long reach, fair prices!", "Spear-it of adventure!"
- **Farmer Trader**: "Fresh from the farm!", "Harvest the best deals!"
- **Dynamic Greetings**: Random selection from merchant-specific phrase sets

#### **Village Translations** (`src/game/translations/villages.ts`)
- **Welcome Messages**: "Welcome to our peaceful village!", "Greetings, weary traveler!"
- **Descriptions**: "Our village thrives through hard work and community spirit."
- **Closing Messages**: "May your stay be pleasant and your journey safe."
- **Dynamic Generation**: Notice boards show randomly combined welcome + description + closing

### **Enhanced Entity Interactions**
- **Context-Aware Responses**: Each entity type uses appropriate translation system
- **Random Selection**: Multiple phrases per entity prevent repetitive interactions
- **Immersive Feedback**: Sounds and quotes enhance world atmosphere
- **Cultural References**: Includes authentic quotes from popular fantasy games

---

## 🆕 **Recent Updates (December 2024)**

### **Major UI/UX Improvements**
- **Redesigned Player Inventory UI**: Armor slots moved to right side in three-column layout alongside animated player sprite
- **Corrected Inventory Layout**: Fixed player inventory to proper 3x3 (9 slots) grid as intended
- **Player Sprite Consistency**: UI now uses RedDemon.png to match the actual player character sprite
- **Height-Aware Slot Sizing**: Inventory slots now calculate size based on both width and height constraints to prevent overflow
- **Natural Navigation System**: Arrow keys follow visual layout directions for intuitive movement
  - **Player Inventory**: Left/right moves between inventory grid and armor slots, preserving position
  - **Trade Inventory**: Left/right switches between player and container sides, maintaining grid position
- **Enhanced Player Sprite**: Uses proper SwordsmanTemplate.png with continuous walking animation
- **Improved Trade UI**: Natural directional navigation in chest/tombstone interfaces with position preservation

### **Game Architecture Enhancements**
- **Atomic OOP Structure**: New InputSystem and ActionSystem classes for clean separation of concerns
- **Optimized Game Loop**: UI-aware updates with continuous animations while game logic pauses during UI display
- **Type-Safe Actions**: Structured InputAction interface with proper TypeScript typing
- **Modular Input Processing**: Priority-based input handling with context-aware UI processing

### **Code Organization & Structure Improvements**
- **Translations System Consolidation**: Moved all translation files to unified `src/game/translations/` directory
  - **Portal Quotes**: Integrated portal discovery quotes into translations system
  - **Entity Interactions**: Comprehensive translation system for animals, monsters, traders, villages, and UI
  - **Removed Redundant Files**: Eliminated duplicate PortalQuotes.ts and empty data directory
- **Atomic OOP Architecture**: Enhanced separation of concerns with dedicated system classes
  - **InputSystem**: Centralized input processing with priority-based action queues
  - **ActionSystem**: Atomic action handling with proper error boundaries
  - **AnimationSystem**: Centralized entity animation management with performance optimization
- **Dependency Management**: Improved system dependencies with cleaner interfaces
  - **Reduced Circular Dependencies**: Better separation between UI, game logic, and rendering systems
  - **Type Safety**: Enhanced TypeScript typing throughout the codebase
  - **Service Layer**: Clear separation between data, business logic, and presentation layers

### **System Architecture Optimizations**
- **Entity Management**: Improved entity lifecycle management with proper cleanup
  - **Chunk-Based Loading**: Efficient entity loading/unloading based on camera visibility
  - **Animation System**: Centralized management of all animated entities (trees, cactus, NPCs)
  - **Memory Management**: Proper entity cleanup when chunks are unloaded
- **Performance Enhancements**:
  - **Camera-Based Updates**: Only update entities within camera view + buffer zone
  - **Efficient Collision Detection**: Optimized tile-based collision with spatial indexing
  - **Reduced Console Logging**: Performance-optimized logging during world generation
- **Modular Design Principles**:
  - **Single Responsibility**: Each system class has a focused, well-defined purpose
  - **Open/Closed Principle**: Systems extensible without modification of core classes
  - **Dependency Inversion**: Systems depend on abstractions, not concrete implementations

### **Dungeon System Improvements**
- **Increased Monster Frequency**: 25% increase in monster spawn rates (60-85% noise threshold vs 70-85%)
- **Enhanced Tunnel Generation**: Expanded tunnel width (0.5 vs 0.35 threshold) for better NPC movement
- **Improved NPC Movement Space**: Extended branching, room systems, and connecting corridors
- **Better Combat Encounters**: More frequent monster encounters throughout dungeon exploration

### **Technical Optimizations**
- **Responsive UI Calculations**: Dynamic slot sizing based on available space and minimum size constraints
- **Performance Improvements**: Reduced console logging during generation for smoother gameplay
- **Clean Code Architecture**: Better separation between UI state, game state, and input processing
- **Enhanced Error Handling**: Proper fallbacks and debug support for sprite loading and UI rendering
- **File Structure Optimization**: Consolidated related functionality and removed redundant code paths

## 🏗️ **Current Architecture & Future Optimization Opportunities**

### **Current System Architecture**
The game follows a modular architecture with clear separation of concerns:

#### **Core Systems**
- **Game Engine** (`src/game/engine/`): Main game loop, state management, and core game logic
- **World Management** (`src/game/world/`): Procedural world generation, chunk management, and dungeon systems
- **Entity System** (`src/game/entities/`): Player, NPCs, structures, POIs, and inventory management
- **UI System** (`src/game/ui/`): User interface components, inventory UIs, and visual feedback
- **Input/Action Systems** (`src/game/systems/`): Input processing, movement, animation, and game actions
- **Translation System** (`src/game/translations/`): Localized text and entity interaction messages
- **Asset Management** (`src/game/assets/`): Sprite mapping, asset loading, and resource management

#### **Current Design Patterns**
- **Observer Pattern**: Camera and UI systems observe player state changes
- **Strategy Pattern**: Different movement strategies for world vs dungeon environments
- **Factory Pattern**: Entity creation through chunk generation and world systems
- **Singleton Pattern**: Global systems like AnimationSystem and Camera
- **Component Pattern**: Entities composed of position, health, inventory, and behavior components

### **Identified Optimization Opportunities**

#### **1. Entity Component System (ECS) Architecture**
**Current State**: Entities use inheritance-based architecture with mixed responsibilities
**Optimization**: Implement ECS pattern for better performance and maintainability
```typescript
// Proposed ECS Structure
interface Component {}
interface PositionComponent extends Component { x: number; y: number; }
interface HealthComponent extends Component { health: number; maxHealth: number; }
interface InventoryComponent extends Component { items: InventoryItem[]; }
interface RenderComponent extends Component { sprite: Sprite; animation: AnimationData; }

class Entity {
  private components = new Map<ComponentType, Component>();
  addComponent<T extends Component>(component: T): void;
  getComponent<T extends Component>(type: ComponentType): T | null;
}

class System {
  abstract update(entities: Entity[], deltaTime: number): void;
}
```

#### **2. Service Locator Pattern**
**Current State**: Direct dependencies between systems create tight coupling
**Optimization**: Implement service locator for better dependency management
```typescript
class ServiceLocator {
  private static services = new Map<string, any>();

  static register<T>(name: string, service: T): void;
  static get<T>(name: string): T;
}

// Usage
ServiceLocator.register('worldGenerator', new WorldGenerator());
ServiceLocator.register('animationSystem', new AnimationSystem());
```

#### **3. Command Pattern for Actions**
**Current State**: Actions processed directly in ActionSystem
**Optimization**: Implement command pattern for undo/redo and action queuing
```typescript
interface Command {
  execute(): void;
  undo(): void;
}

class MoveCommand implements Command {
  constructor(private entity: Entity, private direction: Direction) {}
  execute(): void { /* move logic */ }
  undo(): void { /* reverse move */ }
}

class CommandManager {
  private history: Command[] = [];
  executeCommand(command: Command): void;
  undo(): void;
  redo(): void;
}
```

#### **4. Object Pool Pattern**
**Current State**: Entities created/destroyed frequently causing GC pressure
**Optimization**: Implement object pooling for frequently created entities
```typescript
class EntityPool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();

  acquire(): T;
  release(entity: T): void;
  preAllocate(count: number): void;
}
```

#### **5. State Machine for Entity Behavior**
**Current State**: Entity behavior scattered across update methods
**Optimization**: Implement state machines for cleaner behavior management
```typescript
interface State {
  enter(entity: Entity): void;
  update(entity: Entity, deltaTime: number): void;
  exit(entity: Entity): void;
}

class StateMachine {
  private currentState: State;
  private states = new Map<string, State>();

  transition(stateName: string): void;
  update(entity: Entity, deltaTime: number): void;
}
```

#### **6. Event System for Decoupled Communication**
**Current State**: Direct method calls between systems create coupling
**Optimization**: Implement event system for loose coupling
```typescript
interface GameEvent {
  type: string;
  data?: any;
}

class EventBus {
  private listeners = new Map<string, Function[]>();

  subscribe(eventType: string, callback: Function): void;
  emit(event: GameEvent): void;
  unsubscribe(eventType: string, callback: Function): void;
}
```

### **Performance Optimization Recommendations**

#### **1. Spatial Indexing**
- Implement quadtree or spatial hash for efficient collision detection
- Reduce O(n²) entity-to-entity checks to O(log n) or O(1)

#### **2. Chunk-Based Entity Management**
- Only update entities in active chunks (camera view + buffer)
- Implement entity hibernation for distant chunks

#### **3. Asset Streaming**
- Lazy load sprites and assets based on camera proximity
- Implement asset unloading for memory management

#### **4. Batch Rendering**
- Group similar sprites for batch rendering calls
- Reduce canvas context state changes

### **Maintainability Improvements**

#### **1. Configuration System**
- Centralize game constants and tuning parameters
- Support runtime configuration changes for balancing

#### **2. Plugin Architecture**
- Modular system for adding new features
- Hot-swappable components for development

#### **3. Testing Framework**
- Unit tests for core game logic
- Integration tests for system interactions
- Performance benchmarking suite

---

*This document reflects the current game implementation as a comprehensive survival/RPG experience with procedural world generation, well-centered village systems, animated NPCs, and advanced interaction systems. The game features a complete inventory system with redesigned full-width UI containers, enhanced equipment/armor slot management with two-column layout, and character viewing capabilities with continuously animated player sprites. The sophisticated combat mechanics include blocking systems, village-based reputation system with RPG dialogue, advanced monster flocking algorithms with two-phase movement coordination, enhanced dungeon systems with increased monster frequency and expanded NPC movement spaces, trader generation with defensive combat capabilities, dungeon monster spawning, environmental interactions with priority-based structure placement, modern bubble-style UI system with hierarchical component architecture inspired by contemporary mobile and handheld gaming interfaces, and comprehensive movement intention systems that prevent NPC deadlocks through speculative movement and position swapping. The enhanced inventory UI system provides optimal space utilization through height-aware slot sizing, armor slot management in a two-column layout, and trade inventory interfaces that use the full canvas width with 4-directional navigation, while automatically hiding the right-side inventory panel when full UI components are active. The enhanced dungeon system provides substantially more movement space for NPCs through expanded tunnel generation with increased width thresholds, room systems, and connecting corridors, while the advanced collision detection ensures smooth coordination between NPCs in both world and dungeon environments. The atomic OOP architecture with InputSystem and ActionSystem classes provides clean separation of concerns, type-safe action processing, and optimized game loop performance. The attack and interaction systems provide dynamic gameplay where player actions have meaningful consequences through the reputation system, while monsters actively hunt friendly NPCs using sophisticated AI behaviors with auto-blocking trader defensive combat and increased encounter frequency.*