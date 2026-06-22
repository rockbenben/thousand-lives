import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  loadConfig, saveConfig, loadSave, saveSave, clearSave,
  loadCustomScenarios, addCustomScenario,
  listSlots, saveToSlot, deleteSlot, exportSaveString, parseSaveFile, validateSaveGame,
  recordEnding, seenEndings, SAVE_VERSION,
  type SaveGame,
} from './storage'
import { wasteland } from './scenarios/wasteland'
import { builtinScenarios } from './scenarios'
import { initState } from './engine/state'
import type { AIConfig } from './ai/types'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

beforeEach(() => store.clear())

const cfg: AIConfig = { provider: 'openai', apiKey: 'sk', model: 'gpt-4o-mini' }

describe('config', () => {
  it('往返一致', () => {
    saveConfig(cfg)
    expect(loadConfig()).toEqual(cfg)
  })
  it('缺字段或损坏返回 null', () => {
    expect(loadConfig()).toBeNull()
    store.set('tl.config', '{broken')
    expect(loadConfig()).toBeNull()
    store.set('tl.config', JSON.stringify({ provider: 'openai' }))
    expect(loadConfig()).toBeNull()
  })
})

describe('save game', () => {
  it('往返一致，clear 后为 null', () => {
    const save: SaveGame = { scenario: wasteland, state: initState(wasteland), pendingTurn: null }
    saveSave(save)
    expect(loadSave()?.scenario.id).toBe('wasteland')
    clearSave()
    expect(loadSave()).toBeNull()
  })
  it('损坏的存档返回 null', () => {
    store.set('tl.save', '{"scenario":{"id":"x"}}')
    expect(loadSave()).toBeNull()
  })
  it('内置剧本存档按当前定义刷新（旧快照获得 bands 等更新）', () => {
    // 模拟旧版存档：内置 id 但 scenario 快照里没有 bands
    const stale = { ...wasteland, attributes: wasteland.attributes.map(({ bands: _b, ...a }) => a) }
    const save: SaveGame = { scenario: stale, state: initState(wasteland), pendingTurn: null }
    saveSave(save)
    const loaded = loadSave()
    expect(loaded?.scenario.attributes[0].bands).toBeDefined()
  })
  it('内置剧本存档保留玩家选的 maxTurns（人生长度），刷新内容时不还原回基准', () => {
    // 玩家在 Setup 选「漫长」→ App 用 {...wasteland, maxTurns: 60} 开局并存档
    const longRun = { ...wasteland, maxTurns: 60 }
    const save: SaveGame = { scenario: longRun, state: initState(longRun), pendingTurn: null }
    saveSave(save)
    const loaded = loadSave()
    expect(loaded?.scenario.maxTurns).toBe(60) // 不被 refreshBuiltin 还原成 30
    expect(loaded?.scenario.attributes[0].bands).toBeDefined() // 仍从内置定义刷新了内容
  })
  it('自定义剧本存档保持快照（不被内置覆盖）', () => {
    const custom = { ...wasteland, id: 'my-custom', title: '私设' }
    const save: SaveGame = { scenario: custom, state: initState(custom), pendingTurn: null }
    saveSave(save)
    expect(loadSave()?.scenario.title).toBe('私设')
  })
  it('pendingTurn 损坏时丢弃该字段但保留存档', () => {
    const save: SaveGame = { scenario: wasteland, state: initState(wasteland), pendingTurn: null }
    saveSave(save)
    const raw = JSON.parse(store.get('tl.save')!)
    raw.pendingTurn = { narrative: 123, choices: 'bad' }
    store.set('tl.save', JSON.stringify(raw))
    const loaded = loadSave()
    expect(loaded?.scenario.id).toBe('wasteland')
    expect(loaded?.pendingTurn).toBeNull()
  })
  it('存储写入失败（如配额满）不抛出', () => {
    const save: SaveGame = { scenario: wasteland, state: initState(wasteland), pendingTurn: null }
    const throwing = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
    expect(() => saveSave(save)).not.toThrow()
    throwing.mockRestore()
  })
})

describe('custom scenarios', () => {
  it('添加、去重（同 id 覆盖）、过滤非法项', () => {
    addCustomScenario(wasteland)
    addCustomScenario({ ...wasteland, title: '新版' })
    expect(loadCustomScenarios()).toHaveLength(1)
    expect(loadCustomScenarios()[0].title).toBe('新版')
    store.set('tl.customScenarios', JSON.stringify([{ bad: true }]))
    expect(loadCustomScenarios()).toEqual([])
  })
  it('添加新剧本不抹除未通过当前校验的旧条目', () => {
    const legacy = { id: 'legacy', bad: true }
    store.set('tl.customScenarios', JSON.stringify([legacy]))
    addCustomScenario(wasteland)
    const raw = JSON.parse(store.get('tl.customScenarios')!)
    expect(raw).toContainEqual(legacy)
    expect(loadCustomScenarios().map((s) => s.id)).toEqual(['wasteland'])
  })
})

describe('save slots', () => {
  const mk = (): SaveGame => ({ scenario: wasteland, state: initState(wasteland), pendingTurn: null })

  it('保存、列出（按时间倒序）、删除', () => {
    saveToSlot('存档A', mk(), 1000)
    saveToSlot('存档B', mk(), 2000)
    const slots = listSlots()
    expect(slots.map((s) => s.name)).toEqual(['存档B', '存档A']) // 倒序
    deleteSlot(slots[0].id)
    expect(listSlots().map((s) => s.name)).toEqual(['存档A'])
  })

  it('空名回退为未命名', () => {
    saveToSlot('   ', mk(), 1000)
    expect(listSlots()[0].name).toBe('未命名')
  })

  it('listSlots 跳过损坏的存档位', () => {
    saveToSlot('好', mk(), 1000)
    const raw = JSON.parse(store.get('tl.slots')!)
    raw.push({ id: 'bad', name: '坏', savedAt: 3000, game: { scenario: { id: 'x' } } })
    store.set('tl.slots', JSON.stringify(raw))
    expect(listSlots().map((s) => s.name)).toEqual(['好'])
  })

  it('删除不抹除当前校验不过的旧存档位', () => {
    saveToSlot('好', mk(), 1000)
    const raw = JSON.parse(store.get('tl.slots')!)
    raw.push({ id: 'bad', game: { broken: true } })
    store.set('tl.slots', JSON.stringify(raw))
    const good = listSlots()[0]
    deleteSlot(good.id)
    // 坏条目原样保留
    expect(JSON.parse(store.get('tl.slots')!)).toContainEqual({ id: 'bad', game: { broken: true } })
  })
})

describe('export / import', () => {
  const mk = (): SaveGame => ({ v: SAVE_VERSION, scenario: wasteland, state: initState(wasteland), pendingTurn: null })

  it('导出再导入往返一致', () => {
    const text = exportSaveString(mk())
    const back = parseSaveFile(text)
    expect(back.scenario.id).toBe('wasteland')
  })

  it('兼容裸 SaveGame JSON', () => {
    const back = parseSaveFile(JSON.stringify(mk()))
    expect(back.scenario.id).toBe('wasteland')
  })

  it('导出游戏内 session（内存态无 v）后可再导入', () => {
    // App.startGame / updateSession 持有的内存 session 从不带 v（只有写 localStorage / 存档位时才补 v）。
    // Play 的「导出」按钮直接 exportSaveString(session)，导出物必须能被 parseSaveFile 接回。
    const live: SaveGame = { scenario: wasteland, state: initState(wasteland), pendingTurn: null }
    const back = parseSaveFile(exportSaveString(live))
    expect(back.scenario.id).toBe('wasteland')
  })

  it('非法 JSON 抛中文错误', () => {
    expect(() => parseSaveFile('{not json')).toThrow('不是合法的 JSON')
  })

  it('结构无效抛错', () => {
    expect(() => parseSaveFile(JSON.stringify({ kind: 'thousand-lives-save', game: { scenario: { id: 'x' } } }))).toThrow('无效')
  })

  it('state.attributes 缺失/为 null 的存档应被拒（否则导入后渲染 state.attributes[key] 崩溃）', () => {
    const nullAttrs = { scenario: wasteland, state: { history: [], attributes: null }, pendingTurn: null }
    const missingAttrs = { scenario: wasteland, state: { history: [] }, pendingTurn: null }
    const arrAttrs = { scenario: wasteland, state: { history: [], attributes: [] }, pendingTurn: null }
    expect(validateSaveGame(nullAttrs as unknown)).toBeNull()
    expect(validateSaveGame(missingAttrs as unknown)).toBeNull()
    expect(validateSaveGame(arrAttrs as unknown)).toBeNull()
    expect(() => parseSaveFile(JSON.stringify(nullAttrs))).toThrow('无效')
  })

  it('validateSaveGame 丢弃损坏 pendingTurn 但保留存档', () => {
    const g = { ...mk(), pendingTurn: { narrative: 1, choices: 'bad' } }
    const v = validateSaveGame(g)
    expect(v?.pendingTurn).toBeNull()
    expect(v?.scenario.id).toBe('wasteland')
  })
})

describe('存档版本作废', () => {
  const xianSave = (v?: number) => ({
    v, scenario: builtinScenarios.find((s) => s.id === 'xian'),
    state: { scenarioId: 'xian', attributes: { cultivation: 10, daoHeart: 50, lifespan: 60 }, history: [] },
    pendingTurn: null,
  })
  it('无版本/旧版本的存档作废为 null', () => {
    expect(validateSaveGame(xianSave(undefined))).toBeNull()
    expect(validateSaveGame(xianSave(SAVE_VERSION - 1))).toBeNull()
  })
  it('当前版本存档正常加载', () => {
    expect(validateSaveGame(xianSave(SAVE_VERSION))).not.toBeNull()
  })
})

describe('ending gallery', () => {
  it('记录并去重见过的结局，按剧本隔离', () => {
    recordEnding('wasteland', '获救')
    recordEnding('wasteland', '获救') // 去重
    recordEnding('wasteland', '死亡')
    recordEnding('book', '善终')
    expect(seenEndings('wasteland').sort()).toEqual(['获救', '死亡'].sort())
    expect(seenEndings('book')).toEqual(['善终'])
    expect(seenEndings('unknown')).toEqual([])
  })
  it('忽略空 tone', () => {
    recordEnding('wasteland', '  ')
    expect(seenEndings('wasteland')).toEqual([])
  })
  it('图鉴写入失败（配额满）不抛出（在 Ending 的 effect 内裸调用，抛出会中断结算/报错）', () => {
    const throwing = vi.spyOn(localStorage, 'setItem').mockImplementation((k: string) => {
      if (k === 'tl.endings') throw new Error('QuotaExceededError')
    })
    expect(() => recordEnding('wasteland', '获救')).not.toThrow()
    throwing.mockRestore()
  })
})
