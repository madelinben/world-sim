import { Sprite } from '../../ui/Sprite';
import { type AnimatedEntity } from '../../systems/AnimationSystem';

export enum CactusVariant {
  VARIANT_1 = 1,
  VARIANT_2 = 2,
  VARIANT_3 = 3
}

// Variant 1: index 4 (young) → index 3 (mature)
// Variant 2: index 5 (young) → index 6 → index 7 (mature)
// Variant 3: index 1 (young) → index 0 (mature)

export interface CactusConfig {
  x: number;
  y: number;
  variant?: CactusVariant;
  initialStage?: number;
  growthTimePerStage?: number; // in milliseconds
}

export class Cactus implements AnimatedEntity {
  public readonly x: number;
  public readonly y: number;
  private sprite: Sprite;
  private variant: CactusVariant;
  private currentStage: number;
  private timeSinceLastGrowth = 0;
  private growthTimePerStage: number;
  private isGrowthComplete = false;
  private frameSequence: number[];

  constructor(config: CactusConfig) {
    this.x = config.x;
    this.y = config.y;
    this.variant = config.variant ?? this.getRandomVariant();
    this.currentStage = config.initialStage ?? 0; // Start at stage 0 (young)
    this.growthTimePerStage = config.growthTimePerStage ?? 600000; // 10 minutes in milliseconds

    // Set frame sequence based on variant
    this.frameSequence = this.getFrameSequence(this.variant);

    // Create sprite for cactus animation
    this.sprite = new Sprite({
      imagePath: '/sprites/Nature/Cactus.png',
      frameWidth: 16,
      frameHeight: 16,
      totalFrames: 8, // Assuming 8 frames in the sprite sheet
      framesPerRow: 8,
      animationDuration: this.growthTimePerStage * this.frameSequence.length,
      loop: false // Don't loop, cactus stops growing at final stage
    });

    // Set initial frame
    this.sprite.setFrame(this.frameSequence[this.currentStage] ?? 0);
  }

  private getRandomVariant(): CactusVariant {
    const variants = [CactusVariant.VARIANT_1, CactusVariant.VARIANT_2, CactusVariant.VARIANT_3];
    return variants[Math.floor(Math.random() * variants.length)];
  }

  private getFrameSequence(variant: CactusVariant): number[] {
    switch (variant) {
      case CactusVariant.VARIANT_1:
        return [4, 3]; // young → mature
      case CactusVariant.VARIANT_2:
        return [5, 6, 7]; // young → middle → mature
      case CactusVariant.VARIANT_3:
        return [1, 0]; // young → mature
      default:
        return [4, 3];
    }
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
    if (this.currentStage < this.frameSequence.length - 1) {
      this.currentStage++;
      this.sprite.setFrame(this.frameSequence[this.currentStage] ?? 0);

      if (this.currentStage === this.frameSequence.length - 1) {
        this.isGrowthComplete = true;
      }
    }
  }

  public canGrow(): boolean {
    return this.currentStage < this.frameSequence.length - 1;
  }

  public getCurrentStage(): number {
    return this.currentStage;
  }

  public getVariant(): CactusVariant {
    return this.variant;
  }

  public getGrowthProgress(): number {
    if (this.isGrowthComplete) return 1;
    return this.timeSinceLastGrowth / this.growthTimePerStage;
  }

  public isFullyGrown(): boolean {
    return this.currentStage === this.frameSequence.length - 1;
  }

  public forceGrowthStage(stage: number): void {
    if (stage >= 0 && stage < this.frameSequence.length) {
      this.currentStage = stage;
      this.sprite.setFrame(this.frameSequence[stage] ?? 0);
      this.isGrowthComplete = stage === this.frameSequence.length - 1;
      this.timeSinceLastGrowth = 0;
    }
  }
}