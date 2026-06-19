import { describe, it, expect } from 'vitest'
import { voyage } from './voyage'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('voyage 船力势力封顶', () => {
  it('无势力印记时船力封顶 35（= base，≥ initial 不被削）', () => {
    expect(clampEffects(voyage, { ship: 35 }, { ship: 20 }, []).ship).toBe(35)
  })
  it('私掠→50 船队→70 海枭→88 霸主→100 逐级解锁', () => {
    expect(clampEffects(voyage, { ship: 45 }, { ship: 20 }, ['私掠']).ship).toBe(50)
    expect(clampEffects(voyage, { ship: 65 }, { ship: 20 }, ['私掠', '船队']).ship).toBe(70)
    expect(clampEffects(voyage, { ship: 85 }, { ship: 20 }, ['私掠', '船队', '海枭']).ship).toBe(88)
    expect(clampEffects(voyage, { ship: 95 }, { ship: 20 }, ['私掠', '船队', '海枭', '霸主']).ship).toBe(100)
  })
  it('财富与人心不设势力封顶', () => {
    expect(clampEffects(voyage, { wealth: 95 }, { wealth: 20 }, []).wealth).toBe(100)
    expect(clampEffects(voyage, { crew: 95 }, { crew: 20 }, []).crew).toBe(100)
  })
})

describe('voyage 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = {
      破产商人之子: '商人之子',
      哗变水手: '哗变水手',
      落魄贵族航海家: '贵族航海家',
    }
    for (const [name, flag] of Object.entries(want)) {
      const op = voyage.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(voyage, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = voyage.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('商人之子')).toBeGreaterThanOrEqual(1)
    expect(byFlag('哗变水手')).toBeGreaterThanOrEqual(1)
    expect(byFlag('贵族航海家')).toBeGreaterThanOrEqual(1)
  })
})
