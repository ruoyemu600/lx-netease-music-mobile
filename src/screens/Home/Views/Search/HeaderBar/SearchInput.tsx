import { useCallback, useRef, forwardRef, useImperativeHandle, useState } from 'react'
import { TextInput, TouchableOpacity, View, StyleSheet, type TextInputProps } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'

export interface SearchInputProps {
  onChangeText: (text: string) => void
  onSubmit: (text: string) => void
  onBlur: () => void
  onTouchStart: () => void
}

export interface SearchInputType {
  setText: (text: string) => void
  focus: () => void
  blur: () => void
}

export default forwardRef<SearchInputType, SearchInputProps>(
  ({ onChangeText, onSubmit, onBlur, onTouchStart }, ref) => {
    const theme = useTheme()
    const [text, setText] = useState('')
    const inputRef = useRef<TextInput>(null)

    useImperativeHandle(ref, () => ({
      setText,
      focus() { inputRef.current?.focus() },
      blur() { inputRef.current?.blur() },
    }), [])

    const handleChangeText = (value: string) => {
      setText(value)
      onChangeText(value.trim())
    }
    const handleClearText = useCallback(() => {
      setText('')
      onChangeText('')
      onSubmit('')
    }, [onChangeText, onSubmit])
    const handleSubmit = useCallback<NonNullable<TextInputProps['onSubmitEditing']>>(
      ({ nativeEvent: { text } }) => onSubmit(text), [onSubmit]
    )

    return (
      <View style={[styles.container, { backgroundColor: theme['c-primary-input-background'] }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="搜索" style={styles.action} onPress={() => onSubmit(text)}>
          <Icon name="search-2" rawSize={22} color={theme['c-font-label']} />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          accessibilityLabel="搜索音乐、歌单、歌手或专辑"
          placeholder="搜索音乐、歌单、歌手或专辑"
          placeholderTextColor={theme['c-font-label']}
          selectionColor={theme['c-primary']}
          style={[styles.input, { color: theme['c-font'] }]}
          value={text}
          onChangeText={handleChangeText}
          onBlur={onBlur}
          onSubmitEditing={handleSubmit}
          onTouchStart={onTouchStart}
          autoCapitalize="none"
          autoComplete="off"
          returnKeyType="search"
          multiline={false}
        />
        {!!text && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="清空搜索" style={styles.action} onPress={handleClearText}>
            <Icon name="remove" rawSize={18} color={theme['c-font-label']} />
          </TouchableOpacity>
        )}
      </View>
    )
  }
)

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: 28, flex: 1 },
  input: { flex: 1, minWidth: 0, minHeight: 56, paddingVertical: 12, paddingHorizontal: 0, fontSize: 15 },
  action: { width: 48, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
})
