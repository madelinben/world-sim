import type { Position } from '../../engine/types';
import type { InventoryItem } from '../inventory/Inventory';

export class Tombstone {
  public position: Position;
  public inventory: (InventoryItem | null)[];
  public tombstoneVariant: number; // 0-7 for different tombstone sprites
  public deadEntityType: string; // What type of entity died here
  public deadEntityName?: string; // Optional name for the dead entity

  constructor(config: {
    position: Position;
    inventory?: (InventoryItem | null)[];
    deadEntityType: string;
    deadEntityName?: string;
  }) {
    this.position = { ...config.position };
    this.inventory = config.inventory ?? new Array<InventoryItem | null>(9).fill(null); // 9 slots like player inventory
    this.deadEntityType = config.deadEntityType;
    this.deadEntityName = config.deadEntityName;

    // Randomly select tombstone variant (0-7)
    this.tombstoneVariant = Math.floor(Math.random() * 8);
  }

  public addItem(item: InventoryItem): boolean {
    // Find first empty slot
    for (let i = 0; i < this.inventory.length; i++) {
      if (!this.inventory[i]) {
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
    if (this.deadEntityName) {
      return `${this.deadEntityName}'s Grave`;
    }
    return `${this.deadEntityType} Grave`;
  }

  public getDescription(): string {
    const itemCount = this.inventory.filter(item => item !== null).length;
    return `Press Left/Right to navigate, Z to take all, X to take selected, F to close. Items: ${itemCount}/9`;
  }
}