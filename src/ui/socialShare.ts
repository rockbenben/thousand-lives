// 社交平台分享：用各平台的 share-intent URL，点开即进平台发布框（带挑战链接 + 钩子文案 + 题材封面）。
// 纯前端、无后端：微博/QQ空间的接口支持显式图片参数(pic/pics)，直接附题材封面图；
// X/Telegram 不支持图片参数，靠被分享链接(/s/ 入口页)的 OG meta 自动展示封面。
// 个性化命运卡是本地 blob、无公网 URL，无法走平台图片参数 → 仍通过弹窗「复制图片/保存」分发。
export interface SocialTarget {
  id: string
  label: string
  // img = 题材封面绝对 URL（仅微博/QQ空间用得上；X/Telegram 忽略，由链接 OG meta 带图）
  href: (link: string, text: string, img?: string) => string
}

const enc = encodeURIComponent

export const socialTargets: SocialTarget[] = [
  {
    id: 'weibo',
    label: '微博',
    href: (l, t, img) =>
      `https://service.weibo.com/share/share.php?url=${enc(l)}&title=${enc(t)}` +
      (img ? `&pic=${enc(img)}` : ''),
  },
  {
    id: 'qzone',
    label: 'QQ空间',
    href: (l, t, img) =>
      `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${enc(l)}&title=${enc(t)}` +
      (img ? `&pics=${enc(img)}` : ''),
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
export function openSocialShare(target: SocialTarget, link: string, text: string, img?: string): void {
  window.open(target.href(link, text, img), '_blank', 'noopener,noreferrer')
}
