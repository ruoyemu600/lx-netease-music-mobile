#!/usr/bin/env node
'use strict'
// Reapply after npm ci, after the existing Media3 dependency migration.
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const java = path.join(root, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer')
function inject(text, anchor, replacement, label) {
  if (text.split(anchor).length !== 2) throw new Error(`Listening patch: unknown ${label} anchor`)
  return text.replace(anchor, replacement)
}
function patch(file, transform) {
  const text = fs.readFileSync(file, 'utf8')
  const begin = '// LX_LISTENING_STATS_V1'
  if (text.includes(begin)) {
    // A partial or edited patch must fail rather than being silently skipped.
    const clean = text.replace(/\n[^\n]*\/\/ LX_LISTENING_STATS_V1_BEGIN[^\n]*\n[\s\S]*?[^\n]*\/\/ LX_LISTENING_STATS_V1_END[^\n]*\n/g, '')
    if (clean.includes(begin)) throw new Error(`Listening patch: incomplete markers in ${file}`)
    const expected = transform(clean)
    if (expected !== text) throw new Error(`Listening patch: patched structure differs in ${file}`)
    return text
  }
  return transform(text)
}
function block(code) { return `\n    // LX_LISTENING_STATS_V1_BEGIN\n${code}\n    // LX_LISTENING_STATS_V1_END\n` }
const exo = path.join(java, 'service/player/ExoPlayback.java')
const moduleFile = path.join(java, 'module/MusicModule.java')
const binderFile = path.join(java, 'service/MusicBinder.java')
const a = patch(exo, s => {
  s = inject(s, '    protected final T player;\n', '    protected final T player;\n' + block(`    private com.guichaguri.trackplayer.listening.ListeningStatsAdapter listeningStats;
    public void getListeningStats(double limit, double offset, Promise promise) {
        if (listeningStats != null) listeningStats.snapshot(limit, offset, promise);
        else com.guichaguri.trackplayer.listening.ListeningStatsStore.get(context).snapshot(limit, offset, promise);
    }
    private void syncListeningStats() { if (listeningStats != null) listeningStats.sync(); }
    @Override public void onEvents(Player source, Player.Events events) { syncListeningStats(); }
    @Override public void onIsPlayingChanged(boolean isPlaying) { syncListeningStats(); }`), 'player field')
  s = inject(s, '    public void initialize() {\n        player.addListener(this);', '    public void initialize() {\n' + block(`        if (listeningStats != null) return;
        listeningStats = new com.guichaguri.trackplayer.listening.ListeningStatsAdapter(context, player, this::getCurrentTrack);`) + '        player.addListener(this);', 'initialize')
  s = inject(s, '    public void destroy() {\n        player.release();', '    public void destroy() {\n' + block('        if (listeningStats != null) listeningStats.close();') + '        player.release();', 'destroy')
  s = inject(s, '    public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {\n', '    public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {\n' + block('        syncListeningStats();'), 'media transition')
  s = inject(s, '        player.setPlayWhenReady(false);\n    }\n\n    public void stop()', '        player.setPlayWhenReady(false);\n' + block('        syncListeningStats();') + '    }\n\n    public void stop()', 'pause')
  for (const [anchor, label] of [['        player.seekTo(0);\n', 'stop'], ['        player.clearMediaItems();\n        player.setPlayWhenReady(false);\n', 'reset']]) {
    s = inject(s, anchor, anchor + block('        syncListeningStats();'), label)
  }
  return s
})
const b = patch(moduleFile, s => inject(s, '    /* ****************************** API ****************************** */\n', block(`    @ReactMethod
    public void getListeningStats(final double limit, final double offset, final Promise callback) {
        new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
            if (binder == null) {
                com.guichaguri.trackplayer.listening.ListeningStatsStore.get(getReactApplicationContext()).snapshot(limit, offset, callback);
            } else {
                waitForConnection(() -> {
                    MusicBinder connection = binder;
                    ExoPlayback playback = connection == null ? null : connection.peekPlayback();
                    if (playback == null) com.guichaguri.trackplayer.listening.ListeningStatsStore.get(getReactApplicationContext()).snapshot(limit, offset, callback);
                    else playback.getListeningStats(limit, offset, callback);
                });
            }
        });
    }`) + '    /* ****************************** API ****************************** */\n', 'module API'))
const c = patch(binderFile, s => inject(s, '    public ExoPlayback getPlayback() {\n',
  block('    public ExoPlayback peekPlayback() { return manager.getPlayback(); }') + '    public ExoPlayback getPlayback() {\n', 'binder read-only peek'))
// Validate every source before writing any target.
const templates = ['ListeningClockCore.java', 'ListeningStatsStore.java', 'ListeningStatsAdapter.java']
const sources = templates.map(name => [name, fs.readFileSync(path.join(root, 'android/listening-stats', name), 'utf8')])
fs.writeFileSync(exo, a)
fs.writeFileSync(moduleFile, b)
fs.writeFileSync(binderFile, c)
const dest = path.join(java, 'listening')
fs.mkdirSync(dest, { recursive: true })
for (const [name, source] of sources) fs.writeFileSync(path.join(dest, name), source)
console.log('Listening statistics native patch applied (Media3 preserved).')
