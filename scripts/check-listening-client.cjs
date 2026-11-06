'use strict'
// Actual TS identity/client code with a native bridge stub, not native playback.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const load = (file, native = {}) => {
  const mod = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports,
    require: name => { assert.equal(name, 'react-native'); return { NativeModules: native } },
  })
  return mod.exports
}
async function main() {
  const { getListeningTrackExtras: identity } = load('src/core/player/listeningIdentity.ts')
  const song = { id: '123', source: 'wy', name: 'Song', singer: 'Singer', meta: { picUrl: '/art.jpg', toggleMusicInfo: { id: 'other', source: 'kw' } } }
  const original = identity(song)
  const download = identity({ id: 'download-task-123', progress: 1, metadata: { musicInfo: song } })
  assert.equal(original.listeningKey, JSON.stringify(['wy', '123']))
  assert.equal(download.listeningKey, original.listeningKey)
  assert.equal(download.listeningId, '123')
  assert.equal(identity({ ...song, source: 'kw' }).listeningKey === original.listeningKey, false)
  assert.equal(identity({ ...song, id: '124' }).listeningKey === original.listeningKey, false)
  assert.equal(Object.keys(identity(null)).length, 0)
  assert.equal(identity({ ...song, id: 0 }).listeningId, '0')
  assert.equal(identity({ ...song, source: 'local', id: '/Music/a.flac' }).listeningSource, 'local')
  console.log('PASS original/download identities merge; sources and files stay distinct')

  // Execute the real buildTracks function, with only its surrounding helpers stubbed.
  const filename = path.join(root, 'src/plugins/player/playList.ts')
  const tree = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
  let declaration
  tree.forEachChild(node => {
    if (ts.isVariableStatement(node)) {
      for (const value of node.declarationList.declarations) if (value.name.getText(tree) === 'buildTracks') declaration = value.getText(tree)
    }
  })
  assert.ok(declaration)
  const body = ts.transpileModule(`const ${declaration}; module.exports = buildTracks`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const mod = { exports: {} }
  vm.runInNewContext(body, {
    module: mod, exports: mod.exports,
    settingState: { setting: { 'player.isShowNotificationImage': true } },
    defaultUrl: 'silent-placeholder', httpRxp: /^(https?:\/\/.+|\/.+)/,
    formatMusicInfo: value => ({ id: value.id, pic: null, name: value.name, singer: value.singer }),
    buildTrackExtra: () => ({}), getListeningTrackExtras: identity,
  })
  const queue = mod.exports(song, 'https://stream.example/music?token=synthetic')
  assert.equal(queue.length, 2)
  assert.equal(queue[0].listeningKey, original.listeningKey)
  assert.equal(queue[1].listeningKey, undefined)
  const placeholder = mod.exports(song)
  assert.equal(placeholder.length, 1)
  assert.equal(placeholder[0].listeningKey, undefined)
  assert.equal(Object.values(original).some(v => v.includes('token=')), false)
  console.log('PASS only real audio tracks get listening metadata; placeholders never counted')

  let args
  const row = { key: original.listeningKey, id: '123', source: 'wy', name: 'Song', singer: 'Singer', picUrl: null, listenedMs: 65000, lastPlayedAt: 1000000 }
  let response = { schemaVersion: 1, startedAt: 1000, totalMs: 65000, trackCount: 1, tracks: [row], offset: 0, hasMore: false }
  const bridge = { getListeningStats: async (...input) => { args = input; return response } }
  const api = load('src/core/player/listeningStats.ts', { TrackPlayerModule: bridge })
  assert.equal((await api.getListeningStats()).totalMs, 65000)
  assert.equal(JSON.stringify(args), '[3,0]')
  response = { ...response, offset: 2 }
  await api.getListeningStats(1000, 2.9)
  assert.equal(JSON.stringify(args), '[100,2]')
  response = { ...response, offset: 0 }
  await api.getListeningStats(NaN, Infinity)
  assert.equal(JSON.stringify(args), '[3,0]')
  console.log('PASS bridge reads real snapshots and bounds pagination arguments')

  const fallback = load('src/core/player/listeningStats.ts', { TrackPlayerModule: {}, TrackPlayer: bridge })
  assert.equal((await fallback.getListeningStats()).trackCount, 1)
  const unavailable = load('src/core/player/listeningStats.ts')
  await assert.rejects(unavailable.getListeningStats(), /未启用听歌统计/)
  response = { ...response, totalMs: -1 }
  await assert.rejects(api.getListeningStats(), /格式异常/)
  response = { ...response, totalMs: 65000, tracks: [row, row] }
  await assert.rejects(api.getListeningStats(), /格式异常/)
  response = { ...response, tracks: [{ ...row, listenedMs: NaN }] }
  await assert.rejects(api.getListeningStats(), /格式异常/)
  const failed = load('src/core/player/listeningStats.ts', { TrackPlayerModule: { getListeningStats: async () => { throw Error('storage failed') } } })
  await assert.rejects(failed.getListeningStats(), /storage failed/)
  console.log('PASS missing API, storage errors and invalid snapshots never masquerade as zero')

  const format = api.formatListeningTime
  assert.equal(format(0), '0秒')
  assert.equal(format(65000), '1分5秒')
  assert.equal(format(3723000), '1小时2分3秒')
  assert.equal(format(49 * 3600000), '49小时0分0秒')
  assert.equal(format(NaN), '0秒')
  assert.equal(format(-1), '0秒')
  console.log('PASS elapsed time formatting including totals beyond one day')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
