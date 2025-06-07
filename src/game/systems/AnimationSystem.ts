import { type Tree } from '../entities/structure/Tree';
import { type Cactus } from '../entities/structure/Cactus';
import type { Camera } from './Camera';

export interface AnimatedEntity {
  update(deltaTime: number): void;
  render(ctx: CanvasRenderingContext2D, scale?: number): void;
}

export class AnimationSystem {
  private trees = new Map<string, Tree>();
  private cactus = new Map<string, Cactus>();
  private animatedEntities = new Set<AnimatedEntity>();

  public addTree(tileKey: string, tree: Tree): void {
    this.trees.set(`${tileKey}_${tree.x}_${tree.y}`, tree);
    this.animatedEntities.add(tree);
  }

  public removeTree(tileKey: string, tree: Tree): void {
    const key = `${tileKey}_${tree.x}_${tree.y}`;
    this.trees.delete(key);
    this.animatedEntities.delete(tree);
  }

  public addCactus(tileKey: string, cactus: Cactus): void {
    this.cactus.set(`${tileKey}_${cactus.x}_${cactus.y}`, cactus);
    this.animatedEntities.add(cactus);
  }

  public removeCactus(tileKey: string, cactus: Cactus): void {
    const key = `${tileKey}_${cactus.x}_${cactus.y}`;
    this.cactus.delete(key);
    this.animatedEntities.delete(cactus);
  }

  public addAnimatedEntity(entity: AnimatedEntity): void {
    this.animatedEntities.add(entity);
  }

  public removeAnimatedEntity(entity: AnimatedEntity): void {
    this.animatedEntities.delete(entity);
  }

  public update(deltaTime: number): void {
    // Update all animated entities (including trees)
    for (const entity of this.animatedEntities) {
      entity.update(deltaTime);
    }
  }

        public render(ctx: CanvasRenderingContext2D, camera: Camera, scale = 1): void {
    // Only render entities that are visible in the camera viewport
    const visibleTrees = this.getVisibleTrees(camera);
    for (const tree of visibleTrees) {
      // Calculate which tile the tree is in
      const tileX = Math.floor(tree.x / 16);
      const tileY = Math.floor(tree.y / 16);

      // Get the screen position of the tile corner (to align with tile grid)
      const tileWorldX = tileX * 16;
      const tileWorldY = tileY * 16;
      const tileScreenPos = camera.worldToScreen(tileWorldX, tileWorldY);

      // Calculate the final sprite position (tile position + border offset)
      const spriteX = tileScreenPos.x - 8 + 1; // tile center offset + border offset
      const spriteY = tileScreenPos.y - 8 + 1;

      // Only render if the tree is actually within the canvas bounds
      if (spriteX >= -16 && spriteX <= ctx.canvas.width + 16 &&
          spriteY >= -16 && spriteY <= ctx.canvas.height + 16) {
        // Render the tree sprite aligned with tile grid
        tree.renderAtScreenPosition(ctx, spriteX, spriteY, scale);
      }
    }

            // Render visible cactus
    const visibleCactus = this.getVisibleCactus(camera);
    for (const cactusEntity of visibleCactus) {
      // Calculate which tile the cactus is in
      const tileX = Math.floor(cactusEntity.x / 16);
      const tileY = Math.floor(cactusEntity.y / 16);

      // Get the screen position of the tile corner (to align with tile grid)
      const tileWorldX = tileX * 16;
      const tileWorldY = tileY * 16;
      const tileScreenPos = camera.worldToScreen(tileWorldX, tileWorldY);

      // Calculate the final sprite position (tile position + border offset)
      const spriteX = tileScreenPos.x - 8 + 1; // tile center offset + border offset
      const spriteY = tileScreenPos.y - 8 + 1;

      // Only render if the cactus is actually within the canvas bounds
      if (spriteX >= -16 && spriteX <= ctx.canvas.width + 16 &&
          spriteY >= -16 && spriteY <= ctx.canvas.height + 16) {
        // Render the cactus sprite aligned with tile grid
        cactusEntity.renderAtScreenPosition(ctx, spriteX, spriteY, scale);
      }
    }
  }

  private getVisibleTrees(camera: Camera): Tree[] {
    const tileSize = 16; // WorldGenerator.TILE_SIZE
    const padding = tileSize * 2; // Add some padding for smooth scrolling

    const minX = camera.position.x - padding;
    const minY = camera.position.y - padding;
    const maxX = camera.position.x + camera.viewWidth + padding;
    const maxY = camera.position.y + camera.viewHeight + padding;

    return this.getTreesInArea(minX, minY, maxX, maxY);
  }

  private getVisibleCactus(camera: Camera): Cactus[] {
    const tileSize = 16; // WorldGenerator.TILE_SIZE
    const padding = tileSize * 2; // Add some padding for smooth scrolling

    const minX = camera.position.x - padding;
    const minY = camera.position.y - padding;
    const maxX = camera.position.x + camera.viewWidth + padding;
    const maxY = camera.position.y + camera.viewHeight + padding;

    return this.getCactusInArea(minX, minY, maxX, maxY);
  }

  public getTreesInArea(minX: number, minY: number, maxX: number, maxY: number): Tree[] {
    const treesInArea: Tree[] = [];

    for (const tree of this.trees.values()) {
      if (tree.x >= minX && tree.x <= maxX && tree.y >= minY && tree.y <= maxY) {
        treesInArea.push(tree);
      }
    }

    return treesInArea;
  }

  public getCactusInArea(minX: number, minY: number, maxX: number, maxY: number): Cactus[] {
    const cactusInArea: Cactus[] = [];

    for (const cactus of this.cactus.values()) {
      if (cactus.x >= minX && cactus.x <= maxX && cactus.y >= minY && cactus.y <= maxY) {
        cactusInArea.push(cactus);
      }
    }

    return cactusInArea;
  }

  public getAllTrees(): Tree[] {
    return Array.from(this.trees.values());
  }

  public getAllCactus(): Cactus[] {
    return Array.from(this.cactus.values());
  }

  public getTreeCount(): number {
    return this.trees.size;
  }

  public getCactusCount(): number {
    return this.cactus.size;
  }

  public getAnimatedEntityCount(): number {
    return this.animatedEntities.size;
  }

  public clear(): void {
    this.trees.clear();
    this.cactus.clear();
    this.animatedEntities.clear();
  }
}