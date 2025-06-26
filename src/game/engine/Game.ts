import type { GameState, PlayerState, VillageStructure, POILike, NPCLike, Tile } from './types';
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
import { Mine } from '../world/Mine';
import { LightingSystem } from '../systems/LightingSystem';
import { Chest } from '../entities/poi/Chest';
import { type NPC } from '../entities/npc/NPC';

import { PlayerScoreSystem } from '~/game/systems/PlayerScoreSystem';
import { getAnimalSound } from '../translations/animals';
import { getMonsterSound } from '../translations/monsters';
import { getTraderGreeting } from '../translations/traders';
import { generateVillageNotice } from '../translations/villages';

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
    private mine!: Mine;
    private animationSystem!: AnimationSystem;
    private uiManager!: UIManager;
    private playerScoreSystem!: PlayerScoreSystem;
    private lightingSystem!: LightingSystem;

    private canvas: HTMLCanvasElement;
    private player!: PlayerEntity;
    private portalDiscoveryShown = false; // Track if portal discovery message was shown

    constructor(canvas: HTMLCanvasElement, seed?: string, playerName?: string) {
        this.canvas = canvas;
        this.controls = new Controls(canvas);
        this.initializeGame(seed, playerName);
    }

    private initializeGame(seed?: string, playerName?: string): void {
        // Initialize player entity
        this.player = new PlayerEntity({
            position: { x: 0, y: 0 },
            health: 100,
            attackDamage: 5,
            name: playerName
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
        this.mine = new Mine(seed);
        this.movement = new Movement(this.world, this.dungeon, this.mine, this.camera);
        this.animationSystem = new AnimationSystem();
        this.uiManager = new UIManager(this.canvas);
        this.playerScoreSystem = new PlayerScoreSystem();
        this.lightingSystem = new LightingSystem();

        // Connect UI systems
        this.camera.uiManager.setInventory(this.player.inventory);

        // Set player name in UI manager
        this.camera.uiManager.setPlayerName(this.player.getName());

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

        // Connect lighting system to world systems
        this.dungeon.setLightingSystem(this.lightingSystem);
        this.mine.setLightingSystem(this.lightingSystem);
        this.world.setLightingSystem(this.lightingSystem);

        // Set up tile provider for lighting system
        this.lightingSystem.setTileProvider((x: number, y: number, mode: 'world' | 'dungeon' | 'mine') => {
            if (mode === 'dungeon') {
                const tile = this.dungeon.getTile(x, y);
                return tile as Tile | null;
            } else if (mode === 'mine') {
                return this.mine.getTile(x, y);
            } else {
                const tile = this.world.getTile(x, y);
                return tile as Tile | null;
            }
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
            // Get wearable items from UI manager for health regeneration
            const wearableItems = this.camera.uiManager.getWearableItems();

            // Only update player animation and clear controls when UI is open
            this.player.update(deltaTime, wearableItems);
            this.controls.clearJustPressed();
            return;
        }

        // Handle mouse input
        this.handleMouseInput();

        // Update movement system
        this.movement.update(this.gameState.player, this.controls);

        // Get wearable items from UI manager
        const wearableItems = this.camera.uiManager.getWearableItems();

        // Update player animation and health regeneration
        this.player.update(deltaTime, wearableItems);

        // Debug: Log player health every few seconds when low
        if (this.player.health < 50) {
            console.log(`⚠️ Player health low: ${this.player.health.toFixed(1)}/${this.player.maxHealth}`);
        }

        // Update UI animations
        this.camera.uiManager.update(deltaTime);

        // Update camera
        this.camera.update(this.gameState.player.position);

        // Update systems
        this.animationSystem.update(deltaTime);
        this.lightingSystem.update(deltaTime);

        // Update underground systems
        const inventoryItems = this.gameState.player.inventory.filter(item => item !== null);
        if (this.camera.renderingMode === 'dungeon') {
            this.dungeon.update(deltaTime, this.gameState.player.position, inventoryItems, this.camera);
        } else if (this.camera.renderingMode === 'mine') {
            this.mine.update(deltaTime, this.gameState.player.position, inventoryItems, this.camera);
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
        } else if (this.camera.renderingMode === 'mine') {
            this.mine.render(ctx, this.camera);
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
        } else if (this.camera.renderingMode === 'mine') {
            // Render mine health bars when in mine mode
            this.mine.renderHealthBars(ctx, this.camera);
        }

        this.renderPlayerHealthBar(ctx);

        // Render lighting effects and darkness overlay
        this.lightingSystem.renderDarknessOverlay(ctx, this.camera, this.camera.renderingMode);

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
        // Handle ESC key to close any open UI components or open menu
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
            if (this.camera.uiManager.isChestUIVisible()) {
                this.camera.uiManager.hideChestUI();
                return;
            }
            if (this.camera.uiManager.isMenuUIVisible()) {
                this.camera.uiManager.hideMenuUI();
                return;
            }
            // If no UI is open, open the menu
            this.camera.uiManager.showMenuUI();
            return;
        }

        // Handle menu UI navigation and actions
        if (this.camera.uiManager.isMenuUIVisible()) {
            // Handle menu navigation with up/down arrows
            if (this.controls.wasKeyJustPressed('up')) {
                this.camera.uiManager.navigateMenu('up');
                return;
            }
            if (this.controls.wasKeyJustPressed('down')) {
                this.camera.uiManager.navigateMenu('down');
                return;
            }

            // Handle menu selection with Enter key
            if (this.controls.wasKeyJustPressed('interact') || this.controls.wasKeyJustPressed('inventory')) {
                const selectedOption = this.camera.uiManager.getSelectedMenuOption();
                if (selectedOption === 'Back to Game') {
                    this.camera.uiManager.hideMenuUI();
                } else if (selectedOption === 'Save Game') {
                    this.saveGame();
                    this.camera.uiManager.hideMenuUI();
                }
                return;
            }

            // Don't process other actions while menu is visible
            return;
        }

        // Handle tombstone UI navigation and actions
        if (this.camera.uiManager.isTombstoneUIVisible()) {
            // Handle tombstone navigation with arrow keys (all four directions)
            if (this.controls.wasKeyJustPressed('left')) {
                this.camera.uiManager.navigateTombstoneInventory('left');
                return;
            }
            if (this.controls.wasKeyJustPressed('right')) {
                this.camera.uiManager.navigateTombstoneInventory('right');
                return;
            }
            if (this.controls.wasKeyJustPressed('up')) {
                this.camera.uiManager.navigateTombstoneInventory('up');
                return;
            }
            if (this.controls.wasKeyJustPressed('down')) {
                this.camera.uiManager.navigateTombstoneInventory('down');
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

        // Handle chest UI actions
        if (this.camera.uiManager.isChestUIVisible()) {
            // Handle arrow key navigation
            if (this.controls.wasKeyJustPressed('left')) {
                this.camera.uiManager.navigateChestInventory('left');
                return;
            }
            if (this.controls.wasKeyJustPressed('right')) {
                this.camera.uiManager.navigateChestInventory('right');
                return;
            }
            if (this.controls.wasKeyJustPressed('up')) {
                this.camera.uiManager.navigateChestInventory('up');
                return;
            }
            if (this.controls.wasKeyJustPressed('down')) {
                this.camera.uiManager.navigateChestInventory('down');
                return;
            }

            // Handle take all items (Z key)
            if (this.controls.wasKeyJustPressed('take_all')) {
                this.handleTakeAllChestItems();
                return;
            }

            // Handle take selected item (X key)
            if (this.controls.wasKeyJustPressed('take_selected')) {
                this.handleTakeSelectedChestItem();
                return;
            }

            // Handle close chest UI (F key)
            if (this.controls.wasKeyJustPressed('interact')) {
                this.camera.uiManager.hideChestUI();
                return;
            }

            // Don't process other actions while chest UI is visible
            return;
        }

        // Handle keyboard input to dismiss text box
        if (this.camera.uiManager.isTextBoxVisible()) {
            // Check if F key specifically was pressed (for interact dismissal)
            if (this.controls.wasKeyJustPressed('interact')) {
                this.camera.uiManager.hideTextBox();
                // Set flag to prevent further processing of this interact keypress
                this.portalDiscoveryShown = true;
                return;
            }
            // Any other key press dismisses the text box
            if (this.controls.wasAnyKeyPressed() && !this.controls.wasKeyJustPressed('interact')) {
                this.camera.uiManager.hideTextBox();
                return;
            }
            return; // Don't process other actions while text box is visible
        }

        // Handle inventory UI actions
        if (this.camera.uiManager.isInventoryUIVisible()) {
            // Handle arrow key navigation in player inventory UI
            if (this.controls.wasKeyJustPressed('up')) {
                this.camera.uiManager.navigatePlayerInventory('up');
                return;
            }
            if (this.controls.wasKeyJustPressed('down')) {
                this.camera.uiManager.navigatePlayerInventory('down');
                return;
            }
            if (this.controls.wasKeyJustPressed('left')) {
                this.camera.uiManager.navigatePlayerInventory('left');
                return;
            }
            if (this.controls.wasKeyJustPressed('right')) {
                this.camera.uiManager.navigatePlayerInventory('right');
                return;
            }

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

        // DEBUG: Force player death for testing (K key)
        if (this.controls.wasKeyJustPressed('k')) {
            console.log('🧪 DEBUG: Forcing player death for tombstone testing');
            this.player.health = 0;
            console.log(`🧪 DEBUG: Player health set to ${this.player.health}, will trigger death on next update`);
        }

        // DEBUG: Test player damage and health bar (H key)
        if (this.controls.wasKeyJustPressed('h')) {
            console.log('🧪 DEBUG: Testing player damage and health bar');
            this.player.takeDamage(10);
            console.log(`🧪 DEBUG: Player took 10 damage. Health: ${this.player.health}/${this.player.maxHealth}`);
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

        console.log(`Player attack damage: ${this.player.attackDamage}`);
        console.log(`Attacking tile at (${tileX}, ${tileY}) in ${this.camera.renderingMode} mode`);

        if (this.camera.renderingMode === 'world') {
            // World mode attacks - trees, cactus, and NPCs
            const tile = this.world.getTile(tileX, tileY);

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
                return;
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
                return;
            }

            // Check for world NPCs
            const npc = this.world.getNPCAt(tileX, tileY);
            if (npc) {
                // Track score based on NPC category and village area
                const nearestVillage = this.playerScoreSystem.findNearestVillage(this.gameState.player.position);

                if (nearestVillage && this.playerScoreSystem.isInVillageArea(this.gameState.player.position, nearestVillage)) {
                    if (npc.category === 'monster') {
                        // Positive score for killing monsters in village area
                        this.playerScoreSystem.onMonsterKilled(nearestVillage);
                    } else if (npc.category === 'animal') {
                        // Negative score for attacking village animals
                        this.playerScoreSystem.onAnimalAttacked(nearestVillage);
                    } else if (npc.category === 'friendly') {
                        // Negative score for attacking village traders
                        this.playerScoreSystem.onTraderAttacked(nearestVillage);
                    }
                }

                console.log(`🗡️ Attacking ${npc.type} (${npc.health}/${npc.maxHealth} HP)`);
                npc.takeDamage(this.player.attackDamage);

                if (npc.isDead()) {
                    console.log(`💀 ${npc.type} defeated!`);
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
                return;
            }

        } else if (this.camera.renderingMode === 'dungeon') {
            // Dungeon mode attacks - monsters only
            const tile = this.dungeon.getTile(tileX, tileY);
            if (tile?.villageStructures) {
                for (const structure of tile.villageStructures) {
                    if (structure.npc && !structure.npc.isDead()) {
                        const npc = structure.npc as NPC;
                        console.log(`🗡️ Attacking ${npc.type} (${npc.health}/${npc.maxHealth} HP) in dungeon`);
                        npc.takeDamage(this.player.attackDamage);

                        if (npc.isDead()) {
                            console.log(`💀 ${npc.type} defeated in dungeon!`);
                            // Monsters in dungeons drop their inventory items directly to player
                            for (let i = 0; i < 9; i++) {
                                const item = npc.inventory.getItem(i);
                                if (item) {
                                    const added = this.player.addToInventory(item.type, item.quantity);
                                    if (added) {
                                        console.log(`✅ Added ${item.quantity} ${item.type} from ${npc.type}`);
                                    } else {
                                        console.log(`❌ Inventory full! Could not add ${item.quantity} ${item.type}`);
                                    }
                                }
                            }
                        }
                        return;
                    }
                }
            }

        } else if (this.camera.renderingMode === 'mine') {
            // Mine mode attacks - bandits only
            const tile = this.mine.getTile(tileX, tileY);
            if (tile?.villageStructures) {
                for (const structure of tile.villageStructures) {
                    if (structure.npc && !structure.npc.isDead()) {
                        const npc = structure.npc as NPC;
                        console.log(`🗡️ Attacking ${npc.type} (${npc.health}/${npc.maxHealth} HP) in mine`);
                        npc.takeDamage(this.player.attackDamage);

                        if (npc.isDead()) {
                            console.log(`💀 ${npc.type} defeated in mine!`);
                            // Bandits in mines drop their inventory items directly to player
                            for (let i = 0; i < 9; i++) {
                                const item = npc.inventory.getItem(i);
                                if (item) {
                                    const added = this.player.addToInventory(item.type, item.quantity);
                                    if (added) {
                                        console.log(`✅ Added ${item.quantity} ${item.type} from ${npc.type}`);
                                    } else {
                                        console.log(`❌ Inventory full! Could not add ${item.quantity} ${item.type}`);
                                    }
                                }
                            }
                        }
                        return;
                    }
                }
            }
        }

        console.log('Nothing to attack in that direction');
    }

    private handleInteract(): void {
        // Check if we just dismissed a textbox with F key - if so, skip this interaction
        if (this.portalDiscoveryShown) {
            this.portalDiscoveryShown = false;
            return;
        }

        const facingPos = this.player.getFacingPosition(WorldGenerator.TILE_SIZE);
        const tileX = Math.floor(facingPos.x / WorldGenerator.TILE_SIZE);
        const tileY = Math.floor(facingPos.y / WorldGenerator.TILE_SIZE);

        // Get tile from appropriate source based on rendering mode
        let tile;
        if (this.camera.renderingMode === 'dungeon') {
            tile = this.dungeon.getTile(tileX, tileY);
        } else if (this.camera.renderingMode === 'mine') {
            tile = this.mine.getTile(tileX, tileY);
        } else {
            tile = this.world.getTile(tileX, tileY);
        }

        console.log(`Interacting with tile at (${tileX}, ${tileY}):`, tile?.value, `Mode: ${this.camera.renderingMode}`);

        if (this.camera.renderingMode === 'world') {
            // World-specific interactions

            // Check for tombstone interaction first
            const tombstone = this.world.getTombstoneAt(tileX, tileY);
            if (tombstone) {
                console.log(`Interacting with tombstone: ${tombstone.getDisplayName()}`);
                this.camera.uiManager.showTombstoneUI(tombstone);
                return;
            }

            // Check for chest interaction
            const chest = this.world.getChestAt(tileX, tileY);
            if (chest) {
                console.log(`Interacting with chest: ${chest.getDisplayName()}`);
                this.camera.uiManager.showChestUI(chest);
                return;
            }

            // Check for POI structures
            const poi = this.world.getPOIAt(tileX, tileY);
            if (poi?.type === 'notice_board') {
                console.log('Interacting with notice board');

                // Get village name from POI data or find nearest village
                const villageName = poi.customData?.villageName as string ?? 'Unknown Village';

                // Generate random village notice using translation system
                const villageNotice = generateVillageNotice(villageName);

                this.camera.uiManager.showTextBox({
                    text: villageNotice.text,
                    title: villageNotice.title,
                    villageName: villageName
                });
                return;
            }

            if (poi?.type === 'dungeon_entrance') {
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
                return;
            }

            if (poi?.type === 'mine_entrance') {
                console.log('⛏️ Interacting with mine entrance - entering mine');

                // Store entrance position for mine generation
                const entranceWorldPos = { x: tileX * WorldGenerator.TILE_SIZE, y: tileY * WorldGenerator.TILE_SIZE };
                this.camera.setMineEntrance(entranceWorldPos);
                this.mine.setEntrancePosition(entranceWorldPos);
                this.camera.setRenderingMode('mine');

                // Find nearest unoccupied tile to entrance position in mine
                const spawnPosition = this.findNearestUnoccupiedTile(entranceWorldPos, 'mine');
                this.player.position = spawnPosition;
                this.gameState.player.position = spawnPosition;
                this.camera.centerOnPlayer();
                return;
            }

            // Check for NPCs (trader interaction)
            const npc = this.world.getNPCAt(tileX, tileY);
            if (npc && npc.category === 'friendly') {
                console.log(`Interacting with trader: ${npc.type}`);

                // Use trader translation system for greeting
                const greeting = getTraderGreeting(npc.type);

                // Find nearest village and get trader comment based on score
                const nearestVillage = this.playerScoreSystem.findNearestVillage(this.gameState.player.position);
                let villageName = "Unknown Village";

                if (nearestVillage) {
                    const villageScore = this.playerScoreSystem.getVillageScore(nearestVillage);
                    if (villageScore) {
                        villageName = villageScore.villageName;
                    }
                }

                this.camera.uiManager.showTextBox({
                    text: greeting,
                    title: `Trader in ${villageName}`,
                    villageName: villageName
                });
                return;
            }

            // Check for animal interactions
            if (npc && npc.category === 'animal') {
                console.log(`Interacting with animal: ${npc.type}`);

                const animalSound = getAnimalSound(npc.type);

                this.camera.uiManager.showTextBox({
                    text: animalSound,
                    title: `${npc.type.charAt(0).toUpperCase() + npc.type.slice(1)}`,
                    villageName: ''
                });
                return;
            }

            // Check for monster interactions
            if (npc && npc.category === 'monster') {
                console.log(`Interacting with monster: ${npc.type}`);

                const monsterSound = getMonsterSound(npc.type);

                this.camera.uiManager.showTextBox({
                    text: monsterSound,
                    title: `${npc.type.charAt(0).toUpperCase() + npc.type.slice(1)}`,
                    villageName: ''
                });
                return;
            }

            // Check for other interactable structures (world tile specific properties)
            if (tile && 'trees' in tile && tile.trees && tile.trees.length > 0) {
                console.log('Interacting with tree - could harvest fruit, check growth, etc.');
            } else if (tile && 'cactus' in tile && tile.cactus && tile.cactus.length > 0) {
                console.log('Interacting with cactus - could harvest water, check growth, etc.');
            } else {
                console.log('Nothing to interact with in that direction');
            }
        } else if (this.camera.renderingMode === 'dungeon' || this.camera.renderingMode === 'mine') {
            // Underground interactions (dungeon or mine)

            // Check for tombstone interaction first (works in both dungeon and mine)
            let tombstone = null;
            if (this.camera.renderingMode === 'dungeon') {
                tombstone = this.dungeon.getTombstoneAt(tileX, tileY);
            } else if (this.camera.renderingMode === 'mine') {
                tombstone = this.mine.getTombstoneAt(tileX, tileY);
            }

            if (tombstone) {
                console.log(`Interacting with tombstone: ${tombstone.getDisplayName()}`);
                this.camera.uiManager.showTombstoneUI(tombstone);
                return;
            }

            // Check for underground POI structures
            if (tile && 'villageStructures' in tile && tile.villageStructures) {
                for (const structure of tile.villageStructures) {
                    if (structure?.poi) {
                        const poi = structure.poi;

                        if (poi.type === 'rare_chest') {
                            console.log('🏺 Interacting with rare chest in dungeon');

                            // Create chest object from POI data
                            const chestInventory = poi.customData?.inventory as (InventoryItem | null)[] ?? [];
                            const chestId = poi.customData?.chestId as string ?? `chest_${tileX}_${tileY}`;

                            // Create a proper Chest instance for UI interaction
                            const chest = new Chest({
                                position: poi.position,
                                inventory: chestInventory,
                                chestType: 'rare_chest',
                                chestId: chestId
                            });

                            this.camera.uiManager.showChestUI(chest);
                            return;
                        }

                        if (poi.type === 'normal_chest') {
                            console.log('📦 Interacting with chest in underground area');

                            // Create chest object from POI data
                            const chestInventory = poi.customData?.inventory as (InventoryItem | null)[] ?? [];
                            const chestId = poi.customData?.chestId as string ?? `chest_${tileX}_${tileY}`;

                            // Create a proper Chest instance for UI interaction
                            const chest = new Chest({
                                position: poi.position,
                                inventory: chestInventory,
                                chestType: 'normal_chest',
                                chestId: chestId
                            });

                            this.camera.uiManager.showChestUI(chest);
                            return;
                        }

                        if (poi.type === 'dungeon_entrance') {
                            console.log('🏚️ Interacting with dungeon entrance - returning to surface');
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

                        if (poi.type === 'mine_entrance') {
                            console.log('⛏️ Interacting with mine entrance - returning to surface');
                            this.camera.setRenderingMode('world');

                            // Return player to entrance position on surface
                            if (this.camera.mineEntrancePosition) {
                                const spawnPosition = this.findNearestUnoccupiedTile(this.camera.mineEntrancePosition, 'world');
                                this.player.position = spawnPosition;
                                this.gameState.player.position = spawnPosition;
                                this.camera.centerOnPlayer();
                            }
                            return;
                        }

                        if (poi.type === 'dungeon_portal' && !poi.customData?.discovered) {
                            console.log('🚪 Interacting with dungeon portal - showing discovery message');

                            // Show random portal discovery quote and mark portal as discovered
                            void import('../translations/portals').then(({ getPortalDiscoveryQuote }) => {
                                const randomQuote = getPortalDiscoveryQuote();

                                this.camera.uiManager.showTextBox({
                                    text: randomQuote + '\n\nYou have discovered an ancient portal!',
                                    title: 'Portal Discovery!'
                                });
                            });

                            // Mark portal as discovered for next interaction
                            if (poi.customData) {
                                poi.customData.discovered = true;
                            } else {
                                poi.customData = { discovered: true };
                            }
                            return;
                        }

                        if (poi.type === 'dungeon_portal' && poi.customData?.discovered) {
                            console.log('🚪 Interacting with discovered dungeon portal - showing message only');

                            // For now, just show a message - no teleportation
                            this.camera.uiManager.showTextBox({
                                text: 'The portal shimmers with magical energy, but its power seems dormant for now...',
                                title: 'Ancient Portal'
                            });
                            return;
                        }
                    }
                }
            }

            console.log('Nothing to interact with in that direction');
        }
    }

    private logFacingTile(): void {
        const facingPos = this.player.getFacingPosition(WorldGenerator.TILE_SIZE);
        const tileX = Math.floor(facingPos.x / WorldGenerator.TILE_SIZE);
        const tileY = Math.floor(facingPos.y / WorldGenerator.TILE_SIZE);

        // Get tile from appropriate source based on rendering mode
        let tile;
        if (this.camera.renderingMode === 'dungeon') {
            tile = this.dungeon.getTile(tileX, tileY);
        } else if (this.camera.renderingMode === 'mine') {
            tile = this.mine.getTile(tileX, tileY);
        } else {
            tile = this.world.getTile(tileX, tileY);
        }

        // Log facing tile with additional info about structures
        let tileInfo = tile?.value ?? 'UNKNOWN';

        if (this.camera.renderingMode === 'world') {
            // World-specific tile info
            if (tile && 'trees' in tile && tile.trees && tile.trees.length > 0) {
                const tree = tile.trees[0];
                if (tree && typeof tree === 'object' && 'getHealth' in tree && 'getMaxHealth' in tree) {
                    tileInfo += ` (Tree: ${tree.getHealth()}/${tree.getMaxHealth()} HP)`;
                }
            }
            if (tile && 'cactus' in tile && tile.cactus && tile.cactus.length > 0) {
                const cactus = tile.cactus[0];
                if (cactus && typeof cactus === 'object' && 'getHealth' in cactus && 'getMaxHealth' in cactus && 'getVariant' in cactus) {
                    tileInfo += ` (Cactus: ${cactus.getHealth()}/${cactus.getMaxHealth()} HP, Variant: ${String(cactus.getVariant())})`;
                }
            }

            // Check for NPCs in world
            const npc = this.world.getNPCAt(tileX, tileY);
            if (npc) {
                tileInfo += ` (${npc.type}: ${npc.health}/${npc.maxHealth} HP)`;
            }
        } else {
            // Dungeon-specific tile info
            if (tile && 'villageStructures' in tile && tile.villageStructures && tile.villageStructures.length > 0) {
                const dungeonStructures = tile.villageStructures.map((structure) =>
                    structure.poi ? structure.poi.type : structure.npc ? `${structure.npc.type} Monster` : 'unknown'
                ).join(', ');
                tileInfo += ` (Dungeon: ${dungeonStructures})`;
            }
        }

        console.log(`Facing tile: ${tileInfo}`);
    }

    private logPlayerMovement(): void {
        const playerTileX = Math.floor(this.gameState.player.position.x / WorldGenerator.TILE_SIZE);
        const playerTileY = Math.floor(this.gameState.player.position.y / WorldGenerator.TILE_SIZE);

        // Update persistent info with current player position
        this.camera.uiManager.updatePersistentInfo({
            playerPosition: { x: playerTileX, y: playerTileY },
            renderingMode: this.camera.renderingMode
        });

        // Find and update nearest structures
        const nearestWell = this.findNearestStructure(playerTileX, playerTileY, 'water_well');
        const nearestMine = this.findNearestStructure(playerTileX, playerTileY, 'mine_entrance');
        const nearestDungeon = this.findNearestStructure(playerTileX, playerTileY, 'dungeon_entrance');

        // Update persistent info with nearest structures
        this.camera.uiManager.updatePersistentInfo({
            nearestWell: nearestWell ? {
                x: Math.floor(nearestWell.position.x / WorldGenerator.TILE_SIZE),
                y: Math.floor(nearestWell.position.y / WorldGenerator.TILE_SIZE)
            } : null,
            nearestMine: nearestMine ? {
                x: Math.floor(nearestMine.position.x / WorldGenerator.TILE_SIZE),
                y: Math.floor(nearestMine.position.y / WorldGenerator.TILE_SIZE)
            } : null,
            nearestDungeon: nearestDungeon ? {
                x: Math.floor(nearestDungeon.position.x / WorldGenerator.TILE_SIZE),
                y: Math.floor(nearestDungeon.position.y / WorldGenerator.TILE_SIZE)
            } : null
        });

        // If in dungeon mode, find nearest portal
        if (this.camera.renderingMode === 'dungeon') {
            const nearestPortal = this.findNearestDungeonPortal(playerTileX, playerTileY);
            this.camera.uiManager.updatePersistentInfo({
                nearestPortal: nearestPortal ? {
                    x: Math.floor(nearestPortal.position.x / WorldGenerator.TILE_SIZE),
                    y: Math.floor(nearestPortal.position.y / WorldGenerator.TILE_SIZE)
                } : null
            });
        }

        // Legacy console log calls for backwards compatibility
        const playerPosLog = `Player: (${playerTileX}, ${playerTileY})`;
        this.camera.uiManager.addConsoleLog(playerPosLog);

        if (nearestWell) {
            const wellTileX = Math.floor(nearestWell.position.x / WorldGenerator.TILE_SIZE);
            const wellTileY = Math.floor(nearestWell.position.y / WorldGenerator.TILE_SIZE);
            const wellLog = `Nearest Well: (${wellTileX}, ${wellTileY})`;
            this.camera.uiManager.addConsoleLog(wellLog);
        }

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

    private findNearestDungeonPortal(playerTileX: number, playerTileY: number): { position: { x: number; y: number } } | null {
        // Get the cached portal position from the dungeon system
        const portalPosition = this.dungeon.getPortalPosition();

        if (portalPosition) {
            return { position: portalPosition };
        }

        // Fallback: search for portal if not cached (should not happen with new system)
        let nearestPortal: { position: { x: number; y: number } } | null = null;
        let nearestDistance = Infinity;

        // Search in a reasonable radius around the player for dungeon portals
        const searchRadius = 100; // Large search radius since dungeons can be big

        for (let x = playerTileX - searchRadius; x <= playerTileX + searchRadius; x++) {
            for (let y = playerTileY - searchRadius; y <= playerTileY + searchRadius; y++) {
                const tile = this.dungeon.getTile(x, y);
                if (tile?.villageStructures) {
                    for (const structure of tile.villageStructures) {
                        if (structure.poi?.type === 'dungeon_portal') {
                            const distance = Math.sqrt(Math.pow(x - playerTileX, 2) + Math.pow(y - playerTileY, 2));
                            if (distance < nearestDistance) {
                                nearestDistance = distance;
                                nearestPortal = { position: structure.position };
                            }
                        }
                    }
                }
            }
        }

        return nearestPortal;
    }

    public saveGame(): void {
        console.log('💾 Saving game...');

        try {
            const gameData = {
                player: {
                    position: this.gameState.player.position,
                    health: this.player.health,
                    inventory: this.player.getInventoryItems(),
                    selectedSlot: this.player.getSelectedSlot()
                },
                world: {
                    timestamp: Date.now()
                },
                version: '1.0.0'
            };

            const saveData = JSON.stringify(gameData);
            localStorage.setItem('world-sim-save', saveData);

            console.log('✅ Game saved successfully!');

            // Show save confirmation
            this.camera.uiManager.showTextBox({
                text: 'Game saved successfully!\n\nPress any key to continue...',
                title: 'Save Complete'
            });
        } catch (error) {
            console.error('❌ Failed to save game:', error);

            // Show save error
            this.camera.uiManager.showTextBox({
                text: 'Failed to save game. Please try again.\n\nPress any key to continue...',
                title: 'Save Error'
            });
        }
    }

    public loadGame(): void {
        console.log('📁 Loading game...');

        try {
            const saveData = localStorage.getItem('world-sim-save');
            if (!saveData) {
                console.log('No save data found');
                return;
            }

            console.log('✅ Save data found (load functionality not fully implemented yet)');

            // Show load message
            this.camera.uiManager.showTextBox({
                text: 'Save data found, but loading is not fully implemented yet.\n\nPress any key to continue...',
                title: 'Load Game'
            });

        } catch (error) {
            console.error('❌ Failed to load game:', error);
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

                    this.playerScoreSystem.initializeVillage(villageId, villageName);
                }
            }
        }
    }

    private handleEntityDeaths(): void {
        // Check if player died
        if (this.player.health <= 0) {
            console.log('💀 Player has died!');

            // Get player's current death position BEFORE any changes
            const deathPosition = { ...this.player.position };
            const deathTileX = Math.floor(deathPosition.x / WorldGenerator.TILE_SIZE);
            const deathTileY = Math.floor(deathPosition.y / WorldGenerator.TILE_SIZE);

            console.log(`💀 Player died at position (${deathPosition.x}, ${deathPosition.y}) - tile (${deathTileX}, ${deathTileY}) in ${this.camera.renderingMode} mode`);

            // Get player's current inventory items
            const playerInventory: (InventoryItem | null)[] = [];
            for (let i = 0; i < 9; i++) {
                const item = this.player.inventory.getItem(i);
                playerInventory.push(item);
            }

            // Create tombstone at player's death position based on current rendering mode
            if (this.camera.renderingMode === 'world') {
                console.log(`💀 Creating tombstone in WORLD at (${deathTileX}, ${deathTileY})`);
                this.world.handlePlayerDeath(deathPosition, playerInventory, this.player.getName());
            } else if (this.camera.renderingMode === 'dungeon') {
                console.log(`💀 Creating tombstone in DUNGEON at (${deathTileX}, ${deathTileY})`);
                this.dungeon.handlePlayerDeath(deathPosition, playerInventory, this.player.getName());
            } else if (this.camera.renderingMode === 'mine') {
                console.log(`💀 Creating tombstone in MINE at (${deathTileX}, ${deathTileY})`);
                this.mine.handlePlayerDeath(deathPosition, playerInventory, this.player.getName());
            }

            // Clear player inventory by creating a new one
            this.player.inventory = new Inventory();

            // Reset camera rendering mode back to world
            this.camera.setRenderingMode('world');

            // Respawn player at 0,0
            this.player.position = { x: 0, y: 0 };
            this.gameState.player.position = { x: 0, y: 0 };
            this.player.health = this.player.maxHealth; // Full health on respawn

            // Center camera on respawned player
            this.camera.centerOnPlayer();

            console.log('🔄 Player respawned at (0, 0) with full health, empty inventory, and returned to world surface');
        }

        // Check for dead NPCs in visible area based on current rendering mode
        const viewRadiusInTiles = 20;
        const playerTileX = Math.floor(this.gameState.player.position.x / WorldGenerator.TILE_SIZE);
        const playerTileY = Math.floor(this.gameState.player.position.y / WorldGenerator.TILE_SIZE);

        for (let dx = -viewRadiusInTiles; dx <= viewRadiusInTiles; dx++) {
            for (let dy = -viewRadiusInTiles; dy <= viewRadiusInTiles; dy++) {
                const checkX = playerTileX + dx;
                const checkY = playerTileY + dy;

                let npc = null;

                // Get NPC from appropriate tile source based on rendering mode
                if (this.camera.renderingMode === 'dungeon') {
                    const tile = this.dungeon.getTile(checkX, checkY);
                    if (tile?.villageStructures) {
                        const structure = tile.villageStructures.find(s => s.npc && !s.npc.isDead());
                        npc = structure?.npc ?? null;
                    }
                } else if (this.camera.renderingMode === 'mine') {
                    const tile = this.mine.getTile(checkX, checkY);
                    if (tile?.villageStructures) {
                        const structure = tile.villageStructures.find(s => s.npc && !s.npc.isDead());
                        npc = structure?.npc ?? null;
                    }
                } else {
                    npc = this.world.getNPCAt(checkX, checkY);
                }

                if (npc?.isDead()) {
                    // Handle different death types based on rendering mode
                    if (npc.category === 'animal') {
                        // Animals killed by player - add inventory directly to player
                        if (this.camera.renderingMode === 'world') {
                            this.world.handleAnimalDeath(npc, this.player.position, this.player.inventory);
                        } else if (this.camera.renderingMode === 'dungeon') {
                            this.dungeon.handleAnimalDeath(npc, this.player.position, this.player.inventory);
                        } else if (this.camera.renderingMode === 'mine') {
                            this.mine.handleAnimalDeath(npc, this.player.position, this.player.inventory);
                        }
                    } else {
                        // Traders and monsters - create tombstone
                        if (this.camera.renderingMode === 'world') {
                            this.world.handleNPCDeath(npc, npc.position);
                        } else if (this.camera.renderingMode === 'dungeon') {
                            this.dungeon.handleNPCDeath(npc, npc.position);
                        } else if (this.camera.renderingMode === 'mine') {
                            this.mine.handleNPCDeath(npc, npc.position);
                        }
                    }
                }
            }
        }
    }

    private handleTakeAllTombstoneItems(): void {
        const tombstone = this.camera.uiManager.getCurrentTombstone();
        if (!tombstone) return;

        const dualMode = this.camera.uiManager.getDualInventoryMode();

        if (dualMode === 'container') {
            // Transfer all items from tombstone to player
            console.log('Taking all items from tombstone...');
            let itemsTransferred = 0;

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
                        break; // Stop if inventory is full
                    }
                }
            }

            console.log(`✅ Transferred ${itemsTransferred} items from tombstone to player`);
        } else {
            // Transfer all items from player to tombstone
            console.log('Transferring all items from player to tombstone...');
            let itemsTransferred = 0;
            const playerInventory = this.player.getInventoryItems();

            for (const [i, item] of playerInventory.entries()) {
                if (item && item.quantity > 0) {
                    // Find empty slot in tombstone
                    const emptySlot = tombstone.inventory.findIndex(slot => slot === null);
                    if (emptySlot !== -1) {
                        tombstone.inventory[emptySlot] = { ...item }; // Copy item to tombstone
                        this.player.removeFromInventory(item.type, item.quantity); // Remove from player
                        console.log(`✅ Transferred ${item.quantity}x ${item.type} from player to tombstone`);
                        itemsTransferred++;
                    } else {
                        console.log(`❌ Tombstone full! Could not transfer ${item.quantity}x ${item.type}`);
                        break; // Stop if tombstone is full
                    }
                }
            }

            console.log(`✅ Transferred ${itemsTransferred} items from player to tombstone`);
        }

        // Update tombstone inventory in the appropriate system based on rendering mode
        const tileX = Math.floor(tombstone.position.x / WorldGenerator.TILE_SIZE);
        const tileY = Math.floor(tombstone.position.y / WorldGenerator.TILE_SIZE);

        if (this.camera.renderingMode === 'world') {
            // Update world tombstones map
            if (tombstone.isEmpty()) {
                this.world.removeTombstone(tileX, tileY);
                this.camera.uiManager.hideTombstoneUI();
                console.log('💀 Tombstone emptied and removed from world');
            }
        } else if (this.camera.renderingMode === 'dungeon') {
            // Update dungeon tombstone data
            this.dungeon.updateTombstoneInventory(tileX, tileY, tombstone.inventory);
            if (tombstone.isEmpty()) {
                this.dungeon.removeTombstone(tileX, tileY);
                this.camera.uiManager.hideTombstoneUI();
                console.log('💀 Tombstone emptied and removed from dungeon');
            }
        } else if (this.camera.renderingMode === 'mine') {
            // Update mine tombstone data
            this.mine.updateTombstoneInventory(tileX, tileY, tombstone.inventory);
            if (tombstone.isEmpty()) {
                this.mine.removeTombstone(tileX, tileY);
                this.camera.uiManager.hideTombstoneUI();
                console.log('💀 Tombstone emptied and removed from mine');
            }
        }
    }

    private handleTakeSelectedTombstoneItem(): void {
        const tombstone = this.camera.uiManager.getCurrentTombstone();
        if (!tombstone) return;

        const dualMode = this.camera.uiManager.getDualInventoryMode();

        if (dualMode === 'container') {
            // Transfer selected item from tombstone to player
            const selectedSlot = this.camera.uiManager.getTombstoneSelectedSlot();
            const item = tombstone.inventory[selectedSlot];

            if (!item) {
                console.log('No item selected in tombstone');
                return;
            }

            console.log(`Taking ${item.quantity}x ${item.type} from tombstone slot ${selectedSlot + 1}...`);

            const added = this.player.addToInventory(item.type, item.quantity);
            if (added) {
                tombstone.removeItem(selectedSlot);
                console.log(`🎒 Added ${item.quantity}x ${item.type} from tombstone to player inventory`);
            } else {
                console.log(`🎒 Could not add ${item.quantity}x ${item.type} to player inventory - full!`);
            }
        } else {
            // Transfer selected item from player to tombstone
            const selectedSlot = this.camera.uiManager.getPlayerSelectedSlot();
            const playerInventory = this.player.getInventoryItems();
            const item = playerInventory[selectedSlot];

            if (!item || item.quantity <= 0) {
                console.log('No item selected in player inventory');
                return;
            }

            // Find empty slot in tombstone
            const emptySlot = tombstone.inventory.findIndex(slot => slot === null);
            if (emptySlot !== -1) {
                tombstone.inventory[emptySlot] = { ...item }; // Copy item to tombstone
                this.player.removeFromInventory(item.type, item.quantity); // Remove from player
                console.log(`✅ Transferred ${item.quantity}x ${item.type} from player to tombstone`);
            } else {
                console.log(`❌ Tombstone full! Could not transfer ${item.quantity}x ${item.type}`);
            }
        }

        // Update tombstone inventory in the appropriate system based on rendering mode
        const tileX = Math.floor(tombstone.position.x / WorldGenerator.TILE_SIZE);
        const tileY = Math.floor(tombstone.position.y / WorldGenerator.TILE_SIZE);

        if (this.camera.renderingMode === 'world') {
            // Update world tombstones map
            if (tombstone.isEmpty()) {
                this.world.removeTombstone(tileX, tileY);
                this.camera.uiManager.hideTombstoneUI();
                console.log('💀 Tombstone emptied and removed from world');
            }
        } else if (this.camera.renderingMode === 'dungeon') {
            // Update dungeon tombstone data
            this.dungeon.updateTombstoneInventory(tileX, tileY, tombstone.inventory);
            if (tombstone.isEmpty()) {
                this.dungeon.removeTombstone(tileX, tileY);
                this.camera.uiManager.hideTombstoneUI();
                console.log('💀 Tombstone emptied and removed from dungeon');
            }
        } else if (this.camera.renderingMode === 'mine') {
            // Update mine tombstone data
            this.mine.updateTombstoneInventory(tileX, tileY, tombstone.inventory);
            if (tombstone.isEmpty()) {
                this.mine.removeTombstone(tileX, tileY);
                this.camera.uiManager.hideTombstoneUI();
                console.log('💀 Tombstone emptied and removed from mine');
            }
        }
    }

    private findNearestUnoccupiedTile(position: { x: number; y: number }, mode: 'world' | 'dungeon' | 'mine'): { x: number; y: number } {
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

    private isTilePassable(tileX: number, tileY: number, mode: 'world' | 'dungeon' | 'mine'): boolean {
        if (mode === 'dungeon') {
            const tile = this.dungeon.getTile(tileX, tileY);
            if (!tile || tile.value === 'VOID' || tile.value === 'STONE') return false;

            // Check for impassable structures
            if (tile.villageStructures && tile.villageStructures.length > 0) {
                for (const structure of tile.villageStructures) {
                    if (structure.poi && !structure.poi.passable) return false;
                    if (structure.poi && (structure.poi.type === 'mine_entrance' || structure.poi.type === 'dungeon_entrance')) return false;
                    if (structure.npc && !structure.npc.isDead()) return false;
                }
            }
            return true;
        } else if (mode === 'mine') {
            const tile = this.mine.getTile(tileX, tileY);
            if (!tile || tile.value === 'STONE') return false;

            // Check for impassable structures
            if (tile && 'villageStructures' in tile && tile.villageStructures && tile.villageStructures.length > 0) {
                for (const structure of tile.villageStructures) {
                    // In mine mode, mine entrances should be impassable
                    if (structure.poi && structure.poi.type === 'mine_entrance') {
                        return false;
                    }
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
            } else if (this.camera.renderingMode === 'mine') {
                const tile = this.mine.getTile(checkX, checkY);
                if (tile?.villageStructures) {
                    const structure = tile.villageStructures.find(s => s.npc && !s.npc.isDead());
                    npc = structure?.npc ?? null;
                }
            } else {
                npc = this.world.getNPCAt(checkX, checkY);
            }

            // If there's a monster or aggressive friendly NPC (bandit) that's attacking and targeting the player
            if (npc &&
                ((npc.category === 'monster') || (npc.category === 'friendly' && (npc as NPC).aggressive)) &&
                npc.isCurrentlyAttacking?.() &&
                npc.getAttackTarget?.()) {
                const attackTarget = npc.getAttackTarget?.();
                if (attackTarget) {
                    const targetTileX = Math.floor(attackTarget.x / WorldGenerator.TILE_SIZE);
                    const targetTileY = Math.floor(attackTarget.y / WorldGenerator.TILE_SIZE);

                    // Check if monster/bandit is attacking the player's tile
                    if (targetTileX === playerTileX && targetTileY === playerTileY) {
                        console.log(`🗡️ ${npc.type} attacks player!`);
                        this.player.takeDamage(5); // Monsters and bandits deal 5 damage
                    }
                }
            }
        }
    }

    // Chest handling methods
    private handleTakeAllChestItems(): void {
        const chest = this.camera.uiManager.getCurrentChest();
        if (!chest) return;

        const dualMode = this.camera.uiManager.getDualInventoryMode();

        if (dualMode === 'container') {
            // Transfer all items from chest to player
            let itemsTransferred = 0;

            for (const [i, item] of chest.inventory.entries()) {
                if (item && item.quantity > 0) {
                    const added = this.player.addToInventory(item.type, item.quantity);
                    if (added) {
                        console.log(`✅ Transferred ${item.quantity}x ${item.type} from chest to player`);
                        chest.inventory[i] = null; // Remove from chest
                        itemsTransferred++;
                    } else {
                        console.log(`❌ Player inventory full! Could not transfer ${item.quantity}x ${item.type}`);
                        break; // Stop if inventory is full
                    }
                }
            }

            console.log(`Transferred ${itemsTransferred} items from chest to player`);
        } else {
            // Transfer all items from player to chest
            let itemsTransferred = 0;
            const playerInventory = this.player.getInventoryItems();

            for (const [i, item] of playerInventory.entries()) {
                if (item && item.quantity > 0) {
                    // Find empty slot in chest
                    const emptySlot = chest.inventory.findIndex(slot => slot === null);
                    if (emptySlot !== -1) {
                        chest.inventory[emptySlot] = { ...item }; // Copy item to chest
                        this.player.removeFromInventory(item.type, item.quantity); // Remove from player
                        console.log(`✅ Transferred ${item.quantity}x ${item.type} from player to chest`);
                        itemsTransferred++;
                    } else {
                        console.log(`❌ Chest full! Could not transfer ${item.quantity}x ${item.type}`);
                        break; // Stop if chest is full
                    }
                }
            }

            console.log(`Transferred ${itemsTransferred} items from player to chest`);
        }

        // Update chest inventory in tile cache
        this.updateChestInventoryInCache(chest);
    }

    private handleTakeSelectedChestItem(): void {
        const chest = this.camera.uiManager.getCurrentChest();
        if (!chest) return;

        const dualMode = this.camera.uiManager.getDualInventoryMode();

        if (dualMode === 'container') {
            // Transfer selected item from chest to player
            const selectedSlot = this.camera.uiManager.getChestSelectedSlot();
            const item = chest.inventory[selectedSlot];

            if (item && item.quantity > 0) {
                const added = this.player.addToInventory(item.type, item.quantity);
                if (added) {
                    console.log(`✅ Transferred ${item.quantity}x ${item.type} from chest to player`);
                    chest.inventory[selectedSlot] = null; // Remove from chest
                } else {
                    console.log(`❌ Player inventory full! Could not transfer ${item.quantity}x ${item.type}`);
                }
            } else {
                console.log('No item selected in chest');
            }
        } else {
            // Transfer selected item from player to chest
            const selectedSlot = this.camera.uiManager.getPlayerSelectedSlot();
            const playerInventory = this.player.getInventoryItems();
            const item = playerInventory[selectedSlot];

            if (item && item.quantity > 0) {
                // Find empty slot in chest
                const emptySlot = chest.inventory.findIndex(slot => slot === null);
                if (emptySlot !== -1) {
                    chest.inventory[emptySlot] = { ...item }; // Copy item to chest
                    this.player.removeFromInventory(item.type, item.quantity); // Remove from player
                    console.log(`✅ Transferred ${item.quantity}x ${item.type} from player to chest`);
                } else {
                    console.log(`❌ Chest full! Could not transfer ${item.quantity}x ${item.type}`);
                }
            } else {
                console.log('No item selected in player inventory');
            }
        }

        // Update chest inventory in tile cache
        this.updateChestInventoryInCache(chest);
    }

    private updateChestInventoryInCache(chest: Chest): void {
        // Update chest inventory in appropriate cache (world or dungeon)
        if (this.camera.renderingMode === 'dungeon') {
            this.updateDungeonChestInventory(chest.chestId, chest.inventory);
        } else {
            this.updateWorldChestInventory(chest.chestId, chest.inventory);
        }
    }

    private updateWorldChestInventory(chestId: string, inventory: (InventoryItem | null)[]): void {
        // Find the chest in world tiles and update its inventory
        const playerTileX = Math.floor(this.gameState.player.position.x / WorldGenerator.TILE_SIZE);
        const playerTileY = Math.floor(this.gameState.player.position.y / WorldGenerator.TILE_SIZE);

        // Search in a radius around the player for the chest
        for (let x = playerTileX - 2; x <= playerTileX + 2; x++) {
            for (let y = playerTileY - 2; y <= playerTileY + 2; y++) {
                const tile = this.world.getTile(x, y);
                if (tile?.villageStructures) {
                    for (const structure of tile.villageStructures) {
                        if (structure.poi && structure.poi.type === 'rare_chest' &&
                            structure.poi.customData?.chestId === chestId) {
                            structure.poi.customData.inventory = inventory;
                            console.log(`💾 Updated world chest inventory for ${chestId}`);
                            return;
                        }
                    }
                }
            }
        }
    }

    private updateDungeonChestInventory(chestId: string, inventory: (InventoryItem | null)[]): void {
        // Find the chest in dungeon tiles and update its inventory
        const playerTileX = Math.floor(this.gameState.player.position.x / WorldGenerator.TILE_SIZE);
        const playerTileY = Math.floor(this.gameState.player.position.y / WorldGenerator.TILE_SIZE);

        // Search in a radius around the player for the chest
        for (let x = playerTileX - 2; x <= playerTileX + 2; x++) {
            for (let y = playerTileY - 2; y <= playerTileY + 2; y++) {
                const tile = this.dungeon.getTile(x, y);
                if (tile?.villageStructures) {
                    for (const structure of tile.villageStructures) {
                        if (structure.poi && structure.poi.type === 'rare_chest' &&
                            structure.poi.customData?.chestId === chestId) {
                            structure.poi.customData.inventory = inventory;
                            console.log(`💾 Updated dungeon chest inventory for ${chestId}`);
                            return;
                        }
                    }
                }
            }
        }
    }
}