import type { InventoryItem } from '../entities/inventory/Inventory';
import type { Camera } from '../systems/Camera';
import { ASSET_MAP, getAssetByName } from '../assets/AssetMap';
import { getAssetPath } from '../utils/assetPath';

export interface InventoryUIConfig {
  slotsPerColumn: number;
  slotSize: number;
  slotSpacing: number;
  marginFromEdge: number;
  marginFromTop: number;
}

export class InventoryUI {
  private config: InventoryUIConfig;
  private sprites = new Map<string, HTMLImageElement>();
  private imagesLoaded = false;

  constructor(config?: Partial<InventoryUIConfig>) {
    this.config = {
      slotsPerColumn: 9,
      slotSize: 48,
      slotSpacing: 4,
      marginFromEdge: 20,
      marginFromTop: 20,
      ...config
    };
    void this.loadSprites();
  }

  private async loadSprites(): Promise<void> {
    try {
      // Load all UI sprites for inventory boxes
      const uiAssets = [
        'default_item_box',
        'highlighted_item_box',
        'box_selector'
      ];

      for (const assetName of uiAssets) {
        const asset = getAssetByName(assetName);
        if (asset) {
          const image = new Image();
          image.src = getAssetPath(asset.spritePath);
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error(`Failed to load ${asset.spritePath}`));
          });
          this.sprites.set(assetName, image);
        }
      }

      // Load all inventory item sprites
      const inventoryAssets = Object.values(ASSET_MAP).filter(asset => asset.category === 'inventory');
      for (const asset of inventoryAssets) {
        if (!this.sprites.has(asset.spritePath)) {
          const image = new Image();
          image.src = getAssetPath(asset.spritePath);
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error(`Failed to load ${asset.spritePath}`));
          });
          this.sprites.set(asset.spritePath, image);
        }
      }

      this.imagesLoaded = true;
      console.log('Inventory UI sprites loaded successfully');
    } catch (error) {
      console.error('Failed to load inventory UI sprites:', error);
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    inventory: (InventoryItem | null)[],
    selectedSlot: number
  ): void {
    if (!this.imagesLoaded) return;

    const canvas = ctx.canvas;
    const startX = canvas.width - this.config.marginFromEdge - this.config.slotSize;
    const startY = this.config.marginFromTop;

    // Render each inventory slot
    for (let i = 0; i < this.config.slotsPerColumn; i++) {
      const slotX = startX;
      const slotY = startY + i * (this.config.slotSize + this.config.slotSpacing);
      const item = inventory[i] ?? null;
      const isSelected = i === selectedSlot;

      this.renderSlot(ctx, slotX, slotY, item, isSelected, i + 1);
    }
  }

  private renderSlot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    item: InventoryItem | null,
    isSelected: boolean,
    slotNumber: number
  ): void {
    // Render slot background
    const boxSprite = isSelected ? 'highlighted_item_box' : 'default_item_box';
    this.renderSprite(ctx, boxSprite, 0, x, y, this.config.slotSize, this.config.slotSize);

    // Render selection indicator if selected
    if (isSelected) {
      this.renderSprite(ctx, 'box_selector', 0, x - 2, y - 2, this.config.slotSize + 4, this.config.slotSize + 4);
    }

            // Render item if present
    if (item) {
      const asset = this.getItemAsset(item.type);
      if (asset) {
        // Render item sprite centered in slot
        const itemSize = Math.floor(this.config.slotSize * 0.7);
        const itemX = x + (this.config.slotSize - itemSize) / 2;
        const itemY = y + (this.config.slotSize - itemSize) / 2;

        this.renderSprite(ctx, item.type, asset.index, itemX, itemY, itemSize, itemSize);

        // Render quantity if greater than 1
        if (item.quantity > 1) {
          this.renderQuantity(ctx, x, y, item.quantity);
        }
      }
    }

    // Render slot number
    this.renderSlotNumber(ctx, x, y, slotNumber);
  }

  private renderSprite(
    ctx: CanvasRenderingContext2D,
    assetName: string,
    frameIndex: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const asset = getAssetByName(assetName);
    if (!asset) return;

    const image = this.sprites.get(asset.spritePath);
    if (!image) return;

    // Calculate sprite frame position (16x16 sprites in a grid)
    const spriteSize = 16;
    const spritesPerRow = Math.floor(image.width / spriteSize);
    const spriteX = (frameIndex % spritesPerRow) * spriteSize;
    const spriteY = Math.floor(frameIndex / spritesPerRow) * spriteSize;

    ctx.drawImage(
      image,
      spriteX,
      spriteY,
      spriteSize,
      spriteSize,
      x,
      y,
      width,
      height
    );
  }

  private renderQuantity(ctx: CanvasRenderingContext2D, slotX: number, slotY: number, quantity: number): void {
    ctx.save();

    // Style for quantity text
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    const text = quantity.toString();
    const textX = slotX + this.config.slotSize - 4;
    const textY = slotY + this.config.slotSize - 4;

    // Draw text with outline
    ctx.strokeText(text, textX, textY);
    ctx.fillText(text, textX, textY);

    ctx.restore();
  }

  private renderSlotNumber(ctx: CanvasRenderingContext2D, slotX: number, slotY: number, slotNumber: number): void {
    ctx.save();

    // Style for slot number
    ctx.fillStyle = '#CCCCCC';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const text = slotNumber.toString();
    const textX = slotX + 2;
    const textY = slotY + 2;

    // Draw slot number with outline
    ctx.strokeText(text, textX, textY);
    ctx.fillText(text, textX, textY);

    ctx.restore();
  }

  private getItemAsset(itemType: string): { index: number; spritePath: string } | undefined {
    const asset = getAssetByName(itemType);
    if (asset && typeof asset.index === 'number') {
      return { index: asset.index, spritePath: asset.spritePath };
    }
    return undefined;
  }

  public getSlotAt(mouseX: number, mouseY: number, canvasWidth: number): number | null {
    const startX = canvasWidth - this.config.marginFromEdge - this.config.slotSize;
    const startY = this.config.marginFromTop;

    for (let i = 0; i < this.config.slotsPerColumn; i++) {
      const slotX = startX;
      const slotY = startY + i * (this.config.slotSize + this.config.slotSpacing);

      if (
        mouseX >= slotX &&
        mouseX <= slotX + this.config.slotSize &&
        mouseY >= slotY &&
        mouseY <= slotY + this.config.slotSize
      ) {
        return i;
      }
    }

    return null;
  }

  public isPointInInventoryArea(mouseX: number, mouseY: number, canvasWidth: number, canvasHeight: number): boolean {
    const startX = canvasWidth - this.config.marginFromEdge - this.config.slotSize;
    const startY = this.config.marginFromTop;
    const endY = startY + (this.config.slotsPerColumn - 1) * (this.config.slotSize + this.config.slotSpacing) + this.config.slotSize;

    return mouseX >= startX && mouseX <= canvasWidth && mouseY >= startY && mouseY <= endY;
  }
}