import { useState } from 'react'
import type { Scenario, Opening } from './scenarios/schema'
import { initState } from './engine/state'
import { loadSave, saveSave, clearSave, loadCustomScenarios, type SaveGame } from './storage'
import { builtinScenarios } from './scenarios'
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
  const [session, setSession] = useState<Session | null>(null)

  const startSetup = (sc: Scenario) => {
    setSetupScenario(sc)
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
  // 用剧本的「原始定义」重开：上一局选的人生长度会把 maxTurns 放大写进 session.scenario，
  // 若拿它当基准，Setup 的长度档会累乘漂移（「标准」变成上一局的长度）。按 id 取回原始基准。
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
      <LangToggle />
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
        />
      )}
      {screen === 'play' && session && (
        <Play session={session} onUpdate={updateSession} onQuit={restart} />
      )}
      {screen === 'ending' && session && (
        <EndingScreen session={session} onRestart={restart} onReplay={replay} />
      )}
    </div>
  )
}
