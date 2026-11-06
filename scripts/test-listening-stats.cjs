#!/usr/bin/env node
'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lx-listening-test-'))
function run(command, args, ok = true) {
  const r = spawnSync(command, args, { encoding: 'utf8' })
  if (ok && r.status !== 0) throw new Error(`${command}: ${r.error || ''}\n${r.stdout}\n${r.stderr}`)
  return r
}
try {
  run('javac', ['-d', temp, ...['ListeningClockCore.java', 'ListeningClockCoreTest.java'].map(n => path.join(root, 'android/listening-stats', n))])
  process.stdout.write(run('java', ['-cp', temp, 'com.guichaguri.trackplayer.listening.ListeningClockCoreTest']).stdout)
  const javaRel = 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer'
  const files = ['service/player/ExoPlayback.java', 'module/MusicModule.java', 'service/MusicBinder.java']
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, javaRel, file), 'utf8').replace(/\n[^\n]*\/\/ LX_LISTENING_STATS_V1_BEGIN[^\n]*\n[\s\S]*?[^\n]*\/\/ LX_LISTENING_STATS_V1_END[^\n]*\n/g, '')
    const target = path.join(temp, javaRel, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, text)
  }
  for (const file of ['scripts/patch-listening-stats.cjs', ...['ListeningClockCore.java', 'ListeningStatsStore.java', 'ListeningStatsAdapter.java'].map(n => 'android/listening-stats/' + n)]) {
    fs.mkdirSync(path.dirname(path.join(temp, file)), { recursive: true })
    fs.copyFileSync(path.join(root, file), path.join(temp, file))
  }
  const patch = path.join(temp, 'scripts/patch-listening-stats.cjs')
  run(process.execPath, [patch])
  const before = files.map(n => fs.readFileSync(path.join(temp, javaRel, n), 'utf8'))
  run(process.execPath, [patch])
  files.forEach((n, i) => assert.equal(fs.readFileSync(path.join(temp, javaRel, n), 'utf8'), before[i], 'idempotent ' + n))
  assert.ok(before[1].includes('connection.peekPlayback()'), 'statistics must not call lazy-creating getPlayback')
  assert.ok(before[2].includes('public ExoPlayback peekPlayback() { return manager.getPlayback(); }'))
  console.log('PASS read-only statistics use non-creating playback peek')
  const exo = path.join(temp, javaRel, files[0])
  fs.writeFileSync(exo, before[0].replace('player.addListener(this);', 'player.addListener(unknownStructure);'))
  const broken = fs.readFileSync(exo, 'utf8')
  assert.notEqual(run(process.execPath, [patch], false).status, 0, 'unknown source structure must fail')
  assert.equal(fs.readFileSync(exo, 'utf8'), broken, 'failed patch leaves source untouched')
  assert.equal(fs.readFileSync(path.join(temp, javaRel, files[1]), 'utf8'), before[1], 'failed patch leaves module untouched')
  console.log('PASS: clean patch / repeated patch byte equality / unknown anchor atomic failure')
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
