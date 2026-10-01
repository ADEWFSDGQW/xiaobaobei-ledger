const fs = require('node:fs')
const path = require('node:path')

// The same profile is used by both the old ZIP app and installed releases.
function preserveProfile(app) {
  app.setPath('userData', path.join(app.getPath('appData'), 'mh-five-accounting'))
}

function createUpdates({ app, updater, dialog, getWindow, timers = globalThis, enabled }) {
  const available = enabled ?? (app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml')))
  let status = available ? 'idle' : 'unsupported'
  let version = '', percent = 0, checking = false, stopped = false
  let initialTimer, repeatTimer
  const show = message => {
    const window = getWindow()
    if (!window || window.isDestroyed()) return
    return dialog.showMessageBox(window, { type: 'info', title: '软件更新', message, buttons: ['知道了'] })
  }
  if (available) {
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = true
    updater.autoRunAppAfterInstall = false
    updater.allowPrerelease = false
    updater.allowDowngrade = false
    updater.disableWebInstaller = true
    updater.on('checking-for-update', () => { status = 'checking' })
    updater.on('update-available', info => { version = info.version; status = 'downloading' })
    updater.on('download-progress', info => { status = 'downloading'; percent = Math.round(info.percent) })
    updater.on('update-not-available', () => { status = 'current' })
    // Never restart or replace files while the user is recording a round.
    updater.on('update-downloaded', info => { version = info.version; status = 'ready' })
    updater.on('error', () => { status = 'error' })
  }
  async function check(manual = false) {
    if (!available) {
      if (manual) await show('当前是开发或 ZIP 版本。请安装一次自动更新版，此后新版会在后台下载，关闭软件后安装，下次打开生效。')
      return
    }
    if (stopped) return
    if (status === 'ready') { if (manual) await show(`新版 ${version} 已下载。正常关闭软件后会自动安装，下次打开使用新版。`); return }
    if (status === 'downloading') { if (manual) await show(`正在后台下载 ${version}（${percent}%），你可以继续记账。`); return }
    if (checking) { if (manual) await show('正在检查更新，你可以继续使用软件。'); return }
    checking = true
    try {
      await updater.checkForUpdates()
      if (manual) {
        if (status === 'error') await show('暂时无法连接更新服务，当前版本仍可正常使用，稍后会自动重试。')
        else if (status === 'ready') await show(`新版 ${version} 已下载，下次打开生效。`)
        else if (status === 'downloading') await show(`发现新版 ${version}，正在后台下载，不影响记账。`)
        else await show(`当前已是最新版本（${app.getVersion()}）。`)
      }
    } catch (_) {
      status = 'error'
      if (manual) await show('暂时无法连接更新服务，当前版本仍可正常使用，稍后会自动重试。')
    } finally { checking = false }
  }
  function start() {
    if (!available || initialTimer || stopped) return
    initialTimer = timers.setTimeout(() => { void check() }, 15000)
    initialTimer.unref?.()
    repeatTimer = timers.setInterval(() => { void check() }, 2 * 60 * 60 * 1000)
    repeatTimer.unref?.()
  }
  function stop() {
    stopped = true
    timers.clearTimeout(initialTimer)
    timers.clearInterval(repeatTimer)
  }
  return { check, start, stop, state: () => ({ status, version, percent }) }
}

module.exports = { createUpdates, preserveProfile }
