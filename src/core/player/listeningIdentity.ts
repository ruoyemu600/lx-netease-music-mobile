/** Native accounting receives only identity/display metadata, never stream URLs.
 * Downloaded tracks keep their original source+ID, so online/download playback
 * shares one counter. Different sources/IDs are not merged by name heuristics.
 */
export const getListeningTrackExtras = (raw: LX.Player.PlayMusic | null | undefined): Record<string, string> => {
  if (!raw) return {}
  const song = 'progress' in raw ? raw.metadata.musicInfo : raw
  if (!song || song.id == null || !String(song.id) || !song.source) return {}
  const id = String(song.id)
  const source = String(song.source)
  return {
    listeningKey: JSON.stringify([source, id]),
    listeningId: id,
    listeningSource: source,
    listeningName: song.name || '未知歌曲',
    listeningSinger: song.singer || '',
    listeningPicUrl: song.meta?.picUrl || '',
  }
}
