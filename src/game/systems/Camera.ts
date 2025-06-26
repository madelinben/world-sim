import type { Position } from '../engine/types';
import { WorldGenerator } from '../world/WorldGenerator';
import { UIManager } from '../ui/UIManager';
import type { InventoryItem } from '../entities/inventory/Inventory';

export type RenderingMode = 'world' | 'dungeon' | 'mine';

export class Camera {
    public position: Position;
    public playerPosition: Position = { x: 0, y: 0 };
    public viewWidth: number;
    public viewHeight: number;
    private canvas: HTMLCanvasElement;
    private readonly TILE_SIZE = WorldGenerator.TILE_SIZE;
    public uiManager: UIManager;
    public renderingMode: RenderingMode = 'world';
    public dungeonEntrancePosition: Position | null = null;
    public mineEntrancePosition: Position | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.position = { x: 0, y: 0 };
        this.viewWidth = canvas.width;
        this.viewHeight = canvas.height;
        this.uiManager = new UIManager(canvas);
    }

    public setDungeonEntrance(position: Position): void {
        this.dungeonEntrancePosition = position;
    }

    public setMineEntrance(position: Position): void {
        this.mineEntrancePosition = position;
    }

    public centerOnPlayer(): void {
        this.position = {
            x: this.playerPosition.x - this.viewWidth / 2,
            y: this.playerPosition.y - this.viewHeight / 2
        };
    }

    public setRenderingMode(mode: RenderingMode): void {
        this.renderingMode = mode;
        console.log(`🏚️ Switched to ${mode} rendering mode`);
    }

    public toggleRenderingMode(): void {
        // Cycle through world -> dungeon -> mine -> world
        if (this.renderingMode === 'world') {
            this.renderingMode = 'dungeon';
        } else if (this.renderingMode === 'dungeon') {
            this.renderingMode = 'mine';
        } else {
            this.renderingMode = 'world';
        }
        console.log(`🔄 Toggled to ${this.renderingMode} rendering mode`);
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

    public renderUI(inventory: (InventoryItem | null)[], selectedSlot: number): void {
        this.uiManager.render(inventory, selectedSlot);
    }
}