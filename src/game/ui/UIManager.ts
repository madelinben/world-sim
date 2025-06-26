import { type Inventory, type InventoryItem } from '../entities/inventory/Inventory';
import type { Tombstone } from '../entities/poi/Tombstone';
import type { Chest } from '../entities/poi/Chest';
import { getMenuOption, getPromptMessage } from '../translations/ui';

export interface TextBoxOptions {
  text: string;
  title?: string;
  villageName?: string;
  visible: boolean;
}

export interface ConsoleLogEntry {
  text: string;
  timestamp: number;
}

export interface PersistentInfo {
  playerPosition: { x: number; y: number };
  nearestWell: { x: number; y: number } | null;
  nearestMine: { x: number; y: number } | null;
  nearestDungeon: { x: number; y: number } | null;
  nearestPortal: { x: number; y: number } | null;
  renderingMode: 'world' | 'dungeon' | 'mine';
}

export interface ArmorSlot {
  type: 'head' | 'torso' | 'arms' | 'legs' | 'feet' | 'left_hand' | 'wearable';
  item: InventoryItem | null;
}

export class UIManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private textBox: TextBoxOptions = { text: '', visible: false };
  private inventory: Inventory | null = null;
  private fontLoaded = false;
  private inventoryUIVisible = false; // Player inventory UI state
  private tradeInventoryUIVisible = false; // Trade inventory UI state

  // Tombstone interaction state
  private tombstoneUIVisible = false;
  private currentTombstone: Tombstone | null = null;
  private tombstoneSelectedSlot = 0; // Selected slot in tombstone inventory

  // Chest interaction state
  private chestUIVisible = false;
  private currentChest: Chest | null = null;
  private chestSelectedSlot = 0; // Selected slot in chest inventory

  // Dual inventory state (for both chest and tombstone)
  private dualInventoryMode: 'player' | 'container' = 'player'; // Which side is selected
  private playerSelectedSlot = 0; // Selected slot in player inventory

  // Console UI state - now persistent info instead of log entries
  private persistentInfo: PersistentInfo = {
    playerPosition: { x: 0, y: 0 },
    nearestWell: null,
    nearestMine: null,
    nearestDungeon: null,
    nearestPortal: null,
    renderingMode: 'world'
  };

  // Menu UI state
  private menuUIVisible = false;
  private menuSelectedOption = 0; // 0 = back to game, 1 = save game
  private readonly menuOptions = ['Back to Game', 'Save Game'];

  // Player character data
  private playerName = 'Hero'; // Default player name
  private playerSprite: HTMLImageElement | null = null;
  private playerSpriteLoaded = false;

  // Player sprite animation for inventory UI
  private playerSpriteAnimationFrame = 0;
  private playerSpriteLastFrameTime = 0;
  private readonly playerSpriteAnimationDuration = 800; // 800ms per cycle (4 frames)

  // Player inventory UI navigation state
  private playerInventorySelectedSlot = 0; // 0-8 for inventory, 9-15 for armor slots
  private readonly maxInventorySlots = 16;

  // Player name editing state
  private isEditingPlayerName = false;
  private editingPlayerName = '';
  private playerNameCursorVisible = true;
  private playerNameCursorTimer = 0;

  // Armor slots for player
  private armorSlots: ArmorSlot[] = [
    { type: 'head', item: null },
    { type: 'torso', item: null },
    { type: 'arms', item: null },
    { type: 'legs', item: null },
    { type: 'feet', item: null },
    { type: 'left_hand', item: null },
    { type: 'wearable', item: null }
  ];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    void this.loadPixelFont();
    void this.loadPlayerSprite();
  }

  private async loadPixelFont(): Promise<void> {
    try {
      // Load Press Start 2P font from Google Fonts
      const font = new FontFace('Press Start 2P', 'url(https://fonts.gstatic.com/s/pressstart2p/v14/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff2)');
      await font.load();
      document.fonts.add(font);
      this.fontLoaded = true;
      console.log('Press Start 2P font loaded successfully');
    } catch (error) {
      console.warn('Failed to load Press Start 2P font, using fallback:', error);
      this.fontLoaded = false;
    }
  }

  private async loadPlayerSprite(): Promise<void> {
    try {
      this.playerSprite = new Image();
      // Use the same sprite as the actual player character
      this.playerSprite.src = '/sprites/Characters/Monsters/Demons/RedDemon.png';

      await new Promise<void>((resolve, reject) => {
        if (!this.playerSprite) {
          reject(new Error('Player sprite is null'));
          return;
        }

        this.playerSprite.onload = () => {
          this.playerSpriteLoaded = true;
          console.log('Player sprite loaded successfully for UI!');
          resolve();
        };

        this.playerSprite.onerror = () => {
          console.error('Failed to load player sprite for UI');
          reject(new Error('Failed to load player sprite'));
        };
      });
    } catch (error) {
      console.error('Failed to load player sprite for UI:', error);
    }
  }

  public setInventory(inventory: Inventory): void {
    this.inventory = inventory;
  }

  public showTextBox(options: Omit<TextBoxOptions, 'visible'>): void {
    this.textBox = { ...options, visible: true };
  }

  public hideTextBox(): void {
    this.textBox.visible = false;
  }

  public isTextBoxVisible(): boolean {
    return this.textBox.visible;
  }

  public toggleInventoryUI(): void {
    this.inventoryUIVisible = !this.inventoryUIVisible;
    console.log(`Player Inventory UI ${this.inventoryUIVisible ? 'opened' : 'closed'}`);
  }

  public isInventoryUIVisible(): boolean {
    return this.inventoryUIVisible;
  }

  public closeInventoryUI(): void {
    this.inventoryUIVisible = false;
    console.log('Player Inventory UI closed');
  }

  public toggleTradeInventoryUI(): void {
    this.tradeInventoryUIVisible = !this.tradeInventoryUIVisible;
    console.log(`Trade Inventory UI ${this.tradeInventoryUIVisible ? 'opened' : 'closed'}`);
  }

  public isTradeInventoryUIVisible(): boolean {
    return this.tradeInventoryUIVisible;
  }

  public closeTradeInventoryUI(): void {
    this.tradeInventoryUIVisible = false;
    console.log('Trade Inventory UI closed');
  }

  public isAnyUIVisible(): boolean {
    return this.textBox.visible || this.inventoryUIVisible || this.tradeInventoryUIVisible ||
           this.tombstoneUIVisible || this.chestUIVisible || this.menuUIVisible;
  }

  public generateNoticeText(villageName: string): string {
    const welcomeMessages = [
      `Welcome to ${villageName}!`,
      `Greetings, traveler! You have arrived at ${villageName}.`,
      `${villageName} welcomes you, adventurer!`,
      `You've discovered the peaceful village of ${villageName}.`
    ];

    const villageInfo = [
      'This village is home to friendly animals and hardworking villagers.',
      'Our markets offer fresh goods and supplies for your journey.',
      'The windmill provides grain for the whole community.',
      'Feel free to explore and meet our animal friends!',
      'The village well provides clean water for all residents.',
      'Trade with our merchants to stock up on supplies.',
      'Our community has thrived here for many generations.'
    ];

    const selectedWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    const selectedInfo = villageInfo[Math.floor(Math.random() * villageInfo.length)];

    return `${selectedWelcome}\n\n${selectedInfo}\n\nPress any key to continue...`;
  }

  public update(deltaTime: number): void {
    // Update player sprite animation for inventory UI
    if (this.playerSpriteLoaded && this.playerSprite) {
      this.playerSpriteLastFrameTime += deltaTime * 1000;
      const frameTime = this.playerSpriteAnimationDuration / 4; // 4 frames per animation

      if (this.playerSpriteLastFrameTime >= frameTime) {
        this.playerSpriteAnimationFrame = (this.playerSpriteAnimationFrame + 1) % 4;
        this.playerSpriteLastFrameTime = 0;
      }
    }

    // Update cursor blinking for player name editing
    if (this.isEditingPlayerName) {
      this.playerNameCursorTimer += deltaTime * 1000;
      if (this.playerNameCursorTimer >= 500) { // Blink every 500ms
        this.playerNameCursorVisible = !this.playerNameCursorVisible;
        this.playerNameCursorTimer = 0;
      }
    }
  }

  public render(inventory: (InventoryItem | null)[], selectedSlot: number): void {
    // Only render the right-side inventory panel if no inventory UI is visible
    if (!this.inventoryUIVisible && !this.tradeInventoryUIVisible && !this.chestUIVisible && !this.tombstoneUIVisible) {
    this.renderInventory(inventory, selectedSlot);
    }

    this.renderTextBox();
    this.renderPlayerInventoryUI(inventory, selectedSlot);
    this.renderTradeInventoryUI(inventory, selectedSlot);
    this.renderChestUI(inventory, selectedSlot);
    this.renderMenuUI();
    this.renderConsoleUI();
  }

  /**
   * Update persistent information for the console UI
   */
  public updatePersistentInfo(info: Partial<PersistentInfo>): void {
    this.persistentInfo = { ...this.persistentInfo, ...info };
  }

  /**
   * Legacy method for backwards compatibility - now updates persistent info
   */
  public addConsoleLog(text: string): void {
    // Parse the text to extract position information if it's a position log
    if (text.startsWith('Player: (')) {
      const match = /Player: \((\d+), (\d+)\)/.exec(text);
      if (match) {
        this.persistentInfo.playerPosition = { x: parseInt(match[1]!), y: parseInt(match[2]!) };
      }
    } else if (text.startsWith('Nearest Well: (')) {
      const match = /Nearest Well: \((\d+), (\d+)\)/.exec(text);
      if (match) {
        this.persistentInfo.nearestWell = { x: parseInt(match[1]!), y: parseInt(match[2]!) };
      }
    } else if (text.startsWith('Nearest Dungeon: (')) {
      const match = /Nearest Dungeon: \((\d+), (\d+)\)/.exec(text);
      if (match) {
        this.persistentInfo.nearestDungeon = { x: parseInt(match[1]!), y: parseInt(match[2]!) };
      }
    }
  }

  /**
   * Calculate shared UI layout dimensions based on canvas size and inventory panel
   * This ensures consistent responsive sizing for text box and inventory UI components
   */
  private calculateSharedUIDimensions() {
    const canvas = this.canvas;

    // Right-side inventory panel dimensions (from renderInventory)
    const slotSize = 50;
    const inventoryPadding = 12;
    const spaceFromInventoryToEdge = 15;
    const inventoryPanelWidth = slotSize + (inventoryPadding * 2); // 74px
    const slots = 9;
    const slotPadding = 8;
    const inventoryPanelHeight = (slotSize + slotPadding) * slots - slotPadding + (inventoryPadding * 2);

    // Calculate available space for UI components (excluding right-side inventory panel)
    const availableWidth = canvas.width - inventoryPanelWidth - spaceFromInventoryToEdge;

    // UI component dimensions
    const uiPadding = 20;
    const uiWidth = availableWidth - (uiPadding * 2); // Leave padding on sides
    const uiCenterX = (availableWidth - uiWidth) / 2; // Center horizontally in available space

    return {
      inventoryPanel: {
        width: inventoryPanelWidth,
        height: inventoryPanelHeight,
        x: canvas.width - inventoryPanelWidth - spaceFromInventoryToEdge,
        y: (canvas.height - inventoryPanelHeight) / 2
      },
      sharedUI: {
        availableWidth,
        width: uiWidth,
        centerX: uiCenterX,
        padding: uiPadding
      }
    };
  }

  private renderInventory(inventory: (InventoryItem | null)[], selectedSlot: number): void {
    const canvas = this.canvas;
    const ctx = this.ctx;

    // Vertical column inventory configuration
    const slotSize = 50;
    const slotPadding = 8;
    const inventoryPadding = 12;
    const slots = 9; // 9 slots total in vertical column

    // Calculate inventory panel dimensions (single column)
    const panelWidth = slotSize + (inventoryPadding * 2);
    const panelHeight = (slotSize + slotPadding) * slots - slotPadding + (inventoryPadding * 2);

    // Position at right side, vertically centered
    const panelX = canvas.width - panelWidth - 15;
    const panelY = (canvas.height - panelHeight) / 2;

    // Draw inventory background panel
    this.drawBubble(ctx, panelX, panelY, panelWidth, panelHeight, 8, '#f8f9fa', '#dee2e6');

    // Render each inventory slot vertically (only first 9 slots)
    for (let i = 0; i < slots; i++) {
      const slotX = panelX + inventoryPadding;
      const slotY = panelY + inventoryPadding + (i * (slotSize + slotPadding));

      const item = inventory[i] ?? null;
      const isSelected = i === selectedSlot;

      this.renderInventorySlot(ctx, slotX, slotY, slotSize, item, isSelected, i + 1);
    }
  }

  private renderInventorySlot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    item: InventoryItem | null,
    isSelected: boolean,
    slotNumber: number
  ): void {
    // Draw slot background bubble
    const bgColor = isSelected ? '#e3f2fd' : '#ffffff';
    const borderColor = isSelected ? '#2196f3' : '#bdc3c7';
    this.drawBubble(ctx, x, y, size, size, 4, bgColor, borderColor);

    // Draw slot number in top-left corner
    ctx.save();
    ctx.fillStyle = '#666666';
    ctx.font = this.fontLoaded ? '6px "Press Start 2P"' : '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(slotNumber.toString(), x + 2, y + 2);
    ctx.restore();

    // Draw item if present
    if (item && item.quantity > 0) {
      // Simple coloured circle for item representation
      const itemColour = this.getItemColour(item.type);
      const centerX = x + size / 2;
      const centerY = y + size / 2;
      const radius = size * 0.25;

      ctx.save();
      ctx.fillStyle = itemColour;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Draw quantity if > 1
      if (item.quantity > 1) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.font = this.fontLoaded ? '5px "Press Start 2P"' : '8px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        const text = item.quantity.toString();
        const textX = x + size - 2;
        const textY = y + size - 2;

        ctx.strokeText(text, textX, textY);
        ctx.fillText(text, textX, textY);
        ctx.restore();
      }
    }
  }

      private getItemColour(itemType: string): string {
        // Colour mapping for different item types
        const colours: Record<string, string> = {
      'wood': '#8d6e63',
      'stone': '#607d8b',
      'wheat': '#ffc107',
      'water': '#2196f3',
      'cactus_fruit': '#4caf50',
      'meat': '#f44336',
      'wool': '#ffffff',
      'egg': '#fff9c4',
      'milk': '#f5f5f5'
    };

            return colours[itemType] ?? '#9e9e9e';
  }

  private renderInventoryUI(): void {
    if (!this.inventoryUIVisible) return;

    const canvas = this.canvas;
    const ctx = this.ctx;

    // Use shared UI dimensions for consistent responsive layout
    const dimensions = this.calculateSharedUIDimensions();

    // Inventory UI matches text box width and inventory panel height
    const inventoryUIWidth = dimensions.sharedUI.width;
    const inventoryUIHeight = dimensions.inventoryPanel.height; // Same height as right-side inventory panel
    const inventoryUIX = dimensions.sharedUI.centerX;
    const inventoryUIY = (canvas.height - inventoryUIHeight) / 2; // Vertically centered

    // Draw inventory UI bubble
    this.drawBubble(ctx, inventoryUIX, inventoryUIY, inventoryUIWidth, inventoryUIHeight, 15, '#f8f9fa', '#dee2e6');

    // Add title
    ctx.fillStyle = '#2c3e50';
    ctx.font = this.fontLoaded ? '12px "Press Start 2P"' : 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Inventory Details', inventoryUIX + inventoryUIWidth / 2, inventoryUIY + 30);

    // Add responsive instructions text
    ctx.fillStyle = '#34495e';
    ctx.font = this.fontLoaded ? '8px "Press Start 2P"' : '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Show responsive information
    const responsiveInfo = `Width: ${inventoryUIWidth}px (Available: ${dimensions.sharedUI.availableWidth}px)`;
    ctx.fillText(responsiveInfo, inventoryUIX + inventoryUIWidth / 2, inventoryUIY + inventoryUIHeight - 50);

    // Close instruction
    ctx.fillText('Press E or ESC to close', inventoryUIX + inventoryUIWidth / 2, inventoryUIY + inventoryUIHeight - 30);
  }

  private renderTextBox(): void {
    if (!this.textBox.visible) return;

    const canvas = this.canvas;
    const ctx = this.ctx;

    // Use shared UI dimensions for consistent responsive layout
    const dimensions = this.calculateSharedUIDimensions();

    // Calculate text box dimensions using responsive layout
    const textBoxHeight = 140;
    const textBoxY = canvas.height - textBoxHeight - dimensions.sharedUI.padding;
    const textBoxWidth = dimensions.sharedUI.width; // Same width as inventory UI
    const textBoxX = dimensions.sharedUI.centerX; // Same centering as inventory UI

    // Create bubble effect with rounded rectangle
    this.drawBubble(ctx, textBoxX, textBoxY, textBoxWidth, textBoxHeight, 15);

    // Get fonts
    const titleFont = this.fontLoaded ? '12px "Press Start 2P"' : 'bold 16px Arial';
    const bodyFont = this.fontLoaded ? '8px "Press Start 2P"' : '14px Arial';
    const continueFont = this.fontLoaded ? '7px "Press Start 2P"' : '12px Arial';

    // Title
    const title = this.textBox.title ?? (this.textBox.villageName
      ? `${this.textBox.villageName} Notice Board`
      : 'Notice Board');

    ctx.fillStyle = '#2c3e50';
    ctx.font = titleFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, textBoxX + textBoxWidth / 2, textBoxY + 30);

    // Separate main text from continue prompt
    const fullText = this.textBox.text;
    const continuePrompt = 'Press any key to continue...';
    let mainText = fullText;

    // Check if the text ends with the continue prompt and separate it
    if (fullText.includes(continuePrompt)) {
      mainText = fullText.replace(continuePrompt, '').trim();
      // Remove trailing newlines and dots
      mainText = mainText.replace(/\n+$/, '').replace(/\.{3}$/, '');
    }

    // Ensure mainText is never undefined
    const safeMainText = mainText || '';

    // Main text content with proper line break handling
    const lines = this.wrapTextWithLineBreaks(safeMainText, textBoxWidth - 40, bodyFont);
    ctx.fillStyle = '#34495e';
    ctx.font = bodyFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const lineHeight = this.fontLoaded ? 16 : 18;
    const startY = textBoxY + 55;
    const maxContentHeight = textBoxHeight - 90; // Reserve space for title and continue prompt

    // Render main content lines
    let lastLineY = startY;
    lines.forEach((line, index) => {
      const lineY = startY + (index * lineHeight);
      if (lineY < textBoxY + startY + maxContentHeight - lineHeight) { // Don't overflow into continue prompt area
        ctx.fillText(line, textBoxX + textBoxWidth / 2, lineY);
        lastLineY = lineY + lineHeight;
      }
    });

    // Render "Press any key to continue..." at the bottom
    ctx.fillStyle = '#7f8c8d'; // Lighter gray color to distinguish from main text
    ctx.font = continueFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Position at bottom of text box with some padding
    const continueY = textBoxY + textBoxHeight - 15;
    ctx.fillText(continuePrompt, textBoxX + textBoxWidth / 2, continueY);
  }

  private drawBubble(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillColor = '#ffffff',
    borderColor = '#bdc3c7'
  ): void {
    ctx.save();

    // Create rounded rectangle path
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    // Add subtle shadow effect
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Fill background
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private wrapText(text: string, maxWidth: number, font = '14px Arial'): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    this.ctx.font = font;

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = this.ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private wrapTextWithLineBreaks(text: string, maxWidth: number, font = '14px Arial'): string[] {
    const lines: string[] = [];
    this.ctx.font = font;

    // First split by existing line breaks
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        // Empty line/paragraph break
        lines.push('');
        continue;
      }

      // Apply word wrapping to each paragraph
      const wrappedLines = this.wrapText(paragraph.trim(), maxWidth, font);
      lines.push(...wrappedLines);
    }

    return lines;
  }

  // Tombstone UI methods
  public showTombstoneUI(tombstone: Tombstone): void {
    this.tombstoneUIVisible = true;
    this.tradeInventoryUIVisible = true; // Use trade inventory UI for tombstones
    this.currentTombstone = tombstone;
    this.tombstoneSelectedSlot = 0; // Reset to first slot
    this.dualInventoryMode = 'player'; // Start with player side selected
    this.playerSelectedSlot = 0; // Reset player selection
    console.log(`Tombstone UI opened for ${tombstone.getDisplayName()}`);
  }

  public hideTombstoneUI(): void {
    this.tombstoneUIVisible = false;
    this.tradeInventoryUIVisible = false; // Also hide trade inventory UI
    this.currentTombstone = null;
    this.tombstoneSelectedSlot = 0;
    this.dualInventoryMode = 'player'; // Reset to player mode
    this.playerSelectedSlot = 0; // Reset selection
    console.log('Tombstone UI closed');
  }

  public isTombstoneUIVisible(): boolean {
    return this.tombstoneUIVisible;
  }

  public getCurrentTombstone(): Tombstone | null {
    return this.currentTombstone;
  }

  public getTombstoneSelectedSlot(): number {
    return this.tombstoneSelectedSlot;
  }

  public navigateTombstoneInventory(direction: 'left' | 'right' | 'up' | 'down'): void {
    if (!this.tombstoneUIVisible || !this.currentTombstone) return;

    // Use the same navigation logic as chest inventory but handle both chest and tombstone
    if (this.currentChest) {
      this.navigateChestInventory(direction);
    } else if (this.currentTombstone) {
      // Apply the same navigation logic for tombstones
      this.navigateDualInventory(direction, 'tombstone');
    }
  }

  public getTombstoneSelectedItem(): InventoryItem | null {
    if (!this.currentTombstone) return null;
    return this.currentTombstone.inventory[this.tombstoneSelectedSlot] ?? null;
  }

  // Chest UI methods
  public showChestUI(chest: Chest): void {
    this.chestUIVisible = true;
    this.currentChest = chest;
    this.chestSelectedSlot = 0; // Reset to first slot
    console.log(`Chest UI opened for ${chest.getDisplayName()}`);
  }

  public hideChestUI(): void {
    this.chestUIVisible = false;
    this.tradeInventoryUIVisible = false; // Also hide trade inventory UI
    this.currentChest = null;
    this.chestSelectedSlot = 0;
    this.dualInventoryMode = 'player'; // Reset to player mode
    this.playerSelectedSlot = 0; // Reset selection
    console.log('Chest UI closed');
  }

  public isChestUIVisible(): boolean {
    return this.chestUIVisible;
  }

  public getCurrentChest(): Chest | null {
    return this.currentChest;
  }

  public getChestSelectedSlot(): number {
    return this.chestSelectedSlot;
  }

  public navigateChestInventory(direction: 'left' | 'right' | 'up' | 'down'): void {
    if (!this.chestUIVisible || !this.currentChest) return;
    this.navigateDualInventory(direction, 'chest');
  }

  public getChestSelectedItem(): InventoryItem | null {
    if (!this.currentChest) return null;
    return this.currentChest.inventory[this.chestSelectedSlot] ?? null;
  }

  public getDualInventoryMode(): 'player' | 'container' {
    return this.dualInventoryMode;
  }

  public getPlayerSelectedSlot(): number {
    return this.playerSelectedSlot;
  }

  public getSelectedItemFromCurrentMode(): InventoryItem | null {
    if (!this.chestUIVisible) return null;

    if (this.dualInventoryMode === 'player') {
      // Would need player inventory access - handled in Game.ts
      return null;
    } else {
      return this.getChestSelectedItem();
    }
  }

  private renderChestUI(playerInventory?: (InventoryItem | null)[], playerSelectedSlot?: number): void {
    if (!this.chestUIVisible || !this.currentChest) return;

    // Use the new trade inventory UI instead
    this.tradeInventoryUIVisible = true;
    this.renderTradeInventoryUI(playerInventory ?? [], playerSelectedSlot ?? 0);
  }

  private renderPlayerInventoryUI(inventory: (InventoryItem | null)[], selectedSlot: number): void {
    if (!this.inventoryUIVisible) return;

    const canvas = this.canvas;
    const ctx = this.ctx;

    // Use full-width dimensions
    const dimensions = this.calculateFullWidthUIDimensions();

    // Draw main container
    this.drawBubble(ctx, dimensions.x, dimensions.y, dimensions.width, dimensions.height, 15, '#f8f9fa', '#dee2e6');

    // Split into two halves - inventory (left 50%) and character view (right 50%)
    const halfWidth = dimensions.width / 2;
    const padding = 20;
    const titleHeight = 40;

    // Left side - Player Inventory
    const inventoryStartX = dimensions.x + 10;
    const inventoryWidth = halfWidth - 20;

    // Draw player inventory title
    ctx.fillStyle = '#2c3e50';
    ctx.font = this.fontLoaded ? '12px "Press Start 2P"' : 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Player Inventory:', inventoryStartX + inventoryWidth / 2, dimensions.y + 25);

    // Draw 3x3 inventory grid (9 slots) at top of left side
    const slotsPerRow = 3;
    const rows = 3;

    // Calculate available space for inventory grid only (no armor slots on left side)
    const availableInventoryWidth = inventoryWidth - 20; // Account for padding
    const totalWidthSpacing = (slotsPerRow - 1) * 8; // 8px spacing between slots

    // Calculate available height for inventory grid - need to account for 4 armor rows on right side
    const instructionHeight = 30; // Space for instructions at bottom
    const availableInventoryHeight = dimensions.height - titleHeight - instructionHeight - 40; // Extra padding
    const totalHeightSpacing = (rows - 1) * 8; // 8px spacing between rows

    // Account for armor slots which have 4 rows (need to fit 4 rows in available height)
    const maxArmorRows = 4; // Column 1 has 4 slots (head, torso, legs, feet)
    const armorHeightSpacing = (maxArmorRows - 1) * 8; // 8px spacing between armor rows

    // Calculate slot size based on both width and height constraints
    const maxSlotSizeByWidth = Math.floor((availableInventoryWidth - totalWidthSpacing) / slotsPerRow);
    const maxSlotSizeByHeight = Math.floor((availableInventoryHeight - totalHeightSpacing) / rows);
    const maxSlotSizeByArmorHeight = Math.floor((availableInventoryHeight - armorHeightSpacing) / maxArmorRows);

    // Use the most restrictive constraint to ensure everything fits
    const slotSize = Math.max(30, Math.min(maxSlotSizeByWidth, maxSlotSizeByHeight, maxSlotSizeByArmorHeight));
    const slotSpacing = 8;

    const gridWidth = (slotSize * slotsPerRow) + (slotSpacing * (slotsPerRow - 1));
    const gridStartX = inventoryStartX + (inventoryWidth - gridWidth) / 2;
    const gridStartY = dimensions.y + titleHeight + 10;

    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / slotsPerRow);
      const col = i % slotsPerRow;
      const slotX = gridStartX + col * (slotSize + slotSpacing);
      const slotY = gridStartY + row * (slotSize + slotSpacing);

      const item = inventory[i] ?? null;
      // When player inventory UI is visible, only use playerInventorySelectedSlot for selection
      const isSelected = this.inventoryUIVisible ? this.playerInventorySelectedSlot === i : i === selectedSlot;

      this.renderInventorySlot(ctx, slotX, slotY, slotSize, item, isSelected, i + 1);
    }

    // Remove armor slots from left side - they will be rendered on the right side now

    // Right side - Character View with Armor Slots
    const characterStartX = dimensions.x + halfWidth + 10;
    const characterWidth = halfWidth - 20;

    // Draw character name title (editable)
    ctx.fillStyle = '#2c3e50';
    ctx.font = this.fontLoaded ? '12px "Press Start 2P"' : 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const displayName = this.isEditingPlayerName ? this.editingPlayerName : this.playerName;
    const nameText = `Player: ${displayName}`;

    // Add cursor if editing
    const finalText = this.isEditingPlayerName && this.playerNameCursorVisible ?
      `Player: ${displayName}|` : nameText;

    ctx.fillText(finalText, characterStartX + characterWidth / 2, dimensions.y + 25);

    // Layout: Armor slots on left, player sprite on right
    // Use same slot size as inventory for consistency
    const armorSlotSize = slotSize; // Match inventory slot size
    const armorSlotSpacing = slotSpacing; // Match inventory spacing
    const armorSectionWidth = (armorSlotSize * 3) + (armorSlotSpacing * 2) + 20; // 3 columns + spacing + padding
    const spriteAreaWidth = characterWidth - armorSectionWidth - 10; // Remaining space for sprite

    // Armor slots layout in 3 columns aligned at top:
    // Col 1: head, torso, legs, feet (4 vertical slots)
    // Col 2: left_hand, right_hand, wearable (3 vertical slots) - Note: using 'arms' as right_hand
    // Col 3: (empty for now, can be used for future expansion)
    const col1Slots = ['head', 'torso', 'legs', 'feet'];
    const col2Slots = ['left_hand', 'arms', 'wearable']; // arms represents right_hand

    const armorStartX = characterStartX + 10;
    const armorStartY = dimensions.y + titleHeight + 20;

    // Column 1 armor slots (4 vertical slots)
    for (let i = 0; i < col1Slots.length; i++) {
      const slotType = col1Slots[i];
      if (!slotType) continue;

      const slotX = armorStartX;
      const slotY = armorStartY + i * (armorSlotSize + armorSlotSpacing);

      const armorSlot = this.armorSlots.find(slot => slot.type === slotType);
      const armorSlotIndex = 9 + i; // First column starts at index 9 (after 9 inventory slots)
      const isArmorSelected = this.inventoryUIVisible && this.playerInventorySelectedSlot === armorSlotIndex;
      this.renderArmorSlot(ctx, slotX, slotY, armorSlotSize, armorSlot?.item ?? null, slotType, isArmorSelected);
    }

    // Column 2 armor slots (3 vertical slots, aligned at top)
    for (let i = 0; i < col2Slots.length; i++) {
      const slotType = col2Slots[i];
      if (!slotType) continue;

      const slotX = armorStartX + armorSlotSize + armorSlotSpacing;
      const slotY = armorStartY + i * (armorSlotSize + armorSlotSpacing);

      const armorSlot = this.armorSlots.find(slot => slot.type === slotType);
      const armorSlotIndex = 13 + i; // Second column starts at index 13
      const isArmorSelected = this.inventoryUIVisible && this.playerInventorySelectedSlot === armorSlotIndex;
      this.renderArmorSlot(ctx, slotX, slotY, armorSlotSize, armorSlot?.item ?? null, slotType, isArmorSelected);
    }

    // Draw player sprite in remaining space to the right of armor slots
    if (this.playerSpriteLoaded && this.playerSprite) {
      const availableHeight = dimensions.height - titleHeight - 60; // Leave some padding
      const spriteScale = Math.min(availableHeight / 64, spriteAreaWidth / 64); // Scale to fit available area
      const scaledSize = Math.max(32, 16 * spriteScale); // Minimum 32px sprite size

      const spriteX = armorStartX + armorSectionWidth + (spriteAreaWidth - scaledSize) / 2;
      const spriteY = dimensions.y + titleHeight + 20;

      // Render player sprite with walking down animation (always animate)
      const spriteSize = 16;
      const spritesPerRow = Math.floor(this.playerSprite.width / spriteSize);
      const downFacingBaseIndex = 0; // Base index for walking down animation
      const animatedIndex = downFacingBaseIndex + this.playerSpriteAnimationFrame; // Use animated frame
      const srcX = (animatedIndex % spritesPerRow) * spriteSize;
      const srcY = Math.floor(animatedIndex / spritesPerRow) * spriteSize;

      ctx.drawImage(
        this.playerSprite,
        srcX, srcY, spriteSize, spriteSize,
        spriteX, spriteY, scaledSize, scaledSize
      );
    } else {
      // Debug: Draw placeholder if sprite not loaded
      const placeholderSize = 32;
      const placeholderX = armorStartX + armorSectionWidth + (spriteAreaWidth - placeholderSize) / 2;
      const placeholderY = dimensions.y + titleHeight + 20;

      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(placeholderX, placeholderY, placeholderSize, placeholderSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SPRITE', placeholderX + placeholderSize/2, placeholderY + placeholderSize/2);
    }

    // Draw instructions at bottom
    ctx.fillStyle = '#34495e';
    ctx.font = this.fontLoaded ? '8px "Press Start 2P"' : '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Press E or ESC to close', dimensions.x + dimensions.width / 2, dimensions.y + dimensions.height - 10);
  }

  private renderTradeInventoryUI(playerInventory: (InventoryItem | null)[], playerSelectedSlot: number): void {
    if (!this.tradeInventoryUIVisible || (!this.currentChest && !this.currentTombstone)) return;

    const canvas = this.canvas;
    const ctx = this.ctx;

    // Use full-width dimensions
    const dimensions = this.calculateFullWidthUIDimensions();

    // Draw main container
    this.drawBubble(ctx, dimensions.x, dimensions.y, dimensions.width, dimensions.height, 15, '#f8f9fa', '#dee2e6');

    // Split into two halves - player (left 50%) and container (right 50%)
    const halfWidth = dimensions.width / 2;
    const titleHeight = 40;
    const slotsPerRow = 3;
    const rows = 3; // Back to 3 rows for 3x3 grid

    // Calculate optimal slot size to fill 50% width and available height
    const availableWidth = halfWidth - 40; // Account for padding
    const totalWidthSpacing = (slotsPerRow - 1) * 8; // 8px spacing between slots

    // Calculate available height for inventory grids
    const instructionHeight = 30; // Space for instructions at bottom
    const availableHeight = dimensions.height - titleHeight - instructionHeight - 40; // Extra padding
    const totalHeightSpacing = (rows - 1) * 8; // 8px spacing between rows

    // Calculate slot size based on both width and height constraints
    const maxSlotSizeByWidth = Math.floor((availableWidth - totalWidthSpacing) / slotsPerRow);
    const maxSlotSizeByHeight = Math.floor((availableHeight - totalHeightSpacing) / rows);
    const slotSize = Math.max(30, Math.min(maxSlotSizeByWidth, maxSlotSizeByHeight)); // Minimum 30px slots
    const slotSpacing = 8;

    // Left side - Player Inventory
    const playerStartX = dimensions.x + 10;
    const playerWidth = halfWidth - 20;

    // Draw player inventory title
    ctx.fillStyle = '#2c3e50';
    ctx.font = this.fontLoaded ? '12px "Press Start 2P"' : 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Player Inventory:', playerStartX + playerWidth / 2, dimensions.y + 25);

    // Draw player inventory grid
    const playerGridWidth = (slotSize * slotsPerRow) + (slotSpacing * (slotsPerRow - 1));
    const playerGridStartX = playerStartX + (playerWidth - playerGridWidth) / 2;
    const playerGridStartY = dimensions.y + titleHeight + 10;

    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / slotsPerRow);
      const col = i % slotsPerRow;
      const slotX = playerGridStartX + col * (slotSize + slotSpacing);
      const slotY = playerGridStartY + row * (slotSize + slotSpacing);

      const item = playerInventory[i] ?? null;
      const isSelected = this.dualInventoryMode === 'player' && i === this.playerSelectedSlot;

      this.renderInventorySlot(ctx, slotX, slotY, slotSize, item, isSelected, i + 1);
    }

    // Right side - Container Inventory
    const containerStartX = dimensions.x + halfWidth + 10;
    const containerWidth = halfWidth - 20;

    // Get container name and inventory
    const containerName = this.currentChest ? this.currentChest.getDisplayName() :
                         this.currentTombstone ? this.currentTombstone.getDisplayName() : 'Container';
    const containerInventory = this.currentChest ? this.currentChest.inventory :
                              this.currentTombstone ? this.currentTombstone.inventory : [];

    // Draw container inventory title
    ctx.fillStyle = '#2c3e50';
    ctx.font = this.fontLoaded ? '12px "Press Start 2P"' : 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${containerName}:`, containerStartX + containerWidth / 2, dimensions.y + 25);

    // Draw container inventory grid
    const containerGridWidth = (slotSize * slotsPerRow) + (slotSpacing * (slotsPerRow - 1));
    const containerGridStartX = containerStartX + (containerWidth - containerGridWidth) / 2;
    const containerGridStartY = dimensions.y + titleHeight + 10;

    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / slotsPerRow);
      const col = i % slotsPerRow;
      const slotX = containerGridStartX + col * (slotSize + slotSpacing);
      const slotY = containerGridStartY + row * (slotSize + slotSpacing);

      const item = containerInventory[i] ?? null;
      const isSelected = this.dualInventoryMode === 'container' &&
                        ((this.currentChest && i === this.chestSelectedSlot) ??
                         (this.currentTombstone && i === this.tombstoneSelectedSlot));

      this.renderInventorySlot(ctx, slotX, slotY, slotSize, item, isSelected ?? false, i + 1);
    }

    // Draw mode indicator and instructions at bottom
    ctx.fillStyle = '#34495e';
    ctx.font = this.fontLoaded ? '8px "Press Start 2P"' : '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const currentMode = this.dualInventoryMode === 'player' ? 'Player' : containerName;
    const instructions = `Current: ${currentMode} | Arrow Keys: Navigate | X: Transfer Selected | Z: Transfer All | F/ESC: Close`;
    ctx.fillText(instructions, dimensions.x + dimensions.width / 2, dimensions.y + dimensions.height - 10);
  }

  private renderArmorSlot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    item: InventoryItem | null,
    slotType: string,
    isSelected = false
  ): void {
    // Draw slot background bubble
    const bgColor = isSelected ? '#e3f2fd' : '#ffffff';
    const borderColor = isSelected ? '#2196f3' : '#bdc3c7';
    this.drawBubble(ctx, x, y, size, size, 4, bgColor, borderColor);

    // Draw slot type label in top-left corner
    ctx.save();
    ctx.fillStyle = '#666666';
    ctx.font = this.fontLoaded ? '5px "Press Start 2P"' : '8px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const shortLabel = slotType.charAt(0).toUpperCase(); // First letter of slot type
    ctx.fillText(shortLabel, x + 2, y + 2);
    ctx.restore();

    // Draw item if present
    if (item && item.quantity > 0) {
      // Simple coloured circle for item representation
      const itemColour = this.getItemColour(item.type);
      const centerX = x + size / 2;
      const centerY = y + size / 2;
      const radius = size * 0.2;

      ctx.save();
      ctx.fillStyle = itemColour;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Calculate full-width UI dimensions for inventory containers
   */
  private calculateFullWidthUIDimensions() {
    const canvas = this.canvas;
    const padding = 20;
    const uiWidth = canvas.width - (padding * 2); // Full width minus padding
    const uiHeight = canvas.height * 0.8; // 80% of screen height
    const uiX = padding;
    const uiY = (canvas.height - uiHeight) / 2;

    return {
      width: uiWidth,
      height: uiHeight,
      x: uiX,
      y: uiY,
      padding
    };
  }

  private renderMenuUI(): void {
    if (!this.menuUIVisible) return;

    const canvas = this.canvas;
    const ctx = this.ctx;

    // Menu dimensions
    const menuWidth = 300;
    const menuHeight = 200;
    const menuX = (canvas.width - menuWidth) / 2;
    const menuY = (canvas.height - menuHeight) / 2;

    // Draw menu background
    this.drawBubble(ctx, menuX, menuY, menuWidth, menuHeight, 15, '#f8f9fa', '#dee2e6');

    // Draw menu title
    ctx.fillStyle = '#2c3e50';
    ctx.font = this.fontLoaded ? '14px "Press Start 2P"' : 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Game Menu', menuX + menuWidth / 2, menuY + 40);

    // Draw menu options
    const optionHeight = 40;
    const optionStartY = menuY + 80;

    for (let i = 0; i < this.menuOptions.length; i++) {
      const option = this.menuOptions[i]!;
      const optionY = optionStartY + (i * optionHeight);
      const isSelected = i === this.menuSelectedOption;

      // Draw selection highlight
      if (isSelected) {
        this.drawBubble(ctx, menuX + 20, optionY - 15, menuWidth - 40, 30, 8, '#e3f2fd', '#2196f3');
      }

      // Draw option text
      ctx.fillStyle = isSelected ? '#1976d2' : '#34495e';
      ctx.font = this.fontLoaded ? '10px "Press Start 2P"' : '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(option, menuX + menuWidth / 2, optionY);
    }

    // Draw instructions
    ctx.fillStyle = '#7f8c8d';
    ctx.font = this.fontLoaded ? '8px "Press Start 2P"' : '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Use Up/Down arrows and Enter to select, ESC to close', menuX + menuWidth / 2, menuY + menuHeight - 15);
  }

  private renderConsoleUI(): void {
    const canvas = this.canvas;
    const ctx = this.ctx;

    // Console UI positioning - bottom left corner
    const consolePadding = 10;
    const entryHeight = 18;
    const entrySpacing = 2;
    const maxWidth = 450; // Maximum width for console entries

    // Build persistent info display lines
    const infoLines: string[] = [];

    // Player position (always show)
    infoLines.push(`Player Position: ${this.persistentInfo.playerPosition.x}, ${this.persistentInfo.playerPosition.y}`);

    // Nearest structures (show based on availability)
    if (this.persistentInfo.nearestWell) {
      infoLines.push(`Nearest Village Well Position: ${this.persistentInfo.nearestWell.x}, ${this.persistentInfo.nearestWell.y}`);
    } else {
      infoLines.push('Nearest Village Well Position: NOT FOUND');
    }

    if (this.persistentInfo.nearestMine) {
      infoLines.push(`Nearest Mine Entrance Position: ${this.persistentInfo.nearestMine.x}, ${this.persistentInfo.nearestMine.y}`);
    } else {
      infoLines.push('Nearest Mine Entrance Position: NOT FOUND');
    }

    if (this.persistentInfo.nearestDungeon) {
      infoLines.push(`Nearest Dungeon Entrance Position: ${this.persistentInfo.nearestDungeon.x}, ${this.persistentInfo.nearestDungeon.y}`);
    } else {
      infoLines.push('Nearest Dungeon Entrance Position: NOT FOUND');
    }

    // Portal position (only show when in dungeon)
    if (this.persistentInfo.renderingMode === 'dungeon') {
      if (this.persistentInfo.nearestPortal) {
        infoLines.push(`Nearest Portal Position: ${this.persistentInfo.nearestPortal.x}, ${this.persistentInfo.nearestPortal.y}`);
      } else {
        infoLines.push('Nearest Portal Position: NOT FOUND');
      }
    }

    // Calculate total height needed for all entries
    const totalHeight = infoLines.length * (entryHeight + entrySpacing) - entrySpacing;
    const consoleY = canvas.height - totalHeight - consolePadding;

    // Render each info line
    infoLines.forEach((line, index) => {
      const entryY = consoleY + index * (entryHeight + entrySpacing);

      // Measure text width to create properly sized background
      ctx.font = this.fontLoaded ? '7px "Press Start 2P"' : '11px Arial';
      const textMetrics = ctx.measureText(line);
      const textWidth = Math.min(textMetrics.width + 16, maxWidth); // Add padding, cap at maxWidth

      // Draw black background container for this info line
      this.drawBubble(ctx, consolePadding, entryY, textWidth, entryHeight, 4, '#000000', '#333333');

      // Draw white text
      ctx.fillStyle = '#ffffff';
      ctx.font = this.fontLoaded ? '7px "Press Start 2P"' : '11px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // Truncate text if it's too long
      let displayText = line;
      if (textMetrics.width > maxWidth - 16) {
        // Truncate and add ellipsis
        while (ctx.measureText(displayText + '...').width > maxWidth - 16 && displayText.length > 0) {
          displayText = displayText.slice(0, -1);
        }
        displayText += '...';
      }

      ctx.fillText(displayText, consolePadding + 8, entryY + entryHeight / 2);
    });
  }

  public showMenuUI(): void {
    this.menuUIVisible = true;
    this.menuSelectedOption = 0; // Reset to first option
    console.log('Menu UI opened');
  }

  public hideMenuUI(): void {
    this.menuUIVisible = false;
    console.log('Menu UI closed');
  }

  public isMenuUIVisible(): boolean {
    return this.menuUIVisible;
  }

  public navigateMenu(direction: 'up' | 'down'): void {
    if (!this.menuUIVisible) return;

    if (direction === 'up') {
      this.menuSelectedOption = (this.menuSelectedOption - 1 + this.menuOptions.length) % this.menuOptions.length;
    } else {
      this.menuSelectedOption = (this.menuSelectedOption + 1) % this.menuOptions.length;
    }
    console.log(`Menu option selected: ${this.menuOptions[this.menuSelectedOption]}`);
  }

  public getSelectedMenuOption(): string {
    return this.menuOptions[this.menuSelectedOption] ?? 'Back to Game';
  }

  // Player inventory UI navigation methods - Intuitive visual direction navigation
  public getWearableItems(): { type: string }[] {
    // Extract items from wearable armor slot
    const wearableSlot = this.armorSlots.find(slot => slot.type === 'wearable');
    const wearableItems: { type: string }[] = [];

    if (wearableSlot?.item) {
      wearableItems.push({ type: wearableSlot.item.type });
    }

    return wearableItems;
  }

  public navigatePlayerInventory(direction: 'up' | 'down' | 'left' | 'right'): void {
    if (!this.inventoryUIVisible) return;

    const currentSlot = this.playerInventorySelectedSlot;
    let newSlot = currentSlot;

    if (currentSlot < 9) {
      // Navigation within 3x3 inventory grid (slots 0-8)
      const row = Math.floor(currentSlot / 3);
      const col = currentSlot % 3;

      switch (direction) {
        case 'up':
          if (row > 0) {
            // Move up within inventory grid
            newSlot = (row - 1) * 3 + col;
          } else {
            // At top of inventory, wrap to bottom
            newSlot = 6 + col;
          }
          break;
        case 'down':
          if (row < 2) {
            // Move down within inventory grid
            newSlot = (row + 1) * 3 + col;
          } else {
            // At bottom of inventory, wrap to top
            newSlot = col;
          }
          break;
        case 'left':
          if (col > 0) {
            // Move left within inventory grid
            newSlot = currentSlot - 1;
          } else {
            // At leftmost column, wrap to rightmost column of same row
            newSlot = currentSlot + 2;
          }
          break;
        case 'right':
          if (col < 2) {
            // Move right within inventory grid
            newSlot = currentSlot + 1;
          } else {
            // At rightmost column of inventory, move to armor section
            // Map inventory row to corresponding armor slot in first column
            if (row === 0) newSlot = 9;  // Top row -> head
            else if (row === 1) newSlot = 10; // Middle row -> torso
            else if (row === 2) newSlot = 11; // Bottom row -> legs
          }
          break;
      }
    } else {
      // Navigation within armor slots (slots 9-15)
      // Visual layout: Column 1: head(9), torso(10), legs(11), feet(12)
      //                Column 2: left_hand, arms(14), wearable(15)

      if (currentSlot <= 12) {
        // First armor column (head, torso, legs, feet)
        const armorRow = currentSlot - 9; // 0-3

        switch (direction) {
          case 'up':
            if (armorRow > 0) {
              // Move up within first armor column
              newSlot = currentSlot - 1;
            } else {
              // At top (head), wrap to bottom (feet)
              newSlot = 12;
            }
            break;
          case 'down':
            if (armorRow < 3) {
              // Move down within first armor column
              newSlot = currentSlot + 1;
            } else {
              // At bottom (feet), wrap to top (head)
              newSlot = 9;
            }
            break;
          case 'left':
            // Move left from armor back to inventory
            // Map armor row back to corresponding inventory row, rightmost column
            if (armorRow === 0) newSlot = 2;  // head -> top-right inventory
            else if (armorRow === 1) newSlot = 5;  // torso -> middle-right inventory
            else if (armorRow === 2) newSlot = 8;  // legs -> bottom-right inventory
            else newSlot = 8; // feet -> bottom-right inventory (default)
            break;
          case 'right':
            // Move right to second armor column
            // Map first column to second column naturally
            if (armorRow === 0) newSlot = 13; // head -> left_hand
            else if (armorRow === 1) newSlot = 14; // torso -> arms
            else if (armorRow === 2) newSlot = 15; // legs -> wearable
            else newSlot = 15; // feet -> wearable (last slot available)
            break;
        }
      } else {
        // Second armor column (left_hand, arms, wearable)
        const armorRow = currentSlot - 13; // 0-2

        switch (direction) {
          case 'up':
            if (armorRow > 0) {
              // Move up within second armor column
              newSlot = currentSlot - 1;
            } else {
              // At top (left_hand), wrap to bottom (wearable)
              newSlot = 15;
            }
            break;
          case 'down':
            if (armorRow < 2) {
              // Move down within second armor column
              newSlot = currentSlot + 1;
            } else {
              // At bottom (wearable), wrap to top (left_hand)
              newSlot = 13;
            }
            break;
          case 'left':
            // Move left to first armor column
            // Map second column back to first column naturally
            if (armorRow === 0) newSlot = 9;  // left_hand -> head
            else if (armorRow === 1) newSlot = 10; // arms -> torso
            else if (armorRow === 2) newSlot = 11; // wearable -> legs
            break;
          case 'right':
            // Move right from second armor column back to inventory
            // Map to corresponding inventory row, leftmost column for intuitive flow
            if (armorRow === 0) newSlot = 0;  // left_hand -> top-left inventory
            else if (armorRow === 1) newSlot = 3;  // arms -> middle-left inventory
            else if (armorRow === 2) newSlot = 6;  // wearable -> bottom-left inventory
            break;
        }
      }
    }

    this.playerInventorySelectedSlot = newSlot;
    console.log(`Player inventory slot selected: ${newSlot} (${newSlot < 9 ? 'inventory' : 'armor'})`);
  }

  public getPlayerInventorySelectedSlot(): number {
    return this.playerInventorySelectedSlot;
  }

  // Player name editing methods
  public startEditingPlayerName(currentName: string): void {
    this.isEditingPlayerName = true;
    this.editingPlayerName = currentName;
    this.playerNameCursorVisible = true;
    this.playerNameCursorTimer = 0;
    console.log('Started editing player name');
  }

  public finishEditingPlayerName(): string {
    this.isEditingPlayerName = false;
    const newName = this.editingPlayerName.trim() || 'Hero';
    this.editingPlayerName = '';
    console.log(`Finished editing player name: ${newName}`);
    return newName;
  }

  public cancelEditingPlayerName(): void {
    this.isEditingPlayerName = false;
    this.editingPlayerName = '';
    console.log('Cancelled editing player name');
  }

  public getIsEditingPlayerName(): boolean {
    return this.isEditingPlayerName;
  }

  public handlePlayerNameInput(key: string): void {
    if (!this.isEditingPlayerName) return;

    if (key === 'Enter') {
      // Finish editing - handled by Game.ts
      return;
    } else if (key === 'Escape') {
      this.cancelEditingPlayerName();
      return;
    } else if (key === 'Backspace') {
      this.editingPlayerName = this.editingPlayerName.slice(0, -1);
    } else if (key.length === 1 && this.editingPlayerName.length < 20) {
      // Only allow printable characters and limit to 20 characters
      if (/^[a-zA-Z0-9\s\-_]$/.test(key)) {
        this.editingPlayerName += key;
      }
    }
  }

  // Update player name from game
  public setPlayerName(name: string): void {
    this.playerName = name;
  }

  public getPlayerName(): string {
    return this.playerName;
  }

  // Unified navigation method for both chest and tombstone dual inventory
  private navigateDualInventory(direction: 'left' | 'right' | 'up' | 'down', containerType: 'chest' | 'tombstone'): void {
    // Determine current position based on mode and selected slot
    let currentSlot: number;
    let isPlayerSide: boolean;

    if (this.dualInventoryMode === 'player') {
      currentSlot = this.playerSelectedSlot;
      isPlayerSide = true;
    } else {
      if (containerType === 'chest') {
        currentSlot = this.chestSelectedSlot;
      } else {
        currentSlot = this.tombstoneSelectedSlot;
      }
      isPlayerSide = false;
    }

    let newSlot = currentSlot;
    let newSide = isPlayerSide;

    // Calculate current row and column within the 3x3 grid
    const row = Math.floor(currentSlot / 3);
    const col = currentSlot % 3;

    switch (direction) {
      case 'up':
        // Move up within current grid, wrap to bottom if at top
        if (row > 0) {
          newSlot = (row - 1) * 3 + col;
        } else {
          newSlot = 6 + col; // Wrap to bottom row
        }
        break;

      case 'down':
        // Move down within current grid, wrap to top if at bottom
        if (row < 2) {
          newSlot = (row + 1) * 3 + col;
        } else {
          newSlot = col; // Wrap to top row
        }
        break;

      case 'left':
        if (isPlayerSide) {
          // Currently on player side
          if (col > 0) {
            // Move left within player grid
            newSlot = currentSlot - 1;
          } else {
            // At leftmost column of player grid, wrap to rightmost column of same row
            newSlot = currentSlot + 2;
          }
        } else {
          // Currently on container side
          if (col > 0) {
            // Move left within container grid
            newSlot = currentSlot - 1;
          } else {
            // At leftmost column of container, move to corresponding position in player grid
            newSide = true; // Switch to player side
            newSlot = row * 3 + 2; // Move to rightmost column of same row in player grid
          }
        }
        break;

      case 'right':
        if (isPlayerSide) {
          // Currently on player side
          if (col < 2) {
            // Move right within player grid
            newSlot = currentSlot + 1;
          } else {
            // At rightmost column of player grid, move to corresponding position in container grid
            newSide = false; // Switch to container side
            newSlot = row * 3; // Move to leftmost column of same row in container grid
          }
        } else {
          // Currently on container side
          if (col < 2) {
            // Move right within container grid
            newSlot = currentSlot + 1;
          } else {
            // At rightmost column of container, wrap to leftmost column of same row
            newSlot = currentSlot - 2;
          }
        }
        break;
    }

    // Apply the new position
    if (newSide) {
      // Moving to or staying on player side
      this.dualInventoryMode = 'player';
      this.playerSelectedSlot = newSlot;
      console.log(`Player slot selected: ${newSlot + 1} (row ${Math.floor(newSlot / 3) + 1}, col ${(newSlot % 3) + 1})`);
    } else {
      // Moving to or staying on container side
      this.dualInventoryMode = 'container';
      if (containerType === 'chest') {
        this.chestSelectedSlot = newSlot;
        console.log(`Chest slot selected: ${newSlot + 1} (row ${Math.floor(newSlot / 3) + 1}, col ${(newSlot % 3) + 1})`);
      } else {
        this.tombstoneSelectedSlot = newSlot;
        console.log(`Tombstone slot selected: ${newSlot + 1} (row ${Math.floor(newSlot / 3) + 1}, col ${(newSlot % 3) + 1})`);
      }
    }
  }
}