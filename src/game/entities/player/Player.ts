import { Inventory } from '../inventory/Inventory';
import type { Position } from '../../engine/types';
import { getAssetPath } from '../../utils/assetPath';

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

  // Sprite and animation properties
  private sprite: HTMLImageElement | null = null;
  private isLoaded = false;
  private loadingFailed = false;
  private currentFrame = 0;
  private lastFrameTime = 0;
  private readonly animationDuration = 800; // 800ms per cycle (4 frames)
  private isMoving = false;
  private isAttacking = false;
  private attackAnimationTimer = 0;
  private attackCurrentFrame = 0;
  private attackLastFrameTime = 0;
  private readonly attackAnimationDuration = 600; // 600ms attack animation
  private readonly attackFrameCount = 4; // 4 frames for attack animation

  constructor(config: PlayerConfig) {
    this.position = { ...config.position };
    this.health = config.health ?? 100;
    this.maxHealth = this.health;
    this.attackDamage = config.attackDamage ?? 5;
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

  public update(deltaTime: number): void {
    this.updateAnimation(deltaTime);
    this.updateAttackAnimation(deltaTime);
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

    // Render health bar if damaged
    if (this.health < this.maxHealth) {
      this.renderHealthBar(ctx, x, y);
    }
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

  private renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const barWidth = 14;
    const barHeight = 2;
    const healthPercent = this.health / this.maxHealth;

    // Background (red)
    ctx.fillStyle = 'red';
    ctx.fillRect(x + 1, y - 4, barWidth, barHeight);

    // Foreground (green)
    ctx.fillStyle = 'green';
    ctx.fillRect(x + 1, y - 4, barWidth * healthPercent, barHeight);
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

  public isPlayerSpriteLoaded(): boolean {
    return this.isLoaded;
  }
}