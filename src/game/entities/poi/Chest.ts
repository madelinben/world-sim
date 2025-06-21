import type { Position } from '../../engine/types';
import type { InventoryItem } from '../inventory/Inventory';

export class Chest {
  public position: Position;
  public inventory: (InventoryItem | null)[];
  public chestType: string; // Type of chest (rare_chest, normal_chest, etc.)
  public chestId: string; // Unique identifier for save/load

  constructor(config: {
    position: Position;
    inventory?: (InventoryItem | null)[];
    chestType: string;
    chestId: string;
  }) {
    this.position = { ...config.position };
    this.inventory = config.inventory ?? new Array<InventoryItem | null>(9).fill(null); // 9 slots like player inventory
    this.chestType = config.chestType;
    this.chestId = config.chestId;
  }

  public addItem(item: InventoryItem): boolean {
    // Try to stack with existing items first
    for (const [i, existingItem] of this.inventory.entries()) {
      if (existingItem && existingItem.type === item.type) {
        // Check if we can stack (assuming max stack of 64 for most items)
        const maxStack = this.getMaxStackSize(item.type);
        const availableSpace = maxStack - existingItem.quantity;
        if (availableSpace > 0) {
          const amountToAdd = Math.min(availableSpace, item.quantity);
          existingItem.quantity += amountToAdd;
          item.quantity -= amountToAdd;
          if (item.quantity <= 0) {
            return true; // Fully stacked
          }
        }
      }
    }

    // Find first empty slot for remaining quantity
    for (const [i, slot] of this.inventory.entries()) {
      if (!slot) {
        this.inventory[i] = { ...item };
        return true;
      }
    }
    return false; // Inventory full
  }

  public removeItem(slotIndex: number): InventoryItem | null {
    if (slotIndex >= 0 && slotIndex < this.inventory.length) {
      const item = this.inventory[slotIndex] ?? null;
      this.inventory[slotIndex] = null;
      return item;
    }
    return null;
  }

  public isEmpty(): boolean {
    return this.inventory.every(item => !item);
  }

  public getDisplayName(): string {
    return this.chestType === 'rare_chest' ? 'Rare Chest' : 'Chest';
  }

  public getDescription(): string {
    const itemCount = this.inventory.filter(item => item !== null).length;
    return `Press Left/Right to navigate, Z to take all, X to take selected, F to close. Items: ${itemCount}/9`;
  }

  private getMaxStackSize(itemType: string): number {
    // Most items stack to 64, but some have different limits
    const stackLimits: Record<string, number> = {
      'health_potion': 16,
      'poison_potion': 16,
      'magic_potion': 16,
      'stamina_potion': 16,
      'health_heart': 1,
      'hammer': 1,
      'sword': 1,
      'shield': 1,
      'dagger': 1
    };
    return stackLimits[itemType] ?? 64;
  }
}