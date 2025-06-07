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

    constructor(world: World) {
        this.world = world;
    }

    private canMoveToTile(tile: { value: string; trees?: Tree[]; cactus?: Cactus[] } | null): boolean {
        if (!tile) return false;

        // Check for impassable tiles
        if (tile.value === 'DEEP_WATER' || tile.value === 'STONE') return false;

        // Check for trees (impassable when present)
        if (tile.trees && tile.trees.length > 0) return false;

        // Check for cactus (impassable when present)
        if (tile.cactus && tile.cactus.length > 0) return false;

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

        let moved = false;
        const newPosition = { ...player.position };

        if (controls.wasKeyJustPressed('up') || controls.isKeyPressed('up')) {
            newPosition.y -= this.TILE_SIZE;
        } else if (controls.wasKeyJustPressed('down') || controls.isKeyPressed('down')) {
            newPosition.y += this.TILE_SIZE;
        } else if (controls.wasKeyJustPressed('left') || controls.isKeyPressed('left')) {
            newPosition.x -= this.TILE_SIZE;
        } else if (controls.wasKeyJustPressed('right') || controls.isKeyPressed('right')) {
            newPosition.x += this.TILE_SIZE;
        }

        // Check if we can move to the new position
        const targetTile = this.world.getTile(newPosition.x / this.TILE_SIZE, newPosition.y / this.TILE_SIZE);
        if (this.canMoveToTile(targetTile)) {
            player.position = newPosition;
            moved = true;
        }

        if (moved) {
            // Snap to nearest tile center
            player.position.x = Math.round(player.position.x / this.TILE_SIZE) * this.TILE_SIZE;
            player.position.y = Math.round(player.position.y / this.TILE_SIZE) * this.TILE_SIZE;
            this.moveCooldown = this.moveDelay;
            // Log player and adjacent tile world coordinates and tile indices
            const left = Player.getLeftTile(player.position, this.TILE_SIZE);
            const right = Player.getRightTile(player.position, this.TILE_SIZE);
            const above = Player.getAboveTile(player.position, this.TILE_SIZE);
            const below = Player.getBelowTile(player.position, this.TILE_SIZE);
            const toIndex = (pos: {x: number, y: number}) => ({ x: pos.x / this.TILE_SIZE, y: pos.y / this.TILE_SIZE });
            let worldTile = null, leftTile = null, rightTile = null, aboveTile = null, belowTile = null;
            worldTile = this.world.getTile(player.position.x / this.TILE_SIZE, player.position.y / this.TILE_SIZE);
            leftTile = this.world.getTile(left.x / this.TILE_SIZE, left.y / this.TILE_SIZE);
            rightTile = this.world.getTile(right.x / this.TILE_SIZE, right.y / this.TILE_SIZE);
            aboveTile = this.world.getTile(above.x / this.TILE_SIZE, above.y / this.TILE_SIZE);
            belowTile = this.world.getTile(below.x / this.TILE_SIZE, below.y / this.TILE_SIZE);
            console.log('Current tile:', worldTile.value);
            console.log('Left tile:', leftTile.value);
            console.log('Right tile:', rightTile.value);
            console.log('Above tile:', aboveTile.value);
            console.log('Below tile:', belowTile.value);
        }
    }
}