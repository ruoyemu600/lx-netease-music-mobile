# Android 原生聆听统计

## 接口

`NativeModules.TrackPlayerModule.getListeningStats(limit, offset)` 返回 Promise：

```ts
{
  schemaVersion: 1,
  startedAt: number, // 首次原生统计启用，epoch ms；不是旧 history 推算
  totalMs: number,
  trackCount: number,
  tracks: Array<{
    key: string, id: string, source: string,
    name: string, singer: string, picUrl: string | null,
    listenedMs: number, lastPlayedAt: number
  }>,
  offset: number,
  hasMore: boolean
}
```

limit 限制 1..100（NaN 使用 50），offset 取非负整数；排序为 listenedMs DESC、key ASC。同一次 snapshot 的总时长、数量和当前页在一个 SQLite 事务读取。播放继续时各次 snapshot 会变化，跨请求不冻结整个排行榜。

binder 已连接且播放器存在时，先在原播放器线程 checkpoint 再入 DB worker 读取；通过新增只读 peekPlayback 读取，避开旧 getPlayback 自动创建播放器的副作用。尚未连接或播放器不存在则直接从 context 打开 DB，不启动播放器、不等待服务。读取/写入失败 reject `E_LISTENING_STORAGE`，客户端应保留上一份成功结果并展示错误，而非把它当空库。

## 计时与持久化

- `player.isPlaying()` 是唯一播放判断，排除暂停、buffering 和 suppression。
- `SystemClock.elapsedRealtime()` 统计真实经过时间；播放 position、seek 距离和播放 speed 均不参与计算。
- 仅统计 originalItem 中包含非空 listeningKey 的曲目；缺 key 的占位音频不计。
- 从 listeningId/listeningSource/listeningName/listeningSinger/listeningPicUrl 提取元信息；JS 负责规范线上身份，原生不从播放 url 猜身份。
- Android player looper 每 10 秒 checkpoint，暂停/切歌/停止/reset/destroy 提交当前增量，JS 挂起不影响此链路。
- DB 为独立 `lx_material_listening_v1.db`；只做事务增量更新，不扫描或迁移旧 history，不覆盖其它数据库。
- SQLite IO 和 pending 增量在进程单例串行 worker 中；事务失败保留 pending，每 10 秒及后续 snapshot 自动重试。
- 成功落盘后才清 pending。没有有效增量时不反复开空写事务。
- 重复初始化和重复事件不重复计时；启动新进程不恢复旧 monotonic anchor，所以不存在重启后的 phantom 时长。

进程被系统直接终止时可能损失最后一个未落盘 checkpoint（通常最多约 10 秒；worker 延迟或 DB 持续失败会扩大此窗口）。失败 pending 仅保留在当前进程内存。未进行真机锁屏/音频焦点/进程终止实测。

## 开发与复验

```sh
node scripts/patch-listening-stats.cjs
node scripts/test-listening-stats.cjs
```

补丁精确验证 ExoPlayback、MusicModule 和 MusicBinder anchors，完整 patch 可重复执行；部分 patch、被改坏的 markers 或未知源码结构会失败，验证结束前不改任何目标源码。模板每次复制到依赖同 package 目录；现有 Media3 改造保留。测试在临时目录用真实 javac/java 执行纯核心边界，再验证干净源码应用、重复执行字节一致和异常 anchor 不发生部分写入。
