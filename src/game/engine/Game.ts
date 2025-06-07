import type { GameState } from './types';
import { GameLoop } from './GameLoop';
import { Controls } from '~/game/systems/Controls';
import { Movement } from '~/game/systems/Movement';
import { World } from '~/game/world/World';
import { Camera } from '~/game/systems/Camera';
import { WorldGenerator } from '~/game/world/WorldGenerator';
import { AnimationSystem } from '~/game/systems/AnimationSystem';

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

    constructor(canvas: HTMLCanvasElement, seed?: string) {
        this.canvas = canvas;
        this.controls = new Controls(canvas);
        this.initializeGame(seed);
    }

    private initializeGame(seed?: string): void {
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
        this.animationSystem.render(ctx, this.camera);
        this.renderPlayer(ctx);
    }

    private renderPlayer(ctx: CanvasRenderingContext2D): void {
        // Player is always centered on screen
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        ctx.fillStyle = 'red';
        ctx.fillRect(centerX - 5, centerY - 5, 10, 10);
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