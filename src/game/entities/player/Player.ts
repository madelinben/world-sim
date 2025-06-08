import { Inventory } from '../inventory/Inventory';
import type { Position } from '../../engine/types';

export interface PlayerConfig {
  position: Position;
  health?: number;
  attackDamage?: number;
}

export class Player {
  public position: Position;
  public health: number;
  public maxHealth: number;
  public attackDamage: number;
  public inventory: Inventory;
  public lastDirection: 'up' | 'down' | 'left' | 'right' = 'down';

  constructor(config: PlayerConfig) {
    this.position = { ...config.position };
    this.health = config.health ?? 100;
    this.maxHealth = this.health;
    this.attackDamage = config.attackDamage ?? 5;
    this.inventory = new Inventory();
  }

  public setPosition(position: Position): void {
    this.position = { ...position };
  }

  public setDirection(direction: 'up' | 'down' | 'left' | 'right'): void {
    this.lastDirection = direction;
  }

  public getFacingPosition(tileSize: number): Position {
    switch (this.lastDirection) {
      case 'up':
        return { x: this.position.x, y: this.position.y - tileSize };
      case 'down':
        return { x: this.position.x, y: this.position.y + tileSize };
      case 'left':
        return { x: this.position.x - tileSize, y: this.position.y };
      case 'right':
        return { x: this.position.x + tileSize, y: this.position.y };
      default:
        return { x: this.position.x, y: this.position.y + tileSize };
    }
  }

  public takeDamage(damage: number): void {
    this.health = Math.max(0, this.health - damage);
    console.log(`Player took ${damage} damage. Health: ${this.health}/${this.maxHealth}`);
  }

  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
    console.log(`Player healed ${amount}. Health: ${this.health}/${this.maxHealth}`);
  }

  public addToInventory(type: string, quantity = 1): boolean {
    return this.inventory.addItem(type, quantity);
  }

  public removeFromInventory(type: string, quantity = 1): boolean {
    return this.inventory.removeItem(type, quantity);
  }

  public selectInventorySlot(slotIndex: number): void {
    this.inventory.selectSlot(slotIndex);
  }

  public getSelectedItem() {
    return this.inventory.getSelectedItem();
  }

  public getSelectedSlot(): number {
    return this.inventory.getSelectedSlot();
  }

  public getInventoryItems() {
    // Return array of 9 items (null for empty slots)
    const items = [];
    for (let i = 0; i < 9; i++) {
      items.push(this.inventory.getItem(i));
    }
    return items;
  }

  public openInventory(): void {
    console.log('=== PLAYER INVENTORY ===');
    this.inventory.logInventoryState();
  }

  public getHealthPercentage(): number {
    return this.health / this.maxHealth;
  }

  public isDead(): boolean {
    return this.health <= 0;
  }
}