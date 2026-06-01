import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeDir = path.join(repoRoot, '.tmp')
const pidFile = path.join(runtimeDir, 'dev-server.pid')
const logFile = path.join(runtimeDir, 'dev-server.log')
const command = process.argv[2]
const publicUrl = 'https://client-eventus.test/'
const upstreamUrl = 'http://127.0.0.1:5173'

function readPid() {
  if (!fs.existsSync(pidFile)) return null

  const pid = Number.parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10)
  return Number.isInteger(pid) && pid > 0 ? pid : null
}

function isRunning(pid) {
  if (!pid) return false

  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'EPERM') return true
    return false
  }
}

function clearStalePid(pid) {
  if (pid && !isRunning(pid)) fs.rmSync(pidFile, { force: true })
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function start() {
  fs.mkdirSync(runtimeDir, { recursive: true })

  const existingPid = readPid()
  clearStalePid(existingPid)

  if (isRunning(existingPid)) {
    console.log(`Dev server is already running for ${publicUrl} (PID ${existingPid}).`)
    return
  }

  const logFd = fs.openSync(logFile, 'a')
  const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(process.execPath, [viteBin, '--config', 'apps/web/vite.config.js'], {
    cwd: repoRoot,
    detached: true,
    env: process.env,
    stdio: ['ignore', logFd, logFd],
  })

  child.unref()
  fs.closeSync(logFd)
  fs.writeFileSync(pidFile, String(child.pid))

  await wait(500)
  if (!isRunning(child.pid)) {
    fs.rmSync(pidFile, { force: true })
    console.error(`Dev server failed to start. Check the log: ${logFile}`)
    process.exitCode = 1
    return
  }

  console.log(`Started dev server for ${publicUrl} via ${upstreamUrl} (PID ${child.pid}).`)
  console.log(`Log: ${logFile}`)
}

function status() {
  const pid = readPid()
  clearStalePid(pid)

  if (!isRunning(pid)) {
    console.log('Dev server is not running.')
    process.exitCode = 1
    return
  }

  console.log(`Dev server is running for ${publicUrl} via ${upstreamUrl} (PID ${pid}).`)
}

function stop() {
  const pid = readPid()
  clearStalePid(pid)

  if (!isRunning(pid)) {
    console.log('Dev server is not running.')
    return
  }

  process.kill(pid, 'SIGTERM')
  fs.rmSync(pidFile, { force: true })
  console.log(`Stopped dev server (PID ${pid}).`)
}

switch (command) {
  case 'start':
    await start()
    break
  case 'status':
    status()
    break
  case 'stop':
    stop()
    break
  default:
    console.error('Usage: node scripts/manage-dev-server.mjs <start|status|stop>')
    process.exitCode = 1
}
