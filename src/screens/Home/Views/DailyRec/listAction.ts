import { LIST_IDS } from '@/config/constant'
import {
  setTempList,
  setActiveList,
  createList,
  removeUserList,
  getListMusics,
  overwriteListMusics,
  updateUserList
} from '@/core/list'
import { playList } from '@/core/player/player'
import listState from '@/store/list/state'
import {clearPlayedList} from "@/core/player/playedList.ts";
import settingState from '@/store/setting/state';
import {toast} from "@/utils/tools.ts";
import { getAutoSaveDailyRecIds, saveAutoSaveDailyRecIds } from '@/utils/data.ts'

export const handlePlay = async (list: LX.Music.MusicInfoOnline[], index = 0) => {
  const listId = 'dailyrec_wy'
  await setTempList(listId, [...list])
  clearPlayedList()
  setActiveList(LIST_IDS.TEMP)
  void playList(LIST_IDS.TEMP, index)
}

/** 自动保存的每日推荐歌单最多保留的数量 */
const MAX_DAILY_PLAYLISTS = 15

/** 旧版本仅按名字识别自动歌单，只在首次接管历史数据时使用 */
const LEGACY_DAILY_PLAYLIST_NAME_RE = /^\d{2}_\d{2}_daily$/

/**
 * 获取基于早上7点为分界的逻辑日期
 * @returns {Date} 计算后的日期对象
 */
const getLogicalDateForPlaylist = (): Date => {
  const now = new Date();
  // 如果当前时间在早上7点之前，则认为是前一天的日期
  if (now.getHours() < 7) {
    now.setDate(now.getDate() - 1);
  }
  return now;
};

/**
 * 取出由本功能创建、且当前仍存在的歌单
 *
 * 通过持久化的歌单 id 精确识别，不再依赖歌单名字，
 * 因此用户自己创建的同名歌单不会被计入，也不会被自动删除。
 */
const getTrackedDailyPlaylists = async (): Promise<LX.List.UserListInfo[]> => {
  const storedIds = await getAutoSaveDailyRecIds()
  const aliveIds = new Set(listState.userList.map(list => list.id))

  let ids: string[]
  if (storedIds === null) {
    // 首次运行：接管旧版本按名字生成的歌单，避免这些遗留歌单永远不被清理
    ids = listState.userList.filter(list => LEGACY_DAILY_PLAYLIST_NAME_RE.test(list.name)).map(list => list.id)
    await saveAutoSaveDailyRecIds(ids)
  } else {
    // 列表还没加载完时（userList 为空）不做清理，避免误删记录
    const validIds = listState.userList.length
      ? storedIds.filter(id => aliveIds.has(id))
      : storedIds
    if (validIds.length !== storedIds.length) {
      ids = validIds
      await saveAutoSaveDailyRecIds(ids)
    } else {
      ids = storedIds
    }
  }

  const idSet = new Set(ids)
  return listState.userList.filter(list => idSet.has(list.id))
}

/**
 * 自动保存每日推荐到我的列表
 * @param songList 每日推荐的歌曲列表
 */
export const autoSaveDailyPlaylist = async(songList: LX.Music.MusicInfoOnline[]) => {
  if (!settingState.setting['list.isAutoSaveDailyRec']) return;
  if (!songList.length) return;

  const logicalDate = getLogicalDateForPlaylist();
  const month = (logicalDate.getMonth() + 1).toString().padStart(2, '0');
  const day = logicalDate.getDate().toString().padStart(2, '0');
  const playlistName = `${month}_${day}_daily`;

  try {
    const trackedPlaylists = await getTrackedDailyPlaylists()
    const existingPlaylist = trackedPlaylists.find(list => list.name === playlistName)

    if (existingPlaylist) {
      const existingSongs = await getListMusics(existingPlaylist.id);
      if (existingSongs.length && existingSongs[0].id === songList[0].id) {
        console.log(`歌单 ${playlistName} 无需更新，跳过保存。`);
        return;
      }
      console.log(`歌单 ${playlistName} 内容已更新，执行覆盖操作。`);
      await overwriteListMusics(existingPlaylist.id, songList);
      await updateUserList([{ ...existingPlaylist, locationUpdateTime: Date.now() }]);
      toast(`已自动更新每日推荐: ${playlistName}`);
      return;
    }

    // 超出上限时只清理本功能创建的歌单，按名字（即日期）从旧到新删
    const overCount = trackedPlaylists.length + 1 - MAX_DAILY_PLAYLISTS
    if (overCount > 0) {
      const removeIds = [...trackedPlaylists]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, overCount)
        .map(list => list.id)
      await removeUserList(removeIds)
      const remainIds = (await getAutoSaveDailyRecIds() ?? []).filter(id => !removeIds.includes(id))
      await saveAutoSaveDailyRecIds(remainIds)
    }

    const newListId = `userlist_${Date.now()}`
    await createList({
      name: playlistName,
      list: songList,
      id: newListId,
    });
    const ids = await getAutoSaveDailyRecIds() ?? []
    await saveAutoSaveDailyRecIds([...ids, newListId])
    toast(`已自动保存每日推荐: ${playlistName}`);
  } catch (error: any) {
    toast(`自动保存每日推荐失败: ${error.message}`);
    console.error('自动保存每日推荐失败:', error);
  }
};
