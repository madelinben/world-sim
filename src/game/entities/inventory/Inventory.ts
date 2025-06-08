export interface InventoryItem {
  id: string;
  type: string;
  quantity: number;
  maxStack?: number;
}

export class Inventory {
  private items: (InventoryItem | null)[];
  private selectedSlot = 0;
  private readonly maxSlots = 9;

  constructor() {
    // Initialize empty inventory with 9 slots
    this.items = Array(9).fill(null) as (InventoryItem | null)[];
  }

  public addItem(type: string, quantity = 1): boolean {
    // Check if we can stack with existing items
    for (let i = 0; i < this.maxSlots; i++) {
      const slot = this.items[i];
      if (slot && slot.type === type) {
        const maxStack = slot.maxStack ?? 64;
        const availableSpace = maxStack - slot.quantity;
        if (availableSpace > 0) {
          const addAmount = Math.min(quantity, availableSpace);
          slot.quantity += addAmount;
          quantity -= addAmount;
          console.log(`Added ${addAmount} ${type} to slot ${i + 1}. New quantity: ${slot.quantity}`);

          if (quantity <= 0) {
            this.logInventoryState();
            return true;
          }
        }
      }
    }

    // Find empty slot for remaining items
    while (quantity > 0) {
      const emptySlotIndex = this.items.findIndex(item => item === null);
      if (emptySlotIndex === -1) {
        console.log(`Inventory full! Could not add ${quantity} ${type}`);
        return false;
      }

      const maxStack = this.getMaxStackSize(type);
      const addAmount = Math.min(quantity, maxStack);

      this.items[emptySlotIndex] = {
        id: this.generateItemId(),
        type,
        quantity: addAmount,
        maxStack
      };

      quantity -= addAmount;
      console.log(`Added ${addAmount} ${type} to slot ${emptySlotIndex + 1}`);
    }

    this.logInventoryState();
    return true;
  }

  public removeItem(type: string, quantity = 1): boolean {
    let remainingToRemove = quantity;

    for (let i = 0; i < this.maxSlots; i++) {
      const slot = this.items[i];
      if (slot && slot.type === type) {
        const removeAmount = Math.min(remainingToRemove, slot.quantity);
        slot.quantity -= removeAmount;
        remainingToRemove -= removeAmount;

        if (slot.quantity <= 0) {
          this.items[i] = null;
        }

        if (remainingToRemove <= 0) {
          console.log(`Removed ${quantity} ${type} from inventory`);
          this.logInventoryState();
          return true;
        }
      }
    }

    console.log(`Could not remove ${quantity} ${type}. Only removed ${quantity - remainingToRemove}`);
    this.logInventoryState();
    return false;
  }

  public selectSlot(slotIndex: number): void {
    if (slotIndex >= 0 && slotIndex < this.maxSlots) {
      this.selectedSlot = slotIndex;
      const selectedItem = this.items[slotIndex];

      if (selectedItem) {
        console.log(`Selected slot ${slotIndex + 1}: ${selectedItem.quantity}x ${selectedItem.type}`);
      } else {
        console.log(`Selected slot ${slotIndex + 1}: Empty`);
      }
    }
  }

  public getSelectedItem(): InventoryItem | null {
    return this.items[this.selectedSlot] ?? null;
  }

  public getSelectedSlot(): number {
    return this.selectedSlot;
  }

  public getItem(slotIndex: number): InventoryItem | null {
    if (slotIndex >= 0 && slotIndex < this.maxSlots) {
      return this.items[slotIndex] ?? null;
    }
    return null;
  }

  public isEmpty(): boolean {
    return this.items.every(item => item === null);
  }

  public getItemCount(type: string): number {
    return this.items
      .filter(item => item?.type === type)
      .reduce((sum, item) => sum + (item?.quantity ?? 0), 0);
  }

  public logInventoryState(): void {
    console.log('=== INVENTORY STATE ===');
    this.items.forEach((item, index) => {
      const slotMarker = index === this.selectedSlot ? '→' : ' ';
      if (item) {
        console.log(`${slotMarker} Slot ${index + 1}: ${item.quantity}x ${item.type}`);
      } else {
        console.log(`${slotMarker} Slot ${index + 1}: Empty`);
      }
    });
    console.log('=====================');
  }

  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getMaxStackSize(type: string): number {
    // Define max stack sizes for different item types
    const stackSizes: Record<string, number> = {
      wood: 64,
      cactus: 64,
      stone: 64,
      chicken_meat: 64,
      pork: 64,
      mutton: 64,
      wool: 64,
      // Add more item types as needed
    };

    return stackSizes[type] ?? 64; // Default to 64
  }
}