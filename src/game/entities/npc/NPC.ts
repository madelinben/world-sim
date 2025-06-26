import type { Position } from '../../engine/types';
import type { InventoryItem } from '../inventory/Inventory';
import { Inventory } from '../inventory/Inventory';
import { type AssetMapping, getAssetByName } from '../../assets/AssetMap';
import { getAssetPath } from '../../utils/assetPath';

type Direction = 'up' | 'down' | 'left' | 'right';


export type NPCType = 'chicken' | 'pig' | 'sheep' | 'trader' | 'orc' | 'skeleton' | 'goblin' |
  'archer_goblin' | 'club_goblin' | 'farmer_goblin' | 'orc_shaman' | 'spear_goblin' | 'mega_slime_blue' | 'slime' |
  'axeman_trader' | 'swordsman_trader' | 'spearman_trader' | 'farmer_trader';
export type NPCState = 'idle' | 'wandering' | 'following' | 'fleeing' | 'attacking' | 'dead';

export interface WideAttackFrame {
  playerTileFrame: number;
  facingTileFrame: number;
}
export type NPCCategory = 'animal' | 'friendly' | 'monster';

export interface NPCConfig {
  type: NPCType;
  position: Position;
  health?: number;
  aggressive?: boolean;
  movementSpeed?: number;
  detectionRange?: number;
  inventory?: (InventoryItem | null)[];
}

export class NPC {
  public readonly type: NPCType;
  public position: Position;
  public readonly originalPosition: Position;
  public previousPosition: Position; // Track previous position for cactus bounce-back
  public health: number;
  public readonly maxHealth: number;
  public readonly aggressive: boolean;
  public readonly movementSpeed: number;
  public readonly detectionRange: number;
  public inventory: Inventory;
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
  private readonly moveDelay = 1200; // 1.2 seconds between moves (slowed down)

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

  // Attack animation properties
  private isAttacking = false;
  private attackAnimationTimer = 0;
  private readonly attackAnimationDuration = 600; // 600ms attack animation
  private attackTarget: Position | null = null;

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
    behaviorType: 'crowded_escape' | 'random_avoidance' | 'exploration' | 'attraction' | 'basic_wander' | 'trader_behavior';
    targetPosition?: Position;
  } | null = null;

  // Track last damage time to prevent spam
  private lastDamageTime = 0;
  private cactusDamageCooldown = 0; // Cooldown to prevent repeated cactus damage

  constructor(config: NPCConfig) {
    this.type = config.type;
    this.position = { ...config.position };
    this.originalPosition = { ...config.position };
    this.previousPosition = { ...config.position }; // Initialize previous position
    this.health = config.health ?? this.getDefaultHealth();
    this.maxHealth = this.health;
    this.aggressive = config.aggressive ?? this.getDefaultAggressive();
    this.movementSpeed = config.movementSpeed ?? 1;
    this.detectionRange = config.detectionRange ?? 5;
    this.inventory = new Inventory();
    this.category = this.getNPCCategory();

    // Initialize NPC inventory with default items
    this.initializeInventory(config.inventory);

    // Initialize with random movement timer
    this.moveCooldown = Math.random() * this.moveDelay; // Stagger initial movement (already in milliseconds)
    this.lastMovementTime = Date.now(); // Initialize movement tracking

    void this.loadAsset();
  }

  private initializeInventory(initialItems?: (InventoryItem | null)[]): void {
    if (initialItems) {
      // Add provided items to inventory
      for (const item of initialItems) {
        if (item) {
          this.inventory.addItem(item.type, item.quantity);
        }
      }
    } else {
      // Generate default inventory based on NPC type
      const defaultItems = this.getDefaultInventoryItems();
      for (const item of defaultItems) {
        this.inventory.addItem(item.type, item.quantity);
      }
    }
  }

  private getDefaultInventoryItems(): { type: string; quantity: number }[] {
    switch (this.type) {
      case 'chicken':
        return [
          { type: 'chicken_meat', quantity: Math.floor(Math.random() * 3) + 1 }, // 1-3
          { type: 'feather', quantity: Math.floor(Math.random() * 2) + 1 } // 1-2
        ].filter(item => item.quantity > 0);

      case 'pig':
        return [
          { type: 'pork', quantity: Math.floor(Math.random() * 4) + 2 }, // 2-5
          { type: 'leather', quantity: Math.floor(Math.random() * 2) + 1 } // 1-2
        ].filter(item => item.quantity > 0);

      case 'sheep':
        return [
          { type: 'mutton', quantity: Math.floor(Math.random() * 3) + 1 }, // 1-3
          { type: 'wool', quantity: Math.floor(Math.random() * 4) + 2 } // 2-5
        ].filter(item => item.quantity > 0);

      case 'trader':
      case 'axeman_trader':
      case 'swordsman_trader':
      case 'spearman_trader':
      case 'farmer_trader':
        return [
          { type: 'gold', quantity: Math.floor(Math.random() * 10) + 5 }, // 5-14
          { type: 'bread', quantity: Math.floor(Math.random() * 3) + 1 }, // 1-3
          { type: 'potion', quantity: Math.floor(Math.random() * 2) + 1 } // 1-2
        ].filter(item => item.quantity > 0);

      case 'orc':
      case 'skeleton':
      case 'goblin':
      case 'archer_goblin':
      case 'club_goblin':
      case 'farmer_goblin':
      case 'orc_shaman':
      case 'spear_goblin':
        return [
          { type: 'bone', quantity: Math.floor(Math.random() * 3) + 1 }, // 1-3
          { type: 'dark_gem', quantity: Math.floor(Math.random() * 2) }, // 0-1
          { type: 'weapon_part', quantity: Math.floor(Math.random() * 2) } // 0-1
        ].filter(item => item.quantity > 0);

      case 'mega_slime_blue':
      case 'slime':
        return [
          { type: 'slime', quantity: Math.floor(Math.random() * 5) + 2 }, // 2-6
          { type: 'blue_essence', quantity: Math.floor(Math.random() * 3) + 1 } // 1-3
        ].filter(item => item.quantity > 0);

      default:
        return [];
    }
  }

  public getInventoryItems(): (InventoryItem | null)[] {
    // Return a copy of inventory items
    const inventoryItems: (InventoryItem | null)[] = [];
    for (let i = 0; i < 9; i++) {
      const item = this.inventory.getItem(i);
      inventoryItems.push(item ? { ...item } : null);
    }
    return inventoryItems;
  }

  public getDropItems(): { type: string; quantity: number }[] {
    // Convert inventory to drop items format
    const dropItems: { type: string; quantity: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const item = this.inventory.getItem(i);
      if (item) {
        dropItems.push({ type: item.type, quantity: item.quantity });
      }
    }
    return dropItems;
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
    this.updateAttackAnimation(deltaTime);
    this.updateCactusCooldown(deltaTime);
    this.updateTileBasedMovement(deltaTime, playerPosition, playerInventory, nearbyNPCs, nearbyVillageBuildings);
  }

  private updateTileBasedMovement(
    deltaTime: number,
    playerPosition: Position,
    playerInventory: InventoryItem[],
    nearbyNPCs: NPC[],
    nearbyVillageBuildings: Position[] = []
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

    // Handle monster behavior - attack nearby friendly NPCs and implement flocking
    if (this.category === 'monster') {
      this.handleMonsterBehavior(deltaTime, playerPosition, nearbyNPCs);
    }

    // Handle bandit behavior - aggressive friendly NPCs that attack monsters and players
    if (this.category === 'friendly' && this.aggressive) {
      this.handleBanditBehavior(deltaTime, playerPosition, nearbyNPCs);
    }

    // Handle trader behavior - attraction to village buildings and monster avoidance
    if (this.category === 'friendly' && !this.aggressive) {
      this.handleTraderBehavior(nearbyVillageBuildings, nearbyNPCs);
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
    const decision = this.calculateMovementDecision(playerPosition, playerInventory, nearbyNPCs, nearbyVillageBuildings);
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

        // Store previous position before moving
        this.previousPosition = { ...this.position };

        // Move to new tile
        this.position = { x: newTileX * 16, y: newTileY * 16 };
        this.lastMovementTime = Date.now(); // Track successful movement


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

          // Store previous position before force moving
          this.previousPosition = { ...this.position };

          this.position = { x: forceTileX * 16, y: forceTileY * 16 };
          this.lastMovementTime = now;
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

  private handleMonsterBehavior(deltaTime: number, playerPosition: Position, nearbyNPCs: NPC[]): void {
    if (this.category !== 'monster') return;

    const now = Date.now();

    // Flocking behavior - move towards friendly NPCs and player
    const targets = [
      { position: playerPosition, priority: 2 },
      ...nearbyNPCs
        .filter(npc => npc.category !== 'monster' && !npc.isDead())
        .map(npc => ({ position: npc.position, priority: 1 }))
    ];

    if (targets.length > 0 && !this.isAttacking) {
      // Find closest target for flocking
      let closestTarget: Position | null = null;
      let minDistance = Infinity;

      for (const target of targets) {
        const distance = this.getDistanceToPosition(target.position);
        if (distance < minDistance) {
          minDistance = distance;
          closestTarget = target.position;
        }
      }

      // Move towards target if not adjacent
      if (closestTarget && minDistance > 1.5) {
        const adjacentTile = this.getAdjacentTileTowards(closestTarget);
        if (adjacentTile && this.canMoveTo(adjacentTile)) {
          this.moveToPosition(adjacentTile);
          this.moveCooldown = this.moveDelay;
          return;
        }
      }
    }

    // Attack behavior - attack adjacent targets
    if (now - this.lastAttackTime >= this.attackCooldown) {
      // Check player
      const playerDistance = this.getDistanceToPosition(playerPosition);
      if (playerDistance <= 1) {
        this.startAttack(playerPosition);
        // Player damage should be handled by the game system
        this.lastAttackTime = now;
        return;
      }

      // Check nearby friendly NPCs
      for (const npc of nearbyNPCs) {
        if (npc.category !== 'monster' && !npc.isDead()) {
          const distance = this.getDistanceToNPC(npc);
          if (distance <= 1) {
            this.startAttack(npc.position);
            npc.takeDamage(5); // Deal 5 damage as specified

            // If the NPC died from our attack, collect its drops
            if (npc.isDead()) {
              const victimDrops = npc.getDropItems();
              for (const drop of victimDrops) {
                if (drop.quantity > 0) {
                  // Try to add each drop to monster's inventory
                  const added = this.inventory.addItem(drop.type, drop.quantity);
                  if (added) {
                    console.log(`🎯 ${this.type} collected ${drop.quantity}x ${drop.type} from killed ${npc.type}`);
                  } else {
                    console.log(`🎯 ${this.type} inventory full! Could not collect ${drop.quantity}x ${drop.type} from ${npc.type}`);
                  }
                }
              }
            }

            this.lastAttackTime = now;
            break;
          }
        }
      }

      // Occasionally attack other monsters (monster-on-monster combat)
      if (Math.random() < 0.1) { // 10% chance to attack other monsters
        for (const npc of nearbyNPCs) {
          if (npc.category === 'monster' && npc !== this && !npc.isDead()) {
            const distance = this.getDistanceToNPC(npc);
            if (distance <= 1) {
              console.log(`⚔️ ${this.type} attacks ${npc.type} (monster vs monster)!`);
              this.startAttack(npc.position);
              npc.takeDamage(3); // Deal 3 damage to other monsters

              // If the monster died from our attack, collect its drops
              if (npc.isDead()) {
                const victimDrops = npc.getDropItems();
                for (const drop of victimDrops) {
                  if (drop.quantity > 0) {
                    const added = this.inventory.addItem(drop.type, drop.quantity);
                    if (added) {
                      console.log(`🎯 ${this.type} collected ${drop.quantity}x ${drop.type} from killed ${npc.type}`);
                    } else {
                      console.log(`🎯 ${this.type} inventory full! Could not collect ${drop.quantity}x ${drop.type} from ${npc.type}`);
                    }
                  }
                }
              }

              this.lastAttackTime = now;
              break;
            }
          }
        }
      }
    }
  }

  // New method for bandit behavior (attacks monsters and players, but not other bandits)
  private handleBanditBehavior(deltaTime: number, playerPosition: Position, nearbyNPCs: NPC[]): void {
    if (!this.aggressive || this.category !== 'friendly') return; // Only aggressive friendly NPCs (bandits)

    const now = Date.now();

    // Bandit flocking behavior - move towards monsters and player
    const targets = [
      { position: playerPosition, priority: 2 },
      ...nearbyNPCs
        .filter(npc => npc.category === 'monster' && !npc.isDead())
        .map(npc => ({ position: npc.position, priority: 1 }))
    ];

    if (targets.length > 0 && !this.isAttacking) {
      // Find closest target for flocking
      let closestTarget: Position | null = null;
      let minDistance = Infinity;

      for (const target of targets) {
        const distance = this.getDistanceToPosition(target.position);
        if (distance < minDistance) {
          minDistance = distance;
          closestTarget = target.position;
        }
      }

      // Move towards target if not adjacent
      if (closestTarget && minDistance > 1.5) {
        const adjacentTile = this.getAdjacentTileTowards(closestTarget);
        if (adjacentTile && this.canMoveTo(adjacentTile)) {
          this.moveToPosition(adjacentTile);
          this.moveCooldown = this.moveDelay;
          return;
        }
      }
    }

    // Attack behavior - attack adjacent monsters and player
    if (now - this.lastAttackTime >= this.attackCooldown) {
      // Check player
      const playerDistance = this.getDistanceToPosition(playerPosition);
      if (playerDistance <= 1) {
        this.startAttack(playerPosition);
        // Player damage should be handled by the game system
        this.lastAttackTime = now;
        return;
      }

      // Check nearby monsters (bandits attack monsters)
      for (const npc of nearbyNPCs) {
        if (npc.category === 'monster' && !npc.isDead()) {
          const distance = this.getDistanceToNPC(npc);
          if (distance <= 1) {
            console.log(`🏴‍☠️ ${this.type} bandit attacks ${npc.type} monster!`);
            this.startAttack(npc.position);
            npc.takeDamage(5); // Deal 5 damage to monsters

            // If the monster died from our attack, collect its drops
            if (npc.isDead()) {
              const victimDrops = npc.getDropItems();
              for (const drop of victimDrops) {
                if (drop.quantity > 0) {
                  const added = this.inventory.addItem(drop.type, drop.quantity);
                  if (added) {
                    console.log(`🎯 ${this.type} bandit collected ${drop.quantity}x ${drop.type} from killed ${npc.type}`);
                  } else {
                    console.log(`🎯 ${this.type} bandit inventory full! Could not collect ${drop.quantity}x ${drop.type} from ${npc.type}`);
                  }
                }
              }
            }

            this.lastAttackTime = now;
            break;
          }
        }
      }

      // Do NOT attack other bandits (friendly NPCs with aggressive=true)
      // This differentiates bandits from monsters
    }
  }

  private handleTraderBehavior(nearbyVillageBuildings: Position[], nearbyNPCs: NPC[] = []): void {
    if (this.category !== 'friendly' || this.isAttacking) return;

    const now = Date.now();

    // Check for nearby monsters and handle defensive combat
    const nearbyMonsters = nearbyNPCs.filter(npc =>
      npc.category === 'monster' && !npc.isDead() && this.getDistanceToNPC(npc) <= this.detectionRange
    );

    // Defensive combat - attack adjacent monsters if not blocking their attack
    if (now - this.lastAttackTime >= this.attackCooldown) {
      const adjacentMonsters = nearbyMonsters.filter(monster => this.getDistanceToNPC(monster) <= 1);

      for (const monster of adjacentMonsters) {
        // Check if monster is attacking this trader
        const isBeingAttacked = monster.isAttacking && monster.attackTarget &&
          Math.floor(monster.attackTarget.x / 16) === Math.floor(this.position.x / 16) &&
          Math.floor(monster.attackTarget.y / 16) === Math.floor(this.position.y / 16);

        if (!isBeingAttacked) {
          // Not being attacked, so can attack the monster
          console.log(`🛡️ ${this.type} defends against ${monster.type}!`);
          this.startAttack(monster.position);
          monster.takeDamage(5); // Traders deal 5 damage

          // If the monster died from our attack, collect its drops
          if (monster.isDead()) {
            const victimDrops = monster.getDropItems();
            for (const drop of victimDrops) {
              if (drop.quantity > 0) {
                const added = this.inventory.addItem(drop.type, drop.quantity);
                if (added) {
                  console.log(`🎯 ${this.type} collected ${drop.quantity}x ${drop.type} from killed ${monster.type}`);
                } else {
                  console.log(`🎯 ${this.type} inventory full! Could not collect ${drop.quantity}x ${drop.type} from ${monster.type}`);
                }
              }
            }
          }

          this.lastAttackTime = now;
          return; // Only attack one monster per turn
        } else {
          // Being attacked - take reduced damage (blocking)
          console.log(`🛡️ ${this.type} blocks attack from ${monster.type}!`);
        }
      }
    }

    if (nearbyMonsters.length > 0) {
      // Monster avoidance takes priority - flee from nearest monster
      const nearestMonster = nearbyMonsters.reduce((closest, monster) => {
        return this.getDistanceToNPC(monster) < this.getDistanceToNPC(closest) ? monster : closest;
      });

      this.state = 'fleeing';
      const fleeTarget = this.getAdjacentTileAway(nearestMonster.position);
      if (fleeTarget && this.canMoveTo(fleeTarget)) {
        this.moveToPosition(fleeTarget);
        this.moveCooldown = this.moveDelay;
        return;
      }
    }

    // Reset fleeing state if no monsters nearby
    if (this.state === 'fleeing' && nearbyMonsters.length === 0) {
      this.state = 'idle';
    }

    // Village building attraction (when not fleeing from monsters)
    if (this.state !== 'fleeing' && nearbyVillageBuildings.length > 0) {
      let targetBuilding: Position | null = null;
      let bestDistance = Infinity;

      for (const building of nearbyVillageBuildings) {
        const distance = this.getDistanceToPosition(building);

        // Look for buildings at optimal distance (3-5 tiles away)
        // Avoid buildings that are too close (< 3 tiles) or too far (> 5 tiles)
        if (distance >= 3 && distance <= 5 && distance < bestDistance) {
          // Check if this building already has other traders nearby
          const tradersNearBuilding = nearbyNPCs.filter(npc =>
            npc.category === 'friendly' && npc !== this &&
            this.getDistanceToPosition(building) <= 3
          ).length;

          // Prefer buildings with fewer traders (avoid clustering)
          if (tradersNearBuilding < 2) {
            bestDistance = distance;
            targetBuilding = building;
          }
        }
      }

      // If we found a good building, move towards it
      if (targetBuilding) {
        const moveTarget = this.getAdjacentTileTowards(targetBuilding);
        if (moveTarget && this.canMoveTo(moveTarget)) {
          // Check spacing from other NPCs before moving
          const spacingOk = this.checkTraderSpacing(moveTarget, nearbyNPCs);
          if (spacingOk) {
            this.moveToPosition(moveTarget);
            this.moveCooldown = this.moveDelay;
            return;
          }
        }
      }

      // If no good building target, do gentle wandering around village
      if (Math.random() < 0.3) { // 30% chance to wander
        const wanderTarget = this.getRandomAdjacentTileWithSpacing(nearbyNPCs);
        if (wanderTarget && this.canMoveTo(wanderTarget)) {
          this.moveToPosition(wanderTarget);
          this.moveCooldown = this.moveDelay;
        }
      }
    }
  }

  private checkTraderSpacing(targetPosition: Position, nearbyNPCs: NPC[]): boolean {
    const targetTileX = Math.floor(targetPosition.x / 16);
    const targetTileY = Math.floor(targetPosition.y / 16);

    // Check for adequate spacing from other NPCs (2+ tile minimum)
    for (const npc of nearbyNPCs) {
      if (npc === this) continue;

      const npcTileX = Math.floor(npc.position.x / 16);
      const npcTileY = Math.floor(npc.position.y / 16);

      const distance = Math.abs(npcTileX - targetTileX) + Math.abs(npcTileY - targetTileY);

      // Maintain 2+ tile spacing from other friendly NPCs and traders
      if ((npc.category === 'friendly' || npc.category === 'animal') && distance < 2) {
        return false;
      }

      // Avoid direct occupation by any NPC
      if (distance === 0) {
        return false;
      }
    }

    return true;
  }

  private getTraderMovementTarget(nearbyNPCs: NPC[], nearbyVillageBuildings: Position[]): Position | null {
    // Check for monsters and flee if needed
    const nearbyMonsters = nearbyNPCs.filter(npc =>
      npc.category === 'monster' && !npc.isDead() && this.getDistanceToNPC(npc) <= this.detectionRange
    );

    if (nearbyMonsters.length > 0) {
      // Flee from nearest monster
      const nearestMonster = nearbyMonsters.reduce((closest, monster) => {
        return this.getDistanceToNPC(monster) < this.getDistanceToNPC(closest) ? monster : closest;
      });
      return this.getAdjacentTileAway(nearestMonster.position);
    }

    // Move towards village buildings with spacing
    if (nearbyVillageBuildings.length > 0) {
      for (const building of nearbyVillageBuildings) {
        const distance = this.getDistanceToPosition(building);

        // Target buildings at good distance (3-5 tiles)
        if (distance >= 3 && distance <= 5) {
          // Check if building has few traders nearby
          const tradersNearBuilding = nearbyNPCs.filter(npc =>
            npc.category === 'friendly' && npc !== this &&
            Math.sqrt(Math.pow(npc.position.x - building.x, 2) + Math.pow(npc.position.y - building.y, 2)) / 16 <= 3
          ).length;

          if (tradersNearBuilding < 2) {
            const moveTarget = this.getAdjacentTileTowards(building);
            if (moveTarget && this.checkTraderSpacing(moveTarget, nearbyNPCs)) {
              return moveTarget;
            }
          }
        }
      }
    }

    // Random wandering if no good building targets
    if (Math.random() < 0.3) {
      return this.getRandomAdjacentTileWithSpacing(nearbyNPCs);
    }

    return null;
  }

  public startAttack(target: Position): void {
    this.isAttacking = true;
    this.attackAnimationTimer = 0;
    this.attackTarget = target;
    this.currentFrame = 0;

    // Face the target
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? 'right' : 'left';
    } else {
      this.direction = dy > 0 ? 'down' : 'up';
    }
  }

  private updateAnimation(deltaTime: number): void {
    if (!this.isLoaded || !this.asset) return;

    const mapping = this.getSpriteMapping();
    const frameCount = mapping?.frames ?? 4;

    // Convert deltaTime from seconds to milliseconds for animation timing
    this.lastFrameTime += deltaTime * 1000;

    // Only animate when moving or attacking
    if (this.state === 'wandering' || this.state === 'following' || this.state === 'fleeing' || this.isAttacking) {
      if (this.lastFrameTime >= this.animationDuration / frameCount) {
        this.currentFrame = (this.currentFrame + 1) % frameCount;
      this.lastFrameTime = 0;
      }
    } else {
      // Reset to idle frame when not moving
      this.currentFrame = 0;
      this.lastFrameTime = 0;
    }
  }

  private updateAttackAnimation(deltaTime: number): void {
    if (this.isAttacking) {
      this.attackAnimationTimer += deltaTime * 1000;

      if (this.attackAnimationTimer >= this.attackAnimationDuration) {
        this.isAttacking = false;
        this.attackAnimationTimer = 0;
        this.attackTarget = null;
        this.currentFrame = 0; // Reset to idle frame
      }
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
    if (this.isAttacking) {
      // Attack animations
      const attackOffset = this.getAttackDirectionOffset();
      spriteIndex = attackOffset + this.currentFrame;

      // Debug: Log attack rendering
      if (Math.random() < 0.01) { // Only log 1% of the time to avoid spam
        console.log(`🎯 Rendering ${this.type} attack frame: ${spriteIndex} (offset: ${attackOffset}, frame: ${this.currentFrame})`);
      }
    } else {
      // Movement animations
      const directionOffset = this.getDirectionOffset();
      spriteIndex = directionOffset + this.currentFrame;
    }

    // Special case: farmer_goblin left direction uses flipped right frames
    const shouldFlip = this.type === 'farmer_goblin' && this.direction === 'left';

    // Render the sprite
    const spriteSize = 16;
    const spritesPerRow = this.sprite.width / spriteSize;
    const spriteX = (spriteIndex % spritesPerRow) * spriteSize;
    const spriteY = Math.floor(spriteIndex / spritesPerRow) * spriteSize;

    // Ensure we don't render outside sprite bounds - fallback to idle frame
    const maxSpriteIndex = (this.sprite.width / spriteSize) * (this.sprite.height / spriteSize) - 1;
    if (spriteIndex > maxSpriteIndex) {
      console.warn(`⚠️ ${this.type} sprite index ${spriteIndex} exceeds max ${maxSpriteIndex}, falling back to idle`);
      const fallbackOffset = this.getDirectionOffset();
      const fallbackSpriteX = (fallbackOffset % spritesPerRow) * spriteSize;
      const fallbackSpriteY = Math.floor(fallbackOffset / spritesPerRow) * spriteSize;

      if (shouldFlip) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(
          this.sprite,
          fallbackSpriteX, fallbackSpriteY, spriteSize, spriteSize,
          -(x + spriteSize), y, spriteSize, spriteSize
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          this.sprite,
          fallbackSpriteX, fallbackSpriteY, spriteSize, spriteSize,
          x, y, spriteSize, spriteSize
        );
      }
    } else {
      if (shouldFlip) {
        // Flip horizontally for farmer_goblin left direction
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(
          this.sprite,
          spriteX, spriteY, spriteSize, spriteSize,
          -(x + spriteSize), y, spriteSize, spriteSize
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          this.sprite,
          spriteX, spriteY, spriteSize, spriteSize,
          x, y, spriteSize, spriteSize
        );
      }
    }

    // Render health bar if damaged
    if (this.health < this.maxHealth && !this.isDead()) {
      this.renderHealthBar(ctx, x, y);
    }

    // Render wide attack animation for SpearGoblin if attacking
    if (this.isAttacking && this.type === 'spear_goblin' && this.attackTarget) {
      this.renderWideAttack(ctx, x, y);
    }
  }

  private getDirectionOffset(): number {
    const mapping = this.getSpriteMapping();
    if (!mapping) return 0;

    switch (this.direction) {
      case 'down': return mapping.down;
      case 'up': return mapping.up;
      case 'left': return mapping.left;
      case 'right': return mapping.right;
      default: return mapping.down;
    }
  }

  private getAttackDirectionOffset(): number {
    const mapping = this.getAttackSpriteMapping();
    if (!mapping) return this.getDirectionOffset(); // Fallback to movement frames

    switch (this.direction) {
      case 'down': return mapping.down;
      case 'up': return mapping.up;
      case 'left': return mapping.left;
      case 'right': return mapping.right;
      default: return mapping.down;
    }
  }

  private getAttackSpriteMapping(): { down: number; up: number; left: number; right: number; frames: number } | null {
    switch (this.type) {
      // Monster NPCs with attack animations
      case 'archer_goblin':
        return { down: 25, up: 30, left: 35, right: 40, frames: 5 };
      case 'club_goblin':
        return { down: 25, up: 30, right: 35, left: 40, frames: 5 };
      case 'farmer_goblin':
        return { down: 25, up: 30, right: 35, left: 35, frames: 5 }; // left uses flipped right
      case 'orc':
        return { down: 25, up: 31, right: 37, left: 43, frames: 5 };
      case 'orc_shaman':
        return { down: 25, up: 30, right: 35, left: 40, frames: 5 };
      case 'spear_goblin':
        return { down: 25, up: 30, right: 35, left: 40, frames: 5 };
      case 'mega_slime_blue':
      case 'slime':
        return { down: 25, left: 31, right: 37, up: 43, frames: 6 };

      // Trader NPCs with attack animations
      case 'axeman_trader':
        return { down: 25, up: 31, right: 37, left: 43, frames: 5 };
      case 'swordsman_trader':
      case 'spearman_trader':
        return { down: 25, up: 30, right: 35, left: 40, frames: 5 };
      case 'farmer_trader':
        return { down: 45, up: 50, right: 55, left: 60, frames: 5 };

      // Animals don't have attack animations
      default:
        return null;
    }
  }

  private moveToPosition(target: Position): void {
    // Store previous position before moving
    this.previousPosition = { ...this.position };

    this.position = { ...target };
    this.lastMovementTime = Date.now();
  }

  private renderWideAttack(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (!this.attackTarget || !this.sprite) return;

    // Calculate facing tile position
    const facingTileX = x + (this.direction === 'right' ? 16 : this.direction === 'left' ? -16 : 0);
    const facingTileY = y + (this.direction === 'down' ? 16 : this.direction === 'up' ? -16 : 0);

    // Get wide attack frame mapping
    const wideFrames = this.getWideAttackFrames();
    if (!wideFrames) return;

    const spriteSize = 16;
    const spritesPerRow = this.sprite.width / spriteSize;

    // Render facing tile animation frame
    const facingSpriteX = (wideFrames.facingTileFrame % spritesPerRow) * spriteSize;
    const facingSpriteY = Math.floor(wideFrames.facingTileFrame / spritesPerRow) * spriteSize;

    ctx.drawImage(
      this.sprite,
      facingSpriteX, facingSpriteY, spriteSize, spriteSize,
      facingTileX, facingTileY, spriteSize, spriteSize
    );
  }

  private getWideAttackFrames(): WideAttackFrame | null {
    if (this.type !== 'spear_goblin') return null;

    // SpearGoblin wide attack - 2-tile attack animation
    const baseOffset = this.getAttackDirectionOffset();
    return {
      playerTileFrame: baseOffset + this.currentFrame,
      facingTileFrame: baseOffset + this.currentFrame + 10 // Offset for facing tile frames
    };
  }

  private getSpriteMapping(): { down: number; up: number; left: number; right: number; frames: number } | null {
    switch (this.type) {
      // Monster NPCs
      case 'archer_goblin':
        return { down: 0, up: 5, left: 10, right: 15, frames: 5 };
      case 'club_goblin':
        return { down: 0, up: 5, right: 10, left: 15, frames: 5 };
      case 'farmer_goblin':
        // Note: left uses flipped right frames (10-14), will need special handling
        return { down: 0, up: 5, right: 10, left: 10, frames: 5 };
      case 'orc':
        return { down: 0, up: 6, right: 12, left: 18, frames: 5 };
      case 'orc_shaman':
        return { down: 0, up: 5, right: 10, left: 15, frames: 5 };
      case 'spear_goblin':
        return { down: 0, up: 5, right: 10, left: 15, frames: 5 };
      case 'mega_slime_blue':
      case 'slime':
        return { down: 0, left: 6, right: 12, up: 18, frames: 6 };

      // Trader NPCs
      case 'axeman_trader':
        return { down: 0, up: 6, right: 12, left: 18, frames: 5 };
      case 'swordsman_trader':
      case 'spearman_trader':
        return { down: 0, up: 5, right: 10, left: 15, frames: 5 };
      case 'farmer_trader':
        return { down: 20, up: 25, right: 30, left: 35, frames: 5 };

      // Default animal mappings
      case 'chicken':
      case 'pig':
      case 'sheep':
        return { down: 0, left: 4, right: 8, up: 12, frames: 4 };

      default:
        return { down: 0, left: 4, right: 8, up: 12, frames: 4 };
    }
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (this.isDead() || this.getHealth() <= 0 || this.getMaxHealth() <= 0) return;

    const barWidth = 14;
    const barHeight = 2;
    const healthPercent = this.getHealth() / this.getMaxHealth();

    // Background (red)
    ctx.fillStyle = 'red';
    ctx.fillRect(x + 1, y - 4, barWidth, barHeight);

    // Foreground (green)
    ctx.fillStyle = 'green';
    ctx.fillRect(x + 1, y - 4, barWidth * healthPercent, barHeight);
  }

  public takeDamage(damage: number): void {
    if (this.state === 'dead') return;

    let actualDamage = damage;

    // Traders can block attacks when being attacked by monsters
    if (this.category === 'friendly') {
      // Check if this trader is currently being attacked (blocking scenario)
      // This would be set by the attacking monster's logic
      const isBlocking = this.isBeingAttackedByMonster();
      if (isBlocking) {
        actualDamage = 1; // Reduce damage to 1 when blocking
        console.log(`🛡️ ${this.type} blocks attack! Reduced damage from ${damage} to ${actualDamage}`);
      }
    }

    this.health -= actualDamage;
    if (this.health <= 0) {
      this.health = 0;
      this.state = 'dead';
    } else if (this.category !== 'monster') {
      this.state = 'fleeing';
    }
  }

  private isBeingAttackedByMonster(): boolean {
    // This is a simplified check - in a more complex system,
    // we'd track which monsters are currently attacking this NPC
    // For now, we'll assume traders can block when they're not attacking
    return !this.isAttacking;
  }

  public isDead(): boolean {
    return this.state === 'dead';
  }

  public isCurrentlyAttacking(): boolean {
    return this.isAttacking;
  }

  public getAttackTarget(): Position | null {
    return this.attackTarget;
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

      // Monster NPCs
      case 'archer_goblin': return 60;
      case 'club_goblin': return 80;
      case 'farmer_goblin': return 70;
      case 'orc': return 120;
      case 'orc_shaman': return 100;
      case 'spear_goblin': return 90;
      case 'mega_slime_blue': return 150;
      case 'slime': return 40;

      // Trader NPCs
      case 'axeman_trader':
      case 'swordsman_trader':
      case 'spearman_trader':
      case 'farmer_trader': return 50;

      default: return 25;
    }
  }

  private getDefaultAggressive(): boolean {
    return this.category === 'monster';
  }

  private getDefaultDropItems(): { type: string; quantity: number }[] {
    switch (this.type) {
      case 'chicken': return [{ type: 'chicken_meat', quantity: 1 }];
      case 'pig': return [{ type: 'pork', quantity: 3 }];
      case 'sheep': return [{ type: 'mutton', quantity: 1 }, { type: 'wool', quantity: 3 }];
      case 'trader': return [];
      case 'orc':
      case 'skeleton':
      case 'goblin': return [{ type: 'copper_ore', quantity: 1 }];

      // Monster NPCs
      case 'archer_goblin':
      case 'club_goblin':
      case 'farmer_goblin':
      case 'spear_goblin':
      case 'slime': return [{ type: 'monster_drop', quantity: 1 }];
      case 'orc_shaman': return [{ type: 'monster_drop', quantity: 2 }];
      case 'mega_slime_blue': return [{ type: 'monster_drop', quantity: 3 }];

      // Trader NPCs
      case 'axeman_trader':
      case 'swordsman_trader':
      case 'spearman_trader':
      case 'farmer_trader': return [{ type: 'gold_ingot', quantity: 1 }];

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
      case 'axeman_trader':
      case 'swordsman_trader':
      case 'spearman_trader':
      case 'farmer_trader':
        return 'friendly';
      case 'orc':
      case 'skeleton':
      case 'goblin':
      case 'archer_goblin':
      case 'club_goblin':
      case 'farmer_goblin':
      case 'orc_shaman':
      case 'spear_goblin':
      case 'mega_slime_blue':
      case 'slime':
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
  private calculateMovementDecision(playerPosition: Position, playerInventory: InventoryItem[], nearbyNPCs: NPC[], nearbyVillageBuildings: Position[] = []): {
    shouldMove: boolean;
    behaviorType: 'crowded_escape' | 'random_avoidance' | 'exploration' | 'attraction' | 'basic_wander' | 'trader_behavior';
    targetPosition?: Position;
  } {
    // Cache the decision for 100ms to ensure consistency between intention and execution
    const now = Date.now();
    if (this.currentMovementDecision && (now - this.currentMovementDecision.timestamp) < 100) {
      return this.currentMovementDecision;
    }

    const distanceToPlayer = this.getDistanceToPosition(playerPosition);
    const hasWheat = playerInventory.some(item => item?.type === 'wheat');

    // Handle trader-specific movement (different from animals)
    if (this.category === 'friendly') {
      // Traders have their own flocking behavior
      const traderTarget = this.getTraderMovementTarget(nearbyNPCs, nearbyVillageBuildings);
      const decision = {
        shouldMove: traderTarget !== null,
        behaviorType: 'trader_behavior' as const,
        targetPosition: traderTarget ?? undefined
      };
      this.currentMovementDecision = { timestamp: now, ...decision };
      return decision;
    }

    // Handle special movement states (non-random) - for animals and monsters
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
  public getMovementIntention(playerPosition: Position, playerInventory: InventoryItem[], nearbyNPCs: NPC[], nearbyVillageBuildings: Position[] = []): Position | null {
    const decision = this.calculateMovementDecision(playerPosition, playerInventory, nearbyNPCs, nearbyVillageBuildings);
    return decision.targetPosition ?? null;
  }

  public renderSpriteOnly(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (!this.isLoaded || !this.sprite || !this.asset) return;

    // Calculate sprite frame based on direction and animation
    let spriteIndex = 0;
    if (this.isAttacking) {
      // Attack animations
      const attackOffset = this.getAttackDirectionOffset();
      spriteIndex = attackOffset + this.currentFrame;
    } else {
      // Movement animations
      const directionOffset = this.getDirectionOffset();
      spriteIndex = directionOffset + this.currentFrame;
    }

    // Special case: farmer_goblin left direction uses flipped right frames
    const shouldFlip = this.type === 'farmer_goblin' && this.direction === 'left';

    // Render the sprite
    const spriteSize = 16;
    const spritesPerRow = this.sprite.width / spriteSize;
    const spriteX = (spriteIndex % spritesPerRow) * spriteSize;
    const spriteY = Math.floor(spriteIndex / spritesPerRow) * spriteSize;

    // Ensure we don't render outside sprite bounds - fallback to idle frame
    const maxSpriteIndex = (this.sprite.width / spriteSize) * (this.sprite.height / spriteSize) - 1;
    if (spriteIndex > maxSpriteIndex) {
      console.warn(`⚠️ ${this.type} sprite index ${spriteIndex} exceeds max ${maxSpriteIndex}, falling back to idle`);
      const fallbackOffset = this.getDirectionOffset();
      const fallbackSpriteX = (fallbackOffset % spritesPerRow) * spriteSize;
      const fallbackSpriteY = Math.floor(fallbackOffset / spritesPerRow) * spriteSize;

      if (shouldFlip) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(
          this.sprite,
          fallbackSpriteX, fallbackSpriteY, spriteSize, spriteSize,
          -(x + spriteSize), y, spriteSize, spriteSize
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          this.sprite,
          fallbackSpriteX, fallbackSpriteY, spriteSize, spriteSize,
          x, y, spriteSize, spriteSize
        );
      }
    } else {
      if (shouldFlip) {
        // Flip horizontally for farmer_goblin left direction
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(
          this.sprite,
          spriteX, spriteY, spriteSize, spriteSize,
          -(x + spriteSize), y, spriteSize, spriteSize
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          this.sprite,
          spriteX, spriteY, spriteSize, spriteSize,
          x, y, spriteSize, spriteSize
        );
      }
    }

    // Render wide attack animation for SpearGoblin if attacking
    if (this.isAttacking && this.type === 'spear_goblin' && this.attackTarget) {
      this.renderWideAttack(ctx, x, y);
    }
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  public canTakeCactusDamage(): boolean {
    return this.cactusDamageCooldown <= 0;
  }

  public setCactusDamageCooldown(milliseconds = 1000): void {
    this.cactusDamageCooldown = milliseconds;
  }

  public updateCactusCooldown(deltaTime: number): void {
    if (this.cactusDamageCooldown > 0) {
      this.cactusDamageCooldown -= deltaTime * 1000; // Convert to milliseconds
      if (this.cactusDamageCooldown < 0) {
        this.cactusDamageCooldown = 0;
      }
    }
  }
}