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
| `YELLOW_SAND` | Desert/beach sand | ✅ Passable | Sandy (#F4A460) |
| `GRASS` | Grasslands | ✅ Passable | Light Green (#90EE90) |
| `MUD` | Muddy terrain | ⚠️ Restricted | Brown (#8B4513) |
| `CLAY` | Clay deposits | ✅ Passable | Bronze (#CD7F32) |
| `FOREST` | Dense forest | ✅ Passable | Dark Green (#006400) |
| `GRAVEL` | Rocky ground | ✅ Passable | Gray (#B8B8B8) |
| `COBBLESTONE` | Stone paths | ✅ Passable | Dark Gray (#A9A9A9) |
| `STONE` | Mountain/rock | ❌ Impassable | Gray (#808080) |
| `SNOW` | Snow-covered | ⚠️ Restricted | White (#FFFFFF) |

## 🚶 **Movement System**

### **Basic Movement**
- **Controls**: WASD or Arrow Keys
- **Grid-Based**: Player moves one tile at a time
- **Tile Snapping**: Player position snaps to tile centers
- **Cooldown**: 120ms between moves when holding keys

### **Movement Rules**
- **Impassable Tiles**: Cannot move to DEEP_WATER or STONE
- **Tree Blocking**: Cannot move to tiles containing trees
- **Cactus Blocking**: Cannot move to tiles containing cactus
- **Mud Restriction**: Only 1/3 chance to move when standing on MUD
- **Snow Restriction**: Only 1/4 chance to move when standing on SNOW
- **Collision Detection**: Validates target tile before movement

### **Camera System**
- **Player-Centered**: Player always renders at screen center
- **Smooth Following**: Camera follows player movement
- **Tile Alignment**: World grid aligns perfectly with player position

## 🌳 **Tree & Vegetation System**

### **Tree Growth Stages**
| Stage | ID | Description | Visual |
|-------|----|-----------|---------|
| Cut Down | 0 | Tree stump | Sprite frame 0 |
| Young | 1 | Small sapling | Sprite frame 1 |
| Tall | 2 | Growing tree | Sprite frame 2 |
| Full | 3 | Mature tree | Sprite frame 3 |

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

### **Tree Interactions**
- `cutDown()`: Resets tree to CUT_DOWN stage
- `plant()`: Advances CUT_DOWN trees to YOUNG stage
- `forceGrowthStage()`: Manually set any growth stage

## 🌵 **Cactus System**

### **Cactus Variants & Growth Stages**
| Variant | Growth Sequence | Description |
|---------|----------------|-------------|
| **Variant 1** | Frame 4 → Frame 3 | 2-stage growth (young → mature) |
| **Variant 2** | Frame 5 → Frame 6 → Frame 7 | 3-stage growth (young → middle → mature) |
| **Variant 3** | Frame 1 → Frame 0 | 2-stage growth (young → mature) |

### **Cactus Spawning Rules**
- **Yellow Sand**: 5% chance of cactus
- **Limit**: Maximum 1 cactus per tile
- **Position**: Cactus spawn at tile centers
- **Variant Selection**: Random variant chosen at spawn

### **Cactus Growth Mechanics**
- **Growth Time**: 10 minutes per stage (600,000 milliseconds)
- **Variant-Specific**: Each variant has different frame sequences
- **Final Stage**: Cactus stop growing at final stage for their variant
- **Real-Time**: Growth continues based on game time

### **Cactus Interactions**
- **Collision**: Cactus block player movement (impassable)
- **Growth Stages**: Automatically progress through variant-specific sequences
- **Visual Variety**: Three different cactus types with unique appearances

## 🎮 **Performance & Technical**

### **Game Loop**
- **Target FPS**: 60 FPS
- **Fixed Timestep**: Consistent 16.67ms updates
- **Delta Time**: Proper time-based calculations
- **Update Throttling**: Expensive operations only when needed

### **Rendering Optimization**
- **Visibility Culling**: Only render visible tiles and trees
- **Tile Caching**: Cache visible tiles to avoid recalculation
- **Change Detection**: Only update when camera moves
- **Sprite Batching**: Efficient sprite rendering

### **Coordinate System**
- **World Coordinates**: Infinite procedural world
- **Screen Coordinates**: Camera-relative rendering
- **Tile Coordinates**: Grid-based positioning (x/16, y/16)

## 🎨 **Visual System**

### **Rendering Order**
1. **Black Background**: Canvas filled with black (#000000)
2. **Tile Colors**: 14x14 colored squares (2px border gap)
3. **Tree Sprites**: 16x16 tree sprites on forest/grass tiles
4. **Cactus Sprites**: 16x16 cactus sprites on sand tiles
5. **Player**: Red 10x10 square at screen center

### **Sprite System**
- **Size**: 16x16 pixels per sprite
- **Format**: Sprite sheets with frame indexing
- **Animation**: Time-based frame progression
- **Alignment**: Sprites align perfectly with tile grid

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
- Low humidity: YELLOW_SAND

**Hot Regions (temp > 0.7)**:
- High elevation: STONE → COBBLESTONE
- High humidity: GRASS
- Low humidity: YELLOW_SAND (70% chance)

## 📱 **User Interface**

### **Controls**
- **Movement**: WASD or Arrow Keys
- **Camera**: Mouse drag to pan (when implemented)
- **No Menu**: Direct gameplay focus

## 🔧 **Game State**

### **Player State**
```typescript
{
  position: { x: number, y: number },
  inventory: [], // Future expansion
  health: 100    // Future expansion
}
```

### **World State**
- **Persistent**: Tile changes persist
- **Procedural**: Infinite world generation
- **Seeded**: Reproducible worlds with seed system
- **Chunked**: Efficient memory management

## 🎯 **Game Objectives**

Currently a **world exploration sandbox** with:
- **Exploration**: Navigate different biomes
- **Observation**: Watch trees grow over time
- **Discovery**: Find interesting terrain features
- **Future**: Framework ready for quests, building, resource gathering

---

*This document reflects the current implementation as of the latest codebase version. Rules may evolve as new features are added.*