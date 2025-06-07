import type { Position } from '../engine/types';
import { WorldGenerator } from '../world/WorldGenerator';

export class Camera {
    public position: Position;
    public playerPosition: Position = { x: 0, y: 0 };
    public viewWidth: number;
    public viewHeight: number;
    private canvas: HTMLCanvasElement;
    private readonly TILE_SIZE = WorldGenerator.TILE_SIZE;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.position = { x: 0, y: 0 };
        this.viewWidth = canvas.width;
        this.viewHeight = canvas.height;
    }

    public update(playerPosition: Position): void {
        // Snap player position to nearest tile center
        const tileSize = WorldGenerator.TILE_SIZE;
        const snappedX = Math.round(playerPosition.x / tileSize) * tileSize;
        const snappedY = Math.round(playerPosition.y / tileSize) * tileSize;
        this.playerPosition = { x: snappedX, y: snappedY };

        // Center camera on player position
        // We subtract half the canvas dimensions to center the player
        this.position = {
            x: snappedX - (this.canvas.width / 2),
            y: snappedY - (this.canvas.height / 2)
        };

        this.viewWidth = this.canvas.width;
        this.viewHeight = this.canvas.height;
    }

    public worldToScreen(worldX: number, worldY: number): Position {
        return {
            x: worldX - this.position.x,
            y: worldY - this.position.y
        };
    }

    public screenToWorld(screenX: number, screenY: number): Position {
        return {
            x: screenX + this.position.x,
            y: screenY + this.position.y
        };
    }
}