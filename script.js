/**
 * Dot Clock Application
 * Supports Ring and Grid modes.
 */

// Bitmap Font for 3x5 Digits (0-9) + Colon
// 1 = on, 0 = off
const FONT_3x5 = {
    '0': [[1, 1, 1], [1, 0, 1], [1, 0, 1], [1, 0, 1], [1, 1, 1]],
    '1': [[0, 1, 0], [1, 1, 0], [0, 1, 0], [0, 1, 0], [1, 1, 1]], // Wide 1
    '1_narrow': [[1], [1], [1], [1], [1]], // Custom narrow 1 for tight fits
    '2': [[1, 1, 1], [0, 0, 1], [1, 1, 1], [1, 0, 0], [1, 1, 1]],
    '3': [[1, 1, 1], [0, 0, 1], [1, 1, 1], [0, 0, 1], [1, 1, 1]],
    '4': [[1, 0, 1], [1, 0, 1], [1, 1, 1], [0, 0, 1], [0, 0, 1]],
    '5': [[1, 1, 1], [1, 0, 0], [1, 1, 1], [0, 0, 1], [1, 1, 1]],
    '6': [[1, 1, 1], [1, 0, 0], [1, 1, 1], [1, 0, 1], [1, 1, 1]],
    '7': [[1, 1, 1], [0, 0, 1], [0, 1, 0], [0, 1, 0], [0, 1, 0]],
    '8': [[1, 1, 1], [1, 0, 1], [1, 1, 1], [1, 0, 1], [1, 1, 1]],
    '9': [[1, 1, 1], [1, 0, 1], [1, 1, 1], [0, 0, 1], [0, 0, 1]], // Bottom hook style
    ':': [[0], [1], [0], [1], [0]] // 1x5 colon (dots at 2 and 4)
};

class DotClockApp {
    constructor() {
        this.currentMode = null;
        this.container = document.getElementById('mode-content');
        this.tabs = document.querySelectorAll('.tab-btn');

        // Shared State
        this.isDark = false;

        // DOM Elements
        this.themeToggle = document.getElementById('theme-toggle');
        this.realismToggle = document.getElementById('realism-toggle');
        this.demoBtn = document.getElementById('demo-btn');

        this.init();
    }

    init() {
        this.bindEvents();
        this.loadPreferences();

        // Default mode
        this.switchMode('ring');

        // Global RAF
        requestAnimationFrame((t) => this.tick(t));
    }

    bindEvents() {
        // Mode Tabs
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const modeName = tab.dataset.mode;
                this.switchMode(modeName);
            });
        });

        // Theme
        this.themeToggle.addEventListener('click', () => {
            this.isDark = !this.isDark;
            this.applyTheme();
        });

        // Demo
        this.demoBtn.addEventListener('click', () => {
            if (this.currentMode && this.currentMode.startDemo) {
                this.currentMode.startDemo();
            }
        });

        // Pass realism toggle to mode if it cares
        this.realismToggle.addEventListener('change', (e) => {
            if (this.currentMode && this.currentMode.setSmoothHour) {
                this.currentMode.setSmoothHour(e.target.checked);
            }
        });
    }

    switchMode(modeName) {
        // UI Update
        this.tabs.forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`.tab-btn[data-mode="${modeName}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Cleanup
        if (this.currentMode && this.currentMode.destroy) {
            this.currentMode.destroy();
        }
        this.container.innerHTML = '';

        // Init new mode
        if (modeName === 'ring') {
            this.currentMode = new RingMode(this.container);
        } else if (modeName === 'grid') {
            this.currentMode = new GridMode(this.container);
        }
    }

    loadPreferences() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.isDark = true;
        }
        this.applyTheme();
    }

    applyTheme() {
        document.body.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
    }

    tick(t) {
        const now = new Date();
        if (this.currentMode && this.currentMode.update && this.currentMode.render) {
            this.currentMode.update(now);
            this.currentMode.render(now);
        }
        requestAnimationFrame((time) => this.tick(time));
    }
}

/**
 * RING MODE
 * Original circular clock logic
 */
class RingMode {
    constructor(container) {
        // Create Structure
        this.root = document.createElement('div');
        this.root.className = 'clock-container';
        this.root.innerHTML = `
            <div id="dot-ring" class="dot-ring"></div>
            <div id="time-label" class="time-label"></div>
        `;
        container.appendChild(this.root);

        this.dotContainer = this.root.querySelector('#dot-ring');
        this.timeLabel = this.root.querySelector('#time-label');

        this.dots = [];
        this.cursorDot = null;

        // Config
        const realismMsg = document.getElementById('realism-toggle');
        this.smoothHour = realismMsg ? realismMsg.checked : true;

        // State
        this.isTimestampMode = false;
        this.timestampEndTime = 0;
        this.lastMinute = null;

        this.init();
    }

    setSmoothHour(val) {
        this.smoothHour = val;
    }

    init() {
        // Cursor
        this.cursorDot = document.createElement('div');
        this.cursorDot.className = 'dot active';
        this.dotContainer.appendChild(this.cursorDot);

        // 60 Dots
        const r = 48;
        for (let i = 0; i < 60; i++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.dataset.index = i;
            const angleDeg = i * 6;
            const angleRad = (angleDeg - 90) * (Math.PI / 180);
            const x = 50 + r * Math.cos(angleRad);
            const y = 50 + r * Math.sin(angleRad);
            dot.style.left = `${x}%`;
            dot.style.top = `${y}%`;
            this.dotContainer.appendChild(dot);
            this.dots.push(dot);
        }

        // Re-append cursor to be on top
        this.dotContainer.appendChild(this.cursorDot);
        this.lastMinute = new Date().getMinutes();
    }

    destroy() {
        // Nothing heavy to cleanup
    }

    startDemo() {
        this.triggerTimestampEffect(new Date());
    }

    triggerTimestampEffect(date) {
        this.isTimestampMode = true;
        this.timestampEndTime = Date.now() + 2000;

        const h = date.getHours();
        const m = date.getMinutes();
        const displayH = h % 12 || 12;
        const displayM = m.toString().padStart(2, '0');
        this.timeLabel.textContent = `${displayH}:${displayM}`;
        this.timeLabel.classList.add('visible');
        this.cursorDot.style.opacity = '0';
    }

    update(now) {
        const currentMinute = now.getMinutes();
        if (this.lastMinute !== null && currentMinute !== this.lastMinute) {
            // Real minute rollover
            this.triggerTimestampEffect(now);
        }
        this.lastMinute = currentMinute;

        if (this.isTimestampMode && Date.now() > this.timestampEndTime) {
            this.isTimestampMode = false;
            this.timeLabel.classList.remove('visible');
            this.cursorDot.style.opacity = '';
        }
    }

    render(now) {
        // Reset styles first
        this.dots.forEach(d => {
            d.className = 'dot';
            d.style.transform = '';
            d.style.boxShadow = '';
            d.style.opacity = '';
            // Reset specialized classes
            if (d.classList.contains('timestamp-highlight')) d.classList.remove('timestamp-highlight');
            if (d.classList.contains('timestamp-dim')) d.classList.remove('timestamp-dim');
            if (d.classList.contains('overlap')) d.classList.remove('overlap');
        });

        if (this.isTimestampMode) {
            this.renderTimestampMode(now);
        } else {
            this.renderNormalMode(now);
        }
    }

    renderNormalMode(now) {
        const ms = now.getMilliseconds();
        const s = now.getSeconds();
        const totalSeconds = s + (ms / 1000);
        const angleDeg = totalSeconds * 6;
        const angleRad = (angleDeg - 90) * (Math.PI / 180);
        const r = 48;
        const x = 50 + r * Math.cos(angleRad);
        const y = 50 + r * Math.sin(angleRad);

        this.cursorDot.style.left = `${x}%`;
        this.cursorDot.style.top = `${y}%`;
    }

    renderTimestampMode(now) {
        const h = now.getHours();
        const m = now.getMinutes();
        const mIndex = m;

        let hRaw = (h % 12) * 5;
        if (this.smoothHour) hRaw += m / 12;
        const hIndex = Math.round(hRaw) % 60;

        const mDot = this.dots[mIndex];
        const hDot = this.dots[hIndex];

        if (mDot) mDot.classList.add('timestamp-highlight');
        if (hDot) hDot.classList.add('timestamp-highlight');

        // Dim others
        this.dots.forEach(d => {
            if (d !== mDot && d !== hDot) d.classList.add('timestamp-dim');
        });

        if (mIndex === hIndex && mDot) mDot.classList.add('overlap');
    }
}

/**
 * GRID MODE
 * 10x6 Dot Matrix
 */
class GridMode {
    constructor(container) {
        this.root = document.createElement('div');
        this.root.className = 'clock-grid';
        container.appendChild(this.root);

        // SVG Layer for connectors
        this.svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgLayer.classList.add('grid-connector-layer');
        this.root.appendChild(this.svgLayer);

        this.dots = [];
        this.init();

        this.isOverlay = false;
        this.overlayEndTime = 0;
        this.lastMinute = null;
    }

    init() {
        // Create 60 dots (10 cols x 6 rows)
        for (let i = 0; i < 60; i++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            this.root.appendChild(dot);
            this.dots.push(dot);
        }
        this.lastMinute = new Date().getMinutes();
    }

    destroy() { }

    startDemo() {
        this.triggerOverlay();
    }

    triggerOverlay() {
        this.isOverlay = true;
        this.overlayEndTime = Date.now() + 2000;
    }

    update(now) {
        const currentMinute = now.getMinutes();
        if (this.lastMinute !== null && currentMinute !== this.lastMinute) {
            this.triggerOverlay();
        }
        this.lastMinute = currentMinute;

        if (this.isOverlay && Date.now() > this.overlayEndTime) {
            this.isOverlay = false;
        }
    }

    render(now) {
        // Clear all visuals
        this.dots.forEach(d => {
            d.classList.remove('active-second', 'overlay-on');
            d.style.transform = '';
            d.style.opacity = '';
        });

        // Clear SVG
        while (this.svgLayer.firstChild) {
            this.svgLayer.removeChild(this.svgLayer.firstChild);
        }

        if (this.isOverlay) {
            this.renderOverlay(now);
        } else {
            this.renderNormal(now);
        }
    }

    renderNormal(now) {
        const s = now.getSeconds();
        // Just the one dot at index `s` is active
        if (this.dots[s]) {
            this.dots[s].classList.add('active-second');
        }
    }

    renderOverlay(now) {
        // Draw H:MM map
        const h = now.getHours();
        const m = now.getMinutes();
        const displayH = (h % 12 || 12).toString();
        const displayM = m.toString().padStart(2, '0');

        let chars = [];
        if (displayH.length > 1) {
            chars.push(displayH[0]);
            chars.push(displayH[1]);
        } else {
            chars.push(displayH[0]);
        }

        if (displayH.length < 2) {
            chars.push(':');
        }

        chars.push(displayM[0]);
        chars.push(displayM[1]);

        // Build Sequence
        let sequence = [];
        let totalW = 0;

        chars.forEach(c => {
            let key = c;
            let w = 3;
            if (c === ':') { w = 1; }
            else if (c === '1') { key = '1_narrow'; w = 1; }

            sequence.push({ key, w });
            totalW += w;
        });

        // Start Position
        let cursorX = Math.floor((10 - totalW) / 2);
        if (cursorX < 0) cursorX = 0;

        // Use DOM-based positioning for perfect centering
        const getCenter = (tx, ty) => {
            if (tx < 0 || tx >= 10 || ty < 0 || ty >= 6) return null;
            const idx = ty * 10 + tx;
            const dot = this.dots[idx];
            if (!dot) return null;

            // offsetLeft/Top are relative to the grid container
            // We need center, so add half width/height
            return {
                x: dot.offsetLeft + dot.offsetWidth / 2,
                y: dot.offsetTop + dot.offsetHeight / 2
            };
        };

        // Process each character independently
        sequence.forEach(item => {
            const matrix = FONT_3x5[item.key];
            if (!matrix) return;

            // 1. Draw Dots for this char
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < item.w; c++) {
                    if (matrix[r][c] === 1) {
                        const targetX = cursorX + c;
                        const targetY = r + 1; // Center Y

                        if (targetX >= 0 && targetX < 10 && targetY < 6) {
                            const index = targetY * 10 + targetX;
                            if (this.dots[index]) {
                                this.dots[index].classList.add('overlay-on');
                            }
                        }
                    }
                }
            }

            // 2. Draw Connections INTERNAL to this char
            // This prevents lines bridging between digits
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < item.w; c++) {
                    if (matrix[r][c] === 1) {
                        const startXVal = cursorX + c;
                        const startYVal = r + 1;
                        const p1 = getCenter(startXVal, startYVal);
                        if (!p1) continue;

                        // Check Right (within char bounds items.w)
                        if (c + 1 < item.w && matrix[r][c + 1] === 1) {
                            // Draw Horiz Line
                            const p2 = getCenter(startXVal + 1, startYVal);
                            if (p2) this.drawLine(p1.x, p1.y, p2.x, p2.y);
                        }

                        // Check Down (within char bounds 5)
                        if (r + 1 < 5 && matrix[r + 1][c] === 1) {
                            // Draw Vert Line
                            const p2 = getCenter(startXVal, startYVal + 1);
                            if (p2) this.drawLine(p1.x, p1.y, p2.x, p2.y);
                        }
                    }
                }
            }

            // Advance cursor
            cursorX += item.w;
        });
    }

    drawLine(x1, y1, x2, y2) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.classList.add("connector-line");
        this.svgLayer.appendChild(line);
    }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DotClockApp();
});
