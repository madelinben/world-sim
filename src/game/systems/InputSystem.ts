import type { Controls } from './Controls';
import type { UIManager } from '../ui/UIManager';

export interface InputAction {
  type: 'movement' | 'attack' | 'interact' | 'ui_navigation' | 'menu';
  direction?: 'up' | 'down' | 'left' | 'right';
  key?: string;
  data?: string | number | boolean;
}

export class InputSystem {
  private controls: Controls;
  private uiManager: UIManager;
  private inputQueue: InputAction[] = [];

  constructor(controls: Controls, uiManager: UIManager) {
    this.controls = controls;
    this.uiManager = uiManager;
  }

  public processInput(): InputAction[] {
    this.inputQueue = [];

    // Handle ESC key first (highest priority)
    if (this.controls.wasKeyJustPressed('escape')) {
      this.inputQueue.push({ type: 'menu', key: 'escape' });
      return this.inputQueue;
    }

    // Handle UI-specific inputs
    if (this.uiManager.isAnyUIVisible()) {
      this.processUIInput();
      return this.inputQueue;
    }

    // Handle game inputs
    this.processGameInput();
    return this.inputQueue;
  }

  private processUIInput(): void {
    // Handle player inventory UI
    if (this.uiManager.isInventoryUIVisible()) {
      if (this.controls.wasKeyJustPressed('up')) {
        this.inputQueue.push({ type: 'ui_navigation', direction: 'up', data: 'player_inventory' });
      } else if (this.controls.wasKeyJustPressed('down')) {
        this.inputQueue.push({ type: 'ui_navigation', direction: 'down', data: 'player_inventory' });
      } else if (this.controls.wasKeyJustPressed('left')) {
        this.inputQueue.push({ type: 'ui_navigation', direction: 'left', data: 'player_inventory' });
      } else if (this.controls.wasKeyJustPressed('right')) {
        this.inputQueue.push({ type: 'ui_navigation', direction: 'right', data: 'player_inventory' });
      } else if (this.controls.wasKeyJustPressed('interact')) {
        this.inputQueue.push({ type: 'menu', key: 'close_inventory' });
      }
      return;
    }

    // Handle chest UI
    if (this.uiManager.isChestUIVisible()) {
      if (this.controls.wasKeyJustPressed('up')) {
        this.inputQueue.push({ type: 'ui_navigation', direction: 'up', data: 'chest' });
      } else if (this.controls.wasKeyJustPressed('down')) {
        this.inputQueue.push({ type: 'ui_navigation', direction: 'down', data: 'chest' });
      } else if (this.controls.wasKeyJustPressed('left')) {
        this.inputQueue.push({ type: 'ui_navigation', direction: 'left', data: 'chest' });
      } else if (this.controls.wasKeyJustPressed('right')) {
        this.inputQueue.push({ type: 'ui_navigation', direction: 'right', data: 'chest' });
      } else if (this.controls.wasKeyJustPressed('take_all')) {
        this.inputQueue.push({ type: 'interact', key: 'take_all' });
      } else if (this.controls.wasKeyJustPressed('take_selected')) {
        this.inputQueue.push({ type: 'interact', key: 'take_selected' });
      } else if (this.controls.wasKeyJustPressed('interact')) {
        this.inputQueue.push({ type: 'menu', key: 'close_chest' });
      }
      return;
    }

    // Handle text box
    if (this.uiManager.isTextBoxVisible()) {
      if (this.controls.wasKeyJustPressed('interact')) {
        this.inputQueue.push({ type: 'menu', key: 'close_textbox' });
      } else if (this.controls.wasAnyKeyPressed() && !this.controls.wasKeyJustPressed('interact')) {
        this.inputQueue.push({ type: 'menu', key: 'dismiss_textbox' });
      }
      return;
    }

    // Handle menu UI
    if (this.uiManager.isMenuUIVisible()) {
      if (this.controls.wasKeyJustPressed('up')) {
        this.inputQueue.push({ type: 'ui_navigation', direction: 'up', data: 'menu' });
      } else if (this.controls.wasKeyJustPressed('down')) {
        this.inputQueue.push({ type: 'ui_navigation', direction: 'down', data: 'menu' });
      } else if (this.controls.wasKeyJustPressed('enter')) {
        this.inputQueue.push({ type: 'menu', key: 'select' });
      }
      return;
    }
  }

  private processGameInput(): void {
    // Handle movement
    if (this.controls.wasKeyJustPressed('up') || this.controls.isKeyPressed('up')) {
      this.inputQueue.push({ type: 'movement', direction: 'up' });
    } else if (this.controls.wasKeyJustPressed('down') || this.controls.isKeyPressed('down')) {
      this.inputQueue.push({ type: 'movement', direction: 'down' });
    } else if (this.controls.wasKeyJustPressed('left') || this.controls.isKeyPressed('left')) {
      this.inputQueue.push({ type: 'movement', direction: 'left' });
    } else if (this.controls.wasKeyJustPressed('right') || this.controls.isKeyPressed('right')) {
      this.inputQueue.push({ type: 'movement', direction: 'right' });
    }

    // Handle actions
    if (this.controls.wasKeyJustPressed('attack')) {
      this.inputQueue.push({ type: 'attack' });
    }

    if (this.controls.wasKeyJustPressed('interact')) {
      this.inputQueue.push({ type: 'interact' });
    }

    if (this.controls.wasKeyJustPressed('inventory')) {
      this.inputQueue.push({ type: 'menu', key: 'toggle_inventory' });
    }

    if (this.controls.wasKeyJustPressed('log_facing_tile')) {
      this.inputQueue.push({ type: 'menu', key: 'log_facing_tile' });
    }
  }

  public clearInput(): void {
    this.inputQueue = [];
  }
}