const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path')

app.on('ready', () => {
  // Create the main app window and load index.html
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