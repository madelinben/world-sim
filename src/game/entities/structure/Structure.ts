import { type Sprite } from '../../ui/Sprite';
import { type AnimatedEntity } from '../../systems/AnimationSystem';

export interface StructureConfig {
  x: number;
  y: number;
  health: number;
  dropValue: number;
  dropType: string;
}

export abstract class Structure implements AnimatedEntity {
  public readonly x: number;
  public readonly y: number;
  protected sprite: Sprite;
  protected health: number;
  protected maxHealth: number;
  protected dropValue: number;
  protected dropType: string;
  protected isDestroyed = false;

  constructor(config: StructureConfig) {
    this.x = config.x;
    this.y = config.y;
    this.health = config.health;
    this.maxHealth = config.health;
    this.dropValue = config.dropValue;
    this.dropType = config.dropType;
    this.sprite = this.createSprite();
  }

  protected abstract createSprite(): Sprite;

  public abstract update(deltaTime: number): void;

  public render(ctx: CanvasRenderingContext2D, scale = 1): void {
    if (this.isDestroyed) return;
    this.sprite.render(ctx, this.x, this.y, scale);
  }

  public renderAtScreenPosition(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, scale = 1): void {
    if (this.isDestroyed) return;
    this.sprite.render(ctx, screenX, screenY, scale);

    // Render health bar if damaged (similar to NPCs)
    if (this.health < this.maxHealth) {
      this.renderHealthBar(ctx, screenX, screenY);
    }
  }

  protected renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
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

  public takeDamage(damage: number): { destroyed: boolean; dropValue: number; dropType: string } {
    if (this.isDestroyed) return { destroyed: false, dropValue: 0, dropType: '' };

    this.health -= damage;

    if (this.health <= 0) {
      this.isDestroyed = true;
      return {
        destroyed: true,
        dropValue: this.dropValue,
        dropType: this.dropType
      };
    }

    return { destroyed: false, dropValue: 0, dropType: '' };
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  public getHealthPercentage(): number {
    return this.health / this.maxHealth;
  }

  public isStructureDestroyed(): boolean {
    return this.isDestroyed;
  }

  public getDropInfo(): { dropValue: number; dropType: string } {
    return { dropValue: this.dropValue, dropType: this.dropType };
  }

  public getSprite(): Sprite {
    return this.sprite;
  }

  public renderSpriteOnly(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, scale = 1): void {
    if (this.isDestroyed) return;
    this.sprite.render(ctx, screenX, screenY, scale);
  }
}