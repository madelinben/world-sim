export class GameLoop {
    private isRunning = false;
    private lastTimestamp = 0;
    private updateCallback: (deltaTime: number, forceUpdate?: boolean) => void;
    private renderCallback: () => void;
    private animationFrameId: number | null = null;
    private readonly TARGET_FPS = 60;
    private readonly FRAME_DURATION = 1000 / this.TARGET_FPS; // 60 FPS
    private accumulator = 0;
    private frameCount = 0;
    private fpsTimer = 0;
    private currentFPS = 0;
    private lastUpdateTime = 0;
    private readonly UPDATE_INTERVAL = 16.67; // ~60 FPS in milliseconds

    constructor(
        updateCallback: (deltaTime: number, forceUpdate?: boolean) => void,
        renderCallback: () => void
    ) {
        this.updateCallback = updateCallback;
        this.renderCallback = renderCallback;
    }

    public start(): void {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTimestamp = performance.now();
            this.accumulator = 0;
            this.gameLoop();
        }
    }

    public stop(): void {
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private gameLoop(): void {
        if (!this.isRunning) return;

        const currentTimestamp = performance.now();
        const deltaTime = currentTimestamp - this.lastTimestamp;
        this.lastTimestamp = currentTimestamp;
        this.accumulator += deltaTime;

        // Update FPS calculation
        this.frameCount++;
        this.fpsTimer += deltaTime;
        if (this.fpsTimer >= 1000) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.fpsTimer = 0;
        }

        // Fixed timestep updates with throttling
        let shouldUpdate = false;
        while (this.accumulator >= this.FRAME_DURATION) {
            const timeSinceLastUpdate = currentTimestamp - this.lastUpdateTime;
            const forceUpdate = timeSinceLastUpdate >= this.UPDATE_INTERVAL;

            this.updateCallback(this.FRAME_DURATION / 1000, forceUpdate);
            this.accumulator -= this.FRAME_DURATION;

            if (forceUpdate) {
                this.lastUpdateTime = currentTimestamp;
                shouldUpdate = true;
            }
        }

        this.renderCallback();
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }

    public getCurrentFPS(): number {
        return this.currentFPS;
    }

    public getTargetFPS(): number {
        return this.TARGET_FPS;
    }

    public getGameTime(): number {
        return performance.now();
    }
}