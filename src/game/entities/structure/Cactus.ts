import { Sprite } from '../../ui/Sprite';
import { Structure, type StructureConfig } from './Structure';

export enum CactusVariant {
  VARIANT_1 = 1,
  VARIANT_2 = 2,
  VARIANT_3 = 3
}

// Variant 1: index 4 (young) → index 3 (mature)
// Variant 2: index 5 (young) → index 6 → index 7 (mature)
// Variant 3: index 1 (young) → index 0 (mature)

export interface CactusConfig extends Omit<StructureConfig, 'health' | 'dropValue' | 'dropType'> {
  variant?: CactusVariant;
  initialStage?: number;
  growthTimePerStage?: number; // in milliseconds
}

export class Cactus extends Structure {
  private variant: CactusVariant;
  private currentStage: number;
  private timeSinceLastGrowth = 0;
  private growthTimePerStage: number;
  private isGrowthComplete = false;
  private frameSequence: number[];

        constructor(config: CactusConfig) {
    super({
      ...config,
      health: 15,
      dropValue: 1,
      dropType: 'cactus'
    });

    this.variant = config.variant ?? this.getRandomVariant();
    this.currentStage = config.initialStage ?? 0; // Start at stage 0 (young)
    this.growthTimePerStage = config.growthTimePerStage ?? 600000; // 10 minutes in milliseconds

    // Set frame sequence based on variant
    this.frameSequence = this.getFrameSequence(this.variant);

    // Now recreate the sprite with correct parameters
    this.sprite = this.createSprite();

    // Set initial frame
    this.sprite.setFrame(this.frameSequence[this.currentStage] ?? 0);
  }

  protected createSprite(): Sprite {
    const frameSequenceLength = this.frameSequence?.length ?? 2; // Default to 2 if not set yet
    const growthTime = this.growthTimePerStage ?? 600000; // Default growth time

    return new Sprite({
      imagePath: '/sprites/Nature/Cactus.png',
      frameWidth: 16,
      frameHeight: 16,
      totalFrames: 8, // Assuming 8 frames in the sprite sheet
      framesPerRow: 8,
      animationDuration: growthTime * frameSequenceLength,
      loop: false // Don't loop, cactus stops growing at final stage
    });
  }

  private getRandomVariant(): CactusVariant {
    const variants = [CactusVariant.VARIANT_1, CactusVariant.VARIANT_2, CactusVariant.VARIANT_3];
    return variants[Math.floor(Math.random() * variants.length)] ?? CactusVariant.VARIANT_1;
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