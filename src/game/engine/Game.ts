import type { GameState } from './types';
import { GameLoop } from './GameLoop';
import { Controls } from '~/game/systems/Controls';
import { Movement } from '~/game/systems/Movement';
import { World } from '~/game/world/World';
import { Camera } from '~/game/systems/Camera';
import { WorldGenerator } from '~/game/world/WorldGenerator';
import { AnimationSystem } from '~/game/systems/AnimationSystem';
import { Player as PlayerEntity } from '~/game/entities/player/Player';
import type { Tree } from '~/game/entities/structure/Tree';
import type { Cactus } from '~/game/entities/structure/Cactus';

// Player helper class for adjacent tile logic
export class Player {
    static getLeftTile(playerPos: {x: number, y: number}, tileSize: number) {
        return { x: playerPos.x - tileSize, y: playerPos.y };
    }
    static getRightTile(playerPos: {x: number, y: number}, tileSize: number) {
        return { x: playerPos.x + tileSize, y: playerPos.y };
    }
    static getAboveTile(playerPos: {x: number, y: number}, tileSize: number) {
        return { x: playerPos.x, y: playerPos.y - tileSize };
    }
    static getBelowTile(playerPos: {x: number, y: number}, tileSize: number) {
        return { x: playerPos.x, y: playerPos.y + tileSize };
    }
}

export class Game {
    private gameState!: GameState;
    private gameLoop!: GameLoop;
    private camera!: Camera;
    private controls!: Controls;
    private movement!: Movement;
    private world!: World;
    private animationSystem!: AnimationSystem;
    private canvas: HTMLCanvasElement;
    private lastPlayerPos = { x: 0, y: 0 };
    private lastNPCs = '';
    private lastPOIs = '';
    private player!: PlayerEntity;

    constructor(canvas: HTMLCanvasElement, seed?: string) {
        this.canvas = canvas;
        this.controls = new Controls(canvas);
        this.initializeGame(seed);
    }

    private initializeGame(seed?: string): void {
        // Initialize player entity
        this.player = new PlayerEntity({
            position: { x: 0, y: 0 },
            health: 100,
            attackDamage: 5
        });

        // Initialize game state
        this.gameState = {
            player: {
                position: { x: 0, y: 0 },
                inventory: [],
                health: 100
            },
            world: {
                tiles: [],
                npcs: [],
                pois: []
            },
            timestamp: Date.now()
        };

        // Initialize systems
        this.camera = new Camera(this.canvas);
        this.world = new World(new WorldGenerator(seed));
        this.movement = new Movement(this.world);
        this.animationSystem = new AnimationSystem();

        // Connect world with animation system
        this.world.setAnimationSystem(this.animationSystem);

        // Set up direction change callback to always update facing direction
        this.movement.setDirectionChangeCallback((direction, moved) => {
            if (moved) {
                // First update player entity position to match game state when actually moved
                this.player.setPosition(this.gameState.player.position);
            }
            // Always set direction and log facing tile, regardless of whether movement succeeded
            this.player.setDirection(direction);
            this.logFacingTile();
        });

        // Initialize game loop
        this.gameLoop = new GameLoop(this.update.bind(this), this.render.bind(this));
    }

    public start(): void {
        this.gameLoop.start();
    }

    public stop(): void {
        this.gameLoop.stop();
    }

        private update(deltaTime: number, forceUpdate = false): void {
        // Handle new input actions BEFORE resetting justPressed state
        this.handlePlayerActions();

        this.controls.update();

        // Mouse drag camera movement
        let changed = false;
        if (this.controls.dragDelta.x !== 0 || this.controls.dragDelta.y !== 0) {
            this.camera.position.x -= this.controls.dragDelta.x;
            this.camera.position.y -= this.controls.dragDelta.y;
            this.controls.dragDelta = { x: 0, y: 0 };
            changed = true;
        }

        // Check player movement
        const player = this.gameState.player;
        if (player.position.x !== this.lastPlayerPos.x || player.position.y !== this.lastPlayerPos.y) {
            this.lastPlayerPos = { ...player.position };
            changed = true;
        }

        // Always update movement and camera for smooth interaction
        this.movement.update(player, this.controls);
        this.camera.update(player.position);

        // Update player entity position to match game state
        this.player.setPosition(player.position);

        // Only update expensive systems if forced or something changed
        if (forceUpdate || changed) {
            // Check NPCs only when forced
            const npcsStr = JSON.stringify(this.gameState.world.npcs);
            if (npcsStr !== this.lastNPCs) {
                this.lastNPCs = npcsStr;
                changed = true;
            }

            // Check POIs only when forced
            const poisStr = JSON.stringify(this.gameState.world.pois);
            if (poisStr !== this.lastPOIs) {
                this.lastPOIs = poisStr;
                changed = true;
            }

            this.world.update(deltaTime);
        }

        // Always update animations for smooth tree growth
        this.animationSystem.update(deltaTime);
    }

    private render(): void {
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        // Clear with black background for tile borders
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.world.render(ctx, this.camera);
        // Render player behind structures/sprites
        this.renderPlayer(ctx);
        this.animationSystem.render(ctx, this.camera);
    }

    private renderPlayer(ctx: CanvasRenderingContext2D): void {
        // Player is always centered on screen
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        ctx.fillStyle = 'red';
        ctx.fillRect(centerX - 5, centerY - 5, 10, 10);
    }

    private handlePlayerActions(): void {
        // Handle inventory slot selection (1-9)
        for (let i = 1; i <= 9; i++) {
            if (this.controls.wasKeyJustPressed(`slot${i}`)) {
                this.player.selectInventorySlot(i - 1);
            }
        }

        // Handle inventory open (E)
        if (this.controls.wasKeyJustPressed('inventory')) {
            this.player.openInventory();
        }

        // Handle attack (Q)
        if (this.controls.wasKeyJustPressed('attack')) {
            console.log('Attack key detected - executing attack');
            this.logFacingTile();
            this.handleAttack();
        }

        // Handle interact (F)
        if (this.controls.wasKeyJustPressed('interact')) {
            this.logFacingTile();
            this.handleInteract();
        }

        // Direction tracking will be handled by the movement system after successful movement
    }

        private handleAttack(): void {
        const facingPos = this.player.getFacingPosition(WorldGenerator.TILE_SIZE);
        const tileX = Math.floor(facingPos.x / WorldGenerator.TILE_SIZE);
        const tileY = Math.floor(facingPos.y / WorldGenerator.TILE_SIZE);

        const tile = this.world.getTile(tileX, tileY);
        console.log(`Player attack damage: ${this.player.attackDamage}`);
        console.log(`Attacking tile at (${tileX}, ${tileY}): ${tile?.value}`);

        // Check for trees
        if (tile?.trees && tile.trees.length > 0) {
            const tree = tile.trees[0];
            if (tree) {
                console.log(`Tree health before attack: ${tree.getHealth()}/${tree.getMaxHealth()}`);
                const result = tree.takeDamage(this.player.attackDamage);

                                if (result.destroyed) {
                    console.log(`🌳 Tree destroyed! Dropped ${result.dropValue} ${result.dropType}`);
                    const added = this.player.addToInventory(result.dropType, result.dropValue);
                    if (added) {
                        console.log(`✅ Added ${result.dropValue} ${result.dropType} to inventory`);
                    }

                    // Tree is now a broken stump (CUT_DOWN stage), don't remove it
                    // The tile remains passable but shows the broken tree sprite
                    console.log(`Tree cut down - now showing broken tree stump at (${tileX}, ${tileY})`);
                } else {
                    console.log(`Tree took ${this.player.attackDamage} damage. Health: ${tree.getHealth()}/${tree.getMaxHealth()}`);
                }
            }
        }
        // Check for cactus
        else if (tile?.cactus && tile.cactus.length > 0) {
            const cactus = tile.cactus[0];
            if (cactus) {
                console.log(`Cactus health before attack: ${cactus.getHealth()}/${cactus.getMaxHealth()}`);
                const result = cactus.takeDamage(this.player.attackDamage);

                if (result.destroyed) {
                    console.log(`🌵 Cactus destroyed! Dropped ${result.dropValue} ${result.dropType}`);
                    const added = this.player.addToInventory(result.dropType, result.dropValue);
                    if (added) {
                        console.log(`✅ Added ${result.dropValue} ${result.dropType} to inventory`);
                    }

                    // Remove cactus from AnimationSystem
                    const tileKey = `${tileX},${tileY}`;
                    this.animationSystem.removeCactus(tileKey, cactus);

                    // Remove cactus completely from tile and convert to SAND
                    tile.cactus = tile.cactus.filter(c => c !== cactus);
                    if (tile.cactus.length === 0) {
                        delete tile.cactus;
                        tile.value = 'SAND';
                        this.world.invalidateCache();
                        console.log(`Cactus completely removed - tile converted to SAND at (${tileX}, ${tileY})`);
                    }
                } else {
                    console.log(`Cactus took ${this.player.attackDamage} damage. Health: ${cactus.getHealth()}/${cactus.getMaxHealth()}`);
                }
            }
        }
        else {
            console.log('Nothing to attack in that direction');
        }
    }

    private handleInteract(): void {
        const facingPos = this.player.getFacingPosition(WorldGenerator.TILE_SIZE);
        const tileX = Math.floor(facingPos.x / WorldGenerator.TILE_SIZE);
        const tileY = Math.floor(facingPos.y / WorldGenerator.TILE_SIZE);

        const tile = this.world.getTile(tileX, tileY);
        console.log(`Interacting with tile at (${tileX}, ${tileY}):`, tile?.value);

        // For now, just log what we're interacting with
        if (tile?.trees && tile.trees.length > 0) {
            console.log('Interacting with tree - could harvest fruit, check growth, etc.');
        } else if (tile?.cactus && tile.cactus.length > 0) {
            console.log('Interacting with cactus - could harvest water, check growth, etc.');
        } else {
            console.log('Nothing to interact with in that direction');
        }
    }

    private logFacingTile(): void {
        const facingPos = this.player.getFacingPosition(WorldGenerator.TILE_SIZE);
        const tileX = Math.floor(facingPos.x / WorldGenerator.TILE_SIZE);
        const tileY = Math.floor(facingPos.y / WorldGenerator.TILE_SIZE);
        const tile = this.world.getTile(tileX, tileY);

        // Log facing tile with additional info about structures
        let tileInfo = tile?.value || 'UNKNOWN';
        if (tile?.trees && tile.trees.length > 0) {
            const tree = tile.trees[0];
            tileInfo += ` (Tree: ${tree?.getHealth()}/${tree?.getMaxHealth()} HP)`;
        }
        if (tile?.cactus && tile.cactus.length > 0) {
            const cactus = tile.cactus[0];
            tileInfo += ` (Cactus: ${cactus?.getHealth()}/${cactus?.getMaxHealth()} HP)`;
        }

        console.log(`Facing tile: ${tileInfo}`);
    }

    public saveGame(): void {
        const gameStateString = JSON.stringify(this.gameState);
        localStorage.setItem('gameState', gameStateString);
    }

    public loadGame(): void {
        const savedState = localStorage.getItem('gameState');
        if (savedState) {
            this.gameState = JSON.parse(savedState) as GameState;
        }
    }
}