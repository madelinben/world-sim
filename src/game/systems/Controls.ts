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
    };

    // Mouse drag state
    public isDragging = false;
    public dragStart: { x: number; y: number } | null = null;
    public lastMouse: { x: number; y: number } | null = null;
    public dragDelta: { x: number; y: number } = { x: 0, y: 0 };

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
            }
            this.keyState[mapped] = true;
            this.keys.add(mapped);
            console.log('Key down:', mapped, this.keyState);
        });

        window.addEventListener('keyup', (e) => {
            const mapped = Controls.keyMap[e.key] ?? e.key.toLowerCase();
            this.keyState[mapped] = false;
            this.keys.delete(mapped);
            this.justPressed[mapped] = false;
            console.log('Key up:', mapped, this.keyState);
        });
    }

    private setupMouseListeners(canvas: HTMLCanvasElement) {
        canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.dragDelta = { x: 0, y: 0 };
            console.log('Mouse down:', this.dragStart);
        });
        canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.lastMouse) {
                const dx = e.clientX - this.lastMouse.x;
                const dy = e.clientY - this.lastMouse.y;
                this.dragDelta.x += dx;
                this.dragDelta.y += dy;
                this.lastMouse = { x: e.clientX, y: e.clientY };
                console.log('Mouse drag:', this.dragDelta);
            }
        });
        canvas.addEventListener('mouseup', (e) => {
            this.isDragging = false;
            this.dragStart = null;
            this.lastMouse = null;
            console.log('Mouse up');
        });
        canvas.addEventListener('mouseleave', (e) => {
            this.isDragging = false;
            this.dragStart = null;
            this.lastMouse = null;
            console.log('Mouse leave');
        });
    }

    public update(): void {
        // Reset justPressed after each frame
        this.justPressed = {};
        // Reset drag delta after each frame
        if (this.dragDelta.x !== 0 || this.dragDelta.y !== 0) {
            console.log('Drag delta applied:', this.dragDelta);
        }
    }

    public isKeyPressed(key: string): boolean {
        return this.keyState[key] ?? false;
    }

    public wasKeyJustPressed(key: string): boolean {
        return this.justPressed[key] ?? false;
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