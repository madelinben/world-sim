import { type Inventory, type InventoryItem } from '../entities/inventory/Inventory';
import type { Tombstone } from '../entities/poi/Tombstone';

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

export class UIManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private textBox: TextBoxOptions = { text: '', visible: false };
  private inventory: Inventory | null = null;
  private fontLoaded = false;
  private inventoryUIVisible = false; // New inventory UI state

  // Tombstone interaction state
  private tombstoneUIVisible = false;
  private currentTombstone: Tombstone | null = null;
  private tombstoneSelectedSlot = 0; // Selected slot in tombstone inventory

  // Console UI state
  private consoleLogEntries: ConsoleLogEntry[] = [];
  private readonly MAX_CONSOLE_ENTRIES = 10; // Maximum number of log entries to display

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    void this.loadPixelFont();
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
    console.log(`Inventory UI ${this.inventoryUIVisible ? 'opened' : 'closed'}`);
  }

  public isInventoryUIVisible(): boolean {
    return this.inventoryUIVisible;
  }

  public closeInventoryUI(): void {
    this.inventoryUIVisible = false;
    console.log('Inventory UI closed');
  }

  public isAnyUIVisible(): boolean {
    return this.textBox.visible || this.inventoryUIVisible || this.tombstoneUIVisible;
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

  public render(inventory: (InventoryItem | null)[], selectedSlot: number): void {
    this.renderInventory(inventory, selectedSlot);
    this.renderTextBox();
    this.renderInventoryUI();
    this.renderTombstoneUI();
    this.renderConsoleUI();
  }

  /**
   * Add a new log entry to the console UI
   */
  public addConsoleLog(text: string): void {
    const entry: ConsoleLogEntry = {
      text,
      timestamp: Date.now()
    };

    this.consoleLogEntries.push(entry);

    // Keep only the most recent entries
    if (this.consoleLogEntries.length > this.MAX_CONSOLE_ENTRIES) {
      this.consoleLogEntries = this.consoleLogEntries.slice(-this.MAX_CONSOLE_ENTRIES);
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
      // Simple colored circle for item representation
      const itemColor = this.getItemColor(item.type);
      const centerX = x + size / 2;
      const centerY = y + size / 2;
      const radius = size * 0.25;

      ctx.save();
      ctx.fillStyle = itemColor;
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

  private getItemColor(itemType: string): string {
    // Color mapping for different item types
    const colors: Record<string, string> = {
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

    return colors[itemType] ?? '#9e9e9e';
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
    this.currentTombstone = tombstone;
    this.tombstoneSelectedSlot = 0; // Reset to first slot
    console.log(`Tombstone UI opened for ${tombstone.getDisplayName()}`);
  }

  public hideTombstoneUI(): void {
    this.tombstoneUIVisible = false;
    this.currentTombstone = null;
    this.tombstoneSelectedSlot = 0;
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

  public navigateTombstoneInventory(direction: 'left' | 'right'): void {
    if (!this.tombstoneUIVisible || !this.currentTombstone) return;

    if (direction === 'left') {
      this.tombstoneSelectedSlot = (this.tombstoneSelectedSlot - 1 + 9) % 9;
    } else {
      this.tombstoneSelectedSlot = (this.tombstoneSelectedSlot + 1) % 9;
    }
    console.log(`Tombstone slot selected: ${this.tombstoneSelectedSlot + 1}`);
  }

  public getTombstoneSelectedItem(): InventoryItem | null {
    if (!this.currentTombstone) return null;
    return this.currentTombstone.inventory[this.tombstoneSelectedSlot] ?? null;
  }

  private renderTombstoneUI(): void {
    if (!this.tombstoneUIVisible || !this.currentTombstone) return;

    const canvas = this.canvas;
    const ctx = this.ctx;
    const tombstone = this.currentTombstone; // Create a local reference for type safety

    // Calculate tombstone UI dimensions to match text box width
    const slotSize = 40;
    const slotSpacing = 8;
    const slotsPerRow = 3;
    const rows = 3;
    const contentWidth = (slotSize * slotsPerRow) + (slotSpacing * (slotsPerRow - 1));
    const contentHeight = (slotSize * rows) + (slotSpacing * (rows - 1));
    const padding = 20;
    const titleHeight = 40;
    const descriptionHeight = 60;

    const tombstoneWidth = contentWidth + (padding * 2);
    const tombstoneHeight = titleHeight + descriptionHeight + contentHeight + (padding * 2);
    const tombstoneX = (canvas.width - tombstoneWidth) / 2;
    const tombstoneY = (canvas.height - tombstoneHeight) / 2;

    // Draw tombstone background
    this.drawBubble(ctx, tombstoneX, tombstoneY, tombstoneWidth, tombstoneHeight, 15, '#f8f9fa', '#dee2e6');

    // Draw tombstone title
    ctx.fillStyle = '#2c3e50';
    ctx.font = this.fontLoaded ? '12px "Press Start 2P"' : 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tombstone.getDisplayName(), tombstoneX + tombstoneWidth / 2, tombstoneY + titleHeight / 2);

    // Draw tombstone description with word wrapping
    ctx.fillStyle = '#34495e';
    ctx.font = this.fontLoaded ? '8px "Press Start 2P"' : '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const itemCount = tombstone.inventory.filter(item => item !== null).length;
    const description = `Press Left/Right to navigate, Z to take all, X to take selected, F to close. Items: ${itemCount}/9`;
    const maxWidth = tombstoneWidth - (padding * 2);
    const lines = this.wrapText(description, maxWidth, '12px Arial');
    const lineHeight = this.fontLoaded ? 12 : 16;
    const descStartY = tombstoneY + titleHeight + 10;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], tombstoneX + tombstoneWidth / 2, descStartY + (i * lineHeight));
    }

    // Draw tombstone inventory slots in 3x3 grid
    const gridStartX = tombstoneX + padding;
    const gridStartY = tombstoneY + titleHeight + descriptionHeight;

    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / slotsPerRow);
      const col = i % slotsPerRow;
      const slotX = gridStartX + col * (slotSize + slotSpacing);
      const slotY = gridStartY + row * (slotSize + slotSpacing);

      const item = tombstone.inventory[i] ?? null;
      const isSelected = i === this.tombstoneSelectedSlot;

      this.renderInventorySlot(ctx, slotX, slotY, slotSize, item, isSelected, i + 1);
    }
  }

  private renderConsoleUI(): void {
    if (this.consoleLogEntries.length === 0) return;

    const canvas = this.canvas;
    const ctx = this.ctx;

    // Console UI positioning - bottom left corner
    const consolePadding = 10;
    const entryHeight = 20;
    const entrySpacing = 2;
    const maxWidth = 400; // Maximum width for console entries

    // Calculate total height needed for all entries
    const totalHeight = this.consoleLogEntries.length * (entryHeight + entrySpacing) - entrySpacing;
    const consoleY = canvas.height - totalHeight - consolePadding;

    // Render each log entry from oldest (top) to newest (bottom)
    this.consoleLogEntries.forEach((entry, index) => {
      const entryY = consoleY + index * (entryHeight + entrySpacing);

      // Measure text width to create properly sized background
      ctx.font = this.fontLoaded ? '8px "Press Start 2P"' : '12px Arial';
      const textMetrics = ctx.measureText(entry.text);
      const textWidth = Math.min(textMetrics.width + 16, maxWidth); // Add padding, cap at maxWidth

      // Draw black background container for this log entry
      this.drawBubble(ctx, consolePadding, entryY, textWidth, entryHeight, 4, '#000000', '#333333');

      // Draw white text
      ctx.fillStyle = '#ffffff';
      ctx.font = this.fontLoaded ? '8px "Press Start 2P"' : '12px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // Truncate text if it's too long
      let displayText = entry.text;
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
}