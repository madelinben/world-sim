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
- **Deterministic Generation**: Same entrance always generates same dungeon layout

### **Enhanced Tunnel Architecture for NPC Movement**
- **Entrance Area**: 8-tile radius around entrance guaranteed to be tunnel (increased from 5 tiles for safe spawn zone)
- **Main Corridor**: Winding path up to 50 tiles deep using generous noise values < 0.5 (increased from 0.35)
- **Branch Tunnels**: Enhanced paths (15-35 tiles) with noise values < 0.3 (increased from 0.2) and 25% spawn chance
- **Room System**: New room areas (distance < 25, noise < 0.25) providing large movement spaces for NPCs
- **Connecting Corridors**: Additional corridor system (distance < 40, noise < 0.15) linking rooms and branches
- **Void Boundaries**: All non-tunnel areas are VOID tiles (impassable black areas)
- **Mixed Flooring**: Random mix of STONE (60%) and COBBLESTONE (40%) for visual variety

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
- **Cache Management**: Dungeon chunks automatically cleared when entering new dungeons for fresh generation

### **Rendering System Isolation**
- **Complete Isolation**: Dungeon mode shows only dungeon content (no world trees/NPCs/health bars)
- **World Animation Blocking**: Animation system and world health bars disabled in dungeon mode
- **Camera Mode Toggle**: Seamless switching between world and dungeon views
- **Entrance Position Tracking**: Dungeon system stores entrance coordinates for consistent generation
- **Visual Consistency**: Clean dungeon-only rendering with proper tile colors and structure sprites
- **Health Bar Integration**: Dungeon NPCs show health bars when damaged (same system as world NPCs)

### **Dungeon Features & Rewards**

#### **Enhanced Monster Distribution**
- **Proximity-Based Spawning**: Monster density increases with distance from entrance
- **Enhanced Spawn Rate**: Base 10% + (distance × 0.8%) up to 40% maximum for larger dungeons
- **Lowered Threshold**: Uses monster noise threshold (0.6) with relaxed filtering for more spawns
- **Monster Variety**: Same types as surface (orcs, skeletons, goblins, slimes, etc.)
- **Aggressive Behavior**: All dungeon monsters are hostile by default
- **Guaranteed Spawning**: Improved spawn algorithm ensures monsters appear throughout dungeon

#### **Treasure Chest System**
- **Distance-Based Rarity**: Chest spawn rate increases deeper in dungeon
- **Enhanced Spawn Rate**: Base 4% + (distance × 0.3%) up to 25% maximum for larger dungeons
- **Quality Scaling**: Loot quality improves with distance from entrance (adjusted for 50-tile depth)
- **Chest Contents by Depth**:
  - **Shallow (0-20 tiles)**: Copper ore, iron ore, gold ore, leather
  - **Medium (20-35 tiles)**: Above + gold ingots, rare gems
  - **Deep (35-50 tiles)**: Above + magic potions, ancient artifacts

### **Player Experience**
- **Safe Entry**: Entrance area guaranteed passable for player spawning
- **Substantial Exploration**: Larger tunnel system provides meaningful adventure while maintaining clear progression
- **Progressive Difficulty**: Monsters and rewards increase with exploration depth over 50-tile journey
- **Single Guaranteed Exit**: Exactly one portal ensures focused exit strategy and prevents confusion
- **Enhanced Monster Encounters**: Improved spawn rates guarantee combat encounters throughout exploration
- **Clean Interface**: No world content bleeding into dungeon view for immersive experience
- **Balanced Risk vs Reward**: Better loot deeper in dungeon balances increased monster danger and exploration time

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

#### **Tombstone UI System**
- **Style**: Bubble design matching overall UI aesthetic
- **Layout**: 3×3 grid layout for tombstone inventory display
- **Entity Identification**: Title shows deceased entity name (e.g., "Player's Tombstone")
- **Visual Feedback**: Selected slot highlighted with blue border
- **Navigation**: Use `Left/Right` arrow keys to navigate slots
- **Item Actions**: `Z` for take all, `X` for take selected
- **Close Options**: `F` key or `ESC` key to close interface
- **Game Pause**: Game logic pauses while tombstone UI is displayed

#### **Console UI System**
- **Style**: Black background containers with white text for high contrast visibility
- **Positioning**: Bottom-left corner of the canvas with 10px padding
- **Layout**: Vertical stack with newest entries at the bottom, older entries moving up
- **Entry Design**: Each log entry has its own black bubble container sized to text width
- **Text Styling**: White text using pixel font (Press Start 2P) or Arial fallback
- **Auto-Sizing**: Container width automatically adjusts to text content (max 400px)
- **Entry Management**: Displays up to 10 most recent log entries, automatically removes oldest
- **Real-Time Updates**: Logs player position and nearest structures on every tile movement
- **Content Types**:
  - **Player Position**: Current tile coordinates (e.g., "Player: (15, -23)")
  - **Nearest Village Well**: Closest water well coordinates (e.g., "Nearest Well: (20, -30)")
  - **Nearest Dungeon Entrance**: Closest dungeon entrance coordinates (e.g., "Nearest Dungeon: (45, 12)")
- **Search Algorithm**: Uses expanding radius search up to 100 tiles for efficient structure detection
- **Performance**: Only searches when player moves to new tile, not on every frame

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
- **Shared Layout System**: Centralized dimension calculation for consistent UI positioning
- **Dynamic Width Matching**: Text box and inventory UI maintain identical widths automatically
- **Height Synchronization**: Inventory UI overlay matches inventory panel height precisely
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
  - **Trader NPCs**: Triggers RPG dialogue system with score-based responses
  - **Tombstones**: Opens tombstone inventory UI for item retrieval
  - **Dungeon Entrances**: Switches camera to dungeon rendering mode
  - **Dungeon Portals**: Returns camera to surface world rendering mode
  - **Other POIs**: Various context-specific interactions

### **Tombstone Interaction Controls**
- **Open Tombstone**: `F` key while facing a tombstone
- **Navigate Items**: `Left/Right` arrow keys to select different inventory slots
- **Take Selected Item**: `X` key to take only the currently selected item
- **Take All Items**: `Z` key to transfer all tombstone items to player inventory
- **Close Tombstone**: `F` key to close the tombstone inventory interface
- **Emergency Close**: `ESC` key to immediately close tombstone UI

### **Inventory Controls**
- **Slot Selection**: `1-9` keys select inventory slots
- **Mouse Selection**: Click inventory slots to select items
- **Open Inventory**: `E` key displays full inventory state
- **Close Inventory**: `E` key or `ESC` key to close inventory UI
- **Emergency Close**: `ESC` key to immediately close inventory UI

### **UI Controls**
- **Close Any UI**: `ESC` key - Universal close key for all UI components
  - **Text Box**: Closes village notice board text displays
  - **Inventory UI**: Closes detailed inventory interface
  - **Tombstone UI**: Closes tombstone interaction interface
- **Movement Restriction**: Arrow keys disabled when inventory UI is open
- **Game Pause**: Game logic pauses when any UI component is open

### **Mouse Controls**
- **Camera Drag**: Click and drag to move camera view
- **Inventory Interaction**: Click inventory slots to select items (currently disabled - keyboard only)
- **Click Detection**: Distinguishes between clicks and drags (< 5 pixel threshold)
- **Future Implementation**: Mouse controls for game world interactions planned

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

### **Environmental Damage System**
- **Cactus Damage**: 5 damage per frame to any entity standing on living cactus tiles
- **Damage Radius**: 20-tile radius checking around player for performance optimization
- **Entity Filtering**: Only damages living entities (health > 0)
- **Logging**: Console feedback for all damage events and entity deaths
- **Real-Time Processing**: Damage applied every frame during game update cycle

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
    villageStructures: VillageStructure[],
    npcs: NPC[],
    pois: POI[]
  },
  scoreSystem: {
    villageScores: Map<string, VillageScore>,
    rpgComments: RPGComment[]
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
- **UI Pause System**: Game logic automatically pauses when any UI component is open
  - **Paused Elements**: World updates, NPC movement, animation systems, entity deaths
  - **Active Elements**: Player animation, control input handling, UI rendering
  - **Resume Behavior**: Game resumes immediately when all UI components are closed
- **Console Logging System**: Real-time position tracking and structure detection
  - **Movement Triggers**: Console logs update only when player moves to new tile coordinates
  - **Efficient Search**: Expanding radius algorithm finds nearest structures within 100-tile range
  - **Log Management**: Automatic cleanup maintains 10 most recent entries for performance

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

### **Advanced Movement Coordination System**

#### **Two-Phase Movement Algorithm**
Both world and dungeon systems implement sophisticated movement coordination to prevent NPC clustering and deadlocks:

**Phase 1: Intention Collection**
- All NPCs within update radius declare their intended movement targets
- Movement intentions registered globally before any actual movement occurs
- System builds map of target tiles and which NPCs want to move there

**Phase 2: Coordinated Execution**
- NPCs execute movements with full knowledge of other NPCs' intentions
- Speculative movement allows position swapping and chain movements
- Deadlock resolution through coordinated group movement

#### **Movement Intention System**
- **getMovementIntention()**: NPCs calculate target positions without actually moving
- **Intention Caching**: Movement decisions cached for 100ms to ensure consistency
- **Deterministic Behavior**: Same NPC always makes same decision given same conditions
- **Global Coordination**: All NPCs in area share movement intentions for coordination

#### **Speculative Movement & Deadlock Resolution**
- **Position Swapping**: Two NPCs wanting each other's tiles can swap positions
- **Chain Movement**: If NPC A wants to move away, NPC B can take A's position
- **Bidirectional Coordination**: System detects mutual movement desires
- **Escape Mechanisms**: Long-stuck NPCs (8+ seconds) get enhanced randomness to break deadlocks

#### **Collision Callbacks & Coordination**
- **setTileCollisionCallback()**: Each NPC gets tile-specific collision detection
- **setSpeculativeMovementCallback()**: Enables coordination with other NPCs
- **Context-Aware Collision**: Different collision rules for world vs dungeon modes
- **Dynamic Tile Creation**: Dungeon NPCs can create passable tiles when needed

#### **Performance Optimization**
- **Radius-Based Updates**: Only NPCs within view radius + buffer are updated
- **Intention Sharing**: All NPCs share intentions but only nearby ones execute
- **Cache Efficiency**: Movement decisions cached to avoid recalculation
- **Staggered Processing**: NPCs have random initial delays to prevent synchronization

### **Enhanced Collision Detection System**
- **Mode-Aware Collision**: Different collision rules for world vs dungeon rendering modes
- **Dynamic Context Switching**: Movement system automatically adapts to current camera rendering mode
- **Callback-Based Architecture**: NPCs use collision callbacks for tile-specific movement validation
- **Speculative Movement**: Advanced coordination system allows NPCs to negotiate position swaps
- **Isolated Systems**: World and dungeon collision systems completely separate to prevent interference

### **Advanced Movement Intention Architecture**
- **Two-Phase Processing**: Intention collection phase followed by coordinated execution phase
- **Global Intention Map**: Shared data structure tracking all NPC movement desires
- **Deterministic Caching**: Movement decisions cached for 100ms to ensure execution matches intention
- **Deadlock Prevention**: Multiple escape mechanisms for stuck NPCs including increased randomness
- **Cross-System Implementation**: Same algorithm used in both world and dungeon systems

### **Dungeon System Enhancements**
- **Dynamic Tile Generation**: NPCs can create passable STONE tiles when moving into VOID areas
- **Cache Synchronization**: Dungeon chunk cache automatically updates when NPCs modify tile data
- **Enhanced Tunnel Generation**: Expanded passable areas with rooms, corridors, and connecting paths
- **Isolated Rendering**: Complete separation of world and dungeon content during rendering
- **Fresh Generation**: Dungeon caches cleared when entering new dungeons for consistent experience

---

*This document reflects the current game implementation as a comprehensive survival/RPG experience with procedural world generation, well-centered village systems, animated NPCs, and advanced interaction systems. The game features a complete inventory system, sophisticated combat mechanics with blocking systems, village-based reputation system with RPG dialogue, advanced monster flocking algorithms with two-phase movement coordination, enhanced dungeon systems with expanded NPC movement spaces, trader generation with defensive combat capabilities, dungeon monster spawning, environmental interactions with priority-based structure placement, modern bubble-style UI system inspired by contemporary mobile and handheld gaming interfaces, and comprehensive movement intention systems that prevent NPC deadlocks through speculative movement and position swapping. The enhanced dungeon system provides substantially more movement space for NPCs through expanded tunnel generation, room systems, and connecting corridors, while the advanced collision detection ensures smooth coordination between NPCs in both world and dungeon environments. The attack and interaction systems provide dynamic gameplay where player actions have meaningful consequences through the reputation system, while monsters actively hunt friendly NPCs using sophisticated AI behaviors with auto-blocking trader defensive combat.*