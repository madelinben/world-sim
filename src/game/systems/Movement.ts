import type { PlayerState } from '../engine/types';
import type { Controls } from './Controls';
import { WorldGenerator } from '../world/WorldGenerator';
import { Player } from '../engine/Game';
import { type World } from '../world/World';
import type { Tree } from '../entities/structure/Tree';
import type { Cactus } from '../entities/structure/Cactus';
import type { VillageStructure } from '../world/VillageGenerator';

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

    private canMoveToTile(tile: { value: string; trees?: Tree[]; cactus?: Cactus[]; villageStructures?: VillageStructure[] } | null): boolean {
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

        // Check for village structures (POIs and NPCs)
        if (tile.villageStructures && tile.villageStructures.length > 0) {
            for (const structure of tile.villageStructures) {
                // Check POI passability
                if (structure.poi && !structure.poi.passable) {
                    return false; // Impassable POI (like markets, windmills, chests)
                }

                // Check NPC passability - NPCs are impassable unless dead
                if (structure.npc && !structure.npc.isDead()) {
                    return false; // Living NPCs block movement
                }
            }
        }

        return true;
    }

    private canMoveFromMud(): boolean {
        return Math.random() < 1/3; // 1 in 3 chance to move
    }

    private canMoveFromSnow(): boolean {
        return Math.random() < 1/4; // 1 in 4 chance to move from snow
    }

    private canMoveFromShallowWater(): boolean {
        return Math.random() < 1/3; // 1 in 3 chance to move from shallow water
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

        // Check if player is in SHALLOW_WATER and randomly prevent movement
        if (currentTile?.value === 'SHALLOW_WATER' && !this.canMoveFromShallowWater()) {
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
                let blockReason = `${targetTile?.value ?? 'UNKNOWN'} tile`;

                // Add specific blocking reason
                if (targetTile?.trees?.some(tree => tree.getHealth() > 0)) {
                    blockReason += ' (blocked by tree)';
                } else if (targetTile?.cactus?.some(cactus => cactus.getHealth() > 0)) {
                    blockReason += ' (blocked by cactus)';
                } else if (targetTile?.villageStructures) {
                    const blockingStructures = targetTile.villageStructures.filter(s =>
                        (s.poi && !s.poi.passable) || (s.npc && !s.npc.isDead())
                    );
                    if (blockingStructures.length > 0) {
                        const structureTypes = blockingStructures.map(s =>
                            s.poi ? s.poi.type : s.npc ? s.npc.type : 'unknown'
                        ).join(', ');
                        blockReason += ` (blocked by ${structureTypes})`;
                    }
                }

                console.log(`Movement blocked - cannot move to ${blockReason}`);
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
            let tileInfo = currentTile?.value ?? 'UNKNOWN';
            if (currentTile?.trees && currentTile.trees.length > 0) {
                const tree = currentTile.trees[0];
                tileInfo += ` (Tree: ${tree?.getHealth()}/${tree?.getMaxHealth()} HP)`;
            }
            if (currentTile?.cactus && currentTile.cactus.length > 0) {
                const cactus = currentTile.cactus[0];
                tileInfo += ` (Cactus: ${cactus?.getHealth()}/${cactus?.getMaxHealth()} HP)`;
            }
            if (currentTile?.villageStructures && currentTile.villageStructures.length > 0) {
                const structures = currentTile.villageStructures.map(s =>
                    s.poi ? s.poi.type : s.npc ? `${s.npc.type} NPC` : 'unknown'
                ).join(', ');
                tileInfo += ` (Structures: ${structures})`;
            }
            console.log('Current tile:', tileInfo);

            // Call the move callback to set direction and log facing tile
            if (this.onMoveCallback && moveDirection) {
                this.onMoveCallback(moveDirection);
            }
        }
    }
}