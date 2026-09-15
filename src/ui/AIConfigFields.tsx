import type { ThinkingLevel } from '../ai/types'
import { visibleProviderOptions, DEFAULT_PROXY } from '../ai/presets'
import { SearchSelect } from './SearchSelect'
import { useShowCodingPlans } from './useShowCodingPlans'
import type { useAIConfig } from './useAIConfig'

/**
 * AI 服务配置的那几个字段。开局页与「生成剧本」弹窗共用【同一份 JSX】。
 *
 * 以前只共用 useAIConfig 这个 hook，表单本身各写一份，于是两边慢慢长歪：
 * 端点建议只有开局页有、文档链接只有开局页有，而弹窗那份还停在旧的中转写法。
 * 字段本身是同一件事，就别让它有两份实现。
 *
 * 各页自己的东西（开局页的模式卡片、弹窗的支线数量滑杆）留在各自文件里。
 */
export function AIConfigFields({ cfg }: { cfg: ReturnType<typeof useAIConfig> }) {
  // 当前地址落在哪条建议端点上（只有自定义那一项的端点带文档）
  const endpointDocs = (cfg.preset.endpoints ?? []).find((ep) => ep.url === cfg.baseURL.trim())?.docs
  // 订阅套餐端点默认隐藏（目录 hidden：火山 Coding Plan / 阿里 Token Plan），
  // 高级开关放出；当前选中项始终保留。
  const { show: showCodingPlans, set: setShowCodingPlans } = useShowCodingPlans()

  return (
    <>
      <label>
        <span className="label-row">
          服务商（可搜索）
          {cfg.preset.docs && (
            <a className="ext" href={cfg.preset.docs} target="_blank" rel="noreferrer">
              API 文档 ↗
            </a>
          )}
        </span>
        <SearchSelect options={visibleProviderOptions(showCodingPlans, cfg.presetId)} value={cfg.presetId} onChange={cfg.changePreset} placeholder="搜索服务商…" />
      </label>
      {/* 极少用的高级开关，还带着「套餐可能被判滥用封号」的风险说明 ——
          常驻一大行开关加红字说明过于扎眼。折成一行不起眼的小字，展开后才
          露出开关与风险全文；已开启时 open 跟随状态为 true，免得它被藏住。 */}
      <details className="hidden-providers-toggle" open={showCodingPlans}>
        <summary>
          高级：订阅套餐节点（Coding Plan / Token Plan）{showCodingPlans ? '· 已开启' : ''}
        </summary>
        <div className="hidden-providers-body">
          <label className="inline-toggle">
            <input type="checkbox" checked={showCodingPlans} onChange={(e) => setShowCodingPlans(e.target.checked)} />
            <span>显示订阅套餐节点</span>
          </label>
          <span className="hint">
            官方文档指明：套餐仅限在 AI 编程工具中交互式使用，在允许范围之外使用套餐的 Base URL 和 API Key 可能被识别为滥用，导致订阅停用或账号 / API Key 封禁。请确认了解风险后再开启。
          </span>
        </div>
      </details>

      <label>
        <span className="label-row">
          Base URL（可改为代理或区域地址）
          {/* 自定义那一项底下的每条建议地址背后是一个独立产品（LM Studio /
              Ollama / LiteLLM…），服务商级的那条文档链接对它没有意义 ——
              填到哪条就给哪条的文档，用户得先照着它把服务跑起来。 */}
          {endpointDocs && (
            <a className="ext" href={endpointDocs} target="_blank" rel="noreferrer">
              API 文档 ↗
            </a>
          )}
        </span>
        <input value={cfg.baseURL} onChange={(e) => cfg.changeBaseURL(e.target.value)} placeholder={cfg.preset.baseURL || 'https://api.openai.com/v1'} />
        {/* 点一下就换地址。原先是 <datalist>：那东西只在聚焦/输入时才浮出建议，
            等于「有几个可选地址」这件事根本看不见，也点不到 —— 另外两个项目都是
            可点的芯片行，这里跟上。芯片之外仍留自由输入（自建代理 / 区域地址）。
            ⚠ 必须排在 <input> 【后面】：没写 for 的 <label> 关联的是它的第一个
            可标记后代，而芯片是 <button>（可标记）—— 排在前面的话，点一下标题
            文字就等于点了第一颗芯片，地址被悄悄改掉并落盘，输入框还丢了可访问名称。 */}
        {(cfg.preset.endpoints?.length ?? 0) > 0 && (
          <div className="chip-list endpoint-chips">
            {cfg.preset.endpoints!.map((ep) => (
              <button
                key={ep.url}
                type="button"
                className={`chip ${cfg.baseURL.trim() === ep.url ? 'selected' : ''}`}
                aria-pressed={cfg.baseURL.trim() === ep.url}
                onClick={() => cfg.changeBaseURL(ep.url)}
              >
                {ep.label}
              </button>
            ))}
          </div>
        )}
      </label>

      <label>
        <span className="label-row">
          API Key{cfg.keyOptional && '（本地服务可留空）'}
          {cfg.preset.apiKeyUrl && (
            <a className="ext" href={cfg.preset.apiKeyUrl} target="_blank" rel="noreferrer">
              获取 Key ↗
            </a>
          )}
        </span>
        <input type="password" autoComplete="off" value={cfg.apiKey} onChange={(e) => cfg.changeApiKey(e.target.value)} placeholder={cfg.keyOptional ? '本地服务通常不需要' : 'sk-...'} />
      </label>

      <label>
        模型（可搜索，也可直接输入任意模型名）
        <SearchSelect
          allowCustom
          options={cfg.preset.models.map((m) => ({ value: m }))}
          value={cfg.model}
          onChange={cfg.changeModel}
          placeholder={cfg.preset.models[0] ?? '模型名'}
        />
      </label>

      {cfg.canThink && (
        <label>
          思考强度
          <select value={cfg.thinkingLevel} onChange={(e) => cfg.changeThinkingLevel(e.target.value as ThinkingLevel)}>
            {/* ⚠ 最低那一档写什么，取决于这家【有没有关闭值】。gemini / grok /
                groq / cerebras 这些没有，它们的「关」实际发的是自己的最低档 ——
                仍在推理、仍在计费。写成「关闭（更快更省）」就是在撒谎：用户以为
                省下了推理的钱，账单上并没有。
                选项只留一个词、代价说明放到下面那行 —— 与上游同一分工，下拉保持
                可扫读。 */}
            <option value="off">{cfg.canDisableThinking ? '关闭（更快更省）' : '最低'}</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
          {!cfg.canDisableThinking && (
            <span className="hint">该服务商不支持关闭思考——「最低」发送它自己的最低值，仍会推理、仍会计费。调高通常更准确，但更慢、更耗额度。</span>
          )}
        </label>
      )}

      {/* 中转＝开关 + 地址，与另外两个项目同一形态。自填地址那一项不显示：
          那台按 host 白名单转发，局域网地址够不着、公网自建地址也不在名单里。 */}
      {/* 中转块对自填地址整块不显示，但跨域问题它一样会遇到 —— 不给一句话，用户
          只会看到 friendlyError 里那句「打开 CORS 中转」，而那个开关根本不在他屏幕上。 */}
      {!cfg.proxyApplicable && (
        <p className="hint">自填地址不走中转：那台按域名白名单转发，够不着局域网 / 自建地址。遇到跨域（CORS）失败，要在你自己的服务端加响应头。</p>
      )}

      {cfg.proxyApplicable && (
        <div className="proxy-block">
          <span className="label-row">
            {/* 名字与【本仓 README 里那句】一致（"请求经一台 CORS 中转转发"）——
                那是用户被指过去读隐私说明的地方，界面改叫别的就搜不到了。
                ⚠ 不要照搬上游的「中转 API」：那台是逐 provider 声明路由的【通用
                中转】，存在理由不止 CORS（按 origin 拦的 403 也靠它）；本仓这台
                只为 CORS 而存在。两个不同的东西不该共用一个名字。
                用「中转」而不是「代理」：说清了"经手"，也不与翻墙代理混淆。 */}
            <span>
              CORS 中转
              {/* README 与文档都写着「设置里会标出『必须开』」—— 那句话得在这里真的
                  兑现，否则用户看到的只是一个能关的开关，关掉就是一次无从解释的
                  CORS 失败。 */}
              {cfg.proxyRequired && <span className="req">必须开</span>}
            </span>
            <label className="inline-toggle">
              <input type="checkbox" checked={cfg.proxyOn} onChange={(e) => cfg.changeProxyOn(e.target.checked)} />
              <span>{cfg.proxyOn ? '已开启' : '直连'}</span>
            </label>
          </span>
          <p className="hint">
            {cfg.proxyRequired
              ? '该服务商不给浏览器发跨域头，直连发不出请求 —— 这一项已默认开启。'
              : '请求默认从浏览器直连；遇到跨域（CORS）或 403 错误时开启它转发一次。'}
            {/* 措辞与 types.ts 里那段一致：说清「经过」是真的，也说清「只转发
                不留存」（worker 那段就是 fetch 透传，没有日志、不写存储），再给出
                可做的事。少了后半句就成了一句吓人而无从应对的话，而这一项对
                directBlocked 的几家【默认就是开的】—— 吓退用户等于让 app 用不了。 */}
            {cfg.proxyOn && ' 开启后你的 API Key 与完整 prompt 会经过这台中转再到服务商；它只转发不留存，在意的话可改成自建地址（见文档）。'}
          </p>
          {cfg.proxyOn && (
            <>
              {/* 漏写 https:// 是这一栏最常见的错法，而它【不会报错】：拼出来的
                  `cors.example.dev/https://…` 是个相对地址，浏览器按本站域名解析，
                  请求 404 在自己站上，任何报错都不指向"少了协议头"。
                  留空【不算错】—— 那是「用内置的那台」。 */}
              <input
                value={cfg.proxyAddr}
                onChange={(e) => cfg.changeProxyAddr(e.target.value)}
                placeholder={DEFAULT_PROXY}
                spellCheck={false}
                aria-invalid={cfg.proxyAddrInvalid || undefined}
                className={cfg.proxyAddrInvalid ? 'invalid' : undefined}
              />
              {cfg.proxyAddrInvalid && <span className="hint error">需要完整地址，包含 https://</span>}
            </>
          )}
        </div>
      )}
    </>
  )
}
