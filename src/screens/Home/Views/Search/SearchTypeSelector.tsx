import { useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { type SearchType } from '@/store/search/state'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { getSearchSetting } from '@/utils/data'

const SEARCH_TYPE_LIST = ['music', 'songlist', 'singer', 'album'] as const

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const [type, setType] = useState<SearchType>('music')
  useEffect(() => {
    let active = true
    void getSearchSetting().then((info) => { if (active) setType(info.type) })
    const handleTypeChange = (value: SearchType) => setType(value)
    global.app_event.on('searchTypeChanged', handleTypeChange)
    return () => {
      active = false
      global.app_event.off('searchTypeChanged', handleTypeChange)
    }
  }, [])
  const list = useMemo(() => SEARCH_TYPE_LIST.map((id) => ({ label: t(`search_type_${id}`), id })), [t])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" horizontal showsHorizontalScrollIndicator={false}>
      {list.map((item) => {
        const selected = type === item.id
        return (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: selected ? theme['c-button-background'] : theme['c-theme'], borderColor: selected ? theme['c-button-background'] : theme['c-border-background'] }]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => { setType(item.id); global.app_event.searchTypeChanged(item.id) }}
            key={item.id}
          >
            <Text size={14} color={selected ? theme['c-button-font'] : theme['c-font-label']} style={styles.buttonText}>{item.label}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 0, flexShrink: 0, marginTop: 8, marginBottom: 4 },
  content: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  button: { minHeight: 48, minWidth: 64, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 24, borderWidth: 1 },
  buttonText: { textAlign: 'center' },
})
