import type { GameState, PlayerState } from './types';
import { GameLoop } from './GameLoop';
import { Controls } from '~/game/systems/Controls';
import { Movement } from '~/game/systems/Movement';
import { World } from '~/game/world/World';
import { Camera } from '~/game/systems/Camera';
import { WorldGenerator } from '~/game/world/WorldGenerator';
import { AnimationSystem } from '~/game/systems/AnimationSystem';
import { Player as PlayerEntity } from '~/game/entities/player/Player';
import { UIManager } from '../ui/UIManager';
import { Inventory, type InventoryItem } from '../entities/inventory/Inventory';
import { Dungeon } from '../world/Dungeon';

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
    private dungeon!: Dungeon;
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
        this.dungeon = new Dungeon(seed);
        this.movement = new Movement(this.world, this.dungeon, this.camera);
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

                // Log player position and nearest structures when player moves to new tile
                this.logPlayerMovement();
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
        // Update controls (but don't clear justPressed yet)
        this.controls.update();

        // Handle player actions first (while justPressed states are still valid)
        this.handlePlayerActions();

        // Check if any UI is visible - if so, pause game logic updates
        if (this.camera.uiManager.isAnyUIVisible()) {
            // Only update player animation and clear controls when UI is open
            this.player.update(deltaTime);
            this.controls.clearJustPressed();
            return;
        }

        // Handle mouse input
        this.handleMouseInput();

        // Update movement system
        this.movement.update(this.gameState.player, this.controls);

        // Update player animation
        this.player.update(deltaTime);

        // Update camera
        this.camera.update(this.gameState.player.position);

        // Update world or dungeon based on rendering mode
        const inventoryItems = this.player.getInventoryItems().filter(item => item !== null);
        if (this.camera.renderingMode === 'dungeon') {
            this.dungeon.update(deltaTime, this.gameState.player.position, inventoryItems);
        } else {
            this.world.update(deltaTime, this.gameState.player.position, inventoryItems);
        }

        // Initialize villages in score system when discovered
        this.initializeNearbyVillages();

        // Update animation system
        this.animationSystem.update(deltaTime);

        // Check for entity deaths and handle tombstone creation
        this.handleEntityDeaths();

        // Handle monster attacks on player
        this.handleMonsterAttacks();

        // Clear justPressed states after all actions have been processed
        this.controls.clearJustPressed();
    }

    private render(): void {
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        // Clear with black background for tile borders
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render based on camera rendering mode
        if (this.camera.renderingMode === 'dungeon') {
            this.dungeon.render(ctx, this.camera);
        } else {
            this.world.render(ctx, this.camera);
        }

        // Render player behind structures/sprites
        this.renderPlayer(ctx);

        // Only render world animation system and health bars in world mode
        if (this.camera.renderingMode === 'world') {
            this.animationSystem.render(ctx, this.camera);
            this.world.renderHealthBars(ctx, this.camera);
            this.animationSystem.renderHealthBars(ctx, this.camera);
        } else if (this.camera.renderingMode === 'dungeon') {
            // Render dungeon health bars when in dungeon mode
            this.dungeon.renderHealthBars(ctx, this.camera);
        }

        this.renderPlayerHealthBar(ctx);

        // Render UI Manager with player inventory data
        const playerInventory = this.player.getInventoryItems();
        const selectedSlot = this.player.getSelectedSlot();
        this.camera.renderUI(playerInventory, selectedSlot);
    }

    private renderPlayer(ctx: CanvasRenderingContext2D): void {
        // Player is always centered on screen
        const centerX = this.canvas.width / 2 - 8; // Center the 16x16 sprite
        const centerY = this.canvas.height / 2 - 8;

        // Use the player's new sprite rendering method
        this.player.render(ctx, centerX, centerY);
    }

    private renderPlayerHealthBar(ctx: CanvasRenderingContext2D): void {
        // Render player health bar if damaged
        if (this.player.health < this.player.maxHealth) {
            const centerX = this.canvas.width / 2 - 8; // Center the 16x16 sprite
            const centerY = this.canvas.height / 2 - 8;

            const barWidth = 14;
            const barHeight = 2;
            const healthPercent = this.player.health / this.player.maxHealth;

            // Background (red)
            ctx.fillStyle = 'red';
            ctx.fillRect(centerX + 1, centerY - 4, barWidth, barHeight);

            // Foreground (green)
            ctx.fillStyle = 'green';
            ctx.fillRect(centerX + 1, centerY - 4, barWidth * healthPercent, barHeight);
        }
    }

    private handlePlayerActions(): void {
        // Handle ESC key to close any open UI components
        if (this.controls.wasKeyJustPressed('escape')) {
            if (this.camera.uiManager.isTombstoneUIVisible()) {
                this.camera.uiManager.hideTombstoneUI();
                return;
            }
            if (this.camera.uiManager.isTextBoxVisible()) {
                this.camera.uiManager.hideTextBox();
                return;
            }
            if (this.camera.uiManager.isInventoryUIVisible()) {
                this.camera.uiManager.closeInventoryUI();
                return;
            }
        }

        // Handle tombstone UI navigation and actions
        if (this.camera.uiManager.isTombstoneUIVisible()) {
            // Handle tombstone navigation with left/right arrows
            if (this.controls.wasKeyJustPressed('left')) {
                this.camera.uiManager.navigateTombstoneInventory('left');
                return;
            }
            if (this.controls.wasKeyJustPressed('right')) {
                this.camera.uiManager.navigateTombstoneInventory('right');
                return;
            }

            // Handle take all items (Z key)
            if (this.controls.wasKeyJustPressed('take_all')) {
                this.handleTakeAllTombstoneItems();
                return;
            }

            // Handle take selected item (X key)
            if (this.controls.wasKeyJustPressed('take_selected')) {
                this.handleTakeSelectedTombstoneItem();
                return;
            }

            // Handle close tombstone UI (F key)
            if (this.controls.wasKeyJustPressed('interact')) {
                this.camera.uiManager.hideTombstoneUI();
                return;
            }

            // Don't process other actions while tombstone UI is visible
            return;
        }

        // Handle keyboard input to dismiss text box
        if (this.camera.uiManager.isTextBoxVisible()) {
            // Any key press dismisses the text box
            if (this.controls.wasAnyKeyPressed()) {
                this.camera.uiManager.hideTextBox();
                return; // Don't process other actions while text box is visible
            }
        }

        // Handle inventory UI actions
        if (this.camera.uiManager.isInventoryUIVisible()) {
            // Handle inventory slot selection (1-9) - allowed in inventory UI
            for (let i = 1; i <= 9; i++) {
                if (this.controls.wasKeyJustPressed(`slot${i}`)) {
                    this.player.selectInventorySlot(i - 1);
                }
            }

            // Handle inventory close (E)
            if (this.controls.wasKeyJustPressed('inventory')) {
                this.camera.uiManager.toggleInventoryUI();
            }

            // Don't process movement or other actions while inventory UI is visible
            return;
        }

        // Handle inventory slot selection (1-9)
        for (let i = 1; i <= 9; i++) {
            if (this.controls.wasKeyJustPressed(`slot${i}`)) {
                this.player.selectInventorySlot(i - 1);
            }
        }

        // Handle inventory open (E)
        if (this.controls.wasKeyJustPressed('inventory')) {
            this.camera.uiManager.toggleInventoryUI();
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

        // Handle blocking (G) - hold to block
        if (this.controls.isKeyPressed('block')) {
            if (!this.player.isBlocking) {
                this.player.setBlocking(true);
            }
        } else {
            if (this.player.isBlocking) {
                this.player.setBlocking(false);
            }
        }

        // Handle interact (F)
        if (this.controls.wasKeyJustPressed('interact')) {
            console.log('Interact key detected - executing interact with attack animation');
            this.player.startAttack(); // Trigger attack animation for interact too
            this.logFacingTile();
            this.handleInteract();
        }
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

        // Check for tombstone interaction first
        const tombstone = this.world.getTombstoneAt(tileX, tileY);
        if (tombstone) {
            console.log(`Interacting with tombstone: ${tombstone.getDisplayName()}`);
            this.camera.uiManager.showTombstoneUI(tombstone);
            return;
        }

        // Check for POI structures
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

        if (poi?.type === 'dungeon_entrance') {
            if (this.camera.renderingMode === 'world') {
                console.log('🏚️ Interacting with dungeon entrance - entering dungeon');

                // Store entrance position for dungeon generation
                const entranceWorldPos = { x: tileX * WorldGenerator.TILE_SIZE, y: tileY * WorldGenerator.TILE_SIZE };
                this.camera.setDungeonEntrance(entranceWorldPos);
                this.dungeon.setEntrancePosition(entranceWorldPos);
                this.camera.setRenderingMode('dungeon');

                // Find nearest unoccupied tile to entrance position in dungeon
                const spawnPosition = this.findNearestUnoccupiedTile(entranceWorldPos, 'dungeon');
                this.player.position = spawnPosition;
                this.gameState.player.position = spawnPosition;
                this.camera.centerOnPlayer();
            } else {
                console.log('🏚️ Interacting with dungeon entrance - returning to surface');
                this.camera.setRenderingMode('world');

                // Return player to entrance position on surface
                if (this.camera.dungeonEntrancePosition) {
                    const spawnPosition = this.findNearestUnoccupiedTile(this.camera.dungeonEntrancePosition, 'world');
                    this.player.position = spawnPosition;
                    this.gameState.player.position = spawnPosition;
                    this.camera.centerOnPlayer();
                }
            }
            return;
        }

        if (poi?.type === 'dungeon_portal') {
            console.log('🚪 Interacting with dungeon portal - returning to surface');
            this.camera.setRenderingMode('world');

            // Return player to entrance position on surface
            if (this.camera.dungeonEntrancePosition) {
                const spawnPosition = this.findNearestUnoccupiedTile(this.camera.dungeonEntrancePosition, 'world');
                this.player.position = spawnPosition;
                this.gameState.player.position = spawnPosition;
                this.camera.centerOnPlayer();
            }
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

        // Get tile from appropriate source based on rendering mode
        const tile = this.camera.renderingMode === 'dungeon' ?
            this.dungeon.getTile(tileX, tileY) :
            this.world.getTile(tileX, tileY);

        // Log facing tile with additional info about structures
        let tileInfo = tile?.value ?? 'UNKNOWN';

        if (this.camera.renderingMode === 'world') {
            // World-specific tile info
            if (tile?.trees && tile.trees.length > 0) {
                const tree = tile.trees[0];
                tileInfo += ` (Tree: ${tree?.getHealth()}/${tree?.getMaxHealth()} HP)`;
            }
            if (tile?.cactus && tile.cactus.length > 0) {
                const cactus = tile.cactus[0];
                tileInfo += ` (Cactus: ${cactus?.getHealth()}/${cactus?.getMaxHealth()} HP, Variant: ${cactus?.getVariant()})`;
            }

            // Check for NPCs in world
            const npc = this.world.getNPCAt(tileX, tileY);
            if (npc) {
                tileInfo += ` (${npc.type}: ${npc.health}/${npc.maxHealth} HP)`;
            }
        } else {
            // Dungeon-specific tile info
            if (tile?.villageStructures && tile.villageStructures.length > 0) {
                const dungeonStructures = tile.villageStructures.map(s =>
                    s.poi ? s.poi.type : s.npc ? `${s.npc.type} Monster` : 'unknown'
                ).join(', ');
                tileInfo += ` (Dungeon: ${dungeonStructures})`;
            }
        }

        console.log(`Facing tile: ${tileInfo}`);
    }

    private logPlayerMovement(): void {
        const playerTileX = Math.floor(this.gameState.player.position.x / WorldGenerator.TILE_SIZE);
        const playerTileY = Math.floor(this.gameState.player.position.y / WorldGenerator.TILE_SIZE);

        // Log player position
        const playerPosLog = `Player: (${playerTileX}, ${playerTileY})`;
        this.camera.uiManager.addConsoleLog(playerPosLog);

        // Find and log nearest village well
        const nearestWell = this.findNearestStructure(playerTileX, playerTileY, 'water_well');
        if (nearestWell) {
            const wellTileX = Math.floor(nearestWell.position.x / WorldGenerator.TILE_SIZE);
            const wellTileY = Math.floor(nearestWell.position.y / WorldGenerator.TILE_SIZE);
            const wellLog = `Nearest Well: (${wellTileX}, ${wellTileY})`;
            this.camera.uiManager.addConsoleLog(wellLog);
        }

        // Find and log nearest dungeon entrance
        const nearestDungeon = this.findNearestStructure(playerTileX, playerTileY, 'dungeon_entrance');
        if (nearestDungeon) {
            const dungeonTileX = Math.floor(nearestDungeon.position.x / WorldGenerator.TILE_SIZE);
            const dungeonTileY = Math.floor(nearestDungeon.position.y / WorldGenerator.TILE_SIZE);
            const dungeonLog = `Nearest Dungeon: (${dungeonTileX}, ${dungeonTileY})`;
            this.camera.uiManager.addConsoleLog(dungeonLog);
        }
    }

    private findNearestStructure(playerTileX: number, playerTileY: number, structureType: string): { position: { x: number; y: number } } | null {
        let nearestStructure: { position: { x: number; y: number } } | null = null;
        let nearestDistance = Infinity;

        // Search in expanding radius around player
        const maxSearchRadius = 100; // Search up to 100 tiles away

        for (let radius = 1; radius <= maxSearchRadius; radius++) {
            // Check tiles in a square pattern around the player
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Only check the perimeter of the current radius
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

                    const checkTileX = playerTileX + dx;
                    const checkTileY = playerTileY + dy;

                    const tile = this.world.getTile(checkTileX, checkTileY);
                    if (tile.villageStructures) {
                        for (const structure of tile.villageStructures) {
                            if (structure.type === structureType ||
                                (structure.poi && structure.poi.type === structureType)) {
                                const distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance
                                if (distance < nearestDistance) {
                                    nearestDistance = distance;
                                    nearestStructure = structure;
                                    // Return immediately since we're searching in expanding radius
                                    return nearestStructure;
                                }
                            }
                        }
                    }
                }
            }
        }

        return nearestStructure;
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

    private handleEntityDeaths(): void {
        // Check if player died
        if (this.player.health <= 0) {
            console.log('💀 Player has died!');

            // Get player's current inventory items
            const playerInventory: (InventoryItem | null)[] = [];
            for (let i = 0; i < 9; i++) {
                const item = this.player.inventory.getItem(i);
                playerInventory.push(item);
            }

            // Create tombstone at player's current position
            this.world.handlePlayerDeath(this.player.position, playerInventory);

            // Clear player inventory by creating a new one
            this.player.inventory = new Inventory();

            // Respawn player at 0,0
            this.player.position = { x: 0, y: 0 };
            this.gameState.player.position = { x: 0, y: 0 };
            this.player.health = this.player.maxHealth; // Full health on respawn

            console.log('🔄 Player respawned at (0, 0) with full health and empty inventory');
        }

        // Check for dead NPCs in visible area
        const viewRadiusInTiles = 20;
        const playerTileX = Math.floor(this.gameState.player.position.x / WorldGenerator.TILE_SIZE);
        const playerTileY = Math.floor(this.gameState.player.position.y / WorldGenerator.TILE_SIZE);

        for (let dx = -viewRadiusInTiles; dx <= viewRadiusInTiles; dx++) {
            for (let dy = -viewRadiusInTiles; dy <= viewRadiusInTiles; dy++) {
                const checkX = playerTileX + dx;
                const checkY = playerTileY + dy;
                const npc = this.world.getNPCAt(checkX, checkY);

                if (npc?.isDead()) {
                    // Handle different death types
                    if (npc.category === 'animal') {
                        // Animals killed by player - add inventory directly to player
                        this.world.handleAnimalDeath(npc, this.player.position, this.player.inventory);
                    } else {
                        // Traders and monsters - create tombstone
                        this.world.handleNPCDeath(npc, npc.position);
                    }
                }
            }
        }
    }

    private handleTakeAllTombstoneItems(): void {
        const tombstone = this.camera.uiManager.getCurrentTombstone();
        if (!tombstone) return;

        console.log('Taking all items from tombstone...');
        let itemsTransferred = 0;

        // Transfer all items to player inventory
        for (let i = 0; i < tombstone.inventory.length; i++) {
            const item = tombstone.inventory[i];
            if (item) {
                const added = this.player.addToInventory(item.type, item.quantity);
                if (added) {
                    tombstone.removeItem(i);
                    itemsTransferred++;
                    console.log(`🎒 Added ${item.quantity}x ${item.type} from tombstone to player inventory`);
                } else {
                    console.log(`🎒 Could not add ${item.quantity}x ${item.type} to player inventory - full!`);
                }
            }
        }

        if (itemsTransferred > 0) {
            console.log(`✅ Transferred ${itemsTransferred} items from tombstone`);
        }

        // Check if tombstone is empty and remove it
        if (tombstone.isEmpty()) {
            const tileX = Math.floor(tombstone.position.x / WorldGenerator.TILE_SIZE);
            const tileY = Math.floor(tombstone.position.y / WorldGenerator.TILE_SIZE);
            this.world.removeTombstone(tileX, tileY);
            this.camera.uiManager.hideTombstoneUI();
            console.log('💀 Tombstone emptied and removed');
        }
    }

    private handleTakeSelectedTombstoneItem(): void {
        const tombstone = this.camera.uiManager.getCurrentTombstone();
        if (!tombstone) return;

        const selectedSlot = this.camera.uiManager.getTombstoneSelectedSlot();
        const item = tombstone.inventory[selectedSlot];

        if (!item) {
            console.log('No item in selected slot');
            return;
        }

        console.log(`Taking ${item.quantity}x ${item.type} from tombstone slot ${selectedSlot + 1}...`);

        const added = this.player.addToInventory(item.type, item.quantity);
        if (added) {
            tombstone.removeItem(selectedSlot);
            console.log(`🎒 Added ${item.quantity}x ${item.type} from tombstone to player inventory`);

            // Check if tombstone is empty and remove it
            if (tombstone.isEmpty()) {
                const tileX = Math.floor(tombstone.position.x / WorldGenerator.TILE_SIZE);
                const tileY = Math.floor(tombstone.position.y / WorldGenerator.TILE_SIZE);
                this.world.removeTombstone(tileX, tileY);
                this.camera.uiManager.hideTombstoneUI();
                console.log('💀 Tombstone emptied and removed');
            }
        } else {
            console.log(`🎒 Could not add ${item.quantity}x ${item.type} to player inventory - full!`);
        }
    }

    private findNearestUnoccupiedTile(position: { x: number; y: number }, mode: 'world' | 'dungeon'): { x: number; y: number } {
        const targetTileX = Math.floor(position.x / WorldGenerator.TILE_SIZE);
        const targetTileY = Math.floor(position.y / WorldGenerator.TILE_SIZE);

        // Search in expanding radius around the target position
        const maxSearchRadius = 10; // Search up to 10 tiles away

        for (let radius = 0; radius <= maxSearchRadius; radius++) {
            // Check tiles in a square pattern around the target position
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Only check the perimeter of the current radius (except for radius 0)
                    if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

                    const checkTileX = targetTileX + dx;
                    const checkTileY = targetTileY + dy;

                    // Check if this tile is passable
                    if (this.isTilePassable(checkTileX, checkTileY, mode)) {
                        return {
                            x: checkTileX * WorldGenerator.TILE_SIZE,
                            y: checkTileY * WorldGenerator.TILE_SIZE
                        };
                    }
                }
            }
        }

        // Fallback to original position if no passable tile found
        return position;
    }

    private isTilePassable(tileX: number, tileY: number, mode: 'world' | 'dungeon'): boolean {
        if (mode === 'dungeon') {
            const tile = this.dungeon.getTile(tileX, tileY);
            if (!tile || tile.value === 'VOID') return false;

            // Check for impassable structures
            if (tile.villageStructures && tile.villageStructures.length > 0) {
                for (const structure of tile.villageStructures) {
                    if (structure.poi && !structure.poi.passable) return false;
                    if (structure.npc && !structure.npc.isDead()) return false;
                }
            }
            return true;
        } else {
            const tile = this.world.getTile(tileX, tileY);
            if (!tile) return false;

            // Check world passability rules
            if (tile.value === 'DEEP_WATER' || tile.value === 'SHALLOW_WATER' ||
                tile.value === 'STONE' || tile.value === 'COBBLESTONE' || tile.value === 'SNOW') return false;

            // Check for living trees
            if (tile.trees?.some(tree => tree.getHealth() > 0)) return false;

            // Check for living cactus
            if (tile.cactus?.some(cactus => cactus.getHealth() > 0)) return false;

            // Check for impassable structures
            if (tile.villageStructures && tile.villageStructures.length > 0) {
                for (const structure of tile.villageStructures) {
                    if (structure.poi && !structure.poi.passable) return false;
                    if (structure.npc && !structure.npc.isDead()) return false;
                }
            }
            return true;
        }
    }

    private handleMonsterAttacks(): void {
        // Check for monsters adjacent to player that are attacking
        const playerTileX = Math.floor(this.gameState.player.position.x / WorldGenerator.TILE_SIZE);
        const playerTileY = Math.floor(this.gameState.player.position.y / WorldGenerator.TILE_SIZE);

        // Check all adjacent tiles for attacking monsters
        const adjacentOffsets = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
        ];

        for (const offset of adjacentOffsets) {
            const checkX = playerTileX + offset.dx;
            const checkY = playerTileY + offset.dy;

            // Get NPC from appropriate tile source based on rendering mode
            let npc = null;
            if (this.camera.renderingMode === 'dungeon') {
                const tile = this.dungeon.getTile(checkX, checkY);
                if (tile?.villageStructures) {
                    const structure = tile.villageStructures.find(s => s.npc && !s.npc.isDead());
                    npc = structure?.npc ?? null;
                }
            } else {
                npc = this.world.getNPCAt(checkX, checkY);
            }

            // If there's a monster that's attacking and targeting the player
            if (npc && npc.category === 'monster' && npc.isCurrentlyAttacking() && npc.getAttackTarget()) {
                const attackTarget = npc.getAttackTarget();
                if (attackTarget) {
                    const targetTileX = Math.floor(attackTarget.x / WorldGenerator.TILE_SIZE);
                    const targetTileY = Math.floor(attackTarget.y / WorldGenerator.TILE_SIZE);

                    // Check if monster is attacking the player's tile
                    if (targetTileX === playerTileX && targetTileY === playerTileY) {
                        console.log(`🗡️ ${npc.type} attacks player!`);
                        this.player.takeDamage(5); // Monsters deal 5 damage
                    }
                }
            }
        }
    }
}