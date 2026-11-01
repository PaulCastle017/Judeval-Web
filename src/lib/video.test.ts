import { describe, expect, it } from 'vitest'
import { parseVideo } from './video'

describe('parseVideo', () => {
  it('reconoce los formatos de YouTube', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    ]) {
      const v = parseVideo(url)
      expect(v?.kind, url).toBe('youtube')
      if (v?.kind === 'youtube') {
        expect(v.id).toBe('dQw4w9WgXcQ')
        expect(v.thumbnail).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
        expect(v.embed).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
      }
    }
  })
  it('reconoce Instagram', () => {
    expect(parseVideo('https://www.instagram.com/reel/C1234abcd/')?.kind).toBe('instagram')
  })
  it('rechaza otros sitios, http y enlaces incompletos', () => {
    expect(parseVideo('https://vimeo.com/123')).toBeNull()
    expect(parseVideo('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseVideo('https://youtube.com/watch')).toBeNull()
    expect(parseVideo('https://evil.com/youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseVideo('')).toBeNull()
  })
})
