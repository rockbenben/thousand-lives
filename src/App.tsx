import { useEffect, useState } from 'react'
import type { Scenario, Opening } from './scenarios/schema'
import { initState } from './engine/state'
import { loadSave, saveSave, clearSave, loadCustomScenarios, type SaveGame } from './storage'
import { builtinScenarios } from './scenarios'
import { parseChallenge } from './ui/challengeLink'
import { Home } from './ui/Home'
import { Archive } from './ui/Archive'
import { Setup } from './ui/Setup'
import { Play } from './ui/Play'
import { EndingScreen } from './ui/Ending'
import { LangToggle } from './ui/LangToggle'

type Screen = 'home' | 'archive' | 'setup' | 'play' | 'ending'
export type Session = SaveGame

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [setupScenario, setSetupScenario] = useState<Scenario | null>(null)
  const [setupOpening, setSetupOpening] = useState<number | undefined>(undefined)
  const [session, setSession] = useState<Session | null>(null)

  // 挑战链接（?s=&o=）：进入即直达对应题材+开局的设置页（仍由玩家确认模式/Key 再开局）
  useEffect(() => {
    if (typeof location === 'undefined') return
    const ch = parseChallenge(location.search)
    if (!ch) return
    const sc = builtinScenarios.find((b) => b.id === ch.scenarioId)
    if (!sc) return
    setSetupScenario(sc)
    setSetupOpening(ch.opening)
    setScreen('setup')
    // 清掉 query，避免刷新/返回重复触发
    try {
      history.replaceState(null, '', location.origin + location.pathname)
    } catch {
      // 某些环境禁用 history API，忽略即可
    }
  }, [])

  const startSetup = (sc: Scenario) => {
    setSetupScenario(sc)
    setSetupOpening(undefined)
    setScreen('setup')
  }

  const startGame = (
    sc: Scenario,
    opening?: Opening,
    ambition?: string,
    mode: 'ai' | 'local' = 'ai',
  ) => {
    const existing = loadSave()
    if (
      existing &&
      !existing.state.ended &&
      !window.confirm(`开始新游戏将覆盖未完成的「${existing.scenario.title}」进度，确定？`)
    ) {
      return
    }
    const s: Session = {
      scenario: sc,
      state: initState(sc, opening, ambition, mode),
      pendingTurn: null,
    }
    setSession(s)
    saveSave(s)
    setScreen('play')
  }

  const continueGame = () => {
    const s = loadSave()
    if (s) {
      setSession(s)
      setScreen(s.state.ended ? 'ending' : 'play')
    }
  }

  // 载入一个存档位 / 导入的存档：成为当前进度，并进入对应界面
  const loadGame = (g: SaveGame) => {
    const existing = loadSave()
    if (
      existing &&
      !existing.state.ended &&
      !window.confirm(`载入存档将覆盖未完成的「${existing.scenario.title}」进度，确定？`)
    ) {
      return
    }
    setSession(g)
    saveSave(g)
    setScreen(g.state.ended ? 'ending' : 'play')
  }

  const restart = () => {
    clearSave()
    setSession(null)
    setScreen('home')
  }

  // 重玩同一剧本：清掉当前存档，回到该剧本的设置页。
  // 按 id 取回剧本的「原始定义」重开，而非沿用 session.scenario（后者可能带旧存档遗留的非基准 maxTurns），
  // 保证每次重玩都从该剧本的基准设定起步。
  const replay = (sc: Scenario) => {
    clearSave()
    setSession(null)
    const base =
      builtinScenarios.find((b) => b.id === sc.id) ??
      loadCustomScenarios().find((c) => c.id === sc.id) ??
      sc
    startSetup(base)
  }

  const updateSession = (s: Session) => {
    setSession(s)
    saveSave(s)
    if (s.state.ended) setScreen('ending')
  }

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">跳到主要内容</a>
      <LangToggle />
      <main id="main-content" tabIndex={-1}>
        {screen === 'home' && (
          <Home
            onSelect={startSetup}
            onContinue={continueGame}
            onOpenArchive={() => setScreen('archive')}
          />
        )}
        {screen === 'archive' && (
          <Archive onBack={() => setScreen('home')} onLoadGame={loadGame} />
        )}
        {screen === 'setup' && setupScenario && (
          <Setup
            key={setupScenario.id}
            scenario={setupScenario}
            onStart={startGame}
            onBack={() => setScreen('home')}
            initialOpening={setupOpening}
          />
        )}
        {screen === 'play' && session && (
          <Play session={session} onUpdate={updateSession} onQuit={restart} />
        )}
        {screen === 'ending' && session && (
          <EndingScreen session={session} onRestart={restart} onReplay={replay} />
        )}
      </main>
    </div>
  )
}
