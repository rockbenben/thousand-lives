import { useEffect, useRef, useState } from 'react'

// 简繁转换:默认简体(源语言,零开销)。切到繁体时动态加载 opencc 词库,
// 转换 #root 下所有中文文本节点(含 AI 动态生成的剧情),并用 MutationObserver
// 跟进后续渲染出的新节点。切回简体直接刷新页面,由 React 从简体源重新渲染。
const KEY = 'tl.lang'
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT'])
const HAN = /[㐀-鿿]/

let s2t: ((s: string) => string) | null = null
async function ensureConverter(): Promise<(s: string) => string> {
  if (!s2t) {
    const OpenCC = (await import('opencc-js')) as unknown as {
      Converter: (o: { from: string; to: string }) => (s: string) => string
    }
    s2t = OpenCC.Converter({ from: 'cn', to: 'tw' })
  }
  return s2t
}

function convText(t: Text, conv: (s: string) => string) {
  const p = t.parentElement
  if (!p || SKIP.has(p.tagName) || p.isContentEditable) return
  const v = t.nodeValue
  if (v && HAN.test(v)) {
    const c = conv(v)
    if (c !== v) t.nodeValue = c
  }
}
function convTree(root: Node, conv: (s: string) => string) {
  if (root.nodeType === Node.TEXT_NODE) return convText(root as Text, conv)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) nodes.push(n as Text)
  for (const t of nodes) convText(t, conv)
}

export function LangToggle() {
  const [lang, setLang] = useState<'cn' | 'tw'>(() =>
    localStorage.getItem(KEY) === 'tw' ? 'tw' : 'cn',
  )
  const obs = useRef<MutationObserver | null>(null)

  useEffect(() => {
    document.documentElement.lang = lang === 'tw' ? 'zh-Hant' : 'zh-Hans'
    if (lang !== 'tw') return // 简体即源语言,无需处理
    let live = true
    const root = document.getElementById('root')
    if (!root) return
    ensureConverter().then((conv) => {
      if (!live) return
      // <title> 在 #root 之外不被树转换：繁体下浏览器标签/书签会残留简体标题，单独转一次
      document.title = conv(document.title)
      const reconnect = () =>
        obs.current?.observe(root, { subtree: true, childList: true, characterData: true })
      obs.current = new MutationObserver((muts) => {
        obs.current?.disconnect()
        for (const m of muts) {
          if (m.type === 'characterData') convText(m.target as Text, conv)
          else m.addedNodes.forEach((nd) => convTree(nd, conv))
        }
        reconnect()
      })
      convTree(root, conv)
      reconnect()
    })
    return () => {
      live = false
      obs.current?.disconnect()
    }
  }, [lang])

  const toggle = () => {
    if (lang === 'cn') {
      localStorage.setItem(KEY, 'tw')
      setLang('tw')
    } else {
      localStorage.setItem(KEY, 'cn')
      location.reload() // 回简体:从简体源重新渲染,干净还原
    }
  }
  return (
    <button className="lang-toggle" onClick={toggle} title="简体 / 繁體" aria-label="简繁切换">
      {lang === 'cn' ? '繁' : '简'}
    </button>
  )
}
