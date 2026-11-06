import Content from './Content'
import PlayerBar from '@/components/player/PlayerBar'
import BottomNavigation from './BottomNavigation'

export default ({ componentId }: { componentId: string }) => {
  return (
    <>
      <Content />
      <PlayerBar componentId={componentId} isHome />
      <BottomNavigation />
    </>
  )
}
