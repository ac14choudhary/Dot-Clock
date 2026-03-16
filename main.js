const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        simpleFullscreen: true, // Mac specific smooth fullscreen
        fullscreen: true,       // Start in fullscreen
        frame: false,           // No window chrome (frameless)
        kiosk: true,            // Kiosk mode (prevents easy exit, good for screensaver)
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile(path.join(__dirname, 'web/index.html'));

    // Optional: Quit on 'Esc' key could be handled here or in renderer
}

app.whenReady().then(() => {
    createWindow();

    // Register Esc to quit (Screensaver behavior)
    globalShortcut.register('Escape', () => {
        app.quit();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
