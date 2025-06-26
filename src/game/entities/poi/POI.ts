import type { Position } from '../../engine/types';
import type { InventoryItem } from '../inventory/Inventory';
import { ASSET_MAP, type AssetMapping } from '../../assets/AssetMap';
import { getAssetPath } from '../../utils/assetPath';
import { getPOIMessage } from '../../translations/ui';

export interface POIInteractionResult {
  success: boolean;
  message?: string;
  items?: InventoryItem[];
  healthChange?: number;
  teleportTo?: Position;
  openUI?: 'chest' | 'notice_board' | 'market';
}

export interface POIConfig {
  type: string;
  position: Position;
  health?: number;
  interactable: boolean;
  passable: boolean;
  damage?: number;
  animated?: boolean;
  animationFrames?: number[];
  dropItems?: { type: string; quantity: number }[];
  customData?: Record<string, unknown>;
}

export class POI {
  public readonly type: string;
  public readonly position: Position;
  public health: number;
  public readonly interactable: boolean;
  public readonly passable: boolean;
  public readonly damage: number;
  public readonly animated: boolean;
  public readonly animationFrames: number[];
  public readonly dropItems: { type: string; quantity: number }[];
  public customData: Record<string, unknown>;

  private currentFrame = 0;
  private lastFrameTime = 0;
  private readonly animationDuration = 2000; // 2 seconds per cycle
  private sprite: HTMLImageElement | null = null;
  private asset: AssetMapping | null = null;
  private isLoaded = false;

  constructor(config: POIConfig) {
    this.type = config.type;
    this.position = config.position;
    this.health = config.health ?? 100;
    this.interactable = config.interactable;
    this.passable = config.passable;
    this.damage = config.damage ?? 0;
    this.animated = config.animated ?? false;
    this.animationFrames = config.animationFrames ?? [0];
    this.dropItems = config.dropItems ?? [];
    this.customData = config.customData ?? {};

    if (this.type === 'tombstone') {
      console.log(`🪦 Creating tombstone POI with customData:`, this.customData);
    }

    this.loadAsset();
  }

  private loadAsset(): void {
    // Find the asset in our asset map
    const asset = Object.values(ASSET_MAP).find(a => {
      if (!a || typeof a.name !== 'string') return false;
      const normalizedAssetName = a.name.toLowerCase().replace(/\s+/g, '_');
      return normalizedAssetName === this.type || this.type.includes(normalizedAssetName);
    });

    if (this.type === 'tombstone') {
      console.log(`🪦 Looking for tombstone asset...`);
      console.log(`🔍 Asset search result:`, asset ? {
        name: asset.name,
        spritePath: asset.spritePath,
        index: asset.index,
        category: asset.category
      } : 'Not found');
    }

    if (asset && typeof asset.spritePath === 'string') {
      this.asset = asset;
      if (this.type === 'tombstone') {
        console.log(`✅ Tombstone asset found, loading sprite from: ${asset.spritePath}`);
      }
      void this.loadSprite(asset.spritePath);
    } else {
      console.warn(`No asset found for POI type: ${this.type}`);
      if (this.type === 'tombstone') {
        console.error(`❌ CRITICAL: Tombstone asset not found! Available assets:`, Object.keys(ASSET_MAP));
      }
    }
  }

  private async loadSprite(spritePath: string): Promise<void> {
    try {
      this.sprite = new Image();
      this.sprite.src = getAssetPath(spritePath);

      await new Promise<void>((resolve, reject) => {
        if (!this.sprite) {
          reject(new Error('Sprite is null'));
          return;
        }

        this.sprite.onload = () => {
          this.isLoaded = true;
          resolve();
        };

        this.sprite.onerror = () => {
          reject(new Error(`Failed to load POI sprite: ${spritePath}`));
        };
      });
    } catch (error) {
      console.error(`Failed to load POI sprite for ${this.type}:`, error);
    }
  }

  public update(deltaTime: number): void {
    if (this.animated && this.animationFrames.length > 1) {
      this.lastFrameTime += deltaTime * 1000;
      const timePerFrame = this.animationDuration / this.animationFrames.length;

      if (this.lastFrameTime >= timePerFrame) {
        this.lastFrameTime = 0;
        this.currentFrame = (this.currentFrame + 1) % this.animationFrames.length;
      }
    }

    // Handle damage over time for fire-based POIs
    if (this.damage > 0 && (this.type.includes('fire') || this.type.includes('flame'))) {
      // Damage will be applied by the game engine when player is on same tile
    }
  }

  public interact(playerInventory?: InventoryItem[]): POIInteractionResult {
    if (!this.interactable) {
      return { success: false, message: `Cannot interact with ${this.type}` };
    }

    switch (this.type) {
      case 'normal_chest':
      case 'rare_chest':
        return this.handleChestInteraction();

      case 'water_well':
        return this.handleWellInteraction();

      case 'portal':
        return this.handlePortalInteraction();

      case 'empty_notice_board':
      case 'notice_board':
        return this.handleNoticeBoardInteraction();

      case 'tombstone':
        return this.handleTombstoneInteraction();

      case 'wheat_field_0':
        return this.handleWheatFieldInteraction();

      case 'boat_vertical':
      case 'boat_horizontal':
        return this.handleBoatInteraction();

      case 'food_market':
      case 'butcher_market':
      case 'armory_market':
      case 'cloth_market':
        return this.handleMarketInteraction();

      case 'mine_entrance':
      case 'dungeon_entrance':
        return this.handleEntranceInteraction();

      default:
        return { success: false, message: `Unknown interaction type: ${this.type}` };
    }
  }

  private handleChestInteraction(): POIInteractionResult {
    const isRare = this.type === 'rare_chest';
    const items: InventoryItem[] = [];

    if (isRare) {
      // Rare chest - better loot
      items.push(
        { id: `item_${Date.now()}_1`, type: 'gold_ingot', quantity: 3 },
        { id: `item_${Date.now()}_2`, type: 'magic_potion', quantity: 1 },
        { id: `item_${Date.now()}_3`, type: 'sword', quantity: 1 }
      );
    } else {
      // Normal chest - basic loot
      items.push(
        { id: `item_${Date.now()}_1`, type: 'copper_ingot', quantity: 2 },
        { id: `item_${Date.now()}_2`, type: 'health_potion', quantity: 2 }
      );
    }

    return {
      success: true,
      message: getPOIMessage('chest', isRare ? 'rare_opened' : 'normal_opened'),
      items,
      openUI: 'chest'
    };
  }

  private handleWellInteraction(): POIInteractionResult {
    return {
      success: true,
      message: getPOIMessage('well', 'drink'),
      healthChange: 25
    };
  }

  private handlePortalInteraction(): POIInteractionResult {
    // For now, portal interaction only shows textbox - no teleportation
    return {
      success: true,
      message: getPOIMessage('portal', 'step_through')
      // teleportTo removed - no teleportation functionality for now
    };
  }

  private handleNoticeBoardInteraction(): POIInteractionResult {
    const isEmpty = this.type === 'empty_notice_board';

    if (isEmpty) {
      return {
        success: true,
        message: getPOIMessage('notice_board', 'empty'),
        openUI: 'notice_board'
      };
    } else {
      return {
        success: true,
        message: getPOIMessage('notice_board', 'reading'),
        openUI: 'notice_board'
      };
    }
  }

  private handleTombstoneInteraction(): POIInteractionResult {
    // Tombstones contain the inventory of a deceased player
    const items = this.customData.deathInventory as InventoryItem[] ?? [];

    return {
      success: true,
      message: getPOIMessage('tombstone', 'retrieve'),
      items
    };
  }

  private handleWheatFieldInteraction(): POIInteractionResult {
    // Only allow harvest if wheat is fully grown (frame 3)
    if (this.currentFrame >= 3 || !this.animated) {
      const items: InventoryItem[] = [
        { id: `item_${Date.now()}_wheat`, type: 'wheat', quantity: 3 }
      ];

      return {
        success: true,
        message: getPOIMessage('wheat_field', 'harvest'),
        items
      };
    } else {
      return {
        success: false,
        message: getPOIMessage('wheat_field', 'not_ready')
      };
    }
  }

  private handleBoatInteraction(): POIInteractionResult {
    return {
      success: true,
      message: getPOIMessage('boat', 'board')
    };
  }

  private handleMarketInteraction(): POIInteractionResult {
    const marketType = 'market' as const;
    let message = getPOIMessage('market', 'welcome');

    switch (this.type) {
      case 'food_market':
        message = getPOIMessage('market', 'food');
        break;
      case 'butcher_market':
        message = getPOIMessage('market', 'butcher');
        break;
      case 'armory_market':
        message = getPOIMessage('market', 'armory');
        break;
      case 'cloth_market':
        message = getPOIMessage('market', 'cloth');
        break;
    }

    return {
      success: true,
      message,
      openUI: marketType
    };
  }

  private handleEntranceInteraction(): POIInteractionResult {
    const ismine = this.type === 'mine_entrance';

    return {
      success: true,
      message: getPOIMessage('entrance', ismine ? 'mine' : 'dungeon'),
      teleportTo: {
        x: this.position.x,
        y: this.position.y + 100 // Enter underground
      }
    };
  }

  public takeDamage(amount: number): boolean {
    this.health -= amount;
    return this.health <= 0;
  }

  public getDropItems(): InventoryItem[] {
    return this.dropItems.map(drop => ({
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: drop.type,
      quantity: drop.quantity
    }));
  }

  public render(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
    if (!this.isLoaded || !this.sprite || !this.asset) {
      if (this.type === 'tombstone') {
        console.log(`🪦 Cannot render tombstone: isLoaded=${this.isLoaded}, sprite=${!!this.sprite}, asset=${!!this.asset}`);
      }
      return;
    }

    if (this.type === 'tombstone') {
      const variant = this.customData.tombstoneVariant as number | undefined ?? 'unknown';
      console.log(`🎨 Rendering tombstone at (${x}, ${y}) with variant ${variant}`);
    }

    const frameIndex = this.animated ?
      (this.animationFrames[this.currentFrame] ?? 0) :
      (typeof this.asset.index === 'number' ? this.asset.index : 0);
    const spriteSize = 16;
    const spritesPerRow = Math.floor(this.sprite.width / spriteSize);
    const spriteX = (frameIndex % spritesPerRow) * spriteSize;
    const spriteY = Math.floor(frameIndex / spritesPerRow) * spriteSize;

    if (this.type === 'tombstone') {
      console.log(`🎨 Tombstone render details: frameIndex=${frameIndex}, spriteX=${spriteX}, spriteY=${spriteY}, spritesPerRow=${spritesPerRow}`);
    }

    ctx.drawImage(
      this.sprite,
      spriteX,
      spriteY,
      spriteSize,
      spriteSize,
      x,
      y,
      spriteSize * scale,
      spriteSize * scale
    );

    if (this.type === 'tombstone') {
      console.log(`✅ Tombstone rendered successfully`);
    }
  }

  public isAt(position: Position): boolean {
    return this.position.x === position.x && this.position.y === position.y;
  }

  public isDangerous(): boolean {
    return this.damage > 0;
  }
}