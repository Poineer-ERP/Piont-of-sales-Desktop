const { app, BrowserWindow, ipcMain, session, Menu } = require('electron');
const path = require('path')
const fs   = require('fs')

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

  Menu.setApplicationMenu(null);
  mainWindow.loadFile((__dirname, 'src/index.html'));
  mainWindow.maximize()
  mainWindow.show()

});

// Listen for print requests
ipcMain.on('print-html', (event, data) => {
  const printWin = new BrowserWindow({ show: false })
  printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(data.data)}`)

  printWin.webContents.on('did-finish-load', () => {
    printWin.webContents.print(data.options, (success, failureReason) => {
        if (!success) console.log('Print failed:', failureReason)
        printWin.close()
      }
    )
  })
})