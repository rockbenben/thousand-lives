import { useCallback, useEffect, useState } from 'react'

// 高级开关：放出默认隐藏的订阅套餐服务商（volcengine 方舟 Coding Plan、
// alibaba 百炼 Token Plan）。
// 隐藏的理由：两家官方文档均写明，在非 AI 编程工具 / 允许范围之外使用套餐
// Base URL / Key 可能被判滥用，导致订阅停用或账号 / API Key 封禁。风险全文在
// 开关下方那行 hint。只是一条界面偏好（qs.* 键族），不参与请求，也不进剧本/
// 设置的导入导出。
const KEY = 'qs.showCodingPlans'

export function readShowCodingPlans(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function writeShowCodingPlans(v: boolean): void {
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch {
    // 写入失败不影响当次生效，仅刷新后不保留
  }
}

/** 默认 false —— 隐藏条目要用户显式放出。 */
export function useShowCodingPlans(): { show: boolean; set: (v: boolean) => void } {
  const [show, setShow] = useState(false)
  useEffect(() => setShow(readShowCodingPlans()), [])
  const set = useCallback((v: boolean) => {
    setShow(v)
    writeShowCodingPlans(v)
  }, [])
  return { show, set }
}
