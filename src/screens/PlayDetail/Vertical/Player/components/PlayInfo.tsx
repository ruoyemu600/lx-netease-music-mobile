import { useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, StyleSheet, View } from 'react-native'
import Progress from '@/components/player/ProgressBar'
import Status from './Status'
import { useProgress } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useBufferProgress } from '@/plugins/player'

const getCurrentMusicKey = () => {
  const current = playerState.playMusicInfo.musicInfo
  if (!current) return null
  const music = 'progress' in current ? current.metadata.musicInfo : current
  return `${music.source}:${music.id}`
}

export default () => {
  const { maxPlayTimeStr, nowPlayTimeStr, progress, maxPlayTime } = useProgress()
  const buffered = useBufferProgress()
  const theme = useTheme()
  const [dragProgress, setDragProgress] = useState<number | null>(null)
  const trackWidth = useRef(0)
  const startX = useRef(0)
  const seekProgress = useRef(0)
  const dragMusicKey = useRef<string | null>(null)

  useEffect(() => {
    // Cancel even an A -> B -> A change while a finger remains on the track.
    const cancelDrag = () => {
      dragMusicKey.current = null
      setDragProgress(null)
    }
    global.state_event.on('playMusicInfoChanged', cancelDrag)
    return () => {
      global.state_event.off('playMusicInfoChanged', cancelDrag)
    }
  }, [])

  // Native dp sizing keeps the seek target >=48 even at the smallest app font.
  const responder = useMemo(() => {
    const cancelDrag = () => {
      dragMusicKey.current = null
      setDragProgress(null)
    }
    const update = (x: number) => {
      if (!dragMusicKey.current || dragMusicKey.current !== getCurrentMusicKey()) {
        cancelDrag()
        return
      }
      seekProgress.current = Math.max(0, Math.min(1, x / Math.max(trackWidth.current, 1)))
      setDragProgress(seekProgress.current)
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        dragMusicKey.current = getCurrentMusicKey()
        startX.current = event.nativeEvent.locationX
        update(startX.current)
      },
      onPanResponderMove: (_event, gesture) => update(startX.current + gesture.dx),
      onPanResponderRelease: () => {
        // Read live state: a stale React render must never seek the next song.
        const duration = playerState.progress.maxPlayTime
        if (dragMusicKey.current && dragMusicKey.current === getCurrentMusicKey()
          && Number.isFinite(duration) && duration > 0 && trackWidth.current > 0) {
          global.app_event.setProgress(seekProgress.current * duration)
        }
        cancelDrag()
      },
      onPanResponderTerminate: cancelDrag,
    })
  }, [])

  return (
    <>
      <View
        style={styles.progress}
        onLayout={({ nativeEvent }) => { trackWidth.current = nativeEvent.layout.width }}
        {...responder.panHandlers}
      >
        <View pointerEvents="none">
          <Progress progress={dragProgress ?? progress} duration={maxPlayTime} buffered={buffered} />
        </View>
      </View>
      <View style={styles.info}>
        <Text size={12} color={theme['c-font-label']}>{nowPlayTimeStr}</Text>
        <View style={styles.status}><Status /></View>
        <Text size={12} color={theme['c-font-label']}>{maxPlayTimeStr}</Text>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  progress: {
    height: 48,
    minHeight: 48,
    justifyContent: 'center',
  },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: {
    flex: 1,
    paddingHorizontal: 10,
  },
})
