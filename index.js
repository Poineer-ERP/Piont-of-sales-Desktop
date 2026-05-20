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
// Listen for print requests
ipcMain.on('print-html', (event, data) => {
  const printWin = new BrowserWindow({ show: false })
  printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(data.data)}`)

  printWin.webContents.on('did-finish-load', async () => {
    const requestedName = data.options.deviceName
    const printers = await printWin.webContents.getPrintersAsync()
    const defaultPrinter = printers.find(p => p.isDefault)
    const deviceName = printers.find(p => p.name === requestedName)?.name || defaultPrinter?.name;

   

    printWin.webContents.print({
        ...data.options,
        silent: true,
        deviceName,
        pageSize: {
          width: 70000,
          height: 200000
        },
      }, (success, failureReason) => {
        if (!success) console.log('Print failed:', failureReason)
        printWin.close()
      }
    )
  })
})