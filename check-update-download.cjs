// Local integration check: real electron-updater download and SHA-512 validation.
// Installation is intercepted; neither the running app nor user data is touched.
const { app } = require('electron')
const { NsisUpdater } = require('electron-updater')
const { ElectronHttpExecutor } = require('electron-updater/out/electronHttpExecutor')
const { createUpdates } = require('./electron/updates')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const currentVersion = require('./package.json').version
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-updater-check-'))
app.setPath('userData', sandbox)
let server, controller
app.whenReady().then(async () => {
  try {
    const installer = fs.readFileSync(path.join(__dirname, `installer/xiaobaobei-ledger-Setup-${currentVersion}.exe`))
    const digest = crypto.createHash('sha512').update(installer).digest('base64')
    let corrupt = true, installs = [], quitCallback
    const metadata = () => `version: 99.0.0\nfiles:\n  - url: update.exe\n    sha512: ${corrupt ? Buffer.alloc(64).toString('base64') : digest}\n    size: ${installer.length}\npath: update.exe\nsha512: ${digest}\n`
    server = http.createServer((req, res) => {
      if (req.url.startsWith('/latest.yml')) res.end(metadata())
      else if (req.url === '/update.exe') res.end(installer)
      else res.writeHead(404).end()
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const adapter = { version: currentVersion, name: 'ledger-updater-check', isPackaged: true, userDataPath: sandbox, baseCachePath: sandbox, appUpdateConfigPath: path.join(__dirname, 'installer/win-unpacked/resources/app-update.yml'), whenReady: () => Promise.resolve(), onQuit: callback => { quitCallback = callback }, quit: () => { throw new Error('Unexpected restart') } }
    const updater = new NsisUpdater({ provider: 'generic', url: `http://127.0.0.1:${server.address().port}` }, adapter)
    updater.httpExecutor = new ElectronHttpExecutor()
    updater.setFeedURL({ provider: 'generic', url: `http://127.0.0.1:${server.address().port}` })
    updater.disableDifferentialDownload = true
    updater.install = (silent, relaunch) => { installs.push([silent, relaunch]); return true }
    controller = createUpdates({ app, updater, enabled: true, dialog: {}, getWindow: () => null })
    const failed = new Promise(resolve => updater.once('error', resolve))
    const first = await updater.checkForUpdates()
    await first.downloadPromise.catch(() => {})
    assert.match((await failed).message, /sha512|checksum/i)
    assert.equal(controller.state().status, 'error')
    corrupt = false
    const second = await updater.checkForUpdates()
    const files = await second.downloadPromise
    assert.equal(controller.state().status, 'ready')
    assert.equal(crypto.createHash('sha512').update(fs.readFileSync(files[0])).digest('base64'), digest)
    assert.equal(installs.length, 0, 'Active bookkeeping must not be interrupted')
    quitCallback(0)
    assert.deepEqual(installs, [[true, false]], 'Normal exit installs silently without restarting')
    console.log('PASS: actual installer download, corrupt checksum rejection, recovery download, isolated cache and install-on-normal-exit without relaunch.')
    controller.stop()
    updater.autoInstallOnAppQuit = false
    server.close()
    app.exit(0)
  } catch (error) {
    console.error(error)
    controller?.stop()
    server?.close()
    app.exit(1)
  }
})
