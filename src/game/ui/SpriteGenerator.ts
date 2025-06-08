import { createNoise2D } from 'simplex-noise';
import { getAssetPath } from '~/game/utils/assetPath';

export interface SpriteFrame {
    image: HTMLImageElement;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SpriteAnimation {
    frames: SpriteFrame[];
    frameDuration: number;
    loop: boolean;
}

export interface SpriteInfo {
    id: string;
    path: string;
    frames: SpriteFrame[];
    animation?: SpriteAnimation;
    category?: string;
    tags?: string[];
}

export class SpriteGenerator {
    private sprites = new Map<string, SpriteInfo>();
    private spriteImages = new Map<string, HTMLImageElement>();
    private static TILE_SIZE = 16;
    private static SPRITE_FILES = [
        // Characters
        '/sprites/Characters/champions/Okomo.png',
        // Objects
        '/sprites/Objects/SwordShort.png',
        '/sprites/Objects/Spear.png',
        '/sprites/Objects/ShortBig.png',
        '/sprites/Objects/FireballProjectile.png',
        '/sprites/Objects/Bullet.png',
        '/sprites/Objects/BallistaBolt.png',
        '/sprites/Objects/Axe.png',
        '/sprites/Objects/ArrowShort.png',
        '/sprites/Objects/ArrowLong.png',
        // Animals
        '/sprites/Animals/Sheep.png',
        '/sprites/Animals/Pig.png',
        '/sprites/Animals/MarineAnimals.png',
        '/sprites/Animals/Horse(32x32).png',
        '/sprites/Animals/HornedSheep.png',
        '/sprites/Animals/Chicken.png',
        '/sprites/Animals/Chick.png',
        '/sprites/Animals/Boar.png',
        // Buildings
        '/sprites/Buildings/wood/Barracks.png',
        '/sprites/Buildings/wood/CaveV2.png',
        '/sprites/Buildings/wood/Docks.png',
        '/sprites/Buildings/wood/Houses.png',
        // Ground
        '/sprites/Ground/TexturedGrass.png',
        '/sprites/Ground/Shore.png',
        '/sprites/Ground/Grass.png',
        '/sprites/Ground/Cliff.png',
        '/sprites/Ground/Winter.png',
        // Miscellaneous
        '/sprites/Miscellaneous/Boat.png',
        '/sprites/Miscellaneous/Chests.png',
        '/sprites/Miscellaneous/Tombstones.png',
        '/sprites/Miscellaneous/StreetSigns.png',
        '/sprites/Miscellaneous/Signs.png',
        '/sprites/Miscellaneous/QuestBoard.png',
        '/sprites/Miscellaneous/Portal.png',
        '/sprites/Miscellaneous/PirateShip.png',
        '/sprites/Miscellaneous/Bridge.png',
        // Nature
        '/sprites/Nature/Cactus.png',
        '/sprites/Nature/Rocks.png',
        '/sprites/Nature/Wheatfield.png',
        '/sprites/Nature/WinterTrees.png',
        '/sprites/Nature/Tumbleweed.png',
        '/sprites/Nature/Trees.png',
        '/sprites/Nature/PineTrees.png',
    ];

    constructor() {
        void this.loadSprites();
    }

    private async loadSprites(): Promise<void> {
        for (const spritePath of SpriteGenerator.SPRITE_FILES) {
            try {
                const image = new Image();
                image.src = getAssetPath(spritePath);
                await new Promise<void>((resolve, reject) => {
                    image.onload = () => resolve();
                    image.onerror = () => {
                        const error = new Error(`Failed to load sprite: ${spritePath}`);
                        console.error(error.message);
                        reject(error);
                    };
                });
                this.spriteImages.set(spritePath, image);
                this.processSprite(spritePath, image);
            } catch (error) {
                console.error(`Failed to load sprite: ${spritePath}`, error);
            }
        }
        console.log('Loaded sprites:', Array.from(this.sprites.keys()));
    }

    private processSprite(spritePath: string, image: HTMLImageElement): void {
        const tilesX = Math.floor(image.width / SpriteGenerator.TILE_SIZE);
        const tilesY = Math.floor(image.height / SpriteGenerator.TILE_SIZE);

        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                const spriteId = `${spritePath}#${x},${y}`;
                const frame: SpriteFrame = {
                    image,
                    x: x * SpriteGenerator.TILE_SIZE,
                    y: y * SpriteGenerator.TILE_SIZE,
                    width: SpriteGenerator.TILE_SIZE,
                    height: SpriteGenerator.TILE_SIZE
                };
                this.sprites.set(spriteId, {
                    id: spriteId,
                    path: spritePath,
                    frames: [frame],
                    category: this.getCategoryFromPath(spritePath),
                    tags: this.getTagsFromPath(spritePath)
                });
            }
        }
    }

    private getCategoryFromPath(path: string): string {
        const parts = path.split('/');
        if (parts.length < 3) return 'Unknown';

        const category = parts[1] ?? '';
        return category.charAt(0).toUpperCase() + category.slice(1);
    }

    private getTagsFromPath(path: string): string[] {
        const parts = path.split('/');
        const tags: string[] = [];

        // Add main category as a tag
        if (parts[1]) {
            tags.push(parts[1].toLowerCase());
        }

        // Add filename as a tag
        if (parts[2]) {
            const filename = parts[2].split('.')[0] ?? '';
            if (filename) {
                tags.push(filename.toLowerCase());
            }
        }

        return tags;
    }

    public getSprite(id: string): SpriteInfo | undefined {
        return this.sprites.get(id);
    }

    public getAllSprites(): SpriteInfo[] {
        return Array.from(this.sprites.values());
    }

    public getSpritesByCategory(category: string): SpriteInfo[] {
        return this.getAllSprites().filter(sprite => sprite.category === category);
    }

    public getSpritesByTag(tag: string): SpriteInfo[] {
        return this.getAllSprites().filter(sprite => sprite.tags?.includes(tag));
    }

    public renderSprite(ctx: CanvasRenderingContext2D, spriteId: string, x: number, y: number): void {
        const sprite = this.getSprite(spriteId);
        if (!sprite?.frames[0]) return;

        const frame = sprite.frames[0];
        ctx.drawImage(
            frame.image,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            x,
            y,
            frame.width,
            frame.height
        );
    }
}