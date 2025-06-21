// UI text translations for menus, messages, and interface elements
export const UI_TRANSLATIONS = {
  // Menu system
  menu: {
    options: ['Back to Game', 'Save Game'],
    titles: {
      main: 'Game Menu',
      save: 'Save Game',
      load: 'Load Game'
    }
  },

  // POI interaction messages
  poi: {
    chest: {
      normal_opened: 'Opened normal chest!',
      rare_opened: 'Opened rare chest!',
      empty: 'The chest is empty.'
    },
    well: {
      drink: 'You drink fresh water from the well. Health restored!',
      refreshing: 'The cool water restores your energy.'
    },
    portal: {
      step_through: 'You step through the portal...',
      dormant: 'The portal shimmers with magical energy, but its power seems dormant for now...'
    },
    notice_board: {
      empty: 'The notice board is empty. You could post a message here.',
      reading: 'Reading the notices on the board...'
    },
    tombstone: {
      retrieve: 'You retrieve items from the grave...',
      empty: 'The grave has been disturbed...'
    },
    wheat_field: {
      harvest: 'You harvest the wheat field!',
      not_ready: 'The wheat is not ready for harvest yet.'
    },
    boat: {
      board: 'You board the boat. You can now travel on water!'
    },
    market: {
      welcome: 'Welcome to the market!',
      food: 'Welcome to the food market!',
      butcher: 'Welcome to the butcher!',
      armory: 'Welcome to the armory!',
      cloth: 'Welcome to the cloth market!'
    },
    entrance: {
      mine: 'You enter the mine...',
      dungeon: 'You enter the dungeon...'
    }
  },

  // Game system messages
  system: {
    saving: '💾 Saving game...',
    saved: '✅ Game saved successfully!',
    loading: '📁 Loading game...',
    no_save: 'No save data found',
    save_found: '✅ Save data found (load functionality not fully implemented yet)',
    player_died: '💀 Player has died!',
    player_respawned: '🔄 Player respawned at (0, 0) with full health and empty inventory'
  },

  // Interaction prompts
  prompts: {
    continue: 'Press any key to continue...',
    close: 'Press F to close',
    navigate: 'Press Left/Right to navigate',
    take_all: 'Z to take all',
    take_selected: 'X to take selected',
    interact: 'Press F to interact'
  },

  // Error messages
  errors: {
    cannot_interact: 'Cannot interact with',
    unknown_interaction: 'Unknown interaction type:',
    nothing_to_interact: 'Nothing to interact with in that direction',
    no_item_selected: 'No item selected',
    inventory_full: 'Inventory is full!'
  },

  // Combat messages
  combat: {
    attack: 'attacks',
    player_attacks: 'Player attacks',
    monster_attacks: 'Monster attacks player!',
    damage_dealt: 'damage dealt',
    health_restored: 'health restored'
  },

  // Inventory messages
  inventory: {
    opened: 'Inventory opened',
    closed: 'Inventory closed',
    item_added: 'Item added to inventory',
    item_removed: 'Item removed from inventory',
    taking_all: 'Taking all items...',
    chest_emptied: 'Chest emptied and removed',
    tombstone_emptied: 'Tombstone emptied and removed'
  }
};

// Helper functions to get specific UI text
export function getMenuOption(index: number): string {
  return UI_TRANSLATIONS.menu.options[index] ?? 'Unknown Option';
}

export function getPOIMessage(poiType: string, action: string): string {
  const poi = UI_TRANSLATIONS.poi as Record<string, Record<string, string>>;
  return poi[poiType]?.[action] ?? `Unknown ${poiType} action: ${action}`;
}

export function getSystemMessage(messageType: string): string {
  const system = UI_TRANSLATIONS.system as Record<string, string>;
  return system[messageType] ?? `Unknown system message: ${messageType}`;
}

export function getPromptMessage(promptType: string): string {
  const prompts = UI_TRANSLATIONS.prompts as Record<string, string>;
  return prompts[promptType] ?? `Unknown prompt: ${promptType}`;
}

export function getErrorMessage(errorType: string): string {
  const errors = UI_TRANSLATIONS.errors as Record<string, string>;
  return errors[errorType] ?? `Unknown error: ${errorType}`;
}

export function getCombatMessage(combatType: string): string {
  const combat = UI_TRANSLATIONS.combat as Record<string, string>;
  return combat[combatType] ?? `Unknown combat message: ${combatType}`;
}

export function getInventoryMessage(inventoryType: string): string {
  const inventory = UI_TRANSLATIONS.inventory as Record<string, string>;
  return inventory[inventoryType] ?? `Unknown inventory message: ${inventoryType}`;
}