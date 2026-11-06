'use strict'

// Run from any working directory: node /path/to/project/scripts/check-material-seek.cjs
// This is a callback-level test with React/React Native mocks, not a device UI test.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const sourcePath = path.resolve(__dirname, '../src/screens/PlayDetail/Vertical/Player/components/PlayInfo.tsx')
const result = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  reportDiagnostics: true,
  fileName: sourcePath,
})
const errors = (result.diagnostics || []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
assert.equal(errors.length, 0, errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'))

const listeners = new Map()
const seeks = []
const effects = []
const previewWrites = []
const state = {
  playMusicInfo: { musicInfo: { id: 'A', source: 'wy' } },
  progress: { maxPlayTime: 100 },
}
const jsx = (type, props) => ({ type, props })
const mocks = {
  react: {
    useEffect: effect => { effects.push(effect()) },
    useMemo: factory => factory(),
    useRef: value => ({ current: value }),
    useState: value => [value, next => { previewWrites.push(next) }],
  },
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
  'react-native': {
    PanResponder: { create: panHandlers => ({ panHandlers }) },
    StyleSheet: { create: styles => styles },
    View: 'View',
  },
  '@/components/player/ProgressBar': { default: 'Progress' },
  './Status': { default: 'Status' },
  '@/store/player/hook': {
    useProgress: () => ({
      maxPlayTimeStr: '01:40',
      nowPlayTimeStr: '00:00',
      progress: 0,
      maxPlayTime: 100,
    }),
  },
  '@/store/player/state': { default: state },
  '@/store/theme/hook': { useTheme: () => ({}) },
  '@/components/common/Text': { default: 'Text' },
  '@/plugins/player': { useBufferProgress: () => 0.5 },
}
const context = {
  exports: {},
  require: name => {
    assert.ok(Object.hasOwn(mocks, name), `Unmocked dependency: ${name}`)
    return mocks[name]
  },
  global: {
    state_event: {
      on: (name, callback) => {
        assert.ok(!listeners.has(name), `Duplicate listener: ${name}`)
        listeners.set(name, callback)
      },
      off: (name, callback) => {
        assert.equal(listeners.get(name), callback)
        listeners.delete(name)
      },
    },
    app_event: { setProgress: seconds => { seeks.push(seconds) } },
  },
}
vm.runInNewContext(result.outputText, context, { filename: sourcePath })
const tree = context.exports.default()
const track = tree.props.children[0]
const handlers = track.props
const grant = x => handlers.onPanResponderGrant({ nativeEvent: { locationX: x } })
const move = dx => handlers.onPanResponderMove({}, { dx })
const release = () => handlers.onPanResponderRelease()
const emitSongChange = () => {
  const listener = listeners.get('playMusicInfoChanged')
  assert.equal(typeof listener, 'function')
  listener()
}
const reset = () => {
  handlers.onPanResponderTerminate()
  state.playMusicInfo.musicInfo = { id: 'A', source: 'wy' }
  state.progress.maxPlayTime = 100
  handlers.onLayout({ nativeEvent: { layout: { width: 200 } } })
  seeks.length = 0
  previewWrites.length = 0
}
const tests = [
  ['native 48dp seek target', () => {
    assert.equal(handlers.style.height, 48)
    assert.equal(handlers.style.minHeight, 48)
  }],
  ['normal seek and drag preview', () => {
    grant(50)
    move(50)
    assert.equal(previewWrites.at(-1), 0.5)
    release()
    assert.deepEqual(seeks, [50])
    assert.equal(previewWrites.at(-1), null)
  }],
  ['song change cancels drag', () => {
    grant(50)
    state.playMusicInfo.musicInfo.id = 'B'
    emitSongChange()
    assert.equal(previewWrites.at(-1), null)
    move(50)
    release()
    assert.deepEqual(seeks, [])
  }],
  ['live identity protects stale React render', () => {
    grant(50)
    state.playMusicInfo.musicInfo.id = 'B'
    release()
    assert.deepEqual(seeks, [])
  }],
  ['A -> B -> A remains cancelled', () => {
    grant(50)
    state.playMusicInfo.musicInfo.id = 'B'
    emitSongChange()
    state.playMusicInfo.musicInfo.id = 'A'
    emitSongChange()
    move(50)
    release()
    assert.deepEqual(seeks, [])
  }],
  ['source change with same id cancels drag', () => {
    grant(50)
    state.playMusicInfo.musicInfo.source = 'local'
    release()
    assert.deepEqual(seeks, [])
  }],
  ['responder termination cancels drag', () => {
    grant(50)
    handlers.onPanResponderTerminate()
    release()
    assert.deepEqual(seeks, [])
  }],
  ['zero and non-finite duration never seek', () => {
    for (const duration of [0, -1, NaN, Infinity]) {
      grant(50)
      state.progress.maxPlayTime = duration
      release()
    }
    assert.deepEqual(seeks, [])
  }],
  ['missing music never seeks', () => {
    state.playMusicInfo.musicInfo = null
    grant(50)
    move(50)
    release()
    assert.deepEqual(seeks, [])
  }],
  ['unmeasured track never seeks', () => {
    handlers.onLayout({ nativeEvent: { layout: { width: 0 } } })
    grant(50)
    release()
    assert.deepEqual(seeks, [])
  }],
  ['live duration is used at release', () => {
    grant(100)
    state.progress.maxPlayTime = 200
    release()
    assert.deepEqual(seeks, [100])
  }],
  ['seek stays within track bounds', () => {
    grant(-10)
    release()
    grant(999)
    release()
    assert.deepEqual(seeks, [0, 100])
  }],
  ['downloaded music metadata identity is supported', () => {
    state.playMusicInfo.musicInfo = {
      progress: 1,
      metadata: { musicInfo: { id: 'download-A', source: 'wy' } },
    }
    grant(100)
    release()
    assert.deepEqual(seeks, [50])
  }],
]

let failures = 0
try {
  for (const [name, test] of tests) {
    reset()
    try {
      test()
      console.log(`PASS ${name}`)
    } catch (error) {
      failures++
      console.error(`FAIL ${name}`)
      console.error(error.stack || error)
    }
  }
} finally {
  for (const cleanup of effects) cleanup?.()
}
assert.equal(listeners.size, 0, 'Effect cleanup must remove the song-change listener')
console.log('PASS listener cleanup')
if (failures) {
  process.exitCode = 1
  console.error(`${failures} seek test(s) failed`)
} else {
  console.log(`${tests.length + 1} seek checks passed (mocked callbacks; no native rendering)`)
}
