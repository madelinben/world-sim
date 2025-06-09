import { Sprite } from '../../ui/Sprite';
import { Structure, type StructureConfig } from './Structure';

export enum TreeGrowthStage {
  CUT_DOWN = 0,
  YOUNG = 1,
  TALL = 2,
  FULL = 3
}

export interface TreeConfig extends Omit<StructureConfig, 'health' | 'dropValue' | 'dropType'> {
  initialStage?: TreeGrowthStage;
  growthTimePerStage?: number; // in milliseconds
}

export class Tree extends Structure {
  private currentStage: TreeGrowthStage;
  private timeSinceLastGrowth = 0;
  private growthTimePerStage: number;
  private isGrowthComplete = false;

    constructor(config: TreeConfig) {
    super({
      ...config,
      health: 50,
      dropValue: 5,
      dropType: 'wood'
    });

    this.currentStage = config.initialStage ?? TreeGrowthStage.YOUNG;
    this.growthTimePerStage = config.growthTimePerStage ?? 3600000; // 1 hour in milliseconds

    // Recreate sprite with correct parameters
    this.sprite = this.createSprite();

    // Set initial frame
    this.sprite.setFrame(this.currentStage);
  }

  protected createSprite(): Sprite {
    const growthTime = this.growthTimePerStage ?? 3600000; // Default to 1 hour

    return new Sprite({
      imagePath: '/sprites/Nature/Trees.png',
      frameWidth: 16,
      frameHeight: 16,
      totalFrames: 4,
      framesPerRow: 4,
      animationDuration: growthTime * 4, // Total growth time
      loop: false // Don't loop, tree stops growing at full stage
    });
  }

  public update(deltaTime: number): void {
    if (this.isGrowthComplete) return;

    // Update time since last growth
    this.timeSinceLastGrowth += deltaTime * 1000; // Convert to milliseconds

    // Check if it's time to grow
    if (this.timeSinceLastGrowth >= this.growthTimePerStage && this.canGrow()) {
      this.grow();
      this.timeSinceLastGrowth = 0;
    }

    // Update sprite animation
    this.sprite.update(deltaTime);
  }

  public render(ctx: CanvasRenderingContext2D, scale = 1): void {
    // Render at world coordinates (for backward compatibility)
    this.sprite.render(ctx, this.x, this.y, scale);
  }

  public renderAtScreenPosition(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, scale = 1): void {
    // Always render tree sprite, even if destroyed (show broken stump)
    this.sprite.render(ctx, screenX, screenY, scale);

    // Only render health bar if not destroyed and damaged
    if (!this.isStructureDestroyed() && this.getHealth() < this.getMaxHealth()) {
      this.renderHealthBar(ctx, screenX, screenY);
    }
  }

  public renderSpriteOnly(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, scale = 1): void {
    // Always render tree sprite, even if destroyed (show broken stump)
    this.sprite.render(ctx, screenX, screenY, scale);
  }

  protected renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const barWidth = 14;
    const barHeight = 2;
    const healthPercent = this.getHealth() / this.getMaxHealth();

    // Background (red)
    ctx.fillStyle = 'red';
    ctx.fillRect(x + 1, y - 4, barWidth, barHeight);

    // Foreground (green)
    ctx.fillStyle = 'green';
    ctx.fillRect(x + 1, y - 4, barWidth * healthPercent, barHeight);
  }

  private grow(): void {
    if (this.currentStage < TreeGrowthStage.FULL) {
      this.currentStage++;
      this.sprite.setFrame(this.currentStage);

      if (this.currentStage === TreeGrowthStage.FULL) {
        this.isGrowthComplete = true;
      }
    }
  }

  public canGrow(): boolean {
    return this.currentStage < TreeGrowthStage.FULL;
  }

  public cutDown(): void {
    this.currentStage = TreeGrowthStage.CUT_DOWN;
    this.sprite.setFrame(this.currentStage);
    this.isGrowthComplete = false;
    this.timeSinceLastGrowth = 0;
  }

  public plant(): void {
    if (this.currentStage === TreeGrowthStage.CUT_DOWN) {
      this.currentStage = TreeGrowthStage.YOUNG;
      this.sprite.setFrame(this.currentStage);
      this.isGrowthComplete = false;
      this.timeSinceLastGrowth = 0;
    }
  }

  public getCurrentStage(): TreeGrowthStage {
    return this.currentStage;
  }

  public getGrowthProgress(): number {
    if (this.isGrowthComplete) return 1;
    return this.timeSinceLastGrowth / this.growthTimePerStage;
  }

  public isFullyGrown(): boolean {
    return this.currentStage === TreeGrowthStage.FULL;
  }

  public isCutDown(): boolean {
    return this.currentStage === TreeGrowthStage.CUT_DOWN;
  }

  public forceGrowthStage(stage: TreeGrowthStage): void {
    this.currentStage = stage;
    this.sprite.setFrame(stage);
    this.isGrowthComplete = stage === TreeGrowthStage.FULL;
    this.timeSinceLastGrowth = 0;
  }

  public takeDamage(damage: number): { destroyed: boolean; dropValue: number; dropType: string } {
    const result = super.takeDamage(damage);

    // If tree is destroyed, set to CUT_DOWN stage (broken tree sprite)
    if (result.destroyed) {
      this.cutDown();
    }

    return result;
  }
}