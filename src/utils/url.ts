/**
 * 是不是一个可用的 http(s) 地址。
 *
 * 用在中转地址那一栏：漏写 `https://` 是最常见的错法，而它【不会报错】——
 * 拼出来的 `cors.example.dev/https://…` 是个相对地址，浏览器按本站域名解析，
 * 请求 404 在自己站上，任何报错都不指向「少了协议头」。当场标红比事后猜强。
 */
export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
