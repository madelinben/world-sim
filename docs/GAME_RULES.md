# World Simulator - Game Rules & Mechanics

## 🌍 **World Generation**

### **Tile System**
- **Tile Size**: 16x16 pixels
- **Chunk System**: 16x16 tiles per chunk for efficient loading
- **Procedural Generation**: Uses simplex noise with configurable seeds
- **Grid Alignment**: Perfect tile grid with 1px black borders

### **Biome Generation**
The world generates based on three noise layers:

1. **Height Map** (elevation)
2. **Temperature Map** (climate zones)
3. **Humidity Map** (moisture levels)

### **Tile Types**
| Tile Type | Description | Movement | Color |
|-----------|-------------|----------|-------|
| `DEEP_WATER` | Deep ocean/lakes | ❌ Impassable | Dark Blue (#00008B) |
| `SHALLOW_WATER` | Shallow water | ✅ Passable | Blue (#4169E1) |
| `RIVER` | Flowing water | ✅ Passable | Light Blue (#1E90FF) |
| `SAND` | Desert/beach sand | ✅ Passable | Sandy (#F4A460) |
| `GRASS` | Grasslands | ✅ Passable | Light Green (#90EE90) |
| `MUD` | Muddy terrain | ⚠️ Restricted | Dark Brown (#8B4513) |
| `DIRT` | Exposed soil | ✅ Passable | Light Brown (#CD853F) |
| `CLAY` | Clay deposits | ✅ Passable | Bronze (#CD7F32) |
| `FOREST` | Dense forest | ✅ Passable | Dark Green (#006400) |
| `GRAVEL` | Rocky ground | ✅ Passable | Gray (#B8B8B8) |
| `COBBLESTONE` | Stone paths | ✅ Passable | Dark Gray (#A9A9A9) |
| `STONE` | Mountain/rock | ❌ Impassable | Gray (#808080) |
| `SNOW` | Snow-covered | ⚠️ Restricted | White (#FFFFFF) |

### **DIRT Tile Regeneration**
- **Creation**: DIRT tiles are created when trees are destroyed
- **Regeneration Time**: 30 seconds to convert back to GRASS
- **Appearance**: Light brown color (#CD853F) distinguishes from MUD
- **Purpose**: Temporary tile type showing environmental recovery

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
- **Collision Detection**: Validates target tile before movement

### **Direction Tracking**
- **Facing Direction**: Always updated when movement keys pressed (even if blocked)
- **Facing Tile Logging**: Shows tile info including structure health
- **Movement Blocking**: Logs which tile type prevented movement

### **Camera System**
- **Player-Centered**: Player always renders at screen center
- **Smooth Following**: Camera follows player movement
- **Tile Alignment**: World grid aligns perfectly with player position

## 🎒 **Inventory System**

### **Inventory Structure**
- **Slots**: 9 inventory slots (accessible via keys 1-9)
- **Stacking**: Items stack up to 64 per slot
- **Selection**: Number keys 1-9 select inventory slots
- **Display**: Console logging shows current inventory state

### **Inventory Controls**
- **Selection**: `1-9` keys select inventory slots
- **Open Inventory**: `E` key displays full inventory
- **Auto-Collection**: Items automatically added when structures destroyed
- **Stack Management**: Intelligent stacking fills existing stacks first

### **Item Types & Stack Sizes**
| Item Type | Max Stack | Source |
|-----------|-----------|---------|
| `wood` | 64 | Destroyed trees |
| `cactus` | 64 | Destroyed cactus |
| `stone` | 64 | Future implementation |

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
- **Sprite**: Shows broken tree (index 0) when destroyed

#### **Cactus**
- **Health**: 15 HP
- **Attack Damage Taken**: 5 per attack (3 attacks to destroy)
- **Drops**: 1 cactus when destroyed
- **Destruction Behavior**: Completely removed from tile
- **Tile Conversion**: Destroyed cactus converts tile to SAND

## 🌳 **Tree System**

### **Tree Growth Stages**
| Stage | ID | Description | Visual | Health |
|-------|----|-----------|---------|---------|
| Cut Down | 0 | Tree stump (passable) | Sprite frame 0 | N/A |
| Young | 1 | Small sapling | Sprite frame 1 | 50 HP |
| Tall | 2 | Growing tree | Sprite frame 2 | 50 HP |
| Full | 3 | Mature tree | Sprite frame 3 | 50 HP |

### **Tree Spawning Rules**
- **Forest**: 100% chance of trees
- **Grass**: 5% chance of trees
- **Limit**: Maximum 1 tree per tile
- **Position**: Trees spawn at tile centers

### **Growth Mechanics**
- **Growth Time**: 1 hour per stage (3.6 million milliseconds)
- **Progression**: CUT_DOWN → YOUNG → TALL → FULL
- **Final Stage**: Trees stop growing at FULL stage
- **Real-Time**: Growth continues based on game time

### **Tree Destruction**
- **Broken Stumps**: Destroyed trees become CUT_DOWN stage (sprite index 0)
- **Passable**: Broken stumps allow player movement through them
- **Visual Persistence**: Stumps remain visible on tile
- **Tile Conversion**: Tree tiles don't convert to DIRT (trees remain as stumps)

## 🌵 **Cactus System**

### **Cactus Variants & Growth Stages**
| Variant | Growth Sequence | Description | Health |
|---------|----------------|-------------|---------|
| **Variant 1** | Frame 4 → Frame 3 | 2-stage growth (young → mature) | 15 HP |
| **Variant 2** | Frame 5 → Frame 6 → Frame 7 | 3-stage growth (young → middle → mature) | 15 HP |
| **Variant 3** | Frame 1 → Frame 0 | 2-stage growth (young → mature) | 15 HP |

### **Cactus Spawning Rules**
- **Sand**: 5% chance of cactus
- **Limit**: Maximum 1 cactus per tile
- **Position**: Cactus spawn at tile centers
- **Variant Selection**: Random variant chosen at spawn

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
- **Health**: 100 HP (current: no damage taken implemented)
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

## 🎮 **Controls & Input**

### **Movement Controls**
- **Movement**: `WASD` or Arrow Keys
- **Direction**: Updates facing direction even when movement blocked

### **Combat Controls**
- **Attack**: `Q` key - Attack structure in facing direction

### **Interaction Controls**
- **Interact**: `F` key - Interact with structures (placeholder functionality)

### **Inventory Controls**
- **Slot Selection**: `1-9` keys select inventory slots
- **Open Inventory**: `E` key displays full inventory state

### **Console Logging**
- **Key Operations**: Shows meaningful key mappings (e.g., "q → attack")
- **Tile Information**: Current tile and facing tile with structure details
- **Inventory Changes**: Real-time inventory updates
- **Combat Feedback**: Attack results and damage dealt

## 🎨 **Visual System**

### **Rendering Order**
1. **Black Background**: Canvas filled with black (#000000)
2. **Tile Colors**: 14x14 colored squares (2px border gap)
3. **Player**: Red 10x10 square at screen center (renders behind structures)
4. **Tree Sprites**: 16x16 tree sprites on forest/grass tiles
5. **Cactus Sprites**: 16x16 cactus sprites on sand tiles

### **Sprite System**
- **Size**: 16x16 pixels per sprite
- **Format**: Sprite sheets with frame indexing
- **Animation**: Time-based frame progression
- **Alignment**: Sprites align perfectly with tile grid
- **Depth**: Player renders behind structures for proper depth

### **Border System**
- **Style**: 1px black borders around all tiles
- **Method**: Tile rendering leaves 1px gaps, black background shows through
- **Performance**: Zero-cost border rendering

## 🗺️ **World Features**

### **Rivers**
- **Generation**: Noise-based with winding paths
- **Width**: Configurable river width (0.1 default)
- **Flow Direction**: Calculated from height gradients
- **Surroundings**: Sand appears around rivers

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

## 🎯 **Game Objectives & Gameplay**

Currently a **survival/resource gathering game** with:

### **Core Gameplay Loop**
1. **Exploration**: Navigate different biomes and discover structures
2. **Resource Gathering**: Attack trees and cactus to collect materials
3. **Inventory Management**: Organize collected items in 9-slot inventory
4. **Environmental Interaction**: Observe tile regeneration and structure growth

### **Resource Management**
- **Wood Collection**: Attack trees to gather wood for future crafting
- **Cactus Harvesting**: Destroy cactus for cactus items
- **Inventory Organization**: Use number keys to manage 9 inventory slots
- **Stack Optimization**: Items automatically stack to save space

### **Environmental Systems**
- **Dynamic World**: Structures grow over time
- **Tile Recovery**: DIRT tiles regenerate to GRASS after 30 seconds
- **Persistent Changes**: Destroyed structures leave permanent environmental impact

## 🔧 **Technical Implementation**

### **Game State**
```typescript
{
  player: {
    position: { x: number, y: number },
    inventory: InventoryItem[],
    health: number
  },
  world: {
    tiles: Tile[],
    npcs: Entity[],
    pois: PointOfInterest[]
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

### **Game Loop**
- **Target FPS**: 60 FPS
- **Fixed Timestep**: Consistent 16.67ms updates
- **Delta Time**: Proper time-based calculations
- **Update Throttling**: Expensive operations only when needed

---

*This document reflects the current implementation as of the latest codebase version. The game has evolved from a simple exploration sandbox to include combat, resource gathering, and inventory management systems.*