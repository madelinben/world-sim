export class Controls {
    private keys: Set<string>;
    private keyState: Record<string, boolean>;
    private justPressed: Record<string, boolean>;

    private static keyMap: Record<string, string> = {
        w: 'up',
        ArrowUp: 'up',
        s: 'down',
        ArrowDown: 'down',
        a: 'left',
        ArrowLeft: 'left',
        d: 'right',
        ArrowRight: 'right',
        q: 'attack',
        g: 'block',
        f: 'interact',
        e: 'inventory',
        z: 'take_all',
        x: 'take_selected',
        Escape: 'escape',
        '1': 'slot1',
        '2': 'slot2',
        '3': 'slot3',
        '4': 'slot4',
        '5': 'slot5',
        '6': 'slot6',
        '7': 'slot7',
        '8': 'slot8',
        '9': 'slot9',
    };

    // Mouse drag state
    public isDragging = false;
    public dragStart: { x: number; y: number } | null = null;
    public lastMouse: { x: number; y: number } | null = null;
    public dragDelta: { x: number; y: number } = { x: 0, y: 0 };

    // Mouse click state
    public mouseClick: { x: number; y: number } | null = null;

    constructor(private canvas?: HTMLCanvasElement) {
        this.keys = new Set();
        this.keyState = {};
        this.justPressed = {};
        this.setupEventListeners();
        if (canvas) this.setupMouseListeners(canvas);
    }

    public setCanvas(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.setupMouseListeners(canvas);
    }

    private setupEventListeners(): void {
        window.addEventListener('keydown', (e) => {
            const mapped = Controls.keyMap[e.key] ?? e.key.toLowerCase();
            if (!this.keyState[mapped]) {
                this.justPressed[mapped] = true;
                // Only log meaningful key operations
                if (mapped in Controls.keyMap || ['attack', 'interact', 'inventory'].includes(mapped) || mapped.startsWith('slot')) {
                    console.log(`Key pressed: ${e.key} → ${mapped}`);
                }
            }
            this.keyState[mapped] = true;
            this.keys.add(mapped);
        });

        window.addEventListener('keyup', (e) => {
            const mapped = Controls.keyMap[e.key] ?? e.key.toLowerCase();
            this.keyState[mapped] = false;
            this.keys.delete(mapped);
            this.justPressed[mapped] = false;
        });
    }

    private setupMouseListeners(canvas: HTMLCanvasElement) {
        canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.dragDelta = { x: 0, y: 0 };
        });
        canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.lastMouse) {
                const dx = e.clientX - this.lastMouse.x;
                const dy = e.clientY - this.lastMouse.y;
                this.dragDelta.x += dx;
                this.dragDelta.y += dy;
                this.lastMouse = { x: e.clientX, y: e.clientY };
            }
        });
        canvas.addEventListener('mouseup', (e) => {
            // Only register click if we weren't dragging much
            if (this.dragStart) {
                const dragDistance = Math.sqrt(
                    Math.pow(e.clientX - this.dragStart.x, 2) +
                    Math.pow(e.clientY - this.dragStart.y, 2)
                );
                if (dragDistance < 5) { // Less than 5 pixels = click
                    this.mouseClick = { x: e.clientX, y: e.clientY };
                }
            }

            this.isDragging = false;
            this.dragStart = null;
            this.lastMouse = null;
        });
        canvas.addEventListener('mouseleave', (e) => {
            this.isDragging = false;
            this.dragStart = null;
            this.lastMouse = null;
        });
    }

    public update(): void {
        // Don't reset justPressed here - it should be reset after actions are processed
        // Reset drag delta after each frame (no logging)
    }

    public clearJustPressed(): void {
        // Reset justPressed states - to be called after actions are processed
        this.justPressed = {};
    }

    public getMouseClick(): { x: number; y: number } | null {
        const click = this.mouseClick;
        this.mouseClick = null; // Reset after reading
        return click;
    }

    public isKeyPressed(key: string): boolean {
        return this.keyState[key] ?? false;
    }

    public wasKeyJustPressed(key: string): boolean {
        return this.justPressed[key] ?? false;
    }

    public wasAnyKeyPressed(): boolean {
        return Object.values(this.justPressed).some(pressed => pressed);
    }

    public getMovementDirection(): { x: number; y: number } {
        let x = 0;
        let y = 0;

        if (this.isKeyPressed('up')) y -= 1;
        if (this.isKeyPressed('down')) y += 1;
        if (this.isKeyPressed('left')) x -= 1;
        if (this.isKeyPressed('right')) x += 1;

        return { x, y };
    }
}