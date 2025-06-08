import type { Position } from '../../engine/types';
import type { InventoryItem } from '../inventory/Inventory';
import { ASSET_MAP, type AssetMapping, getAssetByName } from '../../assets/AssetMap';
import { getAssetPath } from '../../utils/assetPath';

type Direction = 'up' | 'down' | 'left' | 'right';


export type NPCType = 'chicken' | 'pig' | 'sheep' | 'trader' | 'orc' | 'skeleton' | 'goblin';
export type NPCState = 'idle' | 'wandering' | 'following' | 'fleeing' | 'attacking' | 'dead';
export type NPCCategory = 'animal' | 'friendly' | 'monster';

export interface NPCConfig {
  type: NPCType;
  position: Position;
  health?: number;
  aggressive?: boolean;
  movementSpeed?: number;
  detectionRange?: number;
  dropItems?: { type: string; quantity: number }[];
}

export class NPC {
  public readonly type: NPCType;
  public position: Position;
  public readonly originalPosition: Position;
  public health: number;
  public readonly maxHealth: number;
  public readonly aggressive: boolean;
  public readonly movementSpeed: number;
  public readonly detectionRange: number;
  public readonly dropItems: { type: string; quantity: number }[];
  public readonly category: NPCCategory;

  public state: NPCState = 'idle';
  public direction: Direction = 'down';
  public lastMoveTime = 0;
  public target: Position | null = null;

  // Callback for tile collision checking
  private tileCollisionCallback?: (position: Position) => boolean;

  // Add speculative movement callback to check if other NPCs want to move away from target tile
  private speculativeMovementCallback?: (position: Position, movingNPC: NPC) => boolean;

  // Tile-based movement properties (like player)
  private moveCooldown = 0;
  private readonly moveDelay = 600; // 0.6 seconds between moves (increased frequency)

  private currentFrame = 0;
  private lastFrameTime = 0;
  private readonly animationDuration = 1000; // 1 second per cycle
  private sprite: HTMLImageElement | null = null;
  private asset: AssetMapping | null = null;
  private isLoaded = false;
  private moveTimer = 0;
  private readonly moveInterval = 2000; // Move every 2 seconds when wandering
  private lastAttackTime = 0;
  private readonly attackCooldown = 1000; // 1 second between attacks

  // Add breeding-related properties
  private lastBreedTime = 0;
  private readonly breedCooldown = 30000; // 30 seconds between breeding attempts

  // Track movement activity to prevent stuck animals
  private lastMovementTime = 0;
  private readonly maxIdleTime = 5000; // 5 seconds max without movement
  private restlessnessBonus = 0; // Builds up when animal hasn't moved

  // Cache movement decision for consistent intention/execution
  private currentMovementDecision: {
    timestamp: number;
    shouldMove: boolean;
    behaviorType: 'crowded_escape' | 'random_avoidance' | 'exploration' | 'attraction' | 'basic_wander';
    targetPosition?: Position;
  } | null = null;

  constructor(config: NPCConfig) {
    this.type = config.type;
    this.position = { ...config.position };
    this.originalPosition = { ...config.position };
    this.health = config.health ?? this.getDefaultHealth();
    this.maxHealth = this.health;
    this.aggressive = config.aggressive ?? this.getDefaultAggressive();
    this.movementSpeed = config.movementSpeed ?? 1;
    this.detectionRange = config.detectionRange ?? 5;
    this.dropItems = config.dropItems ?? this.getDefaultDropItems();
    this.category = this.getNPCCategory();

    // Initialize with random movement timer
    this.moveCooldown = Math.random() * this.moveDelay; // Stagger initial movement (already in milliseconds)
    this.lastMovementTime = Date.now(); // Initialize movement tracking

    void this.loadAsset();
  }

  private async loadAsset(): Promise<void> {
    const asset = getAssetByName(this.type);

    if (asset) {
      this.asset = asset;
      const image = new Image();
      image.src = getAssetPath(asset.spritePath);

      try {
      await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(`Failed to load ${asset.spritePath}`));
        });
        this.sprite = image;
          this.isLoaded = true;
    } catch (error) {
        console.warn(`Failed to load NPC sprite for ${this.type}:`, error);
      }
    }
  }

  public setTileCollisionCallback(callback: (position: Position) => boolean): void {
    this.tileCollisionCallback = callback;
  }

  public setSpeculativeMovementCallback(callback: (position: Position, movingNPC: NPC) => boolean): void {
    this.speculativeMovementCallback = callback;
  }

  public update(
    deltaTime: number,
    playerPosition: Position,
    playerInventory: InventoryItem[],
    nearbyNPCs: NPC[] = [],
    nearbyVillageBuildings: Position[] = []
  ): void {
    if (this.state === 'dead') return;

    this.updateAnimation(deltaTime);
    this.updateTileBasedMovement(deltaTime, playerPosition, playerInventory, nearbyNPCs);
  }

  private updateTileBasedMovement(
    deltaTime: number,
    playerPosition: Position,
    playerInventory: InventoryItem[],
    nearbyNPCs: NPC[]
  ): void {
    // Handle movement cooldown (convert deltaTime from seconds to milliseconds)
    if (this.moveCooldown > 0) {
      this.moveCooldown -= deltaTime * 1000; // Convert deltaTime to milliseconds
      return;
    }

    const distanceToPlayer = this.getDistanceToPosition(playerPosition);
    const hasWheat = playerInventory.some(item => item?.type === 'wheat');

    // Handle player interaction states
    this.handlePlayerInteraction(distanceToPlayer, hasWheat, playerPosition);

    // Handle monster behavior - attack nearby friendly NPCs
    if (this.category === 'monster') {
      this.handleMonsterAttacks(deltaTime, nearbyNPCs);
    }

    // Check for breeding opportunity before movement (animals only)
    if (this.category === 'animal' && this.canBreed()) {
      const breedingPartner = this.findBreedingPartner(nearbyNPCs);
      if (breedingPartner) {
        this.attemptBreeding(breedingPartner);
        return; // Skip movement this turn
      }
    }

    // Use deterministic movement decision system
    const decision = this.calculateMovementDecision(playerPosition, playerInventory, nearbyNPCs);
    const targetTile = decision.targetPosition ?? null;

    // Attempt to move to target tile
    if (targetTile && this.canMoveTo(targetTile)) {
      const currentTileX = Math.floor(this.position.x / 16);
      const currentTileY = Math.floor(this.position.y / 16);
      const newTileX = Math.floor(targetTile.x / 16);
      const newTileY = Math.floor(targetTile.y / 16);

      // Only update direction and move if we're actually changing tiles
      if (currentTileX !== newTileX || currentTileY !== newTileY) {
        // Update direction based on movement
        this.updateDirectionFromMovement(newTileX - currentTileX, newTileY - currentTileY);

        // Move to new tile
        this.position = { x: newTileX * 16, y: newTileY * 16 };
        this.lastMovementTime = Date.now(); // Track successful movement

        // Only log movement if it's a significant change (reduces spam)
        if (Math.random() < 0.1) { // 10% chance to log
          console.log(`[NPC ${this.type}] Moved from (${currentTileX},${currentTileY}) to (${newTileX},${newTileY})`);
        }
      }

      // Always reset movement cooldown when we attempt a valid move
      this.moveCooldown = this.moveDelay;
    } else {
      // Couldn't move, reset cooldown to try again much sooner
      this.moveCooldown = this.moveDelay * 0.25; // Try again in 0.15 seconds instead of 0.3

      // Force movement if stuck for too long
      const now = Date.now();
      if (now - this.lastMovementTime > this.maxIdleTime) {
        // Force a basic movement attempt with minimal restrictions
        const forceMove = this.getBasicAdjacentTile(nearbyNPCs);
        if (forceMove && this.canMoveTo(forceMove)) {
          const forceTileX = Math.floor(forceMove.x / 16);
          const forceTileY = Math.floor(forceMove.y / 16);
          this.position = { x: forceTileX * 16, y: forceTileY * 16 };
          this.lastMovementTime = now;
          console.log(`[NPC ${this.type}] Force moved after being idle for too long`);
        }
      }
    }
  }

  private updateDirectionFromMovement(dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? 'right' : 'left';
    } else {
      this.direction = dy > 0 ? 'down' : 'up';
    }
  }

  private getAdjacentTileTowards(targetPosition: Position): Position | null {
    const currentTileX = Math.floor(this.position.x / 16);
    const currentTileY = Math.floor(this.position.y / 16);
    const targetTileX = Math.floor(targetPosition.x / 16);
    const targetTileY = Math.floor(targetPosition.y / 16);

    const dx = targetTileX - currentTileX;
    const dy = targetTileY - currentTileY;

    // Choose movement direction based on largest distance component
    let moveX = 0, moveY = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      moveX = dx > 0 ? 1 : -1;
    } else if (dy !== 0) {
      moveY = dy > 0 ? 1 : -1;
    }

    return { x: (currentTileX + moveX) * 16, y: (currentTileY + moveY) * 16 };
  }

  private getAdjacentTileAway(fromPosition: Position): Position | null {
    const currentTileX = Math.floor(this.position.x / 16);
    const currentTileY = Math.floor(this.position.y / 16);
    const fromTileX = Math.floor(fromPosition.x / 16);
    const fromTileY = Math.floor(fromPosition.y / 16);

    const dx = currentTileX - fromTileX;
    const dy = currentTileY - fromTileY;

    // Move away from the target
    let moveX = 0, moveY = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      moveX = dx > 0 ? 1 : -1;
    } else if (dy !== 0) {
      moveY = dy > 0 ? 1 : -1;
    } else {
      // If at same position, move randomly
      moveX = Math.random() > 0.5 ? 1 : -1;
    }

    return { x: (currentTileX + moveX) * 16, y: (currentTileY + moveY) * 16 };
  }

  private getRandomAdjacentTileWithSpacing(nearbyNPCs: NPC[]): Position | null {
    const currentTileX = Math.floor(this.position.x / 16);
    const currentTileY = Math.floor(this.position.y / 16);

    // Check if we're too far from origin
    const distanceFromOrigin = this.getDistanceToPosition(this.originalPosition);
    if (distanceFromOrigin > 5) { // 5 tiles max wander distance
      // Move back towards origin
      return this.getAdjacentTileTowards(this.originalPosition);
    }

    // Get all adjacent tiles
    const adjacentTiles = [
      { x: (currentTileX + 1) * 16, y: currentTileY * 16 }, // right
      { x: (currentTileX - 1) * 16, y: currentTileY * 16 }, // left
      { x: currentTileX * 16, y: (currentTileY + 1) * 16 }, // down
      { x: currentTileX * 16, y: (currentTileY - 1) * 16 }  // up
    ];

    // Filter out tiles based on improved spacing rules
    const availableTiles = adjacentTiles.filter(tile => {
      const tileX = Math.floor(tile.x / 16);
      const tileY = Math.floor(tile.y / 16);

      // Check for NPCs within 1-tile spacing (animals and friendly NPCs need space)
      for (const npc of nearbyNPCs) {
        if (npc === this) continue;

        const npcTileX = Math.floor(npc.position.x / 16);
        const npcTileY = Math.floor(npc.position.y / 16);

        // Calculate distance to other NPC
        const distance = Math.abs(npcTileX - tileX) + Math.abs(npcTileY - tileY); // Manhattan distance

        // For friendly NPCs and animals, maintain at least 1 tile spacing
        if ((this.category === 'animal' || this.category === 'friendly') &&
            (npc.category === 'animal' || npc.category === 'friendly')) {

          if (distance === 0) {
            return false; // Direct occupation
          }

          // Allow adjacent movement - only avoid if overcrowded (2+ adjacent animals)
          if (distance === 1) {
            const adjacentAnimals = nearbyNPCs.filter(npc => {
              if (npc === this || npc.category !== 'animal') return false;
              const npcDist = Math.abs(Math.floor(npc.position.x / 16) - tileX) +
                             Math.abs(Math.floor(npc.position.y / 16) - tileY);
              return npcDist === 1;
            }).length;

            // Only avoid if this would create 2+ adjacent animals to this tile
            if (adjacentAnimals >= 2 && Math.random() < 0.3) {
              return false; // 30% chance to avoid overcrowded tiles
            }
          }
    } else {
          // For monsters, only avoid direct occupation
          if (distance === 0) {
            return false; // Tile occupied
          }
        }
      }
      return true;
    });

    // If no available tiles with preferred spacing, fall back to basic avoidance
    if (availableTiles.length === 0) {
      return this.getBasicAdjacentTile(nearbyNPCs);
    }

    // Pick random available tile
    return availableTiles[Math.floor(Math.random() * availableTiles.length)]!;
  }

  private getBasicAdjacentTile(nearbyNPCs: NPC[]): Position | null {
    const currentTileX = Math.floor(this.position.x / 16);
    const currentTileY = Math.floor(this.position.y / 16);

    // Get all adjacent tiles
    const adjacentTiles = [
      { x: (currentTileX + 1) * 16, y: currentTileY * 16 }, // right
      { x: (currentTileX - 1) * 16, y: currentTileY * 16 }, // left
      { x: currentTileX * 16, y: (currentTileY + 1) * 16 }, // down
      { x: currentTileX * 16, y: (currentTileY - 1) * 16 }  // up
    ];

    // Filter out only directly occupied tiles
    const availableTiles = adjacentTiles.filter(tile => {
      const tileX = Math.floor(tile.x / 16);
      const tileY = Math.floor(tile.y / 16);

      // Check if any nearby NPC is on this exact tile
      for (const npc of nearbyNPCs) {
        if (npc === this) continue;
        const npcTileX = Math.floor(npc.position.x / 16);
        const npcTileY = Math.floor(npc.position.y / 16);
        if (npcTileX === tileX && npcTileY === tileY) {
          return false; // Tile occupied
        }
      }
      return true;
    });

    // Pick random available tile
    if (availableTiles.length > 0) {
      return availableTiles[Math.floor(Math.random() * availableTiles.length)]!;
    }

    return null; // No available tiles
  }

  private handlePlayerInteraction(distanceToPlayer: number, hasWheat: boolean, playerPosition: Position): void {
    if (this.state === 'dead') return;

    // Animals are attracted to wheat
    if (this.category === 'animal' && hasWheat && distanceToPlayer <= 5) {
      this.state = 'following';
      return;
    }

    // NPCs flee when attacked (when health is below max)
    if (this.health < this.maxHealth && this.category !== 'monster') {
      this.state = 'fleeing';
      return;
    }

    // Monsters become aggressive when player is close
    if (this.category === 'monster' && distanceToPlayer <= 3) {
      this.state = 'attacking';
      return;
    }

    // Default behavior
    if (this.state === 'following' && (!hasWheat || distanceToPlayer > 5)) {
      this.state = 'idle';
    }
    if (this.state === 'fleeing' && distanceToPlayer > 8) {
      this.state = 'idle';
    }
    if (this.state === 'attacking' && distanceToPlayer > 5) {
      this.state = 'idle';
    }
  }

  private handleMonsterAttacks(deltaTime: number, nearbyNPCs: NPC[]): void {
    if (this.category !== 'monster') return;

    const now = Date.now();
    if (now - this.lastAttackTime < this.attackCooldown) return;

    // Find nearby friendly NPCs to attack
    for (const npc of nearbyNPCs) {
      if (npc.category !== 'monster' && !npc.isDead()) {
        const distance = this.getDistanceToNPC(npc);
        if (distance <= 1) { // Adjacent tile
          // Attack the NPC
          npc.takeDamage(10);
          this.lastAttackTime = now;
          console.log(`${this.type} attacked ${npc.type} for 10 damage`);
          break;
        }
      }
    }
  }

  private updateAnimation(deltaTime: number): void {
    if (!this.isLoaded || !this.asset) return;

    // Convert deltaTime from seconds to milliseconds for animation timing
    this.lastFrameTime += deltaTime * 1000;
    if (this.lastFrameTime >= this.animationDuration / 4) { // 4 frames per cycle
      this.currentFrame = (this.currentFrame + 1) % 4;
      this.lastFrameTime = 0;
    }
  }

  private getDistanceToNPC(other: NPC): number {
    const dx = other.position.x - this.position.x;
    const dy = other.position.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy) / 16; // Distance in tiles
  }

  private getDistanceToPosition(position: Position): number {
    const dx = position.x - this.position.x;
    const dy = position.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy) / 16; // Distance in tiles
  }

  public canMoveTo(targetPosition: Position): boolean {
    // Basic collision check - prevent moving too far from origin
    const maxDistance = 10 * 16; // 10 tiles from origin
    const distanceFromOrigin = Math.sqrt(
      Math.pow(targetPosition.x - this.originalPosition.x, 2) +
      Math.pow(targetPosition.y - this.originalPosition.y, 2)
    );

    if (distanceFromOrigin > maxDistance) {
      return false;
    }

    // Use tile collision callback if available
    if (this.tileCollisionCallback) {
      const blocked = this.tileCollisionCallback(targetPosition);

      // If blocked by basic collision, check if we can use speculative movement
      if (blocked && this.speculativeMovementCallback) {
        // Check if the NPC at target position is trying to move away
        const canSpeculativeMove = this.speculativeMovementCallback(targetPosition, this);
        if (canSpeculativeMove) {
          return true; // Allow movement through speculative coordination
        }
      }

      return !blocked;
    }

    return true;
  }

  public render(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (!this.isLoaded || !this.sprite || !this.asset) return;

    // Calculate sprite frame based on direction and animation
    let spriteIndex = 0;
    const directionOffset = this.getDirectionOffset();
    spriteIndex = directionOffset + this.currentFrame;

    // Render the sprite
    const spriteSize = 16;
    const spritesPerRow = this.sprite.width / spriteSize;
    const spriteX = (spriteIndex % spritesPerRow) * spriteSize;
    const spriteY = Math.floor(spriteIndex / spritesPerRow) * spriteSize;

    ctx.drawImage(
      this.sprite,
      spriteX, spriteY, spriteSize, spriteSize,
      x, y, spriteSize, spriteSize
    );

    // Render health bar if damaged
    if (this.health < this.maxHealth && !this.isDead()) {
      this.renderHealthBar(ctx, x, y);
    }
  }

  private getDirectionOffset(): number {
    // Each direction has 4 frames, arranged as: down, left, right, up
    switch (this.direction) {
      case 'down': return 0;
      case 'left': return 4;
      case 'right': return 8;
      case 'up': return 12;
      default: return 0;
    }
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const barWidth = 14;
    const barHeight = 2;
    const healthPercent = this.health / this.maxHealth;

    // Background (red)
    ctx.fillStyle = 'red';
    ctx.fillRect(x + 1, y - 4, barWidth, barHeight);

    // Foreground (green)
    ctx.fillStyle = 'green';
    ctx.fillRect(x + 1, y - 4, barWidth * healthPercent, barHeight);
  }

  public takeDamage(damage: number): void {
    if (this.state === 'dead') return;

    this.health -= damage;
    if (this.health <= 0) {
      this.health = 0;
      this.state = 'dead';
    } else if (this.category !== 'monster') {
      this.state = 'fleeing';
    }
  }

  public isDead(): boolean {
    return this.state === 'dead' || this.health <= 0;
  }

  public getDropItems(): { type: string; quantity: number }[] {
    return this.dropItems;
  }

  private getDefaultHealth(): number {
    switch (this.type) {
      case 'chicken': return 20;
      case 'pig': return 35;
      case 'sheep': return 25;
      case 'trader': return 50;
      case 'orc':
      case 'skeleton':
      case 'goblin': return 40;
      default: return 25;
    }
  }

  private getDefaultAggressive(): boolean {
    return this.category === 'monster';
  }

  private getDefaultDropItems(): { type: string; quantity: number }[] {
    switch (this.type) {
      case 'chicken': return [{ type: 'chicken_meat', quantity: 1 }];
      case 'pig': return [{ type: 'pork', quantity: 2 }];
      case 'sheep': return [{ type: 'wool', quantity: 1 }, { type: 'mutton', quantity: 1 }];
      case 'trader': return [];
      case 'orc':
      case 'skeleton':
      case 'goblin': return [{ type: 'copper_ore', quantity: 1 }];
      default: return [];
    }
  }

  private getNPCCategory(): NPCCategory {
    switch (this.type) {
      case 'chicken':
      case 'pig':
      case 'sheep':
        return 'animal';
      case 'trader':
        return 'friendly';
      case 'orc':
      case 'skeleton':
      case 'goblin':
        return 'monster';
      default:
        return 'animal';
    }
  }

  private canBreed(): boolean {
    const now = Date.now();
    return now - this.lastBreedTime >= this.breedCooldown;
  }

  private findBreedingPartner(nearbyNPCs: NPC[]): NPC | null {
    for (const npc of nearbyNPCs) {
      if (npc.category === 'animal' && npc !== this && this.canBreedWith(npc)) {
        return npc;
      }
    }
    return null;
  }

  private canBreedWith(partner: NPC): boolean {
    // Must be same species
    if (partner.type !== this.type) {
      return false;
    }

    // Must be adjacent (exactly 1 tile away)
    const distance = this.getDistanceToNPC(partner);
    if (distance !== 1) {
      return false;
    }

    // Must be facing each other
    if (!this.areFacingEachOther(partner)) {
      return false;
    }

    // Partner must also be able to breed
    if (!partner.canBreed()) {
      return false;
    }

    return true;
  }

  private areFacingEachOther(partner: NPC): boolean {
    const myTileX = Math.floor(this.position.x / 16);
    const myTileY = Math.floor(this.position.y / 16);
    const partnerTileX = Math.floor(partner.position.x / 16);
    const partnerTileY = Math.floor(partner.position.y / 16);

    // Determine relative position
    const dx = partnerTileX - myTileX;
    const dy = partnerTileY - myTileY;

    // Check if this NPC is facing towards the partner
    let myFacingCorrect = false;
    if (dx === 1 && dy === 0 && this.direction === 'right') myFacingCorrect = true;
    if (dx === -1 && dy === 0 && this.direction === 'left') myFacingCorrect = true;
    if (dx === 0 && dy === 1 && this.direction === 'down') myFacingCorrect = true;
    if (dx === 0 && dy === -1 && this.direction === 'up') myFacingCorrect = true;

    // Check if partner is facing towards this NPC
    let partnerFacingCorrect = false;
    if (dx === 1 && dy === 0 && partner.direction === 'left') partnerFacingCorrect = true;
    if (dx === -1 && dy === 0 && partner.direction === 'right') partnerFacingCorrect = true;
    if (dx === 0 && dy === 1 && partner.direction === 'up') partnerFacingCorrect = true;
    if (dx === 0 && dy === -1 && partner.direction === 'down') partnerFacingCorrect = true;

    return myFacingCorrect && partnerFacingCorrect;
  }

  private attemptBreeding(partner: NPC): void {
    // Mark both animals as having bred
    this.lastBreedTime = Date.now();
    partner.lastBreedTime = Date.now();

    // Find a suitable adjacent tile for the offspring
    const offspringPosition = this.findOffspringPosition(partner);

    if (offspringPosition) {
      // Trigger breeding event - this would need to be handled by the World system
      // For now, just log the breeding attempt
      console.log(`🐣 [BREEDING] ${this.type} at (${Math.floor(this.position.x/16)},${Math.floor(this.position.y/16)}) and ${partner.type} at (${Math.floor(partner.position.x/16)},${Math.floor(partner.position.y/16)}) are attempting to breed!`);

      // Store breeding information for the world system to handle
      this.breedingRequest = {
        partner,
        offspringType: this.type,
        offspringPosition,
        timestamp: Date.now()
      };
    }
  }

  private findOffspringPosition(partner: NPC): Position | null {
    const myTileX = Math.floor(this.position.x / 16);
    const myTileY = Math.floor(this.position.y / 16);
    const partnerTileX = Math.floor(partner.position.x / 16);
    const partnerTileY = Math.floor(partner.position.y / 16);

    // Check tiles adjacent to both parents
    const candidatePositions = [
      // Adjacent to this NPC
      { x: (myTileX + 1) * 16, y: myTileY * 16 },
      { x: (myTileX - 1) * 16, y: myTileY * 16 },
      { x: myTileX * 16, y: (myTileY + 1) * 16 },
      { x: myTileX * 16, y: (myTileY - 1) * 16 },
      // Adjacent to partner
      { x: (partnerTileX + 1) * 16, y: partnerTileY * 16 },
      { x: (partnerTileX - 1) * 16, y: partnerTileY * 16 },
      { x: partnerTileX * 16, y: (partnerTileY + 1) * 16 },
      { x: partnerTileX * 16, y: (partnerTileY - 1) * 16 }
    ];

    // Find first available position
    for (const position of candidatePositions) {
      if (this.canMoveTo(position)) {
        return position;
      }
    }

    return null; // No suitable position found
  }

  // Add property to store breeding requests
  public breedingRequest?: {
    partner: NPC;
    offspringType: NPCType;
    offspringPosition: Position;
    timestamp: number;
  };

  private findSameTypeAttraction(nearbyNPCs: NPC[]): Position | null {
    // Find nearest same-type animal within reasonable range
    let nearestSameType: NPC | null = null;
    let shortestDistance = Infinity;

    for (const npc of nearbyNPCs) {
      if (npc.category === 'animal' && npc !== this && npc.type === this.type) {
        const distance = this.getDistanceToNPC(npc);
        // Only attract to animals within 3-4 tiles range
        if (distance >= 2 && distance <= 4 && distance < shortestDistance) {
          nearestSameType = npc;
          shortestDistance = distance;
        }
      }
    }

    return nearestSameType ? nearestSameType.position : null;
  }

  private checkCrowdedRepulsion(nearbyNPCs: NPC[]): Position | null {
    // Check if animal is surrounded by too many other animals
    const sameTypeAnimals = nearbyNPCs.filter(npc =>
      npc.category === 'animal' && npc !== this && npc.type === this.type
    );

    // Count animals within 2 tiles
    const nearbyCount = sameTypeAnimals.filter(npc => this.getDistanceToNPC(npc) <= 2).length;

    // If surrounded by 3+ same-type animals, want to escape
    if (nearbyCount >= 3) {
      // Find the center of mass of nearby same-type animals
      let totalX = 0;
      let totalY = 0;
      let count = 0;

      for (const npc of sameTypeAnimals) {
        if (this.getDistanceToNPC(npc) <= 2) {
          totalX += npc.position.x;
          totalY += npc.position.y;
          count++;
        }
      }

      if (count > 0) {
        // Return the center of mass to move away from
        return { x: totalX / count, y: totalY / count };
      }
    }

    return null; // Not crowded
  }

    private calculateAttractionChance(nearbyNPCs: NPC[]): number {
    // Base attraction chance
    let baseChance = 0.2; // Reduced from 0.3

    // Count same-type animals nearby
    const sameTypeNearby = nearbyNPCs.filter(npc =>
      npc.category === 'animal' && npc !== this && npc.type === this.type && this.getDistanceToNPC(npc) <= 3
    ).length;

    // Reduce attraction if already near other same-type animals, but not as severely
    if (sameTypeNearby >= 2) {
      baseChance *= 0.5; // Less attraction when already in a group (increased from 0.3)
    } else if (sameTypeNearby === 1) {
      baseChance *= 0.8; // Slightly less attraction when near one other (increased from 0.7)
    }

    // Increase attraction if isolated (no same-type animals within 4 tiles)
    const isolatedCheck = nearbyNPCs.some(npc =>
      npc.category === 'animal' && npc !== this && npc.type === this.type && this.getDistanceToNPC(npc) <= 4
    );

    if (!isolatedCheck) {
      baseChance *= 1.5; // Increase attraction when isolated
    }

    return Math.min(baseChance, 0.4); // Cap at 40%
  }

  private findNearestAnimal(nearbyNPCs: NPC[]): NPC | null {
    // Find nearest animal of any type within close range
    let nearestAnimal: NPC | null = null;
    let shortestDistance = Infinity;

    for (const npc of nearbyNPCs) {
      if (npc.category === 'animal' && npc !== this) {
        const distance = this.getDistanceToNPC(npc);
        // Only consider animals within 2 tiles for "move away" behavior
        if (distance <= 2 && distance < shortestDistance) {
          nearestAnimal = npc;
          shortestDistance = distance;
        }
      }
    }

    return nearestAnimal;
  }

  // Calculate movement decision that can be reused for both intention and execution
  private calculateMovementDecision(playerPosition: Position, playerInventory: InventoryItem[], nearbyNPCs: NPC[]): {
    shouldMove: boolean;
    behaviorType: 'crowded_escape' | 'random_avoidance' | 'exploration' | 'attraction' | 'basic_wander';
    targetPosition?: Position;
  } {
    // Cache the decision for 100ms to ensure consistency between intention and execution
    const now = Date.now();
    if (this.currentMovementDecision && (now - this.currentMovementDecision.timestamp) < 100) {
      return this.currentMovementDecision;
    }

    const distanceToPlayer = this.getDistanceToPosition(playerPosition);
    const hasWheat = playerInventory.some(item => item?.type === 'wheat');

    // Handle special movement states (non-random)
    if (this.state === 'following' && this.category === 'animal' && hasWheat && distanceToPlayer <= 5) {
      const decision = {
        shouldMove: true,
        behaviorType: 'basic_wander' as const,
        targetPosition: this.getAdjacentTileTowards(playerPosition) ?? undefined
      };
      this.currentMovementDecision = { timestamp: now, ...decision };
      return decision;
    } else if (this.state === 'fleeing') {
      const decision = {
        shouldMove: true,
        behaviorType: 'basic_wander' as const,
        targetPosition: this.getAdjacentTileAway(playerPosition) ?? undefined
      };
      this.currentMovementDecision = { timestamp: now, ...decision };
      return decision;
    } else if (this.category === 'monster' && distanceToPlayer <= 3) {
      const decision = {
        shouldMove: true,
        behaviorType: 'basic_wander' as const,
        targetPosition: this.getAdjacentTileTowards(playerPosition) ?? undefined
      };
      this.currentMovementDecision = { timestamp: now, ...decision };
      return decision;
    }

    // Random wandering logic (cached to ensure consistency)
    const nearbyAnimalsCount = nearbyNPCs.filter(npc =>
      npc.category === 'animal' && npc !== this && this.getDistanceToNPC(npc) <= 2
    ).length;

    const baseMovementChance = nearbyAnimalsCount > 0 ? 0.9 : 0.8;
    const timeSinceMove = now - this.lastMovementTime;
    const restlessnessBonus = timeSinceMove > 3000 ? Math.min(0.3, (timeSinceMove - 3000) / 5000) : 0;
    const movementChance = Math.min(0.95, baseMovementChance + restlessnessBonus);

    // Use a consistent random seed based on NPC position, time, and unique identifier
    // Include originalPosition to make each NPC unique even if they're at same current position
    const npcSeed = Math.floor(this.originalPosition.x) * 31 + Math.floor(this.originalPosition.y) * 37;
    let seed = Math.floor(now / 100) + Math.floor(this.position.x) + Math.floor(this.position.y) + npcSeed;

    // Add some randomness if animal has been stuck for too long (escape mechanism)
    if (timeSinceMove > 8000) { // After 8 seconds of being stuck
      seed += Math.floor(now / 50); // Change seed every 50ms when stuck
    }

    const random = Math.abs(Math.sin(seed)) % 1; // Deterministic "random" based on seed

    if (random < movementChance) {
      // Determine behavior type using additional seeded randoms
      const behaviorRandom1 = Math.abs(Math.sin(seed + 1)) % 1;
      const behaviorRandom2 = Math.abs(Math.sin(seed + 2)) % 1;
      const behaviorRandom3 = Math.abs(Math.sin(seed + 3)) % 1;

      let targetPosition: Position | null = null;
      let behaviorType: 'crowded_escape' | 'random_avoidance' | 'exploration' | 'attraction' | 'basic_wander';

      const crowdedRepulsion = this.checkCrowdedRepulsion(nearbyNPCs);
      if (crowdedRepulsion && behaviorRandom1 < 0.4) {
        targetPosition = this.getAdjacentTileAway(crowdedRepulsion);
        behaviorType = 'crowded_escape';
      } else if (behaviorRandom2 < (nearbyAnimalsCount > 0 ? 0.3 : 0.2)) {
        const nearbyAnimal = this.findNearestAnimal(nearbyNPCs);
        if (nearbyAnimal) {
          targetPosition = this.getAdjacentTileAway(nearbyAnimal.position);
        } else {
          targetPosition = this.getRandomAdjacentTileWithSpacing(nearbyNPCs);
        }
        behaviorType = 'random_avoidance';
      } else if (behaviorRandom3 < (nearbyAnimalsCount > 0 ? 0.35 : 0.25)) {
        targetPosition = this.getRandomAdjacentTileWithSpacing(nearbyNPCs);
        behaviorType = 'exploration';
      } else {
        const sameTypeAttraction = this.findSameTypeAttraction(nearbyNPCs);
        const attractionChance = this.calculateAttractionChance(nearbyNPCs);
        if (sameTypeAttraction && behaviorRandom1 < attractionChance) {
          targetPosition = this.getAdjacentTileTowards(sameTypeAttraction);
          behaviorType = 'attraction';
        } else {
          targetPosition = this.getRandomAdjacentTileWithSpacing(nearbyNPCs);
          behaviorType = 'basic_wander';
        }
      }

      const decision = {
        shouldMove: true,
        behaviorType,
        targetPosition: targetPosition ?? undefined
      };
      this.currentMovementDecision = { timestamp: now, ...decision };
      return decision;
    }

    // Not moving this cycle
    const decision = {
      shouldMove: false,
      behaviorType: 'basic_wander' as const
    };
    this.currentMovementDecision = { timestamp: now, ...decision };
    return decision;
  }

  // Get the intended movement target for this NPC without actually moving
  public getMovementIntention(playerPosition: Position, playerInventory: InventoryItem[], nearbyNPCs: NPC[]): Position | null {
    // Use the same deterministic decision system as actual movement
    const decision = this.calculateMovementDecision(playerPosition, playerInventory, nearbyNPCs);
    return decision.targetPosition ?? null;
  }
}