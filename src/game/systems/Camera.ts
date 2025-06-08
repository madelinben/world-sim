import type { Position } from '../engine/types';
import { WorldGenerator } from '../world/WorldGenerator';
import { UIManager } from '../ui/UIManager';

export class Camera {
    public position: Position;
    public playerPosition: Position = { x: 0, y: 0 };
    public viewWidth: number;
    public viewHeight: number;
    private canvas: HTMLCanvasElement;
    private readonly TILE_SIZE = WorldGenerator.TILE_SIZE;
    public uiManager: UIManager;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.position = { x: 0, y: 0 };
        this.viewWidth = canvas.width;
        this.viewHeight = canvas.height;
        this.uiManager = new UIManager(canvas);
    }

    public update(playerPosition: Position): void {
        // Check if player moved to hide text box
        const playerMoved = this.playerPosition.x !== playerPosition.x || this.playerPosition.y !== playerPosition.y;
        if (playerMoved && this.uiManager.isTextBoxVisible()) {
            this.uiManager.hideTextBox();
        }

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

    public renderUI(): void {
        this.uiManager.render();
    }
}