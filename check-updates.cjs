const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const path = require('node:path')
const { createUpdates, preserveProfile } = require('./electron/updates')

async function run() {
  const paths = {}
  const app = { getPath: () => '/profile', setPath: (key, value) => { paths[key] = value }, getVersion: () => '1.1.0' }
  preserveProfile(app)
  assert.equal(paths.userData, path.join('/profile', 'mh-five-accounting'))
  const updater = new EventEmitter()
  let checks = 0, restarts = 0, scheduled = [], messages = [], cleared = []
  updater.quitAndInstall = () => { restarts++ }
  updater.checkForUpdates = async () => { checks++; updater.emit('update-not-available') }
  const timer = { unref() {} }
  const timers = { setTimeout(fn, ms) { scheduled.push([fn, ms]); return timer }, setInterval(fn, ms) { scheduled.push([fn, ms]); return timer }, clearTimeout(t) { cleared.push(t) }, clearInterval(t) { cleared.push(t) } }
  const options = { app, updater, timers, enabled: true, getWindow: () => ({ isDestroyed: () => false }), dialog: { showMessageBox: async (_window, value) => messages.push(value.message) } }
  const updates = createUpdates(options)
  updates.start(); updates.start()
  assert.equal(checks, 0, 'Startup must not block on network')
  assert.deepEqual(scheduled.map(item => item[1]), [15000, 7200000])
  assert.equal(updater.autoDownload, true)
  assert.equal(updater.autoInstallOnAppQuit, true)
  assert.equal(updater.autoRunAppAfterInstall, false)
  assert.equal(updater.allowDowngrade, false)
  await updates.check(true)
  assert.match(messages.pop(), /最新版本/)
  updater.checkForUpdates = async () => { checks++; throw new Error('offline') }
  await updates.check()
  assert.equal(updates.state().status, 'error')
  assert.equal(messages.length, 0, 'Automatic offline checks must stay quiet')
  updater.checkForUpdates = async () => { checks++; updater.emit('update-available', { version: '1.1.1' }) }
  await updates.check()
  updater.emit('download-progress', { percent: 40.2 })
  assert.equal(updates.state().percent, 40)
  const before = checks
  await updates.check(true)
  assert.equal(checks, before, 'Do not duplicate active downloads')
  assert.match(messages.pop(), /40%/)
  updater.emit('update-downloaded', { version: '1.1.1' })
  assert.equal(restarts, 0, 'Never interrupt active bookkeeping')
  await updates.check(true)
  assert.match(messages.pop(), /正常关闭/)
  assert.equal(checks, before, 'Keep a downloaded update ready for normal exit')
  updates.stop()
  assert.equal(cleared.length, 2)
  await updates.check()
  assert.equal(checks, before)
  const zip = createUpdates({ ...options, enabled: false })
  await zip.check(true)
  assert.match(messages.pop(), /安装一次自动更新版/)
  console.log('PASS: shared data profile, delayed nonblocking checks, quiet offline retry, download deduplication, safe next-launch installation and ZIP fallback.')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
