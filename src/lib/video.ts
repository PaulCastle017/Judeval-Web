/** Enlaces de vídeo de la biblioteca de ejercicios: solo YouTube e Instagram (https). */
export type VideoInfo =
  | { kind: 'youtube'; id: string; thumbnail: string; embed: string; url: string }
  | { kind: 'instagram'; url: string }

// Misma regla que la base de datos (CHECK de exercises.url)
export const ALLOWED_VIDEO_URL = /^https:\/\/([a-z0-9-]+\.)*(youtube\.com|youtu\.be|instagram\.com)\//i

const YT_ID = /^[A-Za-z0-9_-]{11}$/

export function parseVideo(raw: string | null | undefined): VideoInfo | null {
  if (!raw || !ALLOWED_VIDEO_URL.test(raw.trim())) return null
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  const host = u.hostname.replace(/^(www|m)\./, '')
  if (host.endsWith('instagram.com')) return { kind: 'instagram', url: u.toString() }

  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0]
  else if (u.pathname === '/watch') id = u.searchParams.get('v')
  else {
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/)
    if (m) id = m[2]
  }
  if (!id || !YT_ID.test(id)) return null
  return {
    kind: 'youtube',
    id,
    // Miniatura pública de YouTube y reproductor sin cookies (solo se carga al pulsar)
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
    url: u.toString(),
  }
}
