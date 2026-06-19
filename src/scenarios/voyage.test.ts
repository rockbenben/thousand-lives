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
