import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'

export default () => {
  const theme = useTheme()
  const isPlay = useIsPlay()
  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="上一首"
        style={styles.skipButton}
        activeOpacity={0.65}
        onPress={() => { void playPrev() }}
      >
        <Icon name="prevMusic" color={theme['c-font']} rawSize={32} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={isPlay ? '暂停' : '播放'}
        style={[styles.playButton, { backgroundColor: theme['c-button-background-selected'] }]}
        activeOpacity={0.8}
        onPress={togglePlay}
      >
        <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-button-font-selected']} rawSize={38} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="下一首"
        style={styles.skipButton}
        activeOpacity={0.65}
        onPress={() => { void playNext() }}
      >
        <Icon name="nextMusic" color={theme['c-font']} rawSize={32} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButton: {
    width: 56,
    height: 56,
    minWidth: 48,
    minHeight: 48,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 88,
    height: 72,
    minWidth: 48,
    minHeight: 48,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
