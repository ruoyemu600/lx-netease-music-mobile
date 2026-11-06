import {memo, useCallback, useRef} from 'react'
import { PanResponder, View, TouchableOpacity, StyleSheet } from 'react-native'
import { useKeyboard } from '@/utils/hooks'
import Pic from './components/Pic'
import Title from './components/Title'
import PlayInfo from './components/PlayInfo'
import ControlBtn from './components/ControlBtn'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { Icon } from '@/components/common/Icon'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { usePlayerMusicInfo } from '@/store/player/hook'
import PlayerPlaylist, { PlayerPlaylistType } from '@/components/player/PlayerPlaylist.tsx'
import MiniProgressBar from "@/components/player/PlayerBar/components/MiniProgressBar.tsx"
import playerState from '@/store/player/state'
import { LIST_IDS } from '@/config/constant'

export default memo(({ isHome = false }: { componentId?: string; isHome?: boolean }) => {
  const { keyboardShown } = useKeyboard()
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const longPressedRef = useRef(false)
  const playlistRef = useRef<PlayerPlaylistType>(null)
  const drawerLayoutPosition = useSettingValue('common.drawerLayoutPosition')
  const drawerPositionRef = useRef(drawerLayoutPosition)
  drawerPositionRef.current = drawerLayoutPosition

  const handleLongPress = useCallback(() => {
    longPressedRef.current = true
    const listId = playerState.playMusicInfo.listId
    if (!listId || listId == LIST_IDS.DOWNLOAD) return
    global.app_event.jumpListPosition()
  }, [])

  const handleNavigate = () => {
    if (longPressedRef.current) {
      longPressedRef.current = false
      return
    }
    if (!musicInfo.id) return
    const currentComponentId = commonState.componentIds[commonState.componentIds.length - 1]?.id!
    navigations.pushPlayDetailScreen(currentComponentId)
  }

  const handleShowPlaylist = () => {
    playlistRef.current?.show()
  }

  const gestureAction = useRef<'drawer' | 'playlist' | null>(null)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState
        if (Math.abs(dx) > Math.abs(dy) * 1.5) { // 水平滑动为主
          if (drawerPositionRef.current === 'left' && dx > 10) {
            gestureAction.current = 'drawer'
            return true
          }
          if (drawerPositionRef.current === 'right' && dx < -10) {
            gestureAction.current = 'drawer'
            return true
          }
        } else if (Math.abs(dy) > Math.abs(dx) * 1.5) { // 垂直滑动为主
          if (dy < -10) {
            gestureAction.current = 'playlist'
            return true
          }
        }
        return false
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, dy } = gestureState
        if (gestureAction.current === 'drawer') {
          if (drawerPositionRef.current === 'left' && dx > 50) {
            global.app_event.changeMenuVisible(true)
          } else if (drawerPositionRef.current === 'right' && dx < -50) {
            global.app_event.changeMenuVisible(true)
          }
        } else if (gestureAction.current === 'playlist' && dy < -50) {
          handleShowPlaylist()
        }
        gestureAction.current = null
      },
      onPanResponderTerminate: (evt, gestureState) => {
        gestureAction.current = null
      },
    }),
  ).current

  const playerComponent = (
      <View style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}
            {...panResponder.panHandlers}>
        <MiniProgressBar />

        <TouchableOpacity style={styles.left} onPress={handleNavigate} onLongPress={handleLongPress} activeOpacity={0.8}>
          <Pic isHome={isHome} />
          <View style={styles.center}>
            <Title isHome={isHome} />
            <PlayInfo isHome={isHome} />
          </View>
        </TouchableOpacity>
        <View style={styles.right}>
          <ControlBtn />
          <TouchableOpacity style={styles.menuBtn} onPress={handleShowPlaylist}>
            <Icon name="menu" color={theme['c-button-font']} size={22} />
          </TouchableOpacity>
        </View>
      </View>
  )

  return (
    <>
      {keyboardShown ? null : playerComponent}
      <PlayerPlaylist ref={playlistRef} />
    </>
  )
})

// Keep touch targets in Android dp, independent of the app's font-size setting.
const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    minHeight: 68,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 9,
    paddingLeft: 10,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 0,
  },
  left: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    flexDirection: 'column',
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
    justifyContent: 'center',
    minHeight: 48,
    // justifyContent: 'space-evenly',
    // height: 48,
    // backgroundColor: 'rgba(0, 0, 0, .1)',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    paddingLeft: 5,
    paddingRight: 5,
  },
  menuBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // row: {
  //   flexDirection: 'row',
  //   flexGrow: 0,
  //   flexShrink: 0,
  // },
})
