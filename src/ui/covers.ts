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

// 内置剧本的封面图，按剧本 id 索引；自定义剧本无图时回退到 emoji 占位
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
