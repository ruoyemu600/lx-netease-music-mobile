/* Static regression checks. These do not replace Android runtime/device tests. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const parser = require('@babel/parser')
const root = path.resolve(__dirname, '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const check = (name, fn) => { fn(); console.log(`PASS ${name}`) }
const compile = (source, stubs = {}) => {
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const module = { exports: {} }
  vm.runInNewContext(result.outputText, {
    module, exports: module.exports,
    require: p => {
      if (p in stubs) return stubs[p]
      if (/\.jpg$|\.png$/.test(p)) return 1
      return {}
    },
  })
  return module.exports
}
const material = compile(read('src/theme/material.ts'))
const themes = compile(read('src/theme/themes/themes.ts')).default
const legacyState = { setting: { 'theme.id': 'material_dark', 'theme.darkId': 'material_dark', 'theme.lightId': 'material_light', 'common.isAutoTheme': false } }
const themeState = { shouldUseDarkColors: false }
const active = compile(read('src/theme/themes/index.ts'), {
  '../material': material,
  '@/theme/themes/themes': { __esModule: true, default: themes },
  '@/store/setting/state': { __esModule: true, default: legacyState },
  '@/store/theme/state': { __esModule: true, default: themeState },
})
const clone = o => JSON.parse(JSON.stringify(o))
function luminance(hex) {
  const c = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722
}
function ratio(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
for (const id of ['material_dark', 'material_light']) {
  check(`${id}: generated theme and semantic colors`, () => {
    const theme = themes.find(t => t.id === id)
    assert.ok(theme)
    const a = active.buildActiveThemeColors(clone(theme))
    assert.equal(a['c-font'], material.getMaterialThemeColors(id)['c-font'])
    assert.equal(a['bg-image'], undefined)
    for (const [label, fg, bg] of [
      ['body', a['c-font'], a['c-main-background']],
      ['secondary', a['c-font-label'], a['c-main-background']],
      ['surface secondary', a['c-font-label'], a['c-content-background']],
      ['play control', a['c-button-font-selected'], a['c-button-background-selected']],
      ['active tab', a['c-primary-font-active'], a['c-primary-background-active']],
      ['selected track', a['c-primary-font'], a['c-primary-background-active']],
    ]) assert.ok(ratio(fg, bg) >= 4.5, `${id} ${label}: contrast ${ratio(fg, bg).toFixed(2)}`)
  })
  check(`${id}: labels exist in all supported languages`, () => {
    for (const lang of ['zh-cn', 'zh-tw', 'en-us']) assert.ok(JSON.parse(read(`src/lang/${lang}.json`))[`theme_${id}`])
  })
}
check('legacy/imported themes retain legacy palette mapping', () => {
  assert.equal(material.getMaterialThemeColors('green'), undefined)
  const imported = clone(themes.find(t => t.id === 'material_dark'))
  imported.isCustom = true
  assert.equal(active.buildActiveThemeColors(imported)['c-content-background'], imported.config.themeColors['c-primary-light-1000'])
  const green = clone(themes.find(t => t.id === 'green'))
  assert.equal(active.buildActiveThemeColors(green)['c-content-background'], green.config.themeColors['c-primary-light-1000'])
})
check('mini-player uses physical dp for touch targets and current drawer setting', () => {
  const p = read('src/components/player/PlayerBar/index.tsx')
  assert.match(p, /StyleSheet\.create/)
  assert.match(p, /drawerPositionRef\.current = drawerLayoutPosition/)
  assert.match(read('src/components/player/PlayerBar/components/ControlBtn.tsx'), /width: 48,[\s\S]*height: 48/)
})
check('shared track rows preserve fixed-layout heights and 48dp menu targets', () => {
  for (const file of ['src/components/OnlineList/ListItem.tsx', 'src/screens/Home/Views/Mylist/MusicList/ListItem.tsx']) {
    const s = read(file)
    assert.match(s, /Math\.max\(72, scaleSizeH\(72\)\)/)
    assert.match(s, /width: 48/)
    assert.match(s, /onLongPress/)
    assert.match(s, /onShowMenu/)
  }
})
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
}
check('modified UI source parses as TypeScript/TSX', () => {
  const files = [
    ...walk(path.join(root, 'src/components/player/PlayerBar')),
    ...walk(path.join(root, 'src/screens/PlayDetail/Vertical')),
    path.join(root, 'src/theme/material.ts'),
    path.join(root, 'src/components/OnlineList/ListItem.tsx'),
    path.join(root, 'src/screens/Home/Views/Mylist/MusicList/ListItem.tsx'),
    path.join(root, 'src/screens/PlayDetail/components/MiniLyric.tsx'),
    path.join(root, 'src/theme/themes/index.ts'),
  ].filter(p => /\.tsx?$/.test(p))
  for (const file of files) parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  console.log(`  Parsed ${files.length} source files`)
})
;(async () => {
  legacyState.setting['common.isAutoTheme'] = true
  for (const [dark, expected] of [[false, 'material_light'], [true, 'material_dark']]) {
    themeState.shouldUseDarkColors = dark
    assert.equal((await active.getTheme()).id, expected)
    console.log(`PASS automatic theme chooses ${expected}`)
  }
  console.log('All Material UI static regression checks passed. Android runtime tests are still required.')
})().catch(e => { console.error(e); process.exitCode = 1 })
