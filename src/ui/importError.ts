import { ZodError } from 'zod'

export function importErrorMessage(e: unknown): string {
  if (e instanceof SyntaxError) {
    return '文件内容不是合法的 JSON，请检查文件是否完整、是否选错了文件'
  }
  if (e instanceof ZodError) {
    const issue = e.issues[0]
    if (!issue) return e.message
    const path = issue.path
    const evAt = path.indexOf('events')
    const last = String(path[path.length - 1] ?? '')
    const where = evAt >= 0 && typeof path[evAt + 1] === 'number'
      ? `剧本文件第 ${Number(path[evAt + 1]) + 1} 个事件里的「${last}」一项`
      : last ? `「${last}」这一项` : '剧本文件的顶层结构'
    // Zod 内置提示是英文，夹在中文报错里只会添乱；只有自定义中文提示（条件语法等）才值得展示
    const detail = /[\u4e00-\u9fff]/.test(issue.message) ? `；详情：${issue.message}` : ''
    return `${where}格式不对${detail}（格式说明见项目文档《剧本格式规范》）`
  }
  return e instanceof Error ? e.message.slice(0, 200) : String(e)
}
