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
        // Clear all
        this.dots.forEach(d => {
            d.classList.remove('active-second', 'overlay-on');
            d.style.transform = '';
            d.style.opacity = '';
        });

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

        // Layout Strategy for 10 columns:
        // Use narrow '1' if possible.
        // If H>=10 (e.g. 10, 11, 12):
        //   '1' (narrow, 1px) + gap(0) + '0-2' (3px) + gap(0) + ':' (1px) + gap(0) + 'M' (3px) + gap(-1?) + 'M' (3px)
        //   Total needed: 1 + 3 + 1 + 3 + 3 = 11. 
        //   We have 10.
        //   We must overlap the last digit or colon.
        //   OR: we suppress the colon?
        //   '1' (1) '2' (3) '4' (3) '5' (3) = 10px. 
        //   So "1245" fits perfectly in 10 cols.
        //   Let's try to remove colon if total width > 10.

        let chars = [];
        if (displayH.length > 1) {
            chars.push(displayH[0]);
            chars.push(displayH[1]);
        } else {
            chars.push(displayH[0]);
        }

        // Check if we can fit colon
        // H < 10: "H:MM" -> 3 + 1 + 3 + 3 = 10. Fit! (Space is tight, no gaps)
        // H >= 10: "12:MM" -> 1 + 3 + 1 + 3 + 3 = 11. No fit.
        // Logic: if H >= 10, drop colon.
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

        // Render Loop
        sequence.forEach(item => {
            const matrix = FONT_3x5[item.key];
            if (!matrix) return;

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
            cursorX += item.w;
        });
    }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DotClockApp();
});
