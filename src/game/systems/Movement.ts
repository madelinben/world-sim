import type { PlayerState } from '../engine/types';
import type { Controls } from './Controls';
import { WorldGenerator } from '../world/WorldGenerator';
import { Player } from '../engine/Game';
import { type World } from '../world/World';
import type { Tree } from '../entities/structure/Tree';
import type { Cactus } from '../entities/structure/Cactus';

export class Movement {
    private readonly TILE_SIZE = WorldGenerator.TILE_SIZE; // Use unified tile size
    private moveCooldown = 0;
    private moveDelay = 120; // ms between moves when holding a key
    private world: World;
    private onMoveCallback?: (direction: 'up' | 'down' | 'left' | 'right') => void;
    private onDirectionChangeCallback?: (direction: 'up' | 'down' | 'left' | 'right', moved: boolean) => void;

    constructor(world: World) {
        this.world = world;
    }

    public setMoveCallback(callback: (direction: 'up' | 'down' | 'left' | 'right') => void): void {
        this.onMoveCallback = callback;
    }

    public setDirectionChangeCallback(callback: (direction: 'up' | 'down' | 'left' | 'right', moved: boolean) => void): void {
        this.onDirectionChangeCallback = callback;
    }

    private canMoveToTile(tile: { value: string; trees?: Tree[]; cactus?: Cactus[] } | null): boolean {
        if (!tile) return false;

        // Check for impassable tiles
        if (tile.value === 'DEEP_WATER' || tile.value === 'STONE') return false;

        // Check for trees (impassable when present and alive, but passable when cut down)
        if (tile.trees && tile.trees.length > 0) {
            // Allow passage if all trees are cut down (destroyed/health <= 0)
            const hasLivingTrees = tile.trees.some(tree => tree.getHealth() > 0);
            if (hasLivingTrees) return false;
        }

        // Check for cactus (impassable when present and alive)
        if (tile.cactus && tile.cactus.length > 0) {
            // Allow passage if all cactus are destroyed
            const hasLivingCactus = tile.cactus.some(cactus => cactus.getHealth() > 0);
            if (hasLivingCactus) return false;
        }

        return true;
    }

    private canMoveFromMud(): boolean {
        return Math.random() < 1/3; // 1 in 3 chance to move
    }

    private canMoveFromSnow(): boolean {
        return Math.random() < 1/4; // 1 in 4 chance to move from snow
    }

    public update(player: PlayerState, controls: Controls): void {
        // Handle movement cooldown
        if (this.moveCooldown > 0) {
            this.moveCooldown -= 16; // assuming ~60fps, so ~16ms per frame
            if (this.moveCooldown > 0) return;
        }

        // Get current tile
        const currentTile = this.world.getTile(player.position.x / this.TILE_SIZE, player.position.y / this.TILE_SIZE);

        // Check if player is in MUD and randomly prevent movement
        if (currentTile?.value === 'MUD' && !this.canMoveFromMud()) {
            return;
        }

        // Check if player is in SNOW and randomly prevent movement
        if (currentTile?.value === 'SNOW' && !this.canMoveFromSnow()) {
            return;
        }

        let attemptedMove = false;
        let actuallyMoved = false;
        let moveDirection: 'up' | 'down' | 'left' | 'right' | null = null;
        const newPosition = { ...player.position };

        if (controls.wasKeyJustPressed('up') || controls.isKeyPressed('up')) {
            newPosition.y -= this.TILE_SIZE;
            attemptedMove = true;
            moveDirection = 'up';
        } else if (controls.wasKeyJustPressed('down') || controls.isKeyPressed('down')) {
            newPosition.y += this.TILE_SIZE;
            attemptedMove = true;
            moveDirection = 'down';
        } else if (controls.wasKeyJustPressed('left') || controls.isKeyPressed('left')) {
            newPosition.x -= this.TILE_SIZE;
            attemptedMove = true;
            moveDirection = 'left';
        } else if (controls.wasKeyJustPressed('right') || controls.isKeyPressed('right')) {
            newPosition.x += this.TILE_SIZE;
            attemptedMove = true;
            moveDirection = 'right';
        }

                // Check if we can move to the new position
        if (attemptedMove) {
            const targetTile = this.world.getTile(newPosition.x / this.TILE_SIZE, newPosition.y / this.TILE_SIZE);
            if (this.canMoveToTile(targetTile)) {
                player.position = newPosition;
                actuallyMoved = true;
            } else {
                console.log(`Movement blocked - cannot move to ${targetTile?.value || 'UNKNOWN'} tile`);
            }

            // Always trigger direction change callback when a movement was attempted
            if (moveDirection && this.onDirectionChangeCallback) {
                this.onDirectionChangeCallback(moveDirection, actuallyMoved);
            }
        }

        if (actuallyMoved) {
            // Snap to nearest tile center
            player.position.x = Math.round(player.position.x / this.TILE_SIZE) * this.TILE_SIZE;
            player.position.y = Math.round(player.position.y / this.TILE_SIZE) * this.TILE_SIZE;
            this.moveCooldown = this.moveDelay;

            // Log current tile with structure info
            const currentTile = this.world.getTile(player.position.x / this.TILE_SIZE, player.position.y / this.TILE_SIZE);
            let tileInfo = currentTile?.value || 'UNKNOWN';
            if (currentTile?.trees && currentTile.trees.length > 0) {
                const tree = currentTile.trees[0];
                tileInfo += ` (Tree: ${tree?.getHealth()}/${tree?.getMaxHealth()} HP)`;
            }
            if (currentTile?.cactus && currentTile.cactus.length > 0) {
                const cactus = currentTile.cactus[0];
                tileInfo += ` (Cactus: ${cactus?.getHealth()}/${cactus?.getMaxHealth()} HP)`;
            }
            console.log('Current tile:', tileInfo);

            // Call the move callback to set direction and log facing tile
            if (this.onMoveCallback && moveDirection) {
                this.onMoveCallback(moveDirection);
            }
        }
    }
}