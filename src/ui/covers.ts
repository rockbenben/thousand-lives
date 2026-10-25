import coverWasteland from '../assets/cover-wasteland.webp'
import coverBook from '../assets/cover-book.webp'
import coverOfficialdom from '../assets/cover-officialdom.webp'
import coverSpy from '../assets/cover-spy.webp'
import coverXian from '../assets/cover-xian.webp'
import coverWuxia from '../assets/cover-wuxia.webp'
import coverScifi from '../assets/cover-scifi.webp'
import coverVoyage from '../assets/cover-voyage.webp'
import coverSanguo from '../assets/cover-sanguo.webp'
import coverLiyuan from '../assets/cover-liyuan.webp'
// 选关卡卡片用的方形缩略图：卡片只有 252px，封面却要铺满 1440px 的 VN 幕布，
// 直接用整张封面会让首屏多下 1.7MB 的看不见的像素（scripts/gen-cover-thumbs.mjs 生成）
import thumbWasteland from '../assets/cover-thumbs/wasteland.webp'
import thumbBook from '../assets/cover-thumbs/book.webp'
import thumbOfficialdom from '../assets/cover-thumbs/officialdom.webp'
import thumbSpy from '../assets/cover-thumbs/spy.webp'
import thumbXian from '../assets/cover-thumbs/xian.webp'
import thumbWuxia from '../assets/cover-thumbs/wuxia.webp'
import thumbScifi from '../assets/cover-thumbs/scifi.webp'
import thumbVoyage from '../assets/cover-thumbs/voyage.webp'
import thumbSanguo from '../assets/cover-thumbs/sanguo.webp'
import thumbLiyuan from '../assets/cover-thumbs/liyuan.webp'

// 内置剧本的封面图，按剧本 id 索引；自定义剧本无内置封面，卡片按「无封面」样式呈现
export const covers: Record<string, string> = {
  wasteland: coverWasteland,
  book: coverBook,
  officialdom: coverOfficialdom,
  spy: coverSpy,
  xian: coverXian,
  wuxia: coverWuxia,
  scifi: coverScifi,
  voyage: coverVoyage,
  sanguo: coverSanguo,
  liyuan: coverLiyuan,
}

// 卡片的方形缩略图，与 covers 同键。卡片只画 252px，用不着整张 2752px 的封面。
export const coverThumbs: Record<string, string> = {
  wasteland: thumbWasteland,
  book: thumbBook,
  officialdom: thumbOfficialdom,
  spy: thumbSpy,
  xian: thumbXian,
  wuxia: thumbWuxia,
  scifi: thumbScifi,
  voyage: thumbVoyage,
  sanguo: thumbSanguo,
  liyuan: thumbLiyuan,
}
