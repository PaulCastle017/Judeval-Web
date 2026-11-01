import { useState } from 'react'
import { EXERCISE_TAG_LABELS } from '../../lib/format'
import { parseVideo } from '../../lib/video'

type ExerciseLike = { title: string; url?: string | null; description?: string | null; tags?: string[] | null; default_minutes?: number | null }

/** Miniatura del ejercicio: vídeo de YouTube, icono de Instagram o icono de texto. */
export function ExerciseThumb({ url, size = 'md' }: { url?: string | null; size?: 'sm' | 'md' }) {
  const video = parseVideo(url)
  if (video?.kind === 'youtube') {
    return (
      <span className={`ex-thumb ex-thumb-${size}`}>
        <img src={video.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
        <span className="ex-play" aria-hidden="true">
          ▶
        </span>
      </span>
    )
  }
  return (
    <span className={`ex-thumb ex-thumb-${size} ex-thumb-icon`} aria-hidden="true">
      {video?.kind === 'instagram' ? '📸' : '📝'}
    </span>
  )
}

export function TagChips({ tags }: { tags?: string[] | null }) {
  if (!tags?.length) return null
  return (
    <span className="row-tight">
      {tags.map((t) => (
        <span key={t} className={`tag tag-${t}`}>
          {EXERCISE_TAG_LABELS[t]?.icon} {EXERCISE_TAG_LABELS[t]?.label ?? t}
        </span>
      ))}
    </span>
  )
}

/** Tarjeta de ejercicio para la biblioteca y el desplegable. */
export function ExerciseCard({ exercise, onClick, selected }: { exercise: ExerciseLike; onClick?: () => void; selected?: boolean }) {
  const video = parseVideo(exercise.url)
  return (
    <button type="button" className={`card ex-card${selected ? ' ex-card-on' : ''}`} onClick={onClick}>
      <ExerciseThumb url={exercise.url} />
      <span className="ex-card-body">
        <strong className="ex-card-title">{exercise.title}</strong>
        <span className="muted small">
          {video?.kind === 'youtube' ? 'Vídeo de YouTube' : video?.kind === 'instagram' ? 'Instagram' : 'Explicación escrita'}
          {exercise.default_minutes ? ` · ${exercise.default_minutes} min` : ''}
        </span>
        <TagChips tags={exercise.tags} />
      </span>
    </button>
  )
}

/** Vídeo de YouTube incrustado bajo demanda (no carga nada de YouTube hasta pulsar). */
export function VideoPreview({ url }: { url?: string | null }) {
  const video = parseVideo(url)
  const [playing, setPlaying] = useState(false)
  if (!video) return null
  if (video.kind === 'instagram') {
    return (
      <a href={video.url} target="_blank" rel="noopener noreferrer" className="btn btn-small">
        📸 Abrir en Instagram
      </a>
    )
  }
  if (playing) {
    return (
      <div className="video-frame">
        <iframe
          src={video.embed}
          title="Vídeo del ejercicio"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    )
  }
  return (
    <button type="button" className="video-poster" onClick={() => setPlaying(true)} aria-label="Reproducir vídeo">
      <img src={video.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
      <span className="ex-play ex-play-lg" aria-hidden="true">
        ▶
      </span>
    </button>
  )
}
