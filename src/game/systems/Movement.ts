import type { PlayerState } from '../engine/types';
import type { Controls } from './Controls';
import { WorldGenerator } from '../world/WorldGenerator';
import { type World } from '../world/World';
import type { Dungeon } from '../world/Dungeon';
import type { Camera } from './Camera';
import type { Tree } from '../entities/structure/Tree';
import type { Cactus } from '../entities/structure/Cactus';
import type { VillageStructure } from '../world/VillageGenerator';
import type { Player } from '../entities/player/Player';

export class Movement {
    private readonly TILE_SIZE = WorldGenerator.TILE_SIZE; // Use unified tile size
    private moveCooldown = 0;
    private moveDelay = 120; // ms between moves when holding a key
    private world: World;
    private dungeon: Dungeon;
    private camera: Camera;
    private onMoveCallback?: (direction: 'up' | 'down' | 'left' | 'right') => void;
    private onDirectionChangeCallback?: (direction: 'up' | 'down' | 'left' | 'right', moved: boolean) => void;
    private player?: Player; // Reference to player for sprite animations
    private previousPlayerPosition?: { x: number; y: number }; // Track previous position for cactus bounce-back

    constructor(world: World, dungeon: Dungeon, camera: Camera) {
        this.world = world;
        this.dungeon = dungeon;
        this.camera = camera;
    }

    public setPlayer(player: Player): void {
        this.player = player;
    }

    public setMoveCallback(callback: (direction: 'up' | 'down' | 'left' | 'right') => void): void {
        this.onMoveCallback = callback;
    }

    public setDirectionChangeCallback(callback: (direction: 'up' | 'down' | 'left' | 'right', moved: boolean) => void): void {
        this.onDirectionChangeCallback = callback;
    }

    private canMoveToTile(tile: { value: string; trees?: Tree[]; cactus?: Cactus[]; villageStructures?: VillageStructure[] } | null): boolean {
        if (!tile) return false;

        if (this.camera.renderingMode === 'dungeon') {
            // In dungeon mode, only VOID tiles are impassable
            if (tile.value === 'VOID') return false;

            // Check for dungeon structures (monsters, chests, portals)
            if (tile.villageStructures && tile.villageStructures.length > 0) {
                for (const structure of tile.villageStructures) {
                    // Check POI passability
                    if (structure.poi && !structure.poi.passable) {
                        return false; // Impassable POI (like chests, portals)
                    }
                    // Check NPC passability - NPCs are impassable unless dead
                    if (structure.npc && !structure.npc.isDead()) {
                        return false; // Living NPCs block movement
                    }
                }
            }
            return true;
        } else {
            // World mode - use existing world passability rules
            // Check for impassable tiles
            if (tile.value === 'DEEP_WATER' || tile.value === 'SHALLOW_WATER' || tile.value === 'STONE' || tile.value === 'COBBLESTONE' || tile.value === 'SNOW') return false;

            // Check for trees (impassable when present and alive, but passable when cut down)
            if (tile.trees && tile.trees.length > 0) {
                // Allow passage if all trees are cut down (destroyed/health <= 0)
                const hasLivingTrees = tile.trees.some(tree => tree.getHealth() > 0);
                if (hasLivingTrees) return false;
            }

            // Check for living cactus - these are impassable and will cause bounce-back with damage
            if (tile.cactus && tile.cactus.length > 0) {
                const hasLivingCactus = tile.cactus.some(cactus => cactus.getHealth() > 0);
                if (hasLivingCactus) return false; // Block movement onto living cactus
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
    }

    private canMoveFromMud(): boolean {
        return Math.random() < 1/3; // 1 in 3 chance to move
    }

    public update(player: PlayerState, controls: Controls): void {
        // Handle movement cooldown
        if (this.moveCooldown > 0) {
            this.moveCooldown -= 16; // assuming ~60fps, so ~16ms per frame
            if (this.moveCooldown > 0) return;
        }

        // Store previous position before attempting movement
        this.previousPlayerPosition = { ...player.position };

        // Get current tile from appropriate source
        const currentTile = this.getCurrentTile(player.position.x / this.TILE_SIZE, player.position.y / this.TILE_SIZE);

        // Check if player is in MUD and randomly prevent movement (only in world mode)
        if (this.camera.renderingMode === 'world' && currentTile?.value === 'MUD' && !this.canMoveFromMud()) {
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

        // Set player moving state for sprite animation
        const isMoving = attemptedMove && (controls.isKeyPressed('up') || controls.isKeyPressed('down') ||
                                         controls.isKeyPressed('left') || controls.isKeyPressed('right'));
        if (this.player) {
            this.player.setMoving(isMoving);
        }

        // Check if we can move to the new position
        if (attemptedMove) {
            const targetTile = this.getCurrentTile(newPosition.x / this.TILE_SIZE, newPosition.y / this.TILE_SIZE);

            // Check if movement is blocked by living cactus specifically (only in world mode)
            const isBlockedByCactus = this.camera.renderingMode === 'world' &&
                                    targetTile?.cactus && targetTile.cactus.length > 0 &&
                                    targetTile.cactus.some(cactus => cactus.getHealth() > 0);

            if (this.canMoveToTile(targetTile)) {
                player.position = newPosition;
                actuallyMoved = true;
            } else if (isBlockedByCactus) {
                // Special handling for cactus collision - apply damage and bounce back (world mode only)
                this.handleCactusCollision(player);
                console.log(`🌵 Player hit cactus and bounced back!`);
            } else {
                let blockReason = `${targetTile?.value ?? 'UNKNOWN'} tile`;

                // Add specific blocking reason based on mode
                if (this.camera.renderingMode === 'world') {
                    if (targetTile?.trees?.some(tree => tree.getHealth() > 0)) {
                        blockReason += ' (blocked by tree)';
                    } else if (targetTile?.villageStructures) {
                        const blockingStructures = targetTile.villageStructures.filter(s =>
                            (s.poi && !s.poi.passable) ?? (s.npc && !s.npc.isDead())
                        );
                        if (blockingStructures.length > 0) {
                            const structureTypes = blockingStructures.map(s =>
                                s.poi ? s.poi.type : s.npc ? s.npc.type : 'unknown'
                            ).join(', ');
                            blockReason += ` (blocked by ${structureTypes})`;
                        }
                    }
                } else {
                    // In dungeon mode, only show basic tile blocking
                    if (targetTile?.value === 'VOID') {
                        blockReason = 'void (impassable)';
                    }
                }

                console.log(`Movement blocked - cannot move to ${blockReason}`);
            }

            // Always trigger direction change callback when a movement was attempted
            if (moveDirection && this.onDirectionChangeCallback) {
                this.onDirectionChangeCallback(moveDirection, actuallyMoved);
            }
        } else {
            // Not attempting to move, stop animation
            if (this.player) {
                this.player.setMoving(false);
            }
        }

        if (actuallyMoved) {
            // Snap to nearest tile center
            player.position.x = Math.round(player.position.x / this.TILE_SIZE) * this.TILE_SIZE;
            player.position.y = Math.round(player.position.y / this.TILE_SIZE) * this.TILE_SIZE;
            this.moveCooldown = this.moveDelay;

            // Log current tile with structure info
            const currentTile = this.getCurrentTile(player.position.x / this.TILE_SIZE, player.position.y / this.TILE_SIZE);
            let tileInfo = currentTile?.value ?? 'UNKNOWN';

            // Only show world-specific info in world mode
            if (this.camera.renderingMode === 'world') {
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
            } else {
                // In dungeon mode, show dungeon-specific info
                if (currentTile?.villageStructures && currentTile.villageStructures.length > 0) {
                    const dungeonStructures = currentTile.villageStructures.map(s =>
                        s.poi ? s.poi.type : s.npc ? `${s.npc.type} Monster` : 'unknown'
                    ).join(', ');
                    tileInfo += ` (Dungeon: ${dungeonStructures})`;
                }
            }
            console.log('Current tile:', tileInfo);

            // Call the move callback to set direction and log facing tile
            if (this.onMoveCallback && moveDirection) {
                this.onMoveCallback(moveDirection);
            }
        }
    }

    private getCurrentTile(tileX: number, tileY: number) {
        if (this.camera.renderingMode === 'dungeon') {
            return this.dungeon.getTile(tileX, tileY);
        } else {
            return this.world.getTile(tileX, tileY);
        }
    }

    public getPreviousPlayerPosition(): { x: number; y: number } | undefined {
        return this.previousPlayerPosition;
    }

    private handleCactusCollision(player: PlayerState): void {
        // Apply cactus damage to player if they can take damage
        if (this.player?.canTakeCactusDamage()) {
            console.log(`🌵 Player hit cactus! Taking 5 damage (cactus deals 5 damage).`);

            // Deal 5 damage (cactus damage is 5, not 1)
            this.player.takeDamage(5);

            // Set cooldown to prevent repeated damage
            this.player.setCactusDamageCooldown(1000); // 1 second cooldown

            // Check if player died
            if (this.player.health <= 0) {
                console.log(`💀 Player died from cactus damage!`);
            }
        }
    }
}