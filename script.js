/**
 * Dot Clock Application
 * Supports Ring and Grid modes with Metamorphosis Transition.
 */

// Bitmap Font for 3x5 Digits (0-9) + Colon
const FONT_3x5 = {
    '0': [[1, 1, 1], [1, 0, 1], [1, 0, 1], [1, 0, 1], [1, 1, 1]],
    '1': [[0, 1, 0], [1, 1, 0], [0, 1, 0], [0, 1, 0], [1, 1, 1]],
    '1_narrow': [[1], [1], [1], [1], [1]],
    '2': [[1, 1, 1], [0, 0, 1], [1, 1, 1], [1, 0, 0], [1, 1, 1]],
    '3': [[1, 1, 1], [0, 0, 1], [1, 1, 1], [0, 0, 1], [1, 1, 1]],
    '4': [[1, 0, 1], [1, 0, 1], [1, 1, 1], [0, 0, 1], [0, 0, 1]],
    '5': [[1, 1, 1], [1, 0, 0], [1, 1, 1], [0, 0, 1], [1, 1, 1]],
    '6': [[1, 1, 1], [1, 0, 0], [1, 1, 1], [1, 0, 1], [1, 1, 1]],
    '7': [[1, 1, 1], [0, 0, 1], [0, 1, 0], [0, 1, 0], [0, 1, 0]],
    '8': [[1, 1, 1], [1, 0, 1], [1, 1, 1], [1, 0, 1], [1, 1, 1]],
    '9': [[1, 1, 1], [1, 0, 1], [1, 1, 1], [0, 0, 1], [0, 0, 1]],
    ':': [[0], [1], [0], [1], [0]]
};


// State Constants
const STATE_NORMAL = 'normal';
const STATE_TIMESTAMP = 'timestamp';

class DotClockApp {
    constructor() {
        this.currentMode = null;
        this.container = document.getElementById('mode-content');
        this.tabs = document.querySelectorAll('.tab-btn');

        // Persistent Elements
        this.clockContainer = null;
        this.dotRingContainer = null;
        this.timeLabel = null;
        this.dots = []; // Shared 60 dots

        // Configuration
        this.isDark = false;

        // Controls
        this.themeToggle = document.getElementById('theme-toggle');
        this.demoBtn = document.getElementById('demo-btn');

        this.init();
    }

    init() {
        // Create persistent structure
        this.container.innerHTML = `
            <div class="clock-container">
                <div id="dot-ring" class="dot-ring"></div>
                <div id="time-label" class="time-label"></div>
            </div>
        `;
        this.clockContainer = this.container.querySelector('.clock-container');
        this.dotRingContainer = this.container.querySelector('#dot-ring');
        this.timeLabel = this.container.querySelector('#time-label');

        // Initialize 60 Shared Dots
        for (let i = 0; i < 60; i++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.dataset.index = i;
            this.dotRingContainer.appendChild(dot);
            this.dots.push(dot);
        }

        this.bindEvents();
        this.loadPreferences();

        // Init Modes
        this.modes = {
            'ring': new RingMode(this),
            'grid': new GridMode(this)
        };

        // Start in Ring mode
        this.switchMode('ring');

        // Global RAF
        requestAnimationFrame((t) => this.tick(t));
    }

    bindEvents() {
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchMode(tab.dataset.mode);
            });
        });

        this.themeToggle.addEventListener('click', () => {
            this.isDark = !this.isDark;
            this.applyTheme();
        });

        this.demoBtn.addEventListener('click', () => {
            if (this.currentMode && this.currentMode.startDemo) {
                this.currentMode.startDemo();
            }
        });
    }

    switchMode(modeName) {
        if (this.currentMode === this.modes[modeName]) return;

        this.tabs.forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`.tab-btn[data-mode="${modeName}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Apply random delay to each dot to break "row" movement
        // This makes them feel like individual particles
        this.dots.forEach(dot => {
            dot.style.transitionDelay = `${Math.random() * 0.3}s`;
        });

        // Remove delays after transition finishes so ticking remains snappy
        setTimeout(() => {
            this.dots.forEach(dot => {
                dot.style.transitionDelay = '0s';
            });
        }, 800); // Wait for max delay (0.3s) + duration (0.6s) roughly

        // Transition
        if (this.currentMode) this.currentMode.leave();
        this.currentMode = this.modes[modeName];
        this.currentMode.enter();

        // Update container class for context-aware styling if needed
        this.clockContainer.className = `clock-container ${modeName}-mode`;
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
        if (this.currentMode) {
            this.currentMode.update(now);
            this.currentMode.render(now);
        }
        requestAnimationFrame((time) => this.tick(time));
    }
}

/**
 * RING MODE
 */
class RingMode {
    constructor(app) {
        this.app = app;
        this.dots = app.dots;

        // Create Cursor ONLY once (it stays in DOM but hidden in Grid mode)
        this.cursorDot = document.createElement('div');
        this.cursorDot.className = 'dot active';
        this.cursorDot.style.opacity = '0'; // Hidden by default
        this.cursorDot.style.zIndex = '50';
        app.dotRingContainer.appendChild(this.cursorDot);

        // State Machine
        this.currentState = STATE_NORMAL;
        this.timestampEndTime = 0;
        this.lastMinute = null;

        // SVG Layer for Ring Connectors
        this.svgRingLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgRingLayer.classList.add('ring-connector-layer');
    }

    enter() {
        // Append SVG
        this.app.clockContainer.appendChild(this.svgRingLayer);

        // Apply Circular Layout
        const r = 48; // Radius %
        this.dots.forEach((dot, i) => {
            const angleDeg = i * 6;
            const angleRad = (angleDeg - 90) * (Math.PI / 180);
            const x = 50 + r * Math.cos(angleRad);
            const y = 50 + r * Math.sin(angleRad);

            dot.style.left = `${x}%`;
            dot.style.top = `${y}%`;
            dot.style.transform = 'translate(-50%, -50%) scale(1)'; // Reset scale
            dot.className = 'dot'; // Reset classes
        });

        // Show cursor specific to Ring
        this.cursorDot.style.opacity = '1';
        this.lastMinute = new Date().getMinutes();

        // Default to normal state on enter
        this.enterNormalState();

        // Show time label immediately
        this.app.timeLabel.classList.add('visible');
        this.updateTimeLabel(new Date());
    }

    leave() {
        // Hide UI specific to Ring
        this.cursorDot.style.opacity = '0';
        this.app.timeLabel.classList.remove('visible');

        if (this.svgRingLayer.parentNode) this.svgRingLayer.parentNode.removeChild(this.svgRingLayer);

        // Clear SVG
        while (this.svgRingLayer.firstChild) this.svgRingLayer.removeChild(this.svgRingLayer.firstChild);
    }

    startDemo() {
        this.enterTimestampState();
    }

    // --- State Management ---

    enterNormalState() {
        this.currentState = STATE_NORMAL;
        this.cursorDot.style.opacity = '1';
        this.app.timeLabel.classList.add('visible');

        // Clear connectors
        while (this.svgRingLayer.firstChild) this.svgRingLayer.removeChild(this.svgRingLayer.firstChild);
    }

    enterTimestampState() {
        this.currentState = STATE_TIMESTAMP;
        this.timestampEndTime = Date.now() + 2000;
        this.cursorDot.style.opacity = '0'; // Hide cursor in timestamp details if desired?
        // Original code hid cursor in timestamp mode: this.cursorDot.style.opacity = '0';

        // Ensure accurate time update immediately
        this.updateTimeLabel(new Date());
    }

    updateTimeLabel(date) {
        const h = date.getHours();
        const m = date.getMinutes();
        const displayH = h % 12 || 12;
        const displayM = m.toString().padStart(2, '0');
        this.app.timeLabel.textContent = `${displayH}:${displayM}`;
    }

    update(now) {
        const currentMinute = now.getMinutes();

        // Check for minute change -> Trigger Timestamp State
        if (this.lastMinute !== null && currentMinute !== this.lastMinute) {
            this.enterTimestampState();
        }
        this.lastMinute = currentMinute;

        // Always update time label in Ring Mode
        this.updateTimeLabel(now);

        // State Transition Logic
        if (this.currentState === STATE_TIMESTAMP && Date.now() > this.timestampEndTime) {
            this.enterNormalState();
        }
    }

    render(now) {
        // Reset visual states each frame (or optimized)
        this.dots.forEach(d => {
            // Keep layout static (layout is set in enter), just update visual class
            if (d.className !== 'dot') d.className = 'dot';
            d.style.boxShadow = '';
            d.style.opacity = '';
        });

        if (this.currentState === STATE_TIMESTAMP) {
            this.renderTimestampState(now);
        } else {
            this.renderNormalState(now);
        }
    }

    renderNormalState(now) {
        const ms = now.getMilliseconds();
        const s = now.getSeconds();
        const totalSeconds = s + (ms / 1000);
        const angleDeg = totalSeconds * 6;
        const angleRad = (angleDeg - 90) * (Math.PI / 180);
        const r = 48;
        const x = 50 + r * Math.cos(angleRad);
        const y = 50 + r * Math.sin(angleRad);

        // Verify cursor existence (failsafe)
        if (this.cursorDot) {
            this.cursorDot.style.left = `${x}%`;
            this.cursorDot.style.top = `${y}%`;
        }
    }

    renderTimestampState(now) {
        const h = now.getHours();
        const m = now.getMinutes();

        // Calculate Hour Block
        // User requested 11 to be 50-54 (before last 5).
        // Standard mapping: 12 is top.
        // Logic: h=1 -> 0-4. h=11 -> 50-54. h=12/0 -> 55-59.
        let h12 = h % 12;
        if (h12 === 0) h12 = 12; // Treat 0 and 12 as 12th block

        // (12 -> 11, 1 -> 0, 11 -> 10)
        const blockStartIndex = (h12 - 1) * 5;

        const mDot = this.dots[m];

        // Reset all dots to dim first
        this.dots.forEach(d => {
            d.classList.add('timestamp-dim');
            d.classList.remove('timestamp-highlight');
            d.classList.remove('overlap');
        });

        // Clear existing connectors
        while (this.svgRingLayer.firstChild) this.svgRingLayer.removeChild(this.svgRingLayer.firstChild);

        // Highlight Hour Block (5 dots) and Connect them
        for (let i = 0; i < 5; i++) {
            const dotIndex = (blockStartIndex + i) % 60;
            const dot = this.dots[dotIndex];
            if (dot) {
                dot.classList.remove('timestamp-dim');
                dot.classList.add('timestamp-highlight');

                // Connect to next dot in the block (if not the last one)
                if (i < 4) {
                    const nextDotIndex = (blockStartIndex + i + 1) % 60;
                    const nextDot = this.dots[nextDotIndex];
                    if (nextDot) {
                        this.drawRingLine(dot, nextDot);
                    }
                }
            }
        }

        // Highlight Minute Dot
        if (mDot) {
            mDot.classList.remove('timestamp-dim');
            mDot.classList.add('timestamp-highlight');

            // Check for overlap
            if (m >= blockStartIndex && m < blockStartIndex + 5) {
                mDot.classList.add('overlap');
            }
        }
    }

    drawRingLine(dot1, dot2) {
        // dots are centered by transform, so offsetLeft/Top is the center position (pre-transform origin).
        const x1 = dot1.offsetLeft;
        const y1 = dot1.offsetTop;
        const x2 = dot2.offsetLeft;
        const y2 = dot2.offsetTop;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);

        // Failsafe styling
        line.setAttribute("stroke", this.app.isDark ? "#ffffff" : "#1d1d1f");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-opacity", "0.6");
        line.setAttribute("stroke-linecap", "round");

        line.classList.add("ring-connector-line");
        this.svgRingLayer.appendChild(line);
    }
}

/**
 * GRID MODE
 */
class GridMode {
    constructor(app) {
        this.app = app;
        this.dots = app.dots;

        // SVG Layer
        this.svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgLayer.classList.add('grid-connector-layer');

        // Independent Cursor Dot
        this.gridCursor = document.createElement('div');
        this.gridCursor.className = 'grid-cursor';
        // hidden by default

        // State Machine
        this.currentState = STATE_NORMAL;
        this.stateEndTime = 0;
        this.lastMinute = null;
    }

    enter() {
        // Append elements
        this.app.clockContainer.appendChild(this.svgLayer);
        this.app.clockContainer.appendChild(this.gridCursor);

        // Apply Grid Layout
        // 10 columns, 6 rows.
        this.dots.forEach((dot, i) => {
            const c = i % 10;
            const r = Math.floor(i / 10);

            const x = c * 10 + 5;
            const y = r * (100 / 6) + (100 / 12);

            dot.style.left = `${x}%`;
            dot.style.top = `${y}%`;
            dot.style.transform = 'translate(-50%, -50%) scale(1)'; // Base scale
        });

        this.lastMinute = new Date().getMinutes();
        this.enterNormalState();
    }

    leave() {
        if (this.svgLayer.parentNode) this.svgLayer.parentNode.removeChild(this.svgLayer);
        if (this.gridCursor.parentNode) this.gridCursor.parentNode.removeChild(this.gridCursor);

        // Clear SVG lines
        while (this.svgLayer.firstChild) this.svgLayer.removeChild(this.svgLayer.firstChild);
    }

    startDemo() {
        this.enterTimestampState();
    }

    // --- State Management ---

    enterNormalState() {
        this.currentState = STATE_NORMAL;
        this.gridCursor.style.opacity = '1';
    }

    enterTimestampState() {
        this.currentState = STATE_TIMESTAMP;
        this.stateEndTime = Date.now() + 2000;

        // Hide cursor during timestamp overlay
        this.gridCursor.style.opacity = '0';
    }

    update(now) {
        const currentMinute = now.getMinutes();
        if (this.lastMinute !== null && currentMinute !== this.lastMinute) {
            this.enterTimestampState();
        }
        this.lastMinute = currentMinute;

        if (this.currentState === STATE_TIMESTAMP && Date.now() > this.stateEndTime) {
            this.enterNormalState();
        }
    }

    render(now) {
        const s = now.getSeconds();

        // 1. Reset standard dots
        this.dots.forEach((d) => {
            if (d.classList.contains('active-second')) d.classList.remove('active-second');
            if (d.classList.contains('overlay-on')) d.classList.remove('overlay-on');

            // Default scale
            if (d.style.transform !== 'translate(-50%, -50%) scale(1)') {
                d.style.transform = 'translate(-50%, -50%) scale(1)';
            }
        });

        // Clear SVG
        while (this.svgLayer.firstChild) this.svgLayer.removeChild(this.svgLayer.firstChild);

        if (this.currentState === STATE_TIMESTAMP) {
            this.renderTimestampState(now);
        } else {
            this.renderNormalState(now);
        }
    }

    renderNormalState(now) {
        const s = now.getSeconds();

        // Update Cursor Position
        this.gridCursor.style.opacity = '1';

        // Calculate position for second 's'
        const c = s % 10;
        const r = Math.floor(s / 10);
        const x = c * 10 + 5;
        const y = r * (100 / 6) + (100 / 12);

        this.gridCursor.style.left = `${x}%`;
        this.gridCursor.style.top = `${y}%`;
    }

    renderTimestampState(now) {
        // Overlay logic sets class 'overlay-on' which style.css handles with scale(1),
        const h = now.getHours();
        const m = now.getMinutes();
        const displayH = (h % 12 || 12).toString();
        const displayM = m.toString().padStart(2, '0');

        let chars = [];
        if (displayH.length > 1) { chars.push(displayH[0], displayH[1]); }
        else { chars.push(displayH[0]); }
        if (displayH.length < 2) { chars.push(':'); }
        chars.push(displayM[0], displayM[1]);

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

        let cursorX = Math.floor((10 - totalW) / 2);
        if (cursorX < 0) cursorX = 0;

        const getCenter = (tx, ty) => {
            if (tx < 0 || tx >= 10 || ty < 0 || ty >= 6) return null;
            const idx = ty * 10 + tx;
            const dot = this.dots[idx];
            if (!dot) return null;
            return {
                x: dot.offsetLeft + dot.offsetWidth / 2,
                y: dot.offsetTop + dot.offsetHeight / 2
            };
        };

        sequence.forEach(item => {
            const matrix = FONT_3x5[item.key];
            if (!matrix) return;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < item.w; c++) {
                    if (matrix[r][c] === 1) {
                        const targetX = cursorX + c;
                        const targetY = r + 1;
                        if (targetX >= 0 && targetX < 10 && targetY < 6) {
                            const index = targetY * 10 + targetX;
                            if (this.dots[index]) {
                                this.dots[index].classList.add('overlay-on');
                                this.dots[index].style.transform = 'translate(-50%, -50%) scale(1.0)';
                            }
                        }
                    }
                }
            }
            // Connections
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < item.w; c++) {
                    if (matrix[r][c] === 1) {
                        const startXVal = cursorX + c;
                        const startYVal = r + 1;
                        const p1 = getCenter(startXVal, startYVal);
                        if (!p1) continue;

                        if (c + 1 < item.w && matrix[r][c + 1] === 1) {
                            const p2 = getCenter(startXVal + 1, startYVal);
                            if (p2) this.drawLine(p1.x, p1.y, p2.x, p2.y);
                        }
                        if (r + 1 < 5 && matrix[r + 1][c] === 1) {
                            const p2 = getCenter(startXVal, startYVal + 1);
                            if (p2) this.drawLine(p1.x, p1.y, p2.x, p2.y);
                        }
                    }
                }
            }
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

document.addEventListener('DOMContentLoaded', () => {
    window.app = new DotClockApp();
});
