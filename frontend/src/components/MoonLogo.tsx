import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

interface Props {
  /** Rendered edge length in px. The artwork is a 500×500 viewBox, so it scales cleanly. */
  size?: number
  className?: string
}

/**
 * The Meridian brand mark — a wireframe moon: a stippled disc (craters drawn as
 * masked dot-patterns), a limb highlight, soft lighting layers, and an inner
 * gyroscope of three great-circle rings at different tilts that collapse to a
 * sliver and reopen (a wireframe sphere turning in 3D, via SMIL).
 *
 * Ported from RustRoverProjects/webapp `hero/WireframeMoon.tsx`, minus the hero
 * parallax. The disc + lighting live in index.css (`.mrdn-moon-*`).
 */
export function MoonLogo({ size = 260, className = '' }: Props) {
  const orbitsRef = useRef<SVGSVGElement>(null)
  const reduced = usePrefersReducedMotion()

  // Pause the orbit SMIL under reduced-motion.
  useEffect(() => {
    if (reduced) orbitsRef.current?.pauseAnimations()
    else orbitsRef.current?.unpauseAnimations()
  }, [reduced])

  return (
    <div
      className={`mrdn-moon relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="mrdn-moon-disc" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 500" aria-hidden="true">
        <defs>
          <pattern id="blStA" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.9" fill="rgba(223,230,245,0.6)" />
            <circle cx="5.4" cy="4.8" r="0.55" fill="rgba(223,230,245,0.45)" />
          </pattern>
          <pattern id="blStB" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
            <circle cx="3" cy="3" r="0.85" fill="rgba(223,230,245,0.5)" />
            <circle cx="8" cy="7.5" r="0.5" fill="rgba(223,230,245,0.38)" />
          </pattern>
          <radialGradient id="blFade" cx="50%" cy="47%" r="62%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="0.68" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blLimbFade" gradientUnits="userSpaceOnUse" cx="250" cy="250" r="247">
            <stop offset="0.76" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.93" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.85" />
          </radialGradient>
          <mask id="blM1" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
            <path d="M 100 85 C 130 62 185 60 212 85 C 235 105 232 140 208 158 C 180 178 132 175 110 152 C 88 130 82 102 100 85 Z" fill="url(#blFade)" />
          </mask>
          <mask id="blM2" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
            <path d="M 62 218 C 84 204 108 214 114 238 C 122 264 110 286 114 310 C 118 336 104 356 80 352 C 56 348 44 322 48 294 C 52 268 44 238 62 218 Z" fill="url(#blFade)" />
          </mask>
          <mask id="blM3" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
            <path d="M 330 130 C 356 120 384 130 390 155 C 396 180 380 200 353 202 C 327 204 311 186 313 161 C 315 143 318 137 330 130 Z" fill="url(#blFade)" />
          </mask>
          <mask id="blM4" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
            <path d="M 388 232 C 410 226 428 238 430 260 C 432 282 414 296 392 294 C 370 292 358 274 364 254 C 368 240 376 236 388 232 Z" fill="url(#blFade)" />
          </mask>
          <mask id="blM5" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
            <path d="M 225 390 C 242 384 258 392 260 408 C 262 424 248 434 232 432 C 216 430 208 416 212 404 C 215 396 218 393 225 390 Z" fill="url(#blFade)" />
          </mask>
          <mask id="blM6" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
            <path d="M 218 235 C 244 222 280 226 294 248 C 308 270 298 298 272 308 C 246 318 214 310 204 286 C 195 264 200 246 218 235 Z" fill="url(#blFade)" />
          </mask>
          <mask id="blMLimb" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
            <rect x="0" y="0" width="500" height="500" fill="url(#blLimbFade)" />
          </mask>
        </defs>

        <rect x="0" y="0" width="500" height="500" fill="url(#blStA)" mask="url(#blM1)" />
        <rect x="0" y="0" width="500" height="500" fill="url(#blStB)" mask="url(#blM2)" />
        <rect x="0" y="0" width="500" height="500" fill="url(#blStA)" fillOpacity="0.85" mask="url(#blM3)" />
        <rect x="0" y="0" width="500" height="500" fill="url(#blStB)" fillOpacity="0.95" mask="url(#blM4)" />
        <rect x="0" y="0" width="500" height="500" fill="url(#blStB)" fillOpacity="0.8" mask="url(#blM5)" />
        <rect x="0" y="0" width="500" height="500" fill="url(#blStA)" fillOpacity="0.6" mask="url(#blM6)" />
        <path
          d="M 487.6 186.3 A 246 246 0 0 1 186.3 487.6 L 198.8 441.2 A 198 198 0 0 0 441.2 198.8 Z"
          fill="url(#blStB)"
          mask="url(#blMLimb)"
        />

        <circle cx="258" cy="62" r="8" fill="none" stroke="rgba(223,230,245,0.4)" strokeWidth="1" strokeDasharray="1.5 2.8" />
        <ellipse cx="462" cy="238" rx="4.5" ry="9" fill="none" stroke="rgba(223,230,245,0.35)" strokeWidth="1" strokeDasharray="1.5 2.6" transform="rotate(4 462 238)" />
        <circle cx="118" cy="352" r="7" fill="none" stroke="rgba(223,230,245,0.38)" strokeWidth="1" strokeDasharray="1.5 2.8" />
        <circle cx="312" cy="428" r="6" fill="none" stroke="rgba(223,230,245,0.35)" strokeWidth="1" strokeDasharray="1.4 2.6" />
        <circle cx="180" cy="205" r="10" fill="none" stroke="rgba(223,230,245,0.42)" strokeWidth="1" strokeDasharray="1.6 3" />
        <circle cx="180" cy="205" r="4" fill="none" stroke="rgba(223,230,245,0.3)" strokeWidth="1" strokeDasharray="1.2 2.4" />
        <circle cx="322" cy="352" r="8" fill="none" stroke="rgba(223,230,245,0.36)" strokeWidth="1" strokeDasharray="1.5 2.8" />
      </svg>

      <div className="mrdn-moon-lighting" />

      <svg ref={orbitsRef} className="absolute inset-0 h-full w-full" viewBox="0 0 500 500" aria-hidden="true">
        <defs>
          <clipPath id="blOrbitClip">
            <circle cx="250" cy="250" r="248" />
          </clipPath>
        </defs>
        {/* Inner gyroscope — three great-circle rings at different tilts, each
            collapsing its width to a sliver and reopening: reads as a wireframe
            sphere turning in 3D (scale, not spin, = real perspective). */}
        <g clipPath="url(#blOrbitClip)">
          <g transform="translate(250 250)">
            <ellipse rx="247" ry="247" fill="none" stroke="rgba(158,170,198,0.42)" strokeWidth="1.5" transform="rotate(-24)">
              <animate attributeName="rx" values="247;5;247" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" dur="15s" begin="-1.5s" repeatCount="indefinite" />
            </ellipse>
            <ellipse rx="247" ry="247" fill="none" stroke="rgba(158,170,198,0.34)" strokeWidth="1.5" transform="rotate(36)">
              <animate attributeName="rx" values="247;5;247" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" dur="19s" begin="-8s" repeatCount="indefinite" />
            </ellipse>
            <ellipse rx="247" ry="247" fill="none" stroke="rgba(158,170,198,0.28)" strokeWidth="1.5" transform="rotate(88)">
              <animate attributeName="rx" values="247;5;247" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" dur="23s" begin="-14s" repeatCount="indefinite" />
            </ellipse>
          </g>
        </g>
      </svg>
    </div>
  )
}
