const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path')
const fs   = require('fs')
const os   = require('os')

function fixIndexHtml() {
  const htmlPath = path.join(__dirname, 'src/index.html');
  let html = fs.readFileSync(htmlPath, 'utf-8');
  const fixed = html.replace(/((?:href|src|content)=")\/pos\//g, '$1')
                    .replace(/((?:href|src|content)=")pos\//g,  '$1');
  if (fixed !== html) {
    fs.writeFileSync(htmlPath, fixed, 'utf-8');
  }
}

app.on('ready', () => {
  fixIndexHtml();

  const srcDir = path.join(__dirname, 'src');

  // Vue is built with publicPath "/pos/", so lazy-loaded chunks arrive as
  // file:///pos/... — redirect them transparently to the real src/ folder.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    if (url.startsWith('file:///pos/')) {
      const relative    = url.slice('file:///pos/'.length);
      const redirectURL = 'file://' + path.join(srcDir, relative).replace(/\\/g, '/');
      callback({ redirectURL });
    } else {
      callback({});
    }
  });

  mainWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    }
  });

  // mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile((__dirname, 'src/index.html'));
  mainWindow.maximize()
  mainWindow.show()

});

// Listen for print requests
// Listen for print requests
ipcMain.on('print-html', (event, data) => {
  const printWin = new BrowserWindow({ show: false })

  // Receipts (pointOfSale / pointOfSaleKitchen) embed the Tajawal + barcode
  // fonts as base64 (~220KB HTML). Load via a temp file rather than a giant
  // data: URL, and surface any load/print failure (the old handler swallowed
  // them silently, so a failed receipt print looked like "nothing happened").
  const tmpFile = path.join(
    os.tmpdir(),
    `qeyam-print-${Date.now()}-${Math.random().toString(36).slice(2)}.html`
  )

  const cleanup = () => {
    try { fs.unlinkSync(tmpFile) } catch (_) {}
    if (!printWin.isDestroyed()) printWin.close()
  }

  try {
    fs.writeFileSync(tmpFile, data.data, 'utf-8')
  } catch (e) {
    console.log('Print failed (temp file write):', e)
    cleanup()
    return
  }

  printWin.loadFile(tmpFile)

  printWin.webContents.on('did-fail-load', (e, code, desc) => {
    console.log('Print failed (load error):', code, desc)
    cleanup()
  })

  printWin.webContents.on('did-finish-load', async () => {
    try {
      const requestedName = data.options && data.options.deviceName
      const printers = await printWin.webContents.getPrintersAsync()
      const defaultPrinter = printers.find(p => p.isDefault)
      const deviceName = printers.find(p => p.name === requestedName)?.name || defaultPrinter?.name

      printWin.webContents.print({
          ...data.options,
          silent: true,
          deviceName
        }, (success, failureReason) => {
          if (!success) console.log('Print failed:', failureReason)
          cleanup()
        }
      )
    } catch (err) {
      console.log('Print failed (print error):', err)
      cleanup()
    }
  })
})