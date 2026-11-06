import { StyleSheet, TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT } from '@/config/constant'

export const HEADER_HEIGHT = Math.max(56, scaleSizeH(_HEADER_HEIGHT))

export default ({
  icon,
  color,
  onPress,
}: {
  icon: string
  color?: string
  onPress: () => void
}) => {
  return (
    <TouchableOpacity onPress={onPress} style={{ ...styles.button, width: HEADER_HEIGHT }}>
      <Icon name={icon} color={color} size={18} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    minHeight: 48,
    minWidth: 48,
    flex: 0,
  },
})
