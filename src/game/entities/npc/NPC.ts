import type { Position } from '../../engine/types';
import type { InventoryItem } from '../inventory/Inventory';
import { ASSET_MAP, type AssetMapping } from '../../assets/AssetMap';
import { getAssetPath } from '../../utils/assetPath';

export type NPCType = 'chicken' | 'pig' | 'sheep' | 'monster' | 'trader';
export type NPCState = 'idle' | 'wandering' | 'following' | 'fleeing' | 'attacking' | 'dead';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface NPCConfig {
  type: NPCType;
  position: Position;
  health?: number;
  aggressive?: boolean;
  movementSpeed?: number;
  detectionRange?: number;
  dropItems?: { type: string; quantity: number }[];
}

export class NPC {
  public readonly type: NPCType;
  public position: Position;
  public readonly originalPosition: Position;
  public health: number;
  public readonly maxHealth: number;
  public readonly aggressive: boolean;
  public readonly movementSpeed: number;
  public readonly detectionRange: number;
  public readonly dropItems: { type: string; quantity: number }[];

  public state: NPCState = 'idle';
  public direction: Direction = 'down';
  public lastMoveTime = 0;
  public target: Position | null = null;

  private currentFrame = 0;
  private lastFrameTime = 0;
  private readonly animationDuration = 1000; // 1 second per cycle
  private sprite: HTMLImageElement | null = null;
  private asset: AssetMapping | null = null;
  private isLoaded = false;
  private moveTimer = 0;
  private readonly moveInterval = 2000; // Move every 2 seconds when wandering

  constructor(config: NPCConfig) {
    this.type = config.type;
    this.position = { ...config.position };
    this.originalPosition = { ...config.position };
    this.health = config.health ?? this.getDefaultHealth();
    this.maxHealth = this.health;
    this.aggressive = config.aggressive ?? this.getDefaultAggressive();
    this.movementSpeed = config.movementSpeed ?? 1;
    this.detectionRange = config.detectionRange ?? 5;
    this.dropItems = config.dropItems ?? this.getDefaultDropItems();

    this.loadAsset();
  }

  private getDefaultHealth(): number {
    switch (this.type) {
      case 'chicken': return 20;
      case 'pig': return 35;
      case 'sheep': return 25;
      case 'monster': return 80;
      case 'trader': return 50;
      default: return 25;
    }
  }

  private getDefaultAggressive(): boolean {
    return this.type === 'monster';
  }

  private getDefaultDropItems(): { type: string; quantity: number }[] {
    switch (this.type) {
      case 'chicken':
        return [{ type: 'chicken_meat', quantity: 1 }];
      case 'pig':
        return [{ type: 'pork', quantity: 2 }];
      case 'sheep':
        return [
          { type: 'wool', quantity: 1 },
          { type: 'mutton', quantity: 1 }
        ];
      case 'monster':
        return [{ type: 'monster_drop', quantity: 1 }];
      case 'trader':
        return [{ type: 'gold_ingot', quantity: 1 }];
      default:
        return [];
    }
  }

  private loadAsset(): void {
    const asset = Object.values(ASSET_MAP).find(a => {
      if (!a || typeof a.name !== 'string') return false;
      return a.name.toLowerCase() === this.type;
    });

    if (asset && typeof asset.spritePath === 'string') {
      this.asset = asset;
      void this.loadSprite(asset.spritePath);
    } else {
      console.warn(`No asset found for NPC type: ${this.type}`);
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
          reject(new Error(`Failed to load NPC sprite: ${spritePath}`));
        };
      });
    } catch (error) {
      console.error(`Failed to load NPC sprite for ${this.type}:`, error);
    }
  }

  public update(deltaTime: number, playerPosition: Position, playerInventory: InventoryItem[]): void {
    if (this.state === 'dead') return;

    this.updateAnimation(deltaTime);
    this.updateAI(deltaTime, playerPosition, playerInventory);
    this.updateMovement(deltaTime);
  }

  private updateAnimation(deltaTime: number): void {
    const isAnimated = this.asset?.properties?.animated === true;
    if (!isAnimated) return;

    this.lastFrameTime += deltaTime * 1000;
    const timePerFrame = this.animationDuration / 4; // 4 frames per direction

    if (this.lastFrameTime >= timePerFrame) {
      this.lastFrameTime = 0;
      this.currentFrame = (this.currentFrame + 1) % 4;
    }
  }

  private updateAI(deltaTime: number, playerPosition: Position, playerInventory: InventoryItem[]): void {
    const distanceToPlayer = this.getDistanceToPosition(playerPosition);
    const hasWheat = playerInventory.some(item => item?.type === 'wheat');

    // Check if player is within detection range
    if (distanceToPlayer <= this.detectionRange) {
      if (this.aggressive && this.type === 'monster') {
        // Monsters attack players
        this.state = 'attacking';
        this.target = { ...playerPosition };
      } else if (hasWheat && !this.aggressive) {
        // Animals follow player if they have wheat
        this.state = 'following';
        this.target = { ...playerPosition };
      } else if (this.aggressive && !hasWheat) {
        // Some NPCs flee if player doesn't have food
        this.state = 'fleeing';
        this.target = this.getFleePosition(playerPosition);
      } else {
        this.state = 'idle';
        this.target = null;
      }
    } else {
      // Player out of range, return to wandering or idle
      if (this.state === 'following' || this.state === 'attacking' || this.state === 'fleeing') {
        this.state = 'wandering';
        this.target = null;
      }
    }

    // Random wandering behavior
    if (this.state === 'idle' || this.state === 'wandering') {
      this.moveTimer += deltaTime * 1000;
      if (this.moveTimer >= this.moveInterval) {
        this.moveTimer = 0;
        this.initiateRandomMovement();
      }
    }
  }

  private updateMovement(deltaTime: number): void {
    if (!this.target || this.state === 'idle') return;

    const moveSpeed = this.movementSpeed * (deltaTime * 1000); // pixels per second

    if (this.state === 'following' || this.state === 'attacking') {
      this.moveTowardsTarget(moveSpeed);
    } else if (this.state === 'fleeing') {
      this.moveAwayFromTarget(moveSpeed);
    } else if (this.state === 'wandering') {
      this.moveTowardsTarget(moveSpeed * 0.5); // Slower when wandering
    }
  }

  private moveTowardsTarget(speed: number): void {
    if (!this.target) return;

    const dx = this.target.x - this.position.x;
    const dy = this.target.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 16) { // One tile distance
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;

      this.position.x += normalizedDx * speed;
      this.position.y += normalizedDy * speed;

      // Update direction based on movement
      this.updateDirectionFromMovement(normalizedDx, normalizedDy);
    }
  }

  private moveAwayFromTarget(speed: number): void {
    if (!this.target) return;

    const dx = this.target.x - this.position.x;
    const dy = this.target.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < this.detectionRange * 16) { // Still in danger zone
      const normalizedDx = -dx / distance; // Opposite direction
      const normalizedDy = -dy / distance;

      this.position.x += normalizedDx * speed;
      this.position.y += normalizedDy * speed;

      this.updateDirectionFromMovement(normalizedDx, normalizedDy);
    } else {
      this.state = 'wandering';
      this.target = null;
    }
  }

  private updateDirectionFromMovement(dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? 'right' : 'left';
    } else {
      this.direction = dy > 0 ? 'down' : 'up';
    }
  }

  private getDistanceToPosition(position: Position): number {
    const dx = position.x - this.position.x;
    const dy = position.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy) / 16; // Distance in tiles
  }

  private getFleePosition(playerPosition: Position): Position {
    // Calculate a position away from the player
    const dx = this.position.x - playerPosition.x;
    const dy = this.position.y - playerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      // If on same position, pick random direction
      return {
        x: this.position.x + (Math.random() - 0.5) * 160,
        y: this.position.y + (Math.random() - 0.5) * 160
      };
    }

    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;

    return {
      x: this.position.x + normalizedDx * 160, // 10 tiles away
      y: this.position.y + normalizedDy * 160
    };
  }

  private initiateRandomMovement(): void {
    // Don't wander too far from original position
    const maxWanderDistance = 5 * 16; // 5 tiles
    const distanceFromOrigin = this.getDistanceToPosition(this.originalPosition);

    if (distanceFromOrigin * 16 > maxWanderDistance) {
      // Return towards origin
      this.target = { ...this.originalPosition };
      this.state = 'wandering';
    } else {
      // Random movement
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 3 * 16; // Up to 3 tiles

      this.target = {
        x: this.position.x + Math.cos(angle) * distance,
        y: this.position.y + Math.sin(angle) * distance
      };
      this.state = 'wandering';
    }
  }

  public takeDamage(amount: number): boolean {
    this.health -= amount;

    if (this.health <= 0) {
      this.state = 'dead';
      return true; // NPC is dead
    } else {
      // Become aggressive if attacked (unless already aggressive)
      if (!this.aggressive && this.type !== 'trader') {
        this.state = 'fleeing';
      }
      return false;
    }
  }

  public getDropItems(): InventoryItem[] {
    return this.dropItems.map(drop => ({
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: drop.type,
      quantity: drop.quantity
    }));
  }

  public render(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
    if (!this.isLoaded || !this.sprite || !this.asset || this.state === 'dead') return;

    const frameIndex = this.getFrameIndex();
    const spriteSize = 16;
    const spritesPerRow = Math.floor(this.sprite.width / spriteSize);
    const spriteX = (frameIndex % spritesPerRow) * spriteSize;
    const spriteY = Math.floor(frameIndex / spritesPerRow) * spriteSize;

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

    // Render health bar if damaged
    if (this.health < this.maxHealth) {
      this.renderHealthBar(ctx, x, y - 8, scale);
    }
  }

  private getFrameIndex(): number {
    // Calculate frame based on direction and animation frame
    const directionOffset = this.getDirectionOffset();
    return directionOffset + this.currentFrame;
  }

  private getDirectionOffset(): number {
    switch (this.direction) {
      case 'down': return 0;  // Frames 0-3
      case 'up': return 4;    // Frames 4-7
      case 'left': return 8;  // Frames 8-11
      case 'right': return 12; // Frames 12-15
      default: return 0;
    }
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    const barWidth = 16 * scale;
    const barHeight = 3 * scale;
    const healthPercentage = this.health / this.maxHealth;

    // Background (red)
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Health (green)
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(x, y, barWidth * healthPercentage, barHeight);

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);
  }

  public isAt(position: Position): boolean {
    const tolerance = 8; // Half tile tolerance
    return Math.abs(this.position.x - position.x) < tolerance &&
           Math.abs(this.position.y - position.y) < tolerance;
  }

  public isDead(): boolean {
    return this.state === 'dead';
  }

  public isHostile(): boolean {
    return this.aggressive && this.state === 'attacking';
  }

  public canMoveTo(targetPosition: Position): boolean {
    // Basic collision check - prevent moving too far from origin
    const maxDistance = 10 * 16; // 10 tiles from origin
    const distanceFromOrigin = Math.sqrt(
      Math.pow(targetPosition.x - this.originalPosition.x, 2) +
      Math.pow(targetPosition.y - this.originalPosition.y, 2)
    );

    return distanceFromOrigin <= maxDistance;
  }
}