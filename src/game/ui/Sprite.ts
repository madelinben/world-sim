import { getAssetPath } from '~/game/utils/assetPath';

export interface SpriteFrame {
  image: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteConfig {
  imagePath: string;
  frameWidth: number;
  frameHeight: number;
  totalFrames: number;
  framesPerRow?: number;
  animationDuration?: number; // in milliseconds
  loop?: boolean;
}

export class Sprite {
  private image: HTMLImageElement | null = null;
  private frames: SpriteFrame[] = [];
  private currentFrame = 0;
  private lastFrameTime = 0;
  private isLoaded = false;
  private animationDuration: number;
  private loop: boolean;
  private totalFrames: number;
  private frameWidth: number;
  private frameHeight: number;
  private framesPerRow: number;

  constructor(private config: SpriteConfig) {
    this.animationDuration = config.animationDuration ?? 1000;
    this.loop = config.loop !== false; // default to true
    this.totalFrames = config.totalFrames;
    this.frameWidth = config.frameWidth;
    this.frameHeight = config.frameHeight;
    this.framesPerRow = config.framesPerRow ?? this.totalFrames;
    void this.loadImage();
  }

  private async loadImage(): Promise<void> {
    try {
      this.image = new Image();
      this.image.src = getAssetPath(this.config.imagePath);

      await new Promise<void>((resolve, reject) => {
        if (!this.image) {
          reject(new Error('Image is null'));
          return;
        }

        this.image.onload = () => {
          this.processFrames();
          this.isLoaded = true;
          resolve();
        };

        this.image.onerror = () => {
          reject(new Error(`Failed to load sprite: ${this.config.imagePath}`));
        };
      });
    } catch (error) {
      console.error(`Failed to load sprite: ${this.config.imagePath}`, error);
    }
  }

  private processFrames(): void {
    if (!this.image) return;

    this.frames = [];
    for (let i = 0; i < this.totalFrames; i++) {
      const row = Math.floor(i / this.framesPerRow);
      const col = i % this.framesPerRow;

      this.frames.push({
        image: this.image,
        x: col * this.frameWidth,
        y: row * this.frameHeight,
        width: this.frameWidth,
        height: this.frameHeight
      });
    }
  }

  public update(deltaTime: number): void {
    if (!this.isLoaded || this.frames.length <= 1) return;

    this.lastFrameTime += deltaTime * 1000; // Convert to milliseconds
    const timePerFrame = this.animationDuration / this.totalFrames;

    if (this.lastFrameTime >= timePerFrame) {
      this.lastFrameTime = 0;

      if (this.loop) {
        this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
      } else if (this.currentFrame < this.totalFrames - 1) {
        this.currentFrame++;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
    if (!this.isLoaded || !this.frames[this.currentFrame]) return;

    const frame = this.frames[this.currentFrame];
    if (!frame) return;

    // Render sprite at exact position (align with tile grid)
    ctx.drawImage(
      frame.image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      x,
      y,
      frame.width * scale,
      frame.height * scale
    );
  }

  public setFrame(frameIndex: number): void {
    if (frameIndex >= 0 && frameIndex < this.totalFrames) {
      this.currentFrame = frameIndex;
    }
  }

  public getCurrentFrame(): number {
    return this.currentFrame;
  }

  public getFrameCount(): number {
    return this.totalFrames;
  }

  public isAnimationComplete(): boolean {
    return !this.loop && this.currentFrame === this.totalFrames - 1;
  }

  public reset(): void {
    this.currentFrame = 0;
    this.lastFrameTime = 0;
  }

  public isImageLoaded(): boolean {
    return this.isLoaded;
  }

  public canAdvanceFrame(): boolean {
    if (this.loop) return true;
    return this.currentFrame < this.totalFrames - 1;
  }

  public getNextFrame(): number {
    if (this.loop) {
      return (this.currentFrame + 1) % this.totalFrames;
    }
    return Math.min(this.currentFrame + 1, this.totalFrames - 1);
  }
}