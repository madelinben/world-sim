import type { InputAction } from './InputSystem';
import type { PlayerState, Tile as TileInterface, VillageStructure, MineStructure, DungeonStructure } from '../engine/types';
import type { World } from '../world/World';
import type { Dungeon } from '../world/Dungeon';
import type { Camera } from './Camera';
import type { UIManager } from '../ui/UIManager';
import type { Player as PlayerEntity } from '../entities/player/Player';
import type { Tile } from '../world/WorldGenerator';
import type { VillageStructure as WorldVillageStructure } from '../world/VillageGenerator';
import type { POI, POIInteractionResult } from '../entities/poi/POI';
import type { NPC } from '../entities/npc/NPC';
import type { Cactus } from '../entities/structure/Cactus';
import { WorldGenerator } from '../world/WorldGenerator';

// Type guards for different structure types
function isVillageStructure(structure: unknown): structure is VillageStructure {
  if (structure === null || typeof structure !== 'object') return false;
  const obj = structure as Record<string, unknown>;
  return typeof obj.type === 'string' &&
         obj.position !== undefined &&
         typeof obj.position === 'object' &&
         obj.position !== null;
}

function isMineStructure(structure: unknown): structure is MineStructure {
  if (structure === null || typeof structure !== 'object') return false;
  const obj = structure as Record<string, unknown>;
  return typeof obj.type === 'string' &&
         obj.position !== undefined &&
         typeof obj.position === 'object' &&
         obj.position !== null;
}

function isDungeonStructure(structure: unknown): structure is DungeonStructure {
  if (structure === null || typeof structure !== 'object') return false;
  const obj = structure as Record<string, unknown>;
  return typeof obj.type === 'string' &&
         obj.position !== undefined &&
         typeof obj.position === 'object' &&
         obj.position !== null;
}

function isWorldStructure(structure: unknown): structure is WorldVillageStructure {
  if (structure === null || typeof structure !== 'object') return false;
  const obj = structure as Record<string, unknown>;
  return typeof obj.type === 'string' &&
         obj.position !== undefined &&
         typeof obj.position === 'object' &&
         obj.position !== null;
}

// Type guard for cactus arrays
function isCactusArray(arr: unknown[]): arr is Cactus[] {
  return arr.every(item => {
    if (!item || typeof item !== 'object') return false;
    const obj = item as Record<string, unknown>;
    return typeof obj.getHealth === 'function' &&
           typeof obj.getVariant === 'function';
  });
}

export class ActionSystem {
  private world: World;
  private dungeon: Dungeon;
  private camera: Camera;
  private uiManager: UIManager;
  private player: PlayerEntity;

  constructor(
    world: World,
    dungeon: Dungeon,
    camera: Camera,
    uiManager: UIManager,
    player: PlayerEntity
  ) {
    this.world = world;
    this.dungeon = dungeon;
    this.camera = camera;
    this.uiManager = uiManager;
    this.player = player;
  }

  public processActions(actions: InputAction[], playerState: PlayerState): void {
    for (const action of actions) {
      this.processAction(action, playerState);
    }
  }

  private processAction(action: InputAction, playerState: PlayerState): void {
    switch (action.type) {
      case 'attack':
        this.handleAttack();
        break;

      case 'interact':
        if (action.key === 'take_all') {
          this.handleTakeAllChestItems();
        } else if (action.key === 'take_selected') {
          this.handleTakeSelectedChestItem();
        } else {
          this.handleInteract();
        }
        break;

      case 'ui_navigation':
        this.handleUINavigation(action);
        break;

      case 'menu':
        this.handleMenuAction(action);
        break;
    }
  }

  private handleAttack(): void {
    const facingPos = this.player.getFacingPosition(WorldGenerator.TILE_SIZE);
    const tileX = Math.floor(facingPos.x / WorldGenerator.TILE_SIZE);
    const tileY = Math.floor(facingPos.y / WorldGenerator.TILE_SIZE);

    const tile = this.camera.renderingMode === 'dungeon' ?
      this.dungeon.getTile(tileX, tileY) :
      this.world.getTile(tileX, tileY);

    console.log(`Player attack damage: ${this.player.attackDamage}`);
    console.log(`Attacking tile at (${tileX}, ${tileY}): ${tile?.value}`);

    if (this.camera.renderingMode === 'world') {
      this.handleWorldAttack(tile ?? null, tileX, tileY);
    } else {
      this.handleDungeonAttack(tile ?? null, tileX, tileY);
    }
  }

  private handleWorldAttack(tile: TileInterface | Tile | null, tileX: number, tileY: number): void {
    // Check for trees (only in world tiles)
    if (tile && 'trees' in tile && tile.trees && tile.trees.length > 0) {
      const tree = tile.trees[0];
      if (tree && typeof tree === 'object' && 'getHealth' in tree && 'takeDamage' in tree) {
        console.log(`Tree health before attack: ${tree.getHealth()}/${tree.getMaxHealth()}`);
        const result = tree.takeDamage(this.player.attackDamage);

        if (result.destroyed) {
          console.log(`🌳 Tree destroyed! Dropped ${result.dropValue} ${result.dropType}`);
          const added = this.player.addToInventory(result.dropType, result.dropValue);
          if (added) {
            console.log(`✅ Added ${result.dropValue} ${result.dropType} to inventory`);
          }
        } else {
          console.log(`Tree took ${this.player.attackDamage} damage. Health: ${tree.getHealth()}/${tree.getMaxHealth()}`);
        }
      }
    }
    // Check for cactus (only in world tiles)
    else if (tile && 'cactus' in tile && tile.cactus && tile.cactus.length > 0) {
      const cactus = tile.cactus[0];
      if (cactus && typeof cactus === 'object' && 'getHealth' in cactus && 'takeDamage' in cactus) {
        console.log(`Cactus health before attack: ${cactus.getHealth()}/${cactus.getMaxHealth()}`);
        const result = cactus.takeDamage(this.player.attackDamage);

        if (result.destroyed) {
          console.log(`🌵 Cactus destroyed! Dropped ${result.dropValue} ${result.dropType}`);
          const added = this.player.addToInventory(result.dropType, result.dropValue);
          if (added) {
            console.log(`✅ Added ${result.dropValue} ${result.dropType} to inventory`);
          }

          // Remove cactus completely from tile and convert to SAND (only for world tiles)
          if ('cactus' in tile && tile.cactus && isCactusArray(tile.cactus)) {
            const updatedCactus = tile.cactus.filter((c) => c !== cactus);
            if (updatedCactus.length > 0) {
              (tile as { cactus: Cactus[] }).cactus = updatedCactus;
            } else {
              delete (tile as { cactus?: Cactus[] }).cactus;
              tile.value = 'SAND';
              this.world.invalidateCache();
              console.log(`Cactus completely removed - tile converted to SAND at (${tileX}, ${tileY})`);
            }
          }
        } else {
          console.log(`Cactus took ${this.player.attackDamage} damage. Health: ${cactus.getHealth()}/${cactus.getMaxHealth()}`);
        }
      }
    }
    // Check for NPCs
    else if (tile?.villageStructures) {
      for (const structure of tile.villageStructures) {
        if (structure.npc && !structure.npc.isDead()) {
          const npc = structure.npc;
          console.log(`Attacking ${npc.type} NPC at (${tileX}, ${tileY})`);
          if ('takeDamage' in npc && typeof npc.takeDamage === 'function') {
            npc.takeDamage(this.player.attackDamage);

            if (npc.isDead()) {
              console.log(`💀 ${npc.type} NPC defeated!`);
            } else {
              console.log(`${npc.type} took ${this.player.attackDamage} damage. Health: ${npc.health}/${npc.maxHealth}`);
            }
          }
          break;
        }
      }
    }
  }

  private handleDungeonAttack(tile: TileInterface | Tile | null, tileX: number, tileY: number): void {
    // Check for dungeon monsters
    if (tile?.villageStructures) {
      for (const structure of tile.villageStructures) {
        if (structure.npc && !structure.npc.isDead()) {
          const npc = structure.npc;
          console.log(`Attacking ${npc.type} monster at (${tileX}, ${tileY})`);
          if ('takeDamage' in npc && typeof npc.takeDamage === 'function') {
            npc.takeDamage(this.player.attackDamage);

            if (npc.isDead()) {
              console.log(`💀 ${npc.type} monster defeated!`);
            } else {
              console.log(`${npc.type} took ${this.player.attackDamage} damage. Health: ${npc.health}/${npc.maxHealth}`);
            }
          }
          break;
        }
      }
    }
  }

  private handleInteract(): void {
    const facingPos = this.player.getFacingPosition(WorldGenerator.TILE_SIZE);
    const tileX = Math.floor(facingPos.x / WorldGenerator.TILE_SIZE);
    const tileY = Math.floor(facingPos.y / WorldGenerator.TILE_SIZE);

    const tile = this.camera.renderingMode === 'dungeon' ?
      this.dungeon.getTile(tileX, tileY) :
      this.world.getTile(tileX, tileY);

    if (this.camera.renderingMode === 'world') {
      this.handleWorldInteract(tile ?? null, tileX, tileY);
    } else {
      this.handleDungeonInteract(tile ?? null, tileX, tileY);
    }
  }

  private handleWorldInteract(tile: TileInterface | Tile | null, tileX: number, tileY: number): void {
    // Check for village structures first (POIs and NPCs)
    if (tile?.villageStructures) {
      for (const structure of tile.villageStructures) {
        if (structure.poi) {
          const poi: POI = structure.poi as POI;
          console.log(`🔍 Interacting with ${poi.type} at (${tileX}, ${tileY})`);

          const result: POIInteractionResult = poi.interact();
          if (result.success) {
            if (result.message) {
              this.uiManager.showTextBox({ text: result.message });
            }

            if (result.healthChange) {
              this.player.heal(result.healthChange);
              console.log(`💚 Player healed for ${result.healthChange} HP`);
            }

            if (result.items) {
              for (const item of result.items) {
                const added = this.player.addToInventory(item.type, item.quantity);
                if (added) {
                  console.log(`✅ Added ${item.quantity}x ${item.type} to inventory`);
                } else {
                  console.log(`❌ Inventory full! Could not add ${item.quantity}x ${item.type}`);
                }
              }
            }
          }
          return;
        }
      }
    }

    // Check for other interactable structures
    if (tile && 'trees' in tile && tile.trees && tile.trees.length > 0) {
      console.log('Interacting with tree - could harvest fruit, check growth, etc.');
    } else if (tile && 'cactus' in tile && tile.cactus && tile.cactus.length > 0) {
      console.log('Interacting with cactus - could harvest water, check growth, etc.');
    } else {
      console.log('Nothing to interact with in that direction');
    }
  }

  private handleDungeonInteract(tile: TileInterface | Tile | null, tileX: number, tileY: number): void {
    // Check for dungeon POI structures
    if (tile?.villageStructures) {
      for (const structure of tile.villageStructures) {
        if (structure.poi) {
          const poi = structure.poi as POI;

          if (poi.type === 'rare_chest') {
            console.log('🏺 Interacting with rare chest in dungeon');
            return;
          }

          if (poi.type === 'dungeon_portal') {
            console.log('🚪 Interacting with dungeon portal');
            const result: POIInteractionResult = poi.interact();
            if (result.success && result.message) {
              this.uiManager.showTextBox({ text: result.message });
            }
            return;
          }
        }
      }
    }

    console.log('Nothing to interact with in dungeon');
  }

  private handleUINavigation(action: InputAction): void {
    if (!action.direction) return;

    switch (action.data) {
      case 'player_inventory':
        this.uiManager.navigatePlayerInventory(action.direction);
        break;
      case 'chest':
        this.uiManager.navigateChestInventory(action.direction);
        break;
      case 'menu':
        if (action.direction === 'up' || action.direction === 'down') {
          this.uiManager.navigateMenu(action.direction);
        }
        break;
    }
  }

  private handleMenuAction(action: InputAction): void {
    switch (action.key) {
      case 'escape':
        this.handleEscapeKey();
        break;
      case 'close_inventory':
        this.uiManager.closeInventoryUI();
        break;
      case 'close_chest':
        this.uiManager.hideChestUI();
        break;
      case 'close_textbox':
        this.uiManager.hideTextBox();
        break;
      case 'dismiss_textbox':
        this.uiManager.hideTextBox();
        break;
      case 'toggle_inventory':
        this.uiManager.toggleInventoryUI();
        break;
      case 'log_facing_tile':
        this.logFacingTile();
        break;
      case 'select':
        this.handleMenuSelect();
        break;
    }
  }

  private handleEscapeKey(): void {
    if (this.uiManager.isTombstoneUIVisible()) {
      this.uiManager.hideTombstoneUI();
    } else if (this.uiManager.isTextBoxVisible()) {
      this.uiManager.hideTextBox();
    } else if (this.uiManager.isInventoryUIVisible()) {
      this.uiManager.closeInventoryUI();
    } else if (this.uiManager.isChestUIVisible()) {
      this.uiManager.hideChestUI();
    } else if (this.uiManager.isMenuUIVisible()) {
      this.uiManager.hideMenuUI();
    } else {
      this.uiManager.showMenuUI();
    }
  }

  private handleMenuSelect(): void {
    const selectedOption = this.uiManager.getSelectedMenuOption();
    console.log(`Menu option selected: ${selectedOption}`);

    if (selectedOption === 'Back to Game') {
      this.uiManager.hideMenuUI();
    } else if (selectedOption === 'Save Game') {
      console.log('Save game functionality not yet implemented');
      this.uiManager.hideMenuUI();
    }
  }

  private getStructureDescription(structure: unknown): string {
    if (isVillageStructure(structure)) {
      return structure.poi ? structure.poi.type : structure.npc ? `${structure.npc.type} Village NPC` : 'Village Structure';
    } else if (isMineStructure(structure)) {
      return structure.poi ? structure.poi.type : structure.npc ? `${structure.npc.type} Mine NPC` : 'Mine Structure';
    } else if (isDungeonStructure(structure)) {
      return structure.poi ? structure.poi.type : structure.npc ? `${structure.npc.type} Monster` : 'Dungeon Structure';
    } else if (isWorldStructure(structure)) {
      return structure.poi ? structure.poi.type : structure.npc ? `${structure.npc.type} World NPC` : 'World Structure';
    }
    return 'Unknown Structure';
  }

  private logFacingTile(): void {
    const facingPos = this.player.getFacingPosition(WorldGenerator.TILE_SIZE);
    const tileX = Math.floor(facingPos.x / WorldGenerator.TILE_SIZE);
    const tileY = Math.floor(facingPos.y / WorldGenerator.TILE_SIZE);

    const tile = this.camera.renderingMode === 'dungeon' ?
      this.dungeon.getTile(tileX, tileY) :
      this.world.getTile(tileX, tileY);

    let tileInfo = tile?.value ?? 'UNKNOWN';

    if (this.camera.renderingMode === 'world') {
      if (tile && 'trees' in tile && tile.trees && tile.trees.length > 0) {
        const tree = tile.trees[0];
        if (tree && 'getHealth' in tree && 'getMaxHealth' in tree) {
          tileInfo += ` (Tree: ${tree.getHealth()}/${tree.getMaxHealth()} HP)`;
        }
      }
      if (tile && 'cactus' in tile && tile.cactus && tile.cactus.length > 0) {
        const cactus = tile.cactus[0];
        if (cactus && 'getHealth' in cactus && 'getMaxHealth' in cactus && 'getVariant' in cactus) {
          tileInfo += ` (Cactus: ${cactus.getHealth()}/${cactus.getMaxHealth()} HP, Variant: ${cactus.getVariant()})`;
        }
      }

      const npc = this.world.getNPCAt(tileX, tileY);
      if (npc) {
        tileInfo += ` (${npc.type}: ${npc.health}/${npc.maxHealth} HP)`;
      }
    } else {
      if (tile?.villageStructures && tile.villageStructures.length > 0) {
        const dungeonStructures = tile.villageStructures.map(structure =>
          this.getStructureDescription(structure)
        ).join(', ');
        tileInfo += ` (Dungeon: ${dungeonStructures})`;
      }
    }

    console.log(`Facing tile: ${tileInfo}`);
  }

  private handleTakeAllChestItems(): void {
    console.log('Take all chest items - to be implemented');
  }

  private handleTakeSelectedChestItem(): void {
    console.log('Take selected chest item - to be implemented');
  }
}