import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View, StyleSheet } from 'react-native'
import { type InitState } from '@/store/hotSearch/state'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import { Icon } from '@/components/common/Icon'

export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

const ListItem = ({
  keyword,
  onSearch,
  onRemove,
}: {
  keyword: string
  onSearch: (keyword: string) => void
  onRemove: (keyword: string) => void
}) => {
  const theme = useTheme()
  return (
    <Button
      accessibilityRole="button"
      accessibilityLabel={`搜索 ${keyword}，长按删除历史`}
      style={{ ...styles.button, backgroundColor: theme['c-button-background'] }}
      onPress={() => {
        onSearch(keyword)
      }}
      onLongPress={() => {
        onRemove(keyword)
      }}
    >
      <Text color={theme['c-button-font']} size={13}>
        {keyword}
      </Text>
    </Button>
  )
}

interface HistorySearchProps {
  onSearch: (keyword: string) => void
}
export interface HistorySearchType {
  show: () => void
}

export default forwardRef<HistorySearchType, HistorySearchProps>((props, ref) => {
  const [list, setList] = useState<List>([])
  const isUnmountedRef = useRef(false)
  const t = useI18n()
  const theme = useTheme()

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      show() {
        void getSearchHistory().then((list) => {
          if (isUnmountedRef.current) return
          setList(list)
        })
      },
    }),
    []
  )

  const handleClear = () => {
    clearHistoryList()
    setList([])
  }

  const handleRemove = useCallback((keyword: string) => {
    setList((list) => {
      list = [...list]
      const index = list.indexOf(keyword)
      list.splice(index, 1)
      removeHistoryWord(index)
      return list
    })
  }, [])

  return list.length ? (
    <View>
      <View style={styles.titleContent}>
        <Text size={16}>{t('search_history_search')}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="清空搜索历史" onPress={handleClear} style={styles.titleBtn}>
          <Icon name="eraser" color={theme['c-300']} size={14} />
        </TouchableOpacity>
      </View>
      <View style={styles.list}>
        {list.map((keyword) => (
          <ListItem
            keyword={keyword}
            key={keyword}
            onSearch={props.onSearch}
            onRemove={handleRemove}
          />
        ))}
      </View>
    </View>
  ) : null
})

const styles = StyleSheet.create({
  titleContent: {
    paddingTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    // paddingLeft: 15,
    // paddingBottom: 5,
  },
  titleBtn: {
    marginLeft: 'auto',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    // paddingLeft: 15,
    // paddingRight: 15,
    flexDirection: 'row',
    flexWrap: 'wrap',
    // paddingBottom: 15,
  },
  button: {
    textAlign: 'center',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 10,
    marginTop: 8,
  },
})
