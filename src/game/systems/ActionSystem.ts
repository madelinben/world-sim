import type { InputAction } from './InputSystem';
import type { PlayerState } from '../engine/types';
import type { World } from '../world/World';
import type { Dungeon } from '../world/Dungeon';
import type { Camera } from './Camera';
import type { UIManager } from '../ui/UIManager';
import type { Player as PlayerEntity } from '../entities/player/Player';
import type { Tile } from '../world/WorldGenerator';
import type { VillageStructure } from '../world/VillageGenerator';
import type { POI, POIInteractionResult } from '../entities/poi/POI';
import type { NPC } from '../entities/npc/NPC';
import type { Cactus } from '../entities/structure/Cactus';
import { WorldGenerator } from '../world/WorldGenerator';

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

  private handleWorldAttack(tile: Tile | null, tileX: number, tileY: number): void {
    // Check for trees
    if (tile?.trees && tile.trees.length > 0) {
      const tree = tile.trees[0];
      if (tree) {
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
    // Check for cactus
    else if (tile?.cactus && tile.cactus.length > 0) {
      const cactus = tile.cactus[0];
      if (cactus) {
        console.log(`Cactus health before attack: ${cactus.getHealth()}/${cactus.getMaxHealth()}`);
        const result = cactus.takeDamage(this.player.attackDamage);

        if (result.destroyed) {
          console.log(`🌵 Cactus destroyed! Dropped ${result.dropValue} ${result.dropType}`);
          const added = this.player.addToInventory(result.dropType, result.dropValue);
          if (added) {
            console.log(`✅ Added ${result.dropValue} ${result.dropType} to inventory`);
          }

          // Remove cactus completely from tile and convert to SAND
          tile.cactus = tile.cactus.filter((c: Cactus) => c !== cactus);
          if (tile.cactus.length === 0) {
            delete tile.cactus;
            tile.value = 'SAND';
            this.world.invalidateCache();
            console.log(`Cactus completely removed - tile converted to SAND at (${tileX}, ${tileY})`);
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
          npc.takeDamage(this.player.attackDamage);

          if (npc.isDead()) {
            console.log(`💀 ${npc.type} NPC defeated!`);
          } else {
            console.log(`${npc.type} took ${this.player.attackDamage} damage. Health: ${npc.health}/${npc.maxHealth}`);
          }
          break;
        }
      }
    }
  }

  private handleDungeonAttack(tile: Tile | null, tileX: number, tileY: number): void {
    // Check for dungeon monsters
    if (tile?.villageStructures) {
      for (const structure of tile.villageStructures) {
        if (structure.npc && !structure.npc.isDead()) {
          const npc: NPC = structure.npc;
          console.log(`Attacking ${npc.type} monster at (${tileX}, ${tileY})`);
          npc.takeDamage(this.player.attackDamage);

          if (npc.isDead()) {
            console.log(`💀 ${npc.type} monster defeated!`);
          } else {
            console.log(`${npc.type} took ${this.player.attackDamage} damage. Health: ${npc.health}/${npc.maxHealth}`);
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

  private handleWorldInteract(tile: Tile | null, tileX: number, tileY: number): void {
    // Check for village structures first (POIs and NPCs)
    if (tile?.villageStructures) {
      for (const structure of tile.villageStructures) {
        if (structure.poi) {
          const poi: POI = structure.poi;
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
    if (tile?.trees && tile.trees.length > 0) {
      console.log('Interacting with tree - could harvest fruit, check growth, etc.');
    } else if (tile?.cactus && tile.cactus.length > 0) {
      console.log('Interacting with cactus - could harvest water, check growth, etc.');
    } else {
      console.log('Nothing to interact with in that direction');
    }
  }

  private handleDungeonInteract(tile: Tile | null, tileX: number, tileY: number): void {
    // Check for dungeon POI structures
    if (tile?.villageStructures) {
      for (const structure of tile.villageStructures) {
        if (structure.poi) {
          const poi: POI = structure.poi;

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

  private logFacingTile(): void {
    const facingPos = this.player.getFacingPosition(WorldGenerator.TILE_SIZE);
    const tileX = Math.floor(facingPos.x / WorldGenerator.TILE_SIZE);
    const tileY = Math.floor(facingPos.y / WorldGenerator.TILE_SIZE);

    const tile = this.camera.renderingMode === 'dungeon' ?
      this.dungeon.getTile(tileX, tileY) :
      this.world.getTile(tileX, tileY);

    let tileInfo = tile?.value ?? 'UNKNOWN';

    if (this.camera.renderingMode === 'world') {
      if (tile?.trees && tile.trees.length > 0) {
        const tree = tile.trees[0];
        tileInfo += ` (Tree: ${tree?.getHealth()}/${tree?.getMaxHealth()} HP)`;
      }
      if (tile?.cactus && tile.cactus.length > 0) {
        const cactus = tile.cactus[0];
        tileInfo += ` (Cactus: ${cactus?.getHealth()}/${cactus?.getMaxHealth()} HP, Variant: ${cactus?.getVariant()})`;
      }

      const npc = this.world.getNPCAt(tileX, tileY);
      if (npc) {
        tileInfo += ` (${npc.type}: ${npc.health}/${npc.maxHealth} HP)`;
      }
    } else {
      if (tile?.villageStructures && tile.villageStructures.length > 0) {
        const dungeonStructures = tile.villageStructures.map((s: VillageStructure) =>
          s.poi ? s.poi.type : s.npc ? `${s.npc.type} Monster` : 'unknown'
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