import { useEffect, useRef, useState } from 'react'
import type { Scenario } from '../scenarios/schema'
import type { GameState } from '../engine/types'
import { drawShareCard, canvasToBlob, type CardAchievement } from './shareCard'
import { copyImage, downloadBlob, copyText } from './download'
import { useModalA11y } from './useModalA11y'
import { buildShareUrl, openingIndexOf } from './challengeLink'
import { hookQuestion } from './hookQuestion'
import { socialTargets, openSocialShare } from './socialShare'

// 分享命运卡：先生成卡图给玩家预览，再让其明确选择「复制图 / 存图 / 原生分享」。
// 所见即所得，避免「点了分享不知道发生了啥」；一个弹窗同时照顾桌面(复制/下载)与手机(原生分享)。
export function ShareCardModal({
  sc,
  st,
  achievements = [],
  coverUrl,
  onClose,
}: {
  sc: Scenario
  st: GameState
  achievements?: CardAchievement[]
  coverUrl?: string
  onClose: () => void
}) {
  const ref = useModalA11y(onClose)
  const [imgUrl, setImgUrl] = useState('')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [err, setErr] = useState(false)
  const [msg, setMsg] = useState('')
  const aliveRef = useRef(true)

  // 挂载即生成卡图（drawShareCard 内含配图加载，故异步）
  useEffect(() => {
    aliveRef.current = true
    let objUrl = ''
    ;(async () => {
      try {
        const canvas = await drawShareCard(sc, st, achievements, coverUrl)
        const b = await canvasToBlob(canvas)
        if (!b) throw new Error('blob')
        if (!aliveRef.current) return
        objUrl = URL.createObjectURL(b)
        setBlob(b)
        setImgUrl(objUrl)
      } catch {
        if (aliveRef.current) setErr(true)
      }
    })()
    return () => {
      aliveRef.current = false
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => aliveRef.current && setMsg(''), 2200)
  }

  const onCopy = async () => {
    if (!blob) return
    // 复制图片需安全上下文(HTTPS 或 localhost)；不可用时提示退而用「保存图片」
    flash((await copyImage(blob)) ? '已复制图，去聊天框粘贴 ✓' : '此环境不支持复制图，请用「保存图片」')
  }
  const onSave = () => {
    if (blob) {
      downloadBlob(blob, 'qianshi-fate-card.png')
      flash('已保存到本地 ✓')
    }
  }
  // 社交分享：挑战链接 + 钩子文案（纯前端 share-intent，只带链接+文字）
  const link = buildShareUrl(sc, openingIndexOf(sc, st))
  const hook = hookQuestion(sc, st)
  const onCopyLink = async () => {
    flash((await copyText(link)) ? '链接已复制 ✓' : '复制失败，请手动选取')
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="分享命运卡"
      tabIndex={-1}
    >
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
        <h3>分享命运卡</h3>
        <div className="share-modal-body">
          <div className="share-preview">
            {err ? (
              <p className="share-err">命运卡生成失败，请重试。</p>
            ) : imgUrl ? (
              <img src={imgUrl} alt="命运卡预览" />
            ) : (
              <p className="share-loading">正在生成命运卡…</p>
            )}
          </div>
          <div className="share-side">
            <div className="share-modal-actions">
              <button className="primary" onClick={onCopy} disabled={!blob} title="复制卡图，直接粘进微信/聊天框发图">
                复制图片 ⎘
              </button>
              <button onClick={onSave} disabled={!blob} title="把命运卡保存到本地">
                保存图片 ⤓
              </button>
            </div>
            {msg && <p className="share-msg" role="status">{msg}</p>}
            <div className="share-social">
              <span className="share-social-label">分享链接到</span>
              <div className="share-social-row">
                {socialTargets.map((t) => (
                  <button key={t.id} onClick={() => openSocialShare(t, link, hook)} title={`分享挑战链接到${t.label}`}>
                    {t.label}
                  </button>
                ))}
                <button onClick={onCopyLink} title="复制挑战链接（微信/小红书等无网页分享，靠这个或卡上二维码）">
                  复制链接 🔗
                </button>
              </div>
            </div>
            <p className="share-tip">卡面已含钩子文案与挑战二维码；微信/小红书无网页分享接口，请用「复制图片」粘贴或让对方扫码。</p>
            <button className="ghost share-close" onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    </div>
  )
}
