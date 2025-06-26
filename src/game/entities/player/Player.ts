import { Inventory } from '../inventory/Inventory';
import type { Position } from '../../engine/types';
import { getAssetPath } from '../../utils/assetPath';

export interface PlayerConfig {
  position: Position;
  health?: number;
  attackDamage?: number;
  name?: string;
}

export class Player {
  public position: Position;
  public health = 100;
  public maxHealth = 100;
  public attackDamage = 5;
  public inventory: Inventory;
  public name: string; // Player name
  public lastDirection: 'up' | 'down' | 'left' | 'right' = 'down';
  public facingDirection: 'up' | 'down' | 'left' | 'right' = 'down';
  public isMoving = false;
  public isBlocking = false;

  // Sprite and animation properties
  private sprite: HTMLImageElement | null = null;
  private isLoaded = false;
  private loadingFailed = false;
  private currentFrame = 0;
  private lastFrameTime = 0;
  private readonly animationDuration = 800; // 800ms per cycle (4 frames)
  private isAttacking = false;
  private attackAnimationTimer = 0;
  private attackCurrentFrame = 0;
  private attackLastFrameTime = 0;
  private readonly attackAnimationDuration = 600; // 600ms attack animation
  private readonly attackFrameCount = 4; // 4 frames for attack animation
  private cactusDamageCooldown = 0; // Cooldown to prevent repeated cactus damage

  // Combat state tracking for health regeneration
  private lastDamageTime = 0;
  private readonly combatRegenDelay = 10000; // 10 seconds after taking damage before regen resumes

  constructor(config: PlayerConfig) {
    this.position = { ...config.position };
    this.health = config.health ?? 100;
    this.maxHealth = this.health;
    this.attackDamage = config.attackDamage ?? 5;
    this.name = config.name ?? 'Hero';
    this.inventory = new Inventory();

    void this.loadSprite();
  }

  private async loadSprite(): Promise<void> {
    try {
      this.sprite = new Image();
      const spritePath = getAssetPath('/sprites/Characters/Monsters/Demons/RedDemon.png');
      console.log('Loading player sprite from:', spritePath);
      this.sprite.src = spritePath;

      await new Promise<void>((resolve, reject) => {
        if (!this.sprite) {
          reject(new Error('Sprite is null'));
          return;
        }

        this.sprite.onload = () => {
          console.log('Player sprite loaded successfully!');
          this.isLoaded = true;
          resolve();
        };

        this.sprite.onerror = () => {
          console.error('Failed to load player sprite from:', spritePath);
          this.loadingFailed = true;
          reject(new Error('Failed to load player sprite: PurpleDemon.png'));
        };
      });
    } catch (error) {
      console.error('Failed to load player sprite:', error);
    }
  }

    public update(deltaTime: number, wearableItems?: { type: string }[]): void {
    if (!this.isLoaded) return;

    this.updateAnimation(deltaTime);
    this.updateAttackAnimation(deltaTime);
    this.updateCactusCooldown(deltaTime); // Update cactus damage cooldown
    this.updateHealthRegeneration(deltaTime, wearableItems); // Update health regeneration
  }

  private updateHealthRegeneration(deltaTime: number, wearableItems?: { type: string }[]): void {
    // Check if player is in combat (has taken damage recently)
    const now = Date.now();
    const timeSinceLastDamage = now - this.lastDamageTime;

    // Don't regenerate health if player has taken damage recently (in combat)
    if (timeSinceLastDamage < this.combatRegenDelay) {
      return;
    }

    // Base health regeneration: 5 health per minute
    let baseRegenRate = 5 / 60; // 5 health per 60 seconds = 0.083 health per second

    // Check for magical wearable items that boost regeneration
    const hasMagicalItem = this.hasMagicalWearableItem(wearableItems);

    if (hasMagicalItem) {
      // Magical items boost regeneration to 15 health per minute
      baseRegenRate = 15 / 60; // 15 health per 60 seconds = 0.25 health per second
    }

    // Apply regeneration based on delta time
    const healthToRegenerate = baseRegenRate * deltaTime;

    if (this.health < this.maxHealth && healthToRegenerate > 0) {
      this.health = Math.min(this.maxHealth, this.health + healthToRegenerate);
    }
  }

  private hasMagicalWearableItem(wearableItems?: { type: string }[]): boolean {
    if (!wearableItems) return false;

    // Check for magical wearable items: rings, necklaces, crowns
    const magicalItemTypes = ['ring', 'necklace', 'crown', 'magical_ring', 'magical_necklace', 'magical_crown'];

    return wearableItems.some(item =>
      item && magicalItemTypes.some(magicalType =>
        item.type.toLowerCase().includes(magicalType)
      )
    );
  }

  private updateAnimation(deltaTime: number): void {
    if (!this.isLoaded) return;

    // Handle attack animation separately - it takes priority
    if (this.isAttacking) {
      this.updateAttackAnimationFrames(deltaTime);
      return;
    }

    // Convert deltaTime from seconds to milliseconds
    this.lastFrameTime += deltaTime * 1000;

    // Only animate when moving (not attacking)
    if (this.isMoving) {
      const frameTime = this.animationDuration / 4; // 4 frames per animation

      if (this.lastFrameTime >= frameTime) {
        this.currentFrame = (this.currentFrame + 1) % 4;
        this.lastFrameTime = 0;
      }
    } else {
      // Reset to idle frame when not moving
      this.currentFrame = 0;
      this.lastFrameTime = 0;
    }
  }

  private updateAttackAnimationFrames(deltaTime: number): void {
    // Update attack frame progression
    this.attackLastFrameTime += deltaTime * 1000;
    const attackFrameTime = this.attackAnimationDuration / this.attackFrameCount;

    if (this.attackLastFrameTime >= attackFrameTime) {
      this.attackCurrentFrame = (this.attackCurrentFrame + 1) % this.attackFrameCount;
      this.attackLastFrameTime = 0;
    }
  }

  private updateAttackAnimation(deltaTime: number): void {
    if (this.isAttacking) {
      this.attackAnimationTimer += deltaTime * 1000;

      // When attack animation duration completes, return to movement/idle
      if (this.attackAnimationTimer >= this.attackAnimationDuration) {
        this.isAttacking = false;
        this.attackAnimationTimer = 0;
        this.attackCurrentFrame = 0;
        this.attackLastFrameTime = 0;
        this.currentFrame = 0; // Reset to idle frame
        console.log('Attack animation completed - returning to movement animation');
      }
    }
  }

  public setPosition(position: Position): void {
    this.position = { ...position };
  }

  public setDirection(direction: 'up' | 'down' | 'left' | 'right'): void {
    this.lastDirection = direction;
  }

  public setMoving(moving: boolean): void {
    this.isMoving = moving;
    if (!moving) {
      this.currentFrame = 0; // Reset to idle frame when stopping
    }
  }

  public startAttack(): void {
    this.isAttacking = true;
    this.attackAnimationTimer = 0;
    this.attackCurrentFrame = 0;
    this.attackLastFrameTime = 0;
    this.currentFrame = 0;
    console.log('Starting attack animation');
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

  public render(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (!this.isLoaded || !this.sprite) {
      // If loading failed, show red square fallback
      if (this.loadingFailed) {
        ctx.fillStyle = 'red';
        ctx.fillRect(x, y, 16, 16);
      }
      // Otherwise transparent (still loading)
      return;
    }

    // Calculate sprite frame based on direction and current state
    const spriteIndex = this.getSpriteIndex();

    // Render the sprite
    const spriteSize = 16;
    const spritesPerRow = Math.floor(this.sprite.width / spriteSize);
    const spriteX = (spriteIndex % spritesPerRow) * spriteSize;
    const spriteY = Math.floor(spriteIndex / spritesPerRow) * spriteSize;

    ctx.drawImage(
      this.sprite,
      spriteX, spriteY, spriteSize, spriteSize,
      x, y, spriteSize, spriteSize
    );

    // Health bar rendering is now handled separately in Game.ts renderPlayerHealthBar method
  }

  private getSpriteIndex(): number {
    if (this.isAttacking) {
      // Attacking animations - use dedicated attack frame counter
      const baseIndex = this.getAttackingBaseIndex();
      return baseIndex + this.attackCurrentFrame;
    } else if (this.isMoving) {
      // Walking animations
      const baseIndex = this.getWalkingBaseIndex();
      return baseIndex + this.currentFrame;
    } else {
      // Idle - use first frame of walking animation
      return this.getWalkingBaseIndex();
    }
  }

  private getWalkingBaseIndex(): number {
    switch (this.lastDirection) {
      case 'down': return 0;   // index 0-4 walking down
      case 'up': return 6;     // index 6-10 walking up
      case 'right': return 12; // index 12-16 walking right
      case 'left': return 18;  // index 18-22 walking left
      default: return 0;
    }
  }

  private getAttackingBaseIndex(): number {
    switch (this.lastDirection) {
      case 'down': return 24;  // index 24-29 attacking down
      case 'up': return 30;    // index 30-35 attacking up
      case 'right': return 36; // index 36-41 attacking right
      case 'left': return 42;  // index 42-47 attacking left
      default: return 24;
    }
  }

  public takeDamage(damage: number): void {
    // If blocking, reduce damage to 1
    const actualDamage = this.isBlocking ? 1 : damage;
    this.health = Math.max(0, this.health - actualDamage);

    if (this.isBlocking) {
      console.log(`Player blocked attack! Reduced damage from ${damage} to ${actualDamage}. Health: ${this.health}/${this.maxHealth}`);
    } else {
      console.log(`Player took ${actualDamage} damage. Health: ${this.health}/${this.maxHealth}`);
    }

    // Update last damage time
    this.lastDamageTime = Date.now();
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

  public isPlayerSpriteLoaded(): boolean {
    return this.isLoaded;
  }

  public canTakeCactusDamage(): boolean {
    return this.cactusDamageCooldown <= 0;
  }

  public setCactusDamageCooldown(milliseconds = 1000): void {
    this.cactusDamageCooldown = milliseconds;
  }

  public updateCactusCooldown(deltaTime: number): void {
    if (this.cactusDamageCooldown > 0) {
      this.cactusDamageCooldown -= deltaTime * 1000; // Convert to milliseconds
      if (this.cactusDamageCooldown < 0) {
        this.cactusDamageCooldown = 0;
      }
    }
  }

  public setBlocking(blocking: boolean): void {
    this.isBlocking = blocking;
    if (blocking) {
      console.log('Player is now blocking');
    } else {
      console.log('Player stopped blocking');
    }
  }

  public setName(name: string): void {
    this.name = name.trim() || 'Hero';
  }

  public getName(): string {
    return this.name;
  }
}