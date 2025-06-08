import { type Inventory, type InventoryItem } from '../entities/inventory/Inventory';

export interface TextBoxOptions {
  text: string;
  title?: string;
  villageName?: string;
  visible: boolean;
}

export class UIManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private textBox: TextBoxOptions = { text: '', visible: false };
  private inventory: Inventory | null = null;
  private fontLoaded = false;

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

  public render(): void {
    this.renderInventory();
    if (this.textBox.visible) {
      this.renderTextBox();
    }
  }

  private renderInventory(): void {
    if (!this.inventory) return;

    const canvas = this.canvas;
    const ctx = this.ctx;

    // Inventory positioning (right side of screen)
    const slotSize = 50;
    const slotPadding = 8;
    const inventoryPadding = 20;
    const inventoryWidth = slotSize + (slotPadding * 2);
    const totalHeight = (slotSize + slotPadding) * 9 - slotPadding;
    const startX = canvas.width - inventoryWidth - inventoryPadding;
    const startY = (canvas.height - totalHeight) / 2;

    // Render each inventory slot with bubble effect
    for (let i = 0; i < 9; i++) {
      const slotX = startX + slotPadding;
      const slotY = startY + (i * (slotSize + slotPadding));

      // Get inventory item for this slot
      const item = this.inventory.getItem(i);
      const isSelected = this.inventory.getSelectedSlot() === i;

      // Draw bubble background for slot
      const bubbleColor = isSelected ? '#e8f4fd' : '#ffffff';
      const borderColor = isSelected ? '#3498db' : '#bdc3c7';

      this.drawBubble(ctx, slotX, slotY, slotSize, slotSize, 8, bubbleColor, borderColor);

      // Draw slot number
      ctx.fillStyle = '#7f8c8d';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText((i + 1).toString(), slotX + 4, slotY + 14);

      // Draw item if present
      if (item && item.quantity > 0) {
        // Item icon area (simplified for now - could render actual item sprites)
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(slotX + 8, slotY + 18, 34, 24);

        // Item type text
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        const displayText = item.type.slice(0, 4); // First 4 chars
        ctx.fillText(displayText, slotX + 25, slotY + 32);

        // Quantity
        if (item.quantity > 1) {
          ctx.fillStyle = '#e74c3c';
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'right';
          ctx.fillText(item.quantity.toString(), slotX + slotSize - 4, slotY + slotSize - 4);
        }
      }
    }
  }

  private renderTextBox(): void {
    if (!this.textBox.visible) return;

    const canvas = this.canvas;
    const ctx = this.ctx;

    // Calculate inventory dimensions (same as in renderInventory)
    const slotSize = 50;
    const slotPadding = 8;
    const inventoryPadding = 20;
    const inventoryWidth = slotSize + (slotPadding * 2);
    const inventoryTotalWidth = inventoryWidth + inventoryPadding;

    // Text box dimensions and positioning
    const padding = 20;
    const textBoxHeight = 140;
    const textBoxY = canvas.height - textBoxHeight - padding;
    const textBoxX = padding;
    const textBoxWidth = canvas.width - (padding * 2) - inventoryTotalWidth;

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

    // Main text content with proper line break handling
    const lines = this.wrapTextWithLineBreaks(mainText, textBoxWidth - 40, bodyFont);
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
}