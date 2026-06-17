// 成就徽章配图：按成就 id 取 assets/achievements/{id}.webp；无图则回退 emoji 图标。
const art = import.meta.glob('../assets/achievements/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

export function achievementImage(id: string): string | undefined {
  return art[`../assets/achievements/${id}.webp`]
}
