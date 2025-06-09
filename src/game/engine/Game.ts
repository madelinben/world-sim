import type { GameState } from './types';
import { GameLoop } from './GameLoop';
import { Controls } from '~/game/systems/Controls';
import { Movement } from '~/game/systems/Movement';
import { World } from '~/game/world/World';
import { Camera } from '~/game/systems/Camera';
import { WorldGenerator } from '~/game/world/WorldGenerator';
import { AnimationSystem } from '~/game/systems/AnimationSystem';
import { Player as PlayerEntity } from '~/game/entities/player/Player';

import { PlayerScoreSystem } from '~/game/systems/PlayerScoreSystem';

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

    private scoreSystem!: PlayerScoreSystem;
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
        this.world = new World(this.camera, new WorldGenerator(seed));
        this.movement = new Movement(this.world);
        this.animationSystem = new AnimationSystem();

        this.scoreSystem = new PlayerScoreSystem();

        // Connect UI systems
        this.camera.uiManager.setInventory(this.player.inventory);

        // Connect world with animation system
        this.world.setAnimationSystem(this.animationSystem);

        // Connect player to movement system for sprite animations
        this.movement.setPlayer(this.player);

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

    public update(deltaTime: number): void {
        // Game is always running once started

        // Update controls (but don't clear justPressed yet)
        this.controls.update();

        // Handle player actions first (while justPressed states are still valid)
        this.handlePlayerActions();

        // Handle mouse input
        this.handleMouseInput();

        // Update movement system
        this.movement.update(this.gameState.player, this.controls);

        // Update player animation
        this.player.update(deltaTime);

        // Update camera
        this.camera.update(this.gameState.player.position);

        // Update world
        const inventoryItems = this.player.getInventoryItems().filter(item => item !== null);
        this.world.update(deltaTime, this.gameState.player.position, inventoryItems);

        // Initialize villages in score system when discovered
        this.initializeNearbyVillages();

        // Update animation system
        this.animationSystem.update(deltaTime);

        // Check for cactus damage to player
        this.checkCactusDamage();

        // Clear justPressed states after all actions have been processed
        this.controls.clearJustPressed();
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

        // Render UI Manager (Pokemon DS-style text box and inventory)
        this.camera.renderUI();
    }

    private renderPlayer(ctx: CanvasRenderingContext2D): void {
        // Player is always centered on screen
        const centerX = this.canvas.width / 2 - 8; // Center the 16x16 sprite
        const centerY = this.canvas.height / 2 - 8;

        // Use the player's new sprite rendering method
        this.player.render(ctx, centerX, centerY);
    }

    private handlePlayerActions(): void {
        // Handle keyboard input to dismiss text box
        if (this.camera.uiManager.isTextBoxVisible()) {
            // Any key press dismisses the text box
            if (this.controls.wasAnyKeyPressed()) {
                this.camera.uiManager.hideTextBox();
                return; // Don't process other actions while text box is visible
            }
        }

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

        // Update player direction if movement keys are pressed (even if no movement happens)
        if (this.controls.isKeyPressed('up')) {
            this.player.setDirection('up');
        } else if (this.controls.isKeyPressed('down')) {
            this.player.setDirection('down');
        } else if (this.controls.isKeyPressed('left')) {
            this.player.setDirection('left');
        } else if (this.controls.isKeyPressed('right')) {
            this.player.setDirection('right');
        }

        // Handle attack (Q)
        if (this.controls.wasKeyJustPressed('attack')) {
            console.log('Attack key detected - executing attack');
            this.player.startAttack(); // Trigger attack animation
            this.logFacingTile();
            this.handleAttack();
        }

        // Handle interact (F)
        if (this.controls.wasKeyJustPressed('interact')) {
            console.log('Interact key detected - executing interact with attack animation');
            this.player.startAttack(); // Trigger attack animation for interact too
            this.logFacingTile();
            this.handleInteract();
        }

        // Direction tracking will be handled by the movement system after successful movement
    }

    private handleMouseInput(): void {
        // Mouse input currently disabled - inventory controlled via 1-9 keys only
        // const mouseClick = this.controls.getMouseClick();
        // if (mouseClick) {
        //     // Future: implement mouse controls for game world interactions
        // }
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
        // Check for NPCs
        else {
            const npc = this.world.getNPCAt(tileX, tileY);
            if (npc) {
                // Track score based on NPC category and village area
                const nearestVillage = this.scoreSystem.findNearestVillage(this.gameState.player.position);

                if (nearestVillage && this.scoreSystem.isInVillageArea(this.gameState.player.position, nearestVillage)) {
                    if (npc.category === 'monster') {
                        // Positive score for killing monsters in village area
                        this.scoreSystem.onMonsterKilled(nearestVillage);
                    } else if (npc.category === 'animal') {
                        // Negative score for attacking village animals
                        this.scoreSystem.onAnimalAttacked(nearestVillage);
                    } else if (npc.category === 'friendly') {
                        // Negative score for attacking village traders
                        this.scoreSystem.onTraderAttacked(nearestVillage);
                    }
                }

                npc.takeDamage(this.player.attackDamage);

                if (npc.isDead()) {
                    // Get drops and add to inventory
                    const drops = this.world.removeDeadNPCAt(tileX, tileY);
                    for (const drop of drops) {
                        const added = this.player.addToInventory(drop.type, drop.quantity);
                        if (added) {
                            console.log(`✅ Added ${drop.quantity} ${drop.type} to inventory`);
                        } else {
                            console.log(`❌ Inventory full! Could not add ${drop.quantity} ${drop.type}`);
                        }
                    }
                }
            } else {
                console.log('Nothing to attack in that direction');
            }
        }
    }

    private handleInteract(): void {
        const facingPos = this.player.getFacingPosition(WorldGenerator.TILE_SIZE);
        const tileX = Math.floor(facingPos.x / WorldGenerator.TILE_SIZE);
        const tileY = Math.floor(facingPos.y / WorldGenerator.TILE_SIZE);

        const tile = this.world.getTile(tileX, tileY);
        console.log(`Interacting with tile at (${tileX}, ${tileY}):`, tile?.value);

        // Check for POI structures first
        const poi = this.world.getPOIAt(tileX, tileY);
        if (poi?.type === 'notice_board') {
            console.log('Interacting with notice board');

            // Get pre-generated notice text and title from the notice board
            const villageName = poi.customData?.villageName as string ?? 'Unknown Village';
            const noticeTitle = poi.customData?.noticeTitle as string ?? `${villageName} Notice Board`;
            const noticeText = poi.customData?.noticeText as string ?? `Welcome to ${villageName}!\n\nPress any key to continue...`;

            this.camera.uiManager.showTextBox({
                text: noticeText,
                title: noticeTitle,
                villageName: villageName
            });
            return;
        }

        // Check for NPCs (trader interaction)
        const npc = this.world.getNPCAt(tileX, tileY);
        if (npc && npc.category === 'friendly') {
            console.log(`Interacting with trader: ${npc.type}`);

            // Find nearest village and get trader comment based on score
            const nearestVillage = this.scoreSystem.findNearestVillage(this.gameState.player.position);
            let comment = "Hello there, traveler.";
            let villageName = "Unknown Village";

            if (nearestVillage) {
                const villageScore = this.scoreSystem.getVillageScore(nearestVillage);
                if (villageScore) {
                    comment = this.scoreSystem.getTraderComment(nearestVillage);
                    villageName = villageScore.villageName;
                }
            }

            this.camera.uiManager.showTextBox({
                text: comment,
                title: `Trader in ${villageName}`,
                villageName: villageName
            });
            return;
        }

        // Check for other interactable structures
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
            tileInfo += ` (Cactus: ${cactus?.getHealth()}/${cactus?.getMaxHealth()} HP, Variant: ${cactus?.getVariant()})`;
        }

        // Check for NPCs
        const npc = this.world.getNPCAt(tileX, tileY);
        if (npc) {
            tileInfo += ` (${npc.type}: ${npc.health}/${npc.maxHealth} HP)`;
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

    private initializeNearbyVillages(): void {
        // Check for village POIs in the current area to initialize score tracking
        const playerTileX = Math.floor(this.gameState.player.position.x / WorldGenerator.TILE_SIZE);
        const playerTileY = Math.floor(this.gameState.player.position.y / WorldGenerator.TILE_SIZE);

        // Check a 10x10 area around the player for village wells
        for (let dx = -5; dx <= 5; dx++) {
            for (let dy = -5; dy <= 5; dy++) {
                const checkX = playerTileX + dx;
                const checkY = playerTileY + dy;

                const poi = this.world.getPOIAt(checkX, checkY);
                if (poi?.type === 'water_well') {
                    const villageName = poi.customData?.villageName as string ?? 'Unknown Village';

                    // Generate village ID from grid coordinates
                    const villageGridX = Math.floor(checkX / 50);
                    const villageGridY = Math.floor(checkY / 50);
                    const villageId = `village_${villageGridX}_${villageGridY}`;

                    this.scoreSystem.initializeVillage(villageId, villageName);
                }
            }
        }
    }

    private checkCactusDamage(): void {
        // Check player position for cactus damage
        const playerTileX = Math.floor(this.gameState.player.position.x / WorldGenerator.TILE_SIZE);
        const playerTileY = Math.floor(this.gameState.player.position.y / WorldGenerator.TILE_SIZE);
        const playerTile = this.world.getTile(playerTileX, playerTileY);

        // Check if player is on a cactus tile
        if (playerTile?.cactus && playerTile.cactus.length > 0) {
            const livingCactus = playerTile.cactus.filter(cactus => cactus.getHealth() > 0);
            if (livingCactus.length > 0) {
                console.log(`🌵 Player taking cactus damage! Standing on cactus at (${playerTileX}, ${playerTileY})`);
                this.player.takeDamage(5);

                // Visual/audio feedback could be added here
                if (this.player.health <= 0) {
                    console.log(`💀 Player died from cactus damage!`);
                }
            }
        }

        // Check all visible NPCs for cactus damage by iterating through visible tiles
        // Since we don't have direct access to all NPCs, we'll check each visible tile for NPCs
        const viewRadiusInTiles = 20; // Check area around player
        const playerTileXCenter = Math.floor(this.gameState.player.position.x / WorldGenerator.TILE_SIZE);
        const playerTileYCenter = Math.floor(this.gameState.player.position.y / WorldGenerator.TILE_SIZE);

        for (let dx = -viewRadiusInTiles; dx <= viewRadiusInTiles; dx++) {
            for (let dy = -viewRadiusInTiles; dy <= viewRadiusInTiles; dy++) {
                const checkX = playerTileXCenter + dx;
                const checkY = playerTileYCenter + dy;
                const npc = this.world.getNPCAt(checkX, checkY);

                if (npc && !npc.isDead()) {
                    const npcTile = this.world.getTile(checkX, checkY);

                    if (npcTile?.cactus && npcTile.cactus.length > 0) {
                        const livingCactus = npcTile.cactus.filter(cactus => cactus.getHealth() > 0);
                        if (livingCactus.length > 0) {
                            console.log(`🌵 ${npc.type} taking cactus damage at (${checkX}, ${checkY})`);
                            npc.takeDamage(5);

                            if (npc.isDead()) {
                                console.log(`💀 ${npc.type} died from cactus damage!`);
                            }
                        }
                    }
                }
            }
        }
    }
}