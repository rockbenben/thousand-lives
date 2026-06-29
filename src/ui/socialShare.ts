// 社交平台分享：用各平台的 share-intent URL，点开即进平台发布框（带挑战链接 + 钩子文案）。
// 纯前端、无后端，故只带【链接+文字】；卡图通过弹窗里的「复制图片/保存」走（微信/小红书无网页分享接口，靠复制图+二维码）。
// 后续若加边缘函数托管卡图、生成 OG 预览页，分享出去的链接即可自带卡图预览（ChatGPT 那种）。
export interface SocialTarget {
  id: string
  label: string
  href: (link: string, text: string) => string
}

const enc = encodeURIComponent

export const socialTargets: SocialTarget[] = [
  {
    id: 'weibo',
    label: '微博',
    href: (l, t) => `https://service.weibo.com/share/share.php?url=${enc(l)}&title=${enc(t)}`,
  },
  {
    id: 'qzone',
    label: 'QQ空间',
    href: (l, t) =>
      `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${enc(l)}&title=${enc(t)}`,
  },
  {
    id: 'x',
    label: 'X',
    href: (l, t) => `https://twitter.com/intent/tweet?text=${enc(t)}&url=${enc(l)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    href: (l, t) => `https://t.me/share/url?url=${enc(l)}&text=${enc(t)}`,
  },
]

// 在新标签打开平台发布页（noopener 防被分享页反向操控本页）
export function openSocialShare(target: SocialTarget, link: string, text: string): void {
  window.open(target.href(link, text), '_blank', 'noopener,noreferrer')
}
