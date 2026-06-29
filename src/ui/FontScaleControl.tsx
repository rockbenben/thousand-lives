import { FONT_SCALES, useFontScale } from './useFontScale'

// 正文字号档位选择器。compact 用于对局页头部（无文字标签、更紧凑）。
export function FontScaleControl({ compact }: { compact?: boolean }) {
  const { scale, set } = useFontScale()
  return (
    <div className={`font-scale${compact ? ' compact' : ''}`} role="group" aria-label="正文字号">
      {!compact && <span className="font-scale-label">字号</span>}
      {FONT_SCALES.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`font-scale-btn${scale === s.scale ? ' active' : ''}`}
          aria-pressed={scale === s.scale}
          onClick={() => set(s.scale)}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
