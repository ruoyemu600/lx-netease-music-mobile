import { useCallback, useEffect, useRef, useState } from 'react'
import { PermissionsAndroid, Platform } from 'react-native'
import RNFetchBlob from 'rn-fetch-blob'
import { setNavActiveId } from '@/core/common'
import { overwriteListMusics, setActiveList } from '@/core/list'
import { getPlayHistoryByRange } from '@/core/player/playHistory'
import { playList } from '@/core/player/player'
import { clearPlayedList } from '@/core/player/playedList'
import { getLocalMusicScanKey, localMusicCache, normalizeLocalPath, parseLocalPaths, scanLocalMusic, type LocalMusicEntry } from '@/core/localMusic'
import { LIST_IDS } from '@/config/constant'
import commonState from '@/store/common/state'
import downloadState from '@/store/download/state'
import listAction from '@/store/list/action'
import { useSettingValue } from '@/store/setting/hook'
import { navigations } from '@/navigation'
import { toast } from '@/utils/tools'

export const openMaterialList = (id: string) => {
  setActiveList(id)
  setNavActiveId('nav_love')
}

export const openMaterialDownloads = () => {
  const componentId = commonState.componentIds[commonState.componentIds.length - 1]?.id
  if (!componentId) { toast('页面正在准备，请稍后再试'); return }
  void navigations.pushDownloadManagerScreen(componentId).catch(() => toast('下载管理打开失败，请重试'))
}

// History can contain local tracks: preserve their source rather than coercing them to online music.
export const playMaterialTracks = async (listId: string, tracks: LX.Music.MusicInfo[], index: number) => {
  try {
    await overwriteListMusics(LIST_IDS.TEMP, tracks)
    listAction.setTempListMeta({ id: listId })
    clearPlayedList()
    setActiveList(LIST_IDS.TEMP)
    await playList(LIST_IDS.TEMP, index)
  } catch (error) {
    toast(error instanceof Error ? error.message : '播放失败，请重试')
  }
}

export const useMaterialHistory = () => {
  const [items, setItems] = useState<LX.Player.PlayHistoryItem[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const request = useRef(0)
  const reload = useCallback(() => {
    const current = ++request.current
    setStatus('loading')
    void getPlayHistoryByRange(0, Date.now()).then(history => {
      if (current !== request.current) return
      // Keep only the latest occurrence of a track in the compact home preview.
      const seen = new Set<string>()
      const recent = [...history].sort((a, b) => b.playedAt - a.playedAt).filter(item => {
        const key = `${item.musicInfo.source}:${item.musicInfo.id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).slice(0, 5)
      setItems(recent)
      setStatus('ready')
    }).catch(() => {
      if (current === request.current) setStatus('error')
    })
  }, [])
  useEffect(() => {
    reload()
    global.app_event.on('playHistoryUpdated', reload)
    return () => {
      request.current++
      global.app_event.off('playHistoryUpdated', reload)
    }
  }, [reload])
  return { items, status, reload }
}

// Uses the same scanner/cache as LocalMusic. Permission prompts and directory management stay there.
export const useMaterialLocalMusic = (enabled: boolean) => {
  const downloadPath = useSettingValue('download.path')
  const savedPaths = useSettingValue('localMusic.paths')
  const [entries, setEntries] = useState<LocalMusicEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'permission' | 'error'>('loading')
  const request = useRef(0)
  const reload = useCallback((force = false) => {
    const current = ++request.current
    const cancelled = () => current !== request.current
    const paths = [...new Set([
      normalizeLocalPath(downloadPath || `${RNFetchBlob.fs.dirs.MusicDir}/LX-N Music`),
      ...parseLocalPaths(savedPaths),
    ])]
    const key = getLocalMusicScanKey(paths, downloadState.tasks)
    setStatus('loading')
    void (async () => {
      if (!force && localMusicCache.key === key) {
        if (!cancelled()) {
          setEntries(localMusicCache.entries)
          setStatus(localMusicCache.errors.length ? 'error' : 'ready')
        }
        return
      }
      if (Platform.OS === 'android' && paths.some(path => !path.startsWith('content://'))) {
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE) ||
          (Number(Platform.Version) >= 33 && await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO))
        if (cancelled()) return
        if (!granted) { setEntries([]); setStatus('permission'); return }
      }
      const excluded = new Set(downloadState.tasks.filter(task => !task.isRemoteSynced && (task.target ?? 'local') === 'local' && task.status !== 'completed').map(task => normalizeLocalPath(task.filePath)))
      const result = await scanLocalMusic(paths, excluded, cancelled)
      if (cancelled()) return
      Object.assign(localMusicCache, { key, ...result })
      setEntries(result.entries)
      setStatus(result.errors.length ? 'error' : 'ready')
    })().catch(() => { if (!cancelled()) setStatus('error') })
  }, [downloadPath, savedPaths])
  useEffect(() => {
    if (!enabled) return
    reload()
    const onDownload = ({ status: nextStatus }: { status: LX.Download.DownloadTask['status'] }) => {
      if (nextStatus === 'completed') reload()
    }
    global.app_event.on('download_status_update', onDownload)
    return () => {
      request.current++
      global.app_event.off('download_status_update', onDownload)
    }
  }, [enabled, reload])
  return { entries, status, reload: () => reload(true) }
}
