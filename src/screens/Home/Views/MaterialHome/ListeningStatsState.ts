import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useComponentIds, useNavActiveId } from '@/store/common/hook'
import { COMPONENT_IDS } from '@/config/constant'
import { getListeningStats, type ListeningSnapshot, type ListeningTrack } from '@/core/player/listeningStats'

const PAGE_SIZE = 50
const unique = (tracks: ListeningTrack[]) => Array.from(new Map(tracks.map(track => [track.key, track])).values())

export function useListeningStats() {
  const nav = useNavActiveId()
  const screens = useComponentIds()
  const [appState, setAppState] = useState(AppState.currentState)
  const active = nav === 'nav_home' && appState === 'active' &&
    screens[screens.length - 1]?.name === COMPONENT_IDS.home
  const [snapshot, setSnapshot] = useState<ListeningSnapshot | null>(null)
  const [overviewError, setOverviewError] = useState(false)
  const [open, setOpen] = useState(false)
  const [tracks, setTracks] = useState<ListeningTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const overviewEpoch = useRef(0)
  const overviewBusy = useRef(false)
  const pageEpoch = useRef(0)
  const pageBusy = useRef(false)
  const session = useRef<{ totalMs: number, trackCount: number, offset: number, hasMore: boolean } | null>(null)
  const enabled = useRef(active)
  enabled.current = active
  const opened = useRef(false)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState)
    return () => subscription.remove()
  }, [])

  const refreshOverview = useCallback(async () => {
    if (!enabled.current || opened.current || overviewBusy.current) return
    const epoch = overviewEpoch.current
    overviewBusy.current = true
    try {
      const result = await getListeningStats(3, 0)
      if (epoch !== overviewEpoch.current) return
      setSnapshot(result)
      setOverviewError(false)
    } catch {
      if (epoch === overviewEpoch.current) setOverviewError(true)
    } finally {
      if (epoch === overviewEpoch.current) overviewBusy.current = false
    }
  }, [])

  const close = useCallback(() => {
    opened.current = false
    pageEpoch.current++
    pageBusy.current = false
    session.current = null
    setOpen(false)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!active) close()
    if (active && !open) void refreshOverview()
    const timer = active && !open ? setInterval(() => { void refreshOverview() }, 5000) : null
    return () => {
      if (timer !== null) clearInterval(timer)
      overviewEpoch.current++
      overviewBusy.current = false
    }
  }, [active, open, close, refreshOverview])

  useEffect(() => () => {
    opened.current = false
    pageEpoch.current++
    overviewEpoch.current++
  }, [])

  const readPage = useCallback(async (reset: boolean) => {
    if (!enabled.current || !opened.current || (!reset && pageBusy.current)) return
    if (!reset && (!session.current?.hasMore)) return
    if (reset) {
      pageEpoch.current++
      session.current = null
      setTracks([])
      setHasMore(false)
    }
    const epoch = pageEpoch.current
    const offset = reset ? 0 : session.current!.offset
    pageBusy.current = true
    setLoading(true)
    setPageError('')
    try {
      const result = await getListeningStats(PAGE_SIZE, offset)
      if (epoch !== pageEpoch.current || !opened.current || !enabled.current) return
      // Native offset pages are live; keep the opened list stable and deduplicate
      // overlapping keys. Manual refresh starts again at zero after ranking changes.
      const nextOffset = result.offset + result.tracks.length
      const more = result.hasMore && nextOffset > offset
      session.current = { totalMs: result.totalMs, trackCount: result.trackCount, offset: nextOffset, hasMore: more }
      setTracks(previous => unique(reset ? result.tracks : [...previous, ...result.tracks]))
      setHasMore(more)
    } catch {
      if (epoch === pageEpoch.current && opened.current) setPageError('暂时没能读取收听统计，请重试')
    } finally {
      if (epoch === pageEpoch.current) {
        pageBusy.current = false
        setLoading(false)
      }
    }
  }, [])

  const show = useCallback(() => {
    if (!enabled.current) return
    opened.current = true
    overviewEpoch.current++
    overviewBusy.current = false
    setOpen(true)
    void readPage(true)
  }, [readPage])

  return { snapshot, overviewError, refreshOverview, open, show, close, tracks, loading, pageError, hasMore,
    refresh: () => { void readPage(true) }, loadMore: () => { void readPage(false) } }
}
