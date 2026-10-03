/** Centralized user-facing strings — single source of truth for i18n and consistency. */

export const msg = {
  /** Error: no API config found */
  noApiConfig: '未找到 API 配置，请回到卷首重新设置',

  /** Import error prefix */
  importFailed: '剧本导入失败：请确认选择的是命书阁「导出」生成的 JSON 文件。原因：',

  /** Save import error prefix */
  saveImportFailed: '存档导入失败：请确认选择的是「导出存档」生成的 JSON 文件。原因：',

  /** Clipboard copy failed */
  copyFailed: '复制失败：浏览器拒绝了剪贴板访问，请手动选择文本复制',

  /** Lightbox / art thumbnail tooltip */
  clickToEnlarge: '轻触查看全图',

  /** Badge enlarge tooltip (Archive/Ending 同串收拢单源) */
  badgeEnlarge: '轻触放大徽章',

  /** Lightbox aria-label */
  viewLargeImage: '查看大图',

  /** Node art thumbnail aria-label */
  viewNodeArt: '查看此节点配图',

  /** Save-to-slot failed (browser storage quota full) */
  saveSlotFailed: '存档失败：浏览器存储空间不足，可在命书阁删除旧存档后重试。',
} as const
