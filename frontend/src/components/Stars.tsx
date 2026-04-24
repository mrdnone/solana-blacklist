import { useEffect, useRef, useState } from 'react'

interface Star {
  x: number
  y: number
  size: number
  opacity: number
  duration: number
  delay: number
  layer: 'distant' | 'mid' | 'bright'
}

interface ShootingStar {
  id: number
  top: number
  left: number
  duration: number
}

export function Stars() {
  const layers = useRef<Star[][]>([
    // Layer 1 — distant, many, faint, slow twinkle
    Array.from({ length: 200 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.2 + 0.4,
      opacity: Math.random() * 0.18 + 0.06,
      duration: Math.random() * 6 + 4,
      delay: Math.random() * 6,
      layer: 'distant' as const,
    })),
    // Layer 2 — mid-field stars
    Array.from({ length: 80 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.22 + 0.12,
      duration: Math.random() * 5 + 3,
      delay: Math.random() * 5,
      layer: 'mid' as const,
    })),
    // Layer 3 — bright close stars with glow
    Array.from({ length: 25 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 2,
      opacity: Math.random() * 0.2 + 0.28,
      duration: Math.random() * 4 + 2,
      delay: Math.random() * 3,
      layer: 'bright' as const,
    })),
  ]).current

  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    const spawnStar = () => {
      const id = nextId.current++
      const duration = Math.random() * 1.2 + 0.6
      setShootingStars((prev) => [
        ...prev,
        {
          id,
          top: Math.random() * 50 + 5,
          left: Math.random() * 90 + 5,
          duration,
        },
      ])
      setTimeout(() => {
        setShootingStars((prev) => prev.filter((s) => s.id !== id))
      }, duration * 1000)
    }

    const initialTimeout = setTimeout(spawnStar, Math.random() * 300 + 100)
    const interval = setInterval(spawnStar, Math.random() * 1000 + 1000)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [])

  const allStars = layers.flat()

  return (
    <div className="stars">
      {allStars.map((s, i) => (
        <div
          key={i}
          className={`star star--${s.layer}`}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
          }}
        />
      ))}
      {shootingStars.map((s) => (
        <div
          key={s.id}
          className="shooting-star"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
