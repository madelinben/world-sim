import { Sprite } from '../../ui/Sprite';
import { type AnimatedEntity } from '../../systems/AnimationSystem';

export enum TreeGrowthStage {
  CUT_DOWN = 0,
  YOUNG = 1,
  TALL = 2,
  FULL = 3
}

export interface TreeConfig {
  x: number;
  y: number;
  initialStage?: TreeGrowthStage;
  growthTimePerStage?: number; // in milliseconds
}

export class Tree implements AnimatedEntity {
  public readonly x: number;
  public readonly y: number;
  private sprite: Sprite;
  private currentStage: TreeGrowthStage;
  private timeSinceLastGrowth = 0;
  private growthTimePerStage: number;
  private isGrowthComplete = false;

  constructor(config: TreeConfig) {
    this.x = config.x;
    this.y = config.y;
    this.currentStage = config.initialStage ?? TreeGrowthStage.YOUNG;
    this.growthTimePerStage = config.growthTimePerStage ?? 3600000; // 1 hour in milliseconds

    // Create sprite for tree animation
    this.sprite = new Sprite({
      imagePath: '/sprites/Nature/Trees.png',
      frameWidth: 16,
      frameHeight: 16,
      totalFrames: 4,
      framesPerRow: 4,
      animationDuration: this.growthTimePerStage * 4, // Total growth time
      loop: false // Don't loop, tree stops growing at full stage
    });

    // Set initial frame
    this.sprite.setFrame(this.currentStage);
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
    // Render at specific screen coordinates
    this.sprite.render(ctx, screenX, screenY, scale);
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
}