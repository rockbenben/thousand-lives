import { useEffect, useRef, useState } from 'react'
import { LANG_KEY } from '../storage'

// 简繁转换:默认简体(源语言,零开销)。切到繁体时动态加载 opencc 词库,
// 转换 #root 下所有中文文本节点(含 AI 动态生成的剧情),并用 MutationObserver
// 跟进后续渲染出的新节点。切回简体直接刷新页面,由 React 从简体源重新渲染。
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
// 属性位文案（placeholder/title/aria-label）不在文本节点里，OpenCC 的 DOM 树转换
// 必须单独接住——否则繁体态下输入框提示/悬浮说明/读屏标签整片残留简体（审计 D-03）。
// 属性转换只碰元数据不碰 value，故 INPUT/TEXTAREA 不在属性豁免之列；代码/样式类容器仍豁免。
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt']
const ATTR_SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT'])
function convEl(el: Element, conv: (s: string) => string) {
  if (ATTR_SKIP.has(el.tagName)) return
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (v && HAN.test(v)) {
      const c = conv(v)
      if (c !== v) el.setAttribute(a, c)
    }
  }
}
function convTree(root: Node, conv: (s: string) => string) {
  if (root.nodeType === Node.TEXT_NODE) return convText(root as Text, conv)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  convEl(el, conv)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  const nodes: Node[] = []
  let n: Node | null
  while ((n = walker.nextNode())) nodes.push(n)
  for (const n2 of nodes) {
    if (n2.nodeType === Node.TEXT_NODE) convText(n2 as Text, conv)
    else convEl(n2 as Element, conv)
  }
}

export function LangToggle() {
  const [lang, setLang] = useState<'cn' | 'tw'>(() =>
    localStorage.getItem(LANG_KEY) === 'tw' ? 'tw' : 'cn',
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
        obs.current?.observe(root, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ATTRS,
        })
      obs.current = new MutationObserver((muts) => {
        obs.current?.disconnect()
        for (const m of muts) {
          if (m.type === 'characterData') convText(m.target as Text, conv)
          else if (m.type === 'attributes') convEl(m.target as Element, conv)
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
      localStorage.setItem(LANG_KEY, 'tw')
      setLang('tw')
    } else {
      localStorage.setItem(LANG_KEY, 'cn')
      location.reload() // 回简体:从简体源重新渲染,干净还原
    }
  }
  return (
    <button className="lang-toggle" onClick={toggle} title="简体 / 繁體" aria-label={lang === 'cn' ? '繁体' : '简体'}>
      {lang === 'cn' ? '繁' : '简'}
    </button>
  )
}
