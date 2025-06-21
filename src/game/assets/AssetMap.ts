export interface AssetMapping {
  name: string;
  spritePath: string;
  index: number;
  category: 'inventory' | 'poi' | 'structure' | 'ui' | 'projectile' | 'animal' | 'background';
  properties?: {
    maxStack?: number;
    health?: number;
    damage?: number;
    animated?: boolean;
    animationFrames?: number[];
    dropItems?: { type: string; quantity: number }[];
    rarity?: 'common' | 'rare' | 'very_rare';
    interactable?: boolean;
    passable?: boolean;
    tileTypeRequired?: string[];
    spawning?: {
      chance: number;
      biomes: string[];
    };
  };
}

export const ASSET_MAP: Record<string, AssetMapping> = {
  // Inventory Items - Potions
  health_potion: {
    name: 'Health Potion',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 4,
    category: 'inventory',
    properties: { maxStack: 16 }
  },
  poison_potion: {
    name: 'Poison Potion',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 5,
    category: 'inventory',
    properties: { maxStack: 16 }
  },
  magic_potion: {
    name: 'Magic Potion',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 6,
    category: 'inventory',
    properties: { maxStack: 16 }
  },
  stamina_potion: {
    name: 'Stamina Potion',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 7,
    category: 'inventory',
    properties: { maxStack: 16 }
  },

  // Inventory Items - Resources
  wheat: {
    name: 'Wheat',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 8,
    category: 'inventory',
    properties: { maxStack: 64 }
  },
  health_heart: {
    name: 'Health Heart',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 9,
    category: 'inventory',
    properties: { maxStack: 1 }
  },
  wood: {
    name: 'Wood',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 10,
    category: 'inventory',
    properties: { maxStack: 64 }
  },
  cactus: {
    name: 'Cactus',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 11,
    category: 'inventory',
    properties: { maxStack: 64 }
  },

  // Inventory Items - Tools & Weapons
  hammer: {
    name: 'Hammer',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 0,
    category: 'inventory',
    properties: { maxStack: 1, damage: 15 }
  },
  sword: {
    name: 'Sword',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 1,
    category: 'inventory',
    properties: { maxStack: 1, damage: 20 }
  },
  shield: {
    name: 'Shield',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 2,
    category: 'inventory',
    properties: { maxStack: 1 }
  },
  dagger: {
    name: 'Dagger',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 44,
    category: 'inventory',
    properties: { maxStack: 1, damage: 10 }
  },

  // Projectiles
  arrow_horizontal: {
    name: 'Arrow (Horizontal)',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 45,
    category: 'projectile',
    properties: { damage: 15 }
  },
  arrow_vertical: {
    name: 'Arrow (Vertical)',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 3,
    category: 'projectile',
    properties: { damage: 15 }
  },

  // UI Icons
  settings_icon: {
    name: 'Settings',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 42,
    category: 'ui'
  },
  chat_icon: {
    name: 'Chat',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 41,
    category: 'ui'
  },
  notification_icon: {
    name: 'Notification',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 40,
    category: 'ui'
  },
  warning_icon: {
    name: 'Warning',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 31,
    category: 'ui'
  },
  confirm_icon: {
    name: 'Confirm',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 30,
    category: 'ui'
  },
  question_icon: {
    name: 'Question',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 29,
    category: 'ui'
  },
  reject_icon: {
    name: 'Reject',
    spritePath: '/sprites/User Interface/UiIcons.png',
    index: 28,
    category: 'ui'
  },

  // UI Boxes
  default_item_box: {
    name: 'Default Item Box',
    spritePath: '/sprites/User Interface/Highlighted-Boxes.png',
    index: 0,
    category: 'ui'
  },
  broken_item_box: {
    name: 'Broken Item Box',
    spritePath: '/sprites/User Interface/Highlighted-Boxes.png',
    index: 3,
    category: 'ui'
  },
  highlighted_item_box: {
    name: 'Highlighted Item Box',
    spritePath: '/sprites/User Interface/Highlighted-Boxes.png',
    index: 4,
    category: 'ui'
  },
  box_selector: {
    name: 'Box Selector',
    spritePath: '/sprites/User Interface/BoxSelector.png',
    index: 0,
    category: 'ui'
  },
  pressed_box_selector: {
    name: 'Pressed Box Selector',
    spritePath: '/sprites/User Interface/BoxSelector.png',
    index: 1,
    category: 'ui'
  },

  // Inventory Items - Ores & Resources
  rock: {
    name: 'Rock',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 12,
    category: 'inventory',
    properties: {
      maxStack: 64,
      interactable: true,
      passable: false
    }
  },
  gold_ore: {
    name: 'Gold Ore',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 13,
    category: 'inventory',
    properties: {
      maxStack: 64,
      rarity: 'very_rare',
      dropItems: [{ type: 'gold_ingot', quantity: 1 }]
    }
  },
  iron_ore: {
    name: 'Iron Ore',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 14,
    category: 'inventory',
    properties: {
      maxStack: 64,
      rarity: 'rare',
      dropItems: [{ type: 'iron_ingot', quantity: 1 }]
    }
  },
  copper_ore: {
    name: 'Copper Ore',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 15,
    category: 'inventory',
    properties: {
      maxStack: 64,
      rarity: 'common',
      dropItems: [{ type: 'copper_ingot', quantity: 1 }]
    }
  },

  // Processed Materials
  gold_ingot: {
    name: 'Gold Ingot',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 0,
    category: 'inventory',
    properties: { maxStack: 64 }
  },
  iron_ingot: {
    name: 'Iron Ingot',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 1,
    category: 'inventory',
    properties: { maxStack: 64 }
  },
  copper_ingot: {
    name: 'Copper Ingot',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 2,
    category: 'inventory',
    properties: { maxStack: 64 }
  },

  // Ores & Ingots - Extended
  coal: {
    name: 'Coal',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 3,
    category: 'inventory',
    properties: { maxStack: 64 }
  },
  silver_ore: {
    name: 'Silver Ore',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 4,
    category: 'inventory',
    properties: { maxStack: 64 }
  },
  bone: {
    name: 'Bone',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 5,
    category: 'inventory',
    properties: { maxStack: 64 }
  },

  // POI - Fire Effects
  fireball_frame_0: {
    name: 'Fireball',
    spritePath: '/sprites/Objects/FireballProjectile.png',
    index: 0,
    category: 'poi',
    properties: {
      damage: 25,
      animated: true,
      animationFrames: [0, 1]
    }
  },
  magic_fire_frame_0: {
    name: 'Magic Fire',
    spritePath: '/sprites/Objects/FireballProjectile.png',
    index: 3,
    category: 'poi',
    properties: {
      damage: 35,
      animated: true,
      animationFrames: [3, 2]
    }
  },

  // POI - Wheat Field
  wheat_field_0: {
    name: 'Wheat Field (Young)',
    spritePath: '/sprites/Nature/Wheatfield.png',
    index: 0,
    category: 'poi',
    properties: {
      animated: true,
      animationFrames: [0, 1, 2, 3],
      interactable: true,
      dropItems: [{ type: 'wheat', quantity: 3 }]
    }
  },

  // POI - Transportation
  boat_vertical: {
    name: 'Boat (Vertical)',
    spritePath: '/sprites/Miscellaneous/Boat.png',
    index: 0,
    category: 'poi',
    properties: {
      interactable: true,
      passable: true,
      tileTypeRequired: ['SHALLOW_WATER', 'DEEP_WATER']
    }
  },
  boat_horizontal: {
    name: 'Boat (Horizontal)',
    spritePath: '/sprites/Miscellaneous/Boat.png',
    index: 2,
    category: 'poi',
    properties: {
      interactable: true,
      passable: true,
      tileTypeRequired: ['SHALLOW_WATER', 'DEEP_WATER']
    }
  },

  // POI - Storage
  normal_chest: {
    name: 'Normal Chest',
    spritePath: '/sprites/Miscellaneous/Chests.png',
    index: 0,
    category: 'poi',
    properties: {
      interactable: true,
      passable: false
    }
  },
  rare_chest: {
    name: 'Rare Chest',
    spritePath: '/sprites/Miscellaneous/Chests.png',
    index: 1,
    category: 'poi',
    properties: {
      interactable: true,
      passable: false,
      rarity: 'rare'
    }
  },

  // POI - Portals & Utilities
  portal: {
    name: 'Portal',
    spritePath: '/sprites/Miscellaneous/Portal.png',
    index: 3,
    category: 'poi',
    properties: {
      interactable: true,
      passable: true
    }
  },
  empty_notice_board: {
    name: 'Empty Notice Board',
    spritePath: '/sprites/Miscellaneous/QuestBoard.png',
    index: 0,
    category: 'poi',
    properties: {
      interactable: true,
      passable: false
    }
  },
  notice_board: {
    name: 'Notice Board',
    spritePath: '/sprites/Miscellaneous/QuestBoard.png',
    index: 1,
    category: 'poi',
    properties: {
      interactable: true,
      passable: false
    }
  },
  tombstone: {
    name: 'Tombstone',
    spritePath: '/sprites/Miscellaneous/Tombstones.png',
    index: 6,
    category: 'poi',
    properties: {
      interactable: true,
      passable: false
    }
  },
  water_well: {
    name: 'Water Well',
    spritePath: '/sprites/Miscellaneous/Well.png',
    index: 3,
    category: 'poi',
    properties: {
      interactable: true,
      passable: false
    }
  },

  // Background Tiles
  sand_tile: {
    name: 'Sand Tile',
    spritePath: '/sprites/Ground/Shore.png',
    index: 0,
    category: 'background'
  },
  shallow_water_tile: {
    name: 'Shallow Water Tile',
    spritePath: '/sprites/Ground/Shore.png',
    index: 2,
    category: 'background'
  },
  deep_water_tile: {
    name: 'Deep Water Tile',
    spritePath: '/sprites/Ground/Shore.png',
    index: 4,
    category: 'background'
  },
  grass_tile_0: {
    name: 'Grass Tile (Variant 0)',
    spritePath: '/sprites/Ground/TexturedGrass.png',
    index: 0,
    category: 'background'
  },
  grass_tile_1: {
    name: 'Grass Tile (Variant 1)',
    spritePath: '/sprites/Ground/TexturedGrass.png',
    index: 1,
    category: 'background'
  },
  grass_tile_2: {
    name: 'Grass Tile (Variant 2)',
    spritePath: '/sprites/Ground/TexturedGrass.png',
    index: 2,
    category: 'background'
  },
  grass_tile_3: {
    name: 'Grass Tile (Variant 3)',
    spritePath: '/sprites/Ground/TexturedGrass.png',
    index: 3,
    category: 'background'
  },
  grass_tile_4: {
    name: 'Grass Tile (Variant 4)',
    spritePath: '/sprites/Ground/TexturedGrass.png',
    index: 4,
    category: 'background'
  },
  grass_tile_5: {
    name: 'Grass Tile (Variant 5)',
    spritePath: '/sprites/Ground/TexturedGrass.png',
    index: 5,
    category: 'background'
  },

    // Structures
  mine_entrance: {
    name: 'Mine Entrance',
    spritePath: '/sprites/Buildings/Wood/Resources.png',
    index: 10,
    category: 'structure',
    properties: {
      interactable: true,
      passable: true,
      tileTypeRequired: ['STONE'],
      spawning: { chance: 0.001, biomes: ['STONE'] }
    }
  },
  windmill_frame_0: {
    name: 'Windmill',
    spritePath: '/sprites/Buildings/Wood/Resources.png',
    index: 3,
    category: 'structure',
    properties: {
      animated: true,
      animationFrames: [3, 4, 5],
      passable: false,
      tileTypeRequired: ['GRASS'],
      spawning: { chance: 0.0001, biomes: ['GRASS'] }
    }
  },
  food_market: {
    name: 'Food Market',
    spritePath: '/sprites/Buildings/Wood/Market.png',
    index: 4,
    category: 'structure',
    properties: {
      interactable: true,
      passable: false,
      tileTypeRequired: ['GRASS'],
      spawning: { chance: 0.0001, biomes: ['GRASS'] }
    }
  },
  butcher_market: {
    name: 'Butcher Market',
    spritePath: '/sprites/Buildings/Wood/Market.png',
    index: 11,
    category: 'structure',
    properties: {
      interactable: true,
      passable: false,
      tileTypeRequired: ['GRASS'],
      spawning: { chance: 0.0001, biomes: ['GRASS'] }
    }
  },
  armory_market: {
    name: 'Armory Market',
    spritePath: '/sprites/Buildings/Wood/Market.png',
    index: 5,
    category: 'structure',
    properties: {
      interactable: true,
      passable: false,
      tileTypeRequired: ['GRASS'],
      spawning: { chance: 0.0001, biomes: ['GRASS'] }
    }
  },
  cloth_market: {
    name: 'Cloth Market',
    spritePath: '/sprites/Buildings/Wood/Market.png',
    index: 7,
    category: 'structure',
    properties: {
      interactable: true,
      passable: false,
      tileTypeRequired: ['GRASS'],
      spawning: { chance: 0.0001, biomes: ['GRASS'] }
    }
  },
  market_stall: {
    name: 'Market Stall',
    spritePath: '/sprites/Buildings/Wood/Market.png',
    index: 1,
    category: 'structure',
    properties: {
      interactable: true,
      passable: false,
      tileTypeRequired: ['GRASS'],
      spawning: { chance: 0.0001, biomes: ['GRASS'] }
    }
  },
  dungeon_entrance: {
    name: 'Dungeon Entrance',
    spritePath: '/sprites/Buildings/Wood/Resources.png',
    index: 9,
    category: 'structure',
    properties: {
      interactable: true,
      passable: true,
      tileTypeRequired: ['STONE'],
      spawning: { chance: 0.0005, biomes: ['STONE'] }
    }
  },

  // Animal Products
  chicken_meat: {
    name: 'Chicken Meat',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 16,
    category: 'inventory',
    properties: { maxStack: 64 }
  },
  pork: {
    name: 'Pork',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 17,
    category: 'inventory',
    properties: { maxStack: 64 }
  },
  wool: {
    name: 'Wool',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 18,
    category: 'inventory',
    properties: { maxStack: 64 }
  },
  mutton: {
    name: 'Mutton',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 19,
    category: 'inventory',
    properties: { maxStack: 64 }
  },

  // Animals
  chicken: {
    name: 'Chicken',
    spritePath: '/sprites/Animals/Chicken.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 20,
      animated: true,
      animationFrames: [0, 1, 2, 3], // down movement
      spawning: { chance: 0.001, biomes: ['GRASS'] },
      dropItems: [{ type: 'chicken_meat', quantity: 1 }]
    }
  },
  pig: {
    name: 'Pig',
    spritePath: '/sprites/Animals/Pig.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 35,
      animated: true,
      animationFrames: [0, 1, 2, 3], // down movement
      spawning: { chance: 0.0008, biomes: ['GRASS'] },
      dropItems: [{ type: 'pork', quantity: 2 }]
    }
  },
  sheep: {
    name: 'Sheep',
    spritePath: '/sprites/Animals/Sheep.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 25,
      animated: true,
      animationFrames: [0, 1, 2, 3], // down movement
      spawning: { chance: 0.0012, biomes: ['GRASS'] },
      dropItems: [{ type: 'wool', quantity: 1 }, { type: 'mutton', quantity: 1 }]
    }
  },

  // Monster NPCs
  archer_goblin: {
    name: 'Archer Goblin',
    spritePath: '/sprites/Characters/Monsters/Orcs/ArcherGoblin.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 60,
      animated: true,
      animationFrames: [0, 1, 2, 3, 4], // down movement
      spawning: { chance: 0.0001, biomes: ['FOREST', 'STONE', 'GRAVEL'] },
      dropItems: [{ type: 'monster_drop', quantity: 1 }]
    }
  },
  club_goblin: {
    name: 'Club Goblin',
    spritePath: '/sprites/Characters/Monsters/Orcs/ClubGoblin.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 80,
      animated: true,
      animationFrames: [0, 1, 2, 3, 4], // down movement
      spawning: { chance: 0.0001, biomes: ['FOREST', 'STONE', 'GRAVEL'] },
      dropItems: [{ type: 'monster_drop', quantity: 1 }]
    }
  },
  farmer_goblin: {
    name: 'Farmer Goblin',
    spritePath: '/sprites/Characters/Monsters/Orcs/FarmerGoblin.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 70,
      animated: true,
      animationFrames: [0, 1, 2, 3, 4], // down movement
      spawning: { chance: 0.0001, biomes: ['FOREST', 'STONE', 'GRAVEL'] },
      dropItems: [{ type: 'monster_drop', quantity: 1 }]
    }
  },
  orc: {
    name: 'Orc',
    spritePath: '/sprites/Characters/Monsters/Orcs/Orc.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 120,
      animated: true,
      animationFrames: [0, 1, 2, 3, 4], // down movement
      spawning: { chance: 0.00005, biomes: ['FOREST', 'STONE', 'GRAVEL'] },
      dropItems: [{ type: 'monster_drop', quantity: 2 }]
    }
  },
  orc_shaman: {
    name: 'Orc Shaman',
    spritePath: '/sprites/Characters/Monsters/Orcs/OrcShaman.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 100,
      animated: true,
      animationFrames: [0, 1, 2, 3, 4], // down movement
      spawning: { chance: 0.00005, biomes: ['FOREST', 'STONE', 'GRAVEL'] },
      dropItems: [{ type: 'monster_drop', quantity: 2 }]
    }
  },
  spear_goblin: {
    name: 'Spear Goblin',
    spritePath: '/sprites/Characters/Monsters/Orcs/SpearGoblin.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 90,
      animated: true,
      animationFrames: [0, 1, 2, 3, 4], // down movement
      spawning: { chance: 0.0001, biomes: ['FOREST', 'STONE', 'GRAVEL'] },
      dropItems: [{ type: 'monster_drop', quantity: 1 }]
    }
  },
  mega_slime_blue: {
    name: 'Mega Slime',
    spritePath: '/sprites/Characters/Monsters/Slimes/MegaSlimeBlue.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 150,
      animated: true,
      animationFrames: [0, 1, 2, 3, 4, 5], // down movement
      spawning: { chance: 0.00002, biomes: ['MUD'] },
      dropItems: [{ type: 'monster_drop', quantity: 3 }]
    }
  },
  slime: {
    name: 'Slime',
    spritePath: '/sprites/Characters/Monsters/Slimes/Slime.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 40,
      animated: true,
      animationFrames: [0, 1, 2, 3, 4, 5], // down movement
      spawning: { chance: 0.0002, biomes: ['MUD'] },
      dropItems: [{ type: 'monster_drop', quantity: 1 }]
    }
  },

  // Trader NPCs
  axeman_trader: {
    name: 'Axeman Trader',
    spritePath: '/sprites/Characters/Soldiers/Melee/AxemanTemplate.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 50,
      animated: true,
      animationFrames: [0, 1, 2, 3, 4], // down movement
      spawning: { chance: 0.0005, biomes: ['GRASS'] },
      dropItems: [{ type: 'gold_ingot', quantity: 1 }]
    }
  },
  swordsman_trader: {
    name: 'Swordsman Trader',
    spritePath: '/sprites/Characters/Soldiers/Melee/SwordsmanTemplate.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 50,
      animated: true,
      animationFrames: [0, 1, 2, 3, 4], // down movement
      spawning: { chance: 0.0005, biomes: ['GRASS'] },
      dropItems: [{ type: 'gold_ingot', quantity: 1 }]
    }
  },
  spearman_trader: {
    name: 'Spearman Trader',
    spritePath: '/sprites/Characters/Soldiers/Melee/SpearmanTemplate.png',
    index: 0,
    category: 'animal',
    properties: {
      health: 50,
      animated: true,
      animationFrames: [0, 1, 2, 3, 4], // down movement
      spawning: { chance: 0.0005, biomes: ['GRASS'] },
      dropItems: [{ type: 'gold_ingot', quantity: 1 }]
    }
  },
  farmer_trader: {
    name: 'Farmer Trader',
    spritePath: '/sprites/Characters/Workers/FarmerTemplate.png',
    index: 20,
    category: 'animal',
    properties: {
      health: 50,
      animated: true,
      animationFrames: [20, 21, 22, 23, 24], // down movement (offset indices)
      spawning: { chance: 0.0005, biomes: ['GRASS'] },
      dropItems: [{ type: 'gold_ingot', quantity: 1 }]
    }
  },

  // Monster drops
  monster_drop: {
    name: 'Monster Essence',
    spritePath: '/sprites/User Interface/Icons-Essentials.png',
    index: 20,
    category: 'inventory',
    properties: { maxStack: 64 }
  }
};

// Helper functions to categorize assets
export function getAssetsByCategory(category: AssetMapping['category']): AssetMapping[] {
  return Object.values(ASSET_MAP).filter(asset => asset.category === category);
}

export function getInventoryItems(): AssetMapping[] {
  return getAssetsByCategory('inventory');
}

export function getPOIAssets(): AssetMapping[] {
  return getAssetsByCategory('poi');
}

export function getStructureAssets(): AssetMapping[] {
  return getAssetsByCategory('structure');
}

export function getAnimalAssets(): AssetMapping[] {
  return getAssetsByCategory('animal');
}

export function getUIAssets(): AssetMapping[] {
  return getAssetsByCategory('ui');
}

export function getProjectileAssets(): AssetMapping[] {
  return getAssetsByCategory('projectile');
}

export function getBackgroundAssets(): AssetMapping[] {
  return getAssetsByCategory('background');
}

export function getAssetByName(name: string): AssetMapping | undefined {
  return ASSET_MAP[name];
}
