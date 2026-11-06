import { NativeModules } from 'react-native'

export interface ListeningTrack {
  key: string
  id: string
  source: string
  name: string
  singer: string
  picUrl?: string | null
  listenedMs: number
  lastPlayedAt: number
}

export interface ListeningSnapshot {
  schemaVersion: 1
  startedAt: number
  totalMs: number
  trackCount: number
  tracks: ListeningTrack[]
  offset: number
  hasMore: boolean
}

const isNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER

const isTrack = (value: unknown): value is ListeningTrack => {
  if (!value || typeof value !== 'object') return false
  const row = value as ListeningTrack
  return typeof row.key === 'string' && !!row.key && typeof row.id === 'string' &&
    typeof row.source === 'string' && typeof row.name === 'string' && typeof row.singer === 'string' &&
    (row.picUrl == null || typeof row.picUrl === 'string') && isNonNegative(row.listenedMs) && isNonNegative(row.lastPlayedAt)
}

/** The native player owns the clock and SQLite storage, including while JS sleeps.
 * UI reads snapshots only. Historical progress positions are never backfilled.
 */
export const getListeningStats = async (limit = 3, offset = 0): Promise<ListeningSnapshot> => {
  const bridge = [NativeModules?.TrackPlayerModule, NativeModules?.TrackPlayer]
    .find(candidate => typeof candidate?.getListeningStats === 'function')
  if (!bridge) throw new Error('当前安装包未启用听歌统计，请安装新版')
  const count = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 3
  const start = Number.isFinite(offset) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(offset))) : 0
  const value: unknown = await bridge.getListeningStats(count, start)
  if (!value || typeof value !== 'object') throw new Error('听歌统计数据格式异常，请重试')
  const result = value as ListeningSnapshot
  if (result.schemaVersion !== 1 || !isNonNegative(result.startedAt) || !isNonNegative(result.totalMs) ||
    !isNonNegative(result.trackCount) || !Number.isInteger(result.trackCount) || !isNonNegative(result.offset) ||
    !Number.isInteger(result.offset) || result.offset !== start || typeof result.hasMore !== 'boolean' ||
    !Array.isArray(result.tracks) || result.tracks.length > count || !result.tracks.every(isTrack) ||
    new Set(result.tracks.map(track => track.key)).size !== result.tracks.length) {
    throw new Error('听歌统计数据格式异常，请重试')
  }
  return result
}

export const formatListeningTime = (milliseconds: number): string => {
  const total = Math.floor((isNonNegative(milliseconds) ? milliseconds : 0) / 1000)
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  if (hours) return `${hours}小时${minutes}分${seconds}秒`
  if (minutes) return `${minutes}分${seconds}秒`
  return `${seconds}秒`
}
