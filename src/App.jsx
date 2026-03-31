import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

const LETTER_TEXT = `Today is your 19th birthday right?! If I remember correctly. happy birthday！！！ 🎂

No matter what, I truly hope you can be happy every single day. In the coming year, I hope you get everything you want and become the person you aspire to be.

I am truly grateful to have met you. You have taught me so much, slowly melting the ice that once enveloped my heart, transforming me into a warmer and more authentic person.

So I have always been very grateful to you!!

I no longer have extravagant hopes of gaining your love, but I still sincerely wish you a good and happy life. To me, that is already very important.

Thank you for appearing in my life like a brief yet brilliant firework!!!!`

const CANDLES = 4
const CANDLE_BODY_H = 0.45
const CANDLE_TOP_Y = CANDLE_BODY_H / 2
const FLAME_CONE_R = 0.05
const FLAME_CONE_H = 0.16
/** ConeGeometry is centered: base at y = -H/2, apex at y = +H/2 → group sits at candle top + H/2 */
const FLAME_GROUP_Y = CANDLE_TOP_Y + FLAME_CONE_H / 2+0.01

const LIVES_PER_LEVEL = 3
/** Game 1: chance each hop is a bomb (tap = −1 score, min 0) */
const GAME1_BOMB_CHANCE = 0.34

/** Game 3: catches needed to continue */
const FALL_CATCH_GOAL = 20

function reshuffleFlipCards() {
  const base = ['🧸', '🎂', '🎁', '🎈']
  return [...base, ...base].sort(() => Math.random() - 0.5).map((icon, id) => ({ id, icon, open: false, matched: false }))
}

function MiniGame({ title, hint, children, onNext, done, lives, livesMax = LIVES_PER_LEVEL }) {
  return (
    <div className="card fade-in mx-auto w-full max-w-2xl p-6 md:p-8">
      <h2 className="text-2xl font-bold text-teddy-dark">{title}</h2>
      {hint != null && <p className="mt-2 text-teddy-dark/80">{hint}</p>}
      {lives != null && (
        <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-lg font-semibold text-teddy-dark">
          <span>Lives:</span>
          <span className="inline-flex flex-wrap justify-center gap-0.5" aria-label={`${lives} of ${livesMax} lives`}>
            {Array.from({ length: livesMax }, (_, i) => (
              <span key={i} className={i < lives ? '' : 'opacity-30'}>
                ❤️
              </span>
            ))}
          </span>
        </p>
      )}
      <div className="mt-6">{children}</div>
      {done && (
        <button
          onClick={onNext}
          className="warm-btn mt-6 bg-teddy-base text-white shadow hover:bg-teddy-dark"
        >
          Continue
        </button>
      )}
    </div>
  )
}

function CandleFlame({ alive, offset = 0 }) {
  const meshRef = useRef(null)
  const lightRef = useRef(null)
  useFrame(({ clock }) => {
    if (!meshRef.current || !lightRef.current || !alive) return
    const t = clock.getElapsedTime() * 4 + offset
    meshRef.current.scale.y = 1 + Math.sin(t) * 0.12
    meshRef.current.position.x = Math.sin(t * 0.55) * 0.03
    lightRef.current.intensity = 1.05 + Math.sin(t * 1.7) * 0.25 + Math.random() * 0.08
  })

  if (!alive) return null
  return (
    <group position={[0, FLAME_GROUP_Y, 0]}>
      <pointLight ref={lightRef} color="#FFD580" intensity={1} distance={1.65} />
      <mesh ref={meshRef}>
        <coneGeometry args={[FLAME_CONE_R, FLAME_CONE_H, 16]} />
        <meshStandardMaterial
          color="#ffd27a"
          emissive="#ffb347"
          emissiveIntensity={1.3}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  )
}

function Candle({ position, alive, index, smoking }) {
  const smokeRef = useRef()
  const fadeRef = useRef(1)
  useFrame(({ clock }) => {
    if (!alive && fadeRef.current > 0) fadeRef.current = Math.max(0, fadeRef.current - 0.08)
    if (alive) fadeRef.current = Math.min(1, fadeRef.current + 0.12)
    if (!smokeRef.current || !smoking) return
    smokeRef.current.position.y = 0.35 + Math.sin(clock.getElapsedTime() * 2 + index) * 0.03
    smokeRef.current.scale.setScalar(0.8 + Math.sin(clock.getElapsedTime() * 1.7 + index) * 0.08)
  })

  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.06, 0.06, 0.45, 18]} />
        <meshStandardMaterial color="#f8e7c9" roughness={0.45} metalness={0.08} />
      </mesh>
      <CandleFlame alive={alive} offset={index * 0.7} />
      {smoking && (
        <mesh ref={smokeRef} position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#b9b9b9" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  )
}

function Fireworks({ active }) {
  const rockets = useMemo(
    () =>
      new Array(5).fill(0).map((_, i) => ({
        x: -2.8 + i * 1.8,
        z: -1.2 + Math.random() * 2.4,
        delay: i * 0.55,
        color: ['#fef0d2', '#ffd580', '#f6d1d1'][i % 3],
      })),
    [],
  )

  const trails = useRef([])
  const bursts = useRef([])

  useFrame(({ clock }) => {
    if (!active) return
    const t = clock.getElapsedTime()
    rockets.forEach((rocket, i) => {
      const local = (t - rocket.delay) % 3.4
      const upPhase = Math.min(local / 1.05, 1)
      const rocketY = -0.7 + upPhase * 3.35
      const burstPhase = Math.max(0, local - 1.1)

      const trail = trails.current[i]
      if (trail) {
        trail.position.set(rocket.x, rocketY, rocket.z)
        trail.material.opacity = upPhase < 1 ? 0.95 : 0
      }

      const burst = bursts.current[i]
      if (burst) {
        const spread = 0.3 + burstPhase * 1.4
        burst.scale.set(spread * 1.25, spread, spread * 1.25)
        burst.position.set(rocket.x, 2.5, rocket.z)
        burst.material.opacity = Math.max(0, 0.95 - burstPhase * 1.1)
      }
    })
  })

  if (!active) return null
  return (
    <>
      {rockets.map((rocket, i) => (
        <group key={i}>
          <mesh ref={(el) => (trails.current[i] = el)}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshBasicMaterial color={rocket.color} transparent opacity={0.9} />
          </mesh>
          <mesh ref={(el) => (bursts.current[i] = el)} position={[rocket.x, 2.5, rocket.z]}>
            <sphereGeometry args={[0.4, 22, 22]} />
            <meshBasicMaterial color={rocket.color} transparent opacity={0} wireframe />
          </mesh>
        </group>
      ))}
      <Sparkles count={190} scale={[12, 8, 12]} size={2.2} speed={0.95} />
    </>
  )
}

function TeddyCakeContent({ litCandles, onCakeTap, allOut, roomLightsOn }) {
  const bearRef = useRef(null)
  const floatRefs = useRef([])
  const farRefs = useRef([])
  const midRefs = useRef([])
  const meteorRefs = useRef([])
  const mixRef = useRef(0)
  const roomLightsRef = useRef(false)
  const [nightMix, setNightMix] = useState(0)

  useEffect(() => {
    roomLightsRef.current = roomLightsOn
  }, [roomLightsOn])
  const candlePositions = useMemo(
    () => [
      [-0.45, 1.02, 0.25],
      [-0.2, 0.96, -0.2],
      [0.35, 0.95, -0.15],
      [0.55, 0.9, 0.12],
    ],
    [],
  )
  const farStars = useMemo(
    () =>
      new Array(75).fill(0).map(() => ({
        pos: [Math.random() * 12 - 6, 1.1 + Math.random() * 4.8, -4.8 - Math.random() * 2.5],
        phase: Math.random() * Math.PI * 2,
      })),
    [],
  )
  const midParticles = useMemo(
    () =>
      new Array(20).fill(0).map(() => ({
        pos: [Math.random() * 10 - 5, 0.6 + Math.random() * 4.2, -3.2 - Math.random() * 1.8],
        phase: Math.random() * Math.PI * 2,
      })),
    [],
  )
  const meteors = useMemo(
    () =>
      new Array(2).fill(0).map((_, i) => ({
        origin: [3.8 - i * 4.8, 3.2 + i * 1.1, -2.8],
        phase: i * 2.4,
      })),
    [],
  )

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime()
    const target = allOut ? 1 : 0
    mixRef.current += (target - mixRef.current) * 0.025
    if (Math.abs(nightMix - mixRef.current) > 0.01) setNightMix(mixRef.current)

    camera.position.z = 3.8 - Math.min(0.28, t * 0.02) + Math.sin(t * 0.25) * 0.03
    camera.position.y = 1.45 + Math.sin(t * 0.2) * 0.015
    camera.lookAt(0, 0.9, 0)
    if (bearRef.current) {
      const b = 1 + Math.sin(t * 2.2) * 0.02
      bearRef.current.scale.set(b, b, b)
      bearRef.current.rotation.x = -0.04 * mixRef.current
    }
    floatRefs.current.forEach((ref, i) => {
      if (!ref) return
      ref.position.y += Math.sin(t * 0.7 + i) * 0.0012
      ref.rotation.y += 0.002 + i * 0.0005
    })
    const starDim = allOut && roomLightsRef.current ? 0.5 : 1
    farRefs.current.forEach((ref, i) => {
      if (!ref) return
      ref.material.opacity = (0.08 + Math.sin(t * 0.7 + farStars[i].phase) * 0.06) * mixRef.current * starDim
    })
    midRefs.current.forEach((ref, i) => {
      if (!ref) return
      ref.position.y += Math.sin(t * 0.45 + i) * 0.0008
      ref.material.opacity = (0.14 + Math.sin(t * 0.8 + midParticles[i].phase) * 0.08) * mixRef.current * starDim
    })
    meteorRefs.current.forEach((ref, i) => {
      if (!ref) return
      const cycle = (t + meteors[i].phase) % 8
      const run = Math.max(0, cycle - 6.7)
      ref.position.set(
        meteors[i].origin[0] - run * 2.4,
        meteors[i].origin[1] - run * 1.3,
        meteors[i].origin[2],
      )
      ref.material.opacity = run > 0 ? Math.max(0, 0.32 - run * 0.6) * mixRef.current * starDim : 0
    })
  })

  const nightEase = allOut && roomLightsOn ? 0.42 : 1
  const visualNight = nightMix * nightEase
  /** Lights match “candles still lit” whenever not in full night, or when room lights are on. */
  const lightDim = allOut && !roomLightsOn ? nightMix : 0

  const bgColor = new THREE.Color('#F5E6D3').lerp(new THREE.Color('#1D1717'), visualNight).getStyle()
  const fogColor = new THREE.Color('#E6D3B3').lerp(new THREE.Color('#2A1F26'), visualNight).getStyle()
  const groundColor = new THREE.Color('#e6d3b3').lerp(new THREE.Color('#4A3A33'), visualNight).getStyle()
  const ringColor = new THREE.Color('#cda883').lerp(new THREE.Color('#3A2C2A'), visualNight).getStyle()

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <fog attach="fog" args={[fogColor, 4.4, 10]} />
      <ambientLight intensity={0.35 - lightDim * 0.25} />
      <directionalLight position={[2.5, 4.5, 2.8]} intensity={1.2 - lightDim * 0.85} color="#ffd7ad" />
      <directionalLight position={[-2.8, 2.1, -1.4]} intensity={0.5 - lightDim * 0.24} color="#f6d1d1" />
      <pointLight position={[0, 3, 2.5]} intensity={0.25 - lightDim * 0.12} color="#fff2df" />
      <OrbitControls enablePan={false} minDistance={2.4} maxDistance={5.3} enableDamping dampingFactor={0.08} />
      <Sparkles
        count={80 + Math.round(visualNight * 40)}
        scale={[10, 4, 10]}
        size={1.8}
        speed={0.45 - visualNight * 0.2}
        color="#ffdca9"
      />

      <group onClick={onCakeTap}>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[1.25, 1.3, 0.7, 48]} />
          <meshStandardMaterial color="#F5E6D3" roughness={0.52} metalness={0.04} />
        </mesh>
        <mesh position={[0, 0.73, 0]}>
          <cylinderGeometry args={[0.95, 1.05, 0.36, 48]} />
          <meshStandardMaterial color="#6B4F3A" roughness={0.28} metalness={0.18} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.78, 0.82, 0.2, 48]} />
          <meshStandardMaterial color="#E6D3B3" roughness={0.48} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0.96, 0]}>
          <torusGeometry args={[0.78, 0.05, 18, 80]} />
          <meshStandardMaterial color="#F5E6D3" roughness={0.5} metalness={0.05} />
        </mesh>

        <group ref={bearRef} position={[0, 1.34, 0]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.25, 28, 28]} />
            <meshStandardMaterial color="#c4a484" roughness={0.46} metalness={0.05} />
          </mesh>
          <mesh position={[-0.19, 0.16, 0]}>
            <sphereGeometry args={[0.1, 20, 20]} />
            <meshStandardMaterial color="#c4a484" roughness={0.44} metalness={0.04} />
          </mesh>
          <mesh position={[0.19, 0.16, 0]}>
            <sphereGeometry args={[0.1, 20, 20]} />
            <meshStandardMaterial color="#c4a484" roughness={0.44} metalness={0.04} />
          </mesh>
          <mesh position={[0, -0.07, 0.2]}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial color="#8b5e3c" />
          </mesh>
          <mesh position={[-0.09, -0.02, 0.22]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshStandardMaterial color="#f0a3a3" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0.09, -0.02, 0.22]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshStandardMaterial color="#f0a3a3" transparent opacity={0.55} />
          </mesh>
          <TeddyWavePaw />
        </group>

        {candlePositions.map((position, i) => (
          <Candle key={i} position={position} index={i} alive={i < litCandles} smoking={i >= litCandles} />
        ))}
      </group>

      {farStars.map((s, i) => (
        <mesh key={`far-${i}`} position={s.pos} ref={(el) => (farRefs.current[i] = el)}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color="#fff2df" transparent opacity={0} />
        </mesh>
      ))}
      {midParticles.map((s, i) => (
        <mesh key={`mid-${i}`} position={s.pos} ref={(el) => (midRefs.current[i] = el)}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshBasicMaterial color="#ffdca9" transparent opacity={0} />
        </mesh>
      ))}
      {meteors.map((m, i) => (
        <mesh key={`meteor-${i}`} position={m.origin} ref={(el) => (meteorRefs.current[i] = el)}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshBasicMaterial color="#fff2df" transparent opacity={0} />
        </mesh>
      ))}

      <mesh ref={(el) => (floatRefs.current[0] = el)} position={[-2.6, 2.1, -1.8]}>
        <sphereGeometry args={[0.32, 18, 18]} />
        <meshStandardMaterial color="#f6d1d1" emissive="#f6d1d1" emissiveIntensity={0.12} transparent opacity={0.72} />
      </mesh>
      <mesh ref={(el) => (floatRefs.current[1] = el)} position={[-2.2, 1.7, -1.9]}>
        <sphereGeometry args={[0.22, 18, 18]} />
        <meshStandardMaterial color="#c4a484" emissive="#c4a484" emissiveIntensity={0.08} transparent opacity={0.78} />
      </mesh>
      <mesh ref={(el) => (floatRefs.current[2] = el)} position={[2.6, 2.2, -1.7]}>
        <sphereGeometry args={[0.3, 18, 18]} />
        <meshStandardMaterial color="#ffdca9" emissive="#ffdca9" emissiveIntensity={0.1} transparent opacity={0.75} />
      </mesh>
      <mesh ref={(el) => (floatRefs.current[3] = el)} position={[2.25, 1.75, -1.8]}>
        <sphereGeometry args={[0.2, 18, 18]} />
        <meshStandardMaterial color="#f6d1d1" emissive="#f6d1d1" emissiveIntensity={0.08} transparent opacity={0.68} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color={groundColor} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -0.2]}>
        <ringGeometry args={[1.9, 2.5, 64]} />
        <meshStandardMaterial color={ringColor} />
      </mesh>

      <Fireworks active={allOut} />
    </>
  )
}

function TeddyCakeScene({ litCandles, onCakeTap, allOut, roomLightsOn }) {
  return (
    <Canvas camera={{ position: [0, 1.45, 3.8], fov: 42 }}>
      <TeddyCakeContent litCandles={litCandles} onCakeTap={onCakeTap} allOut={allOut} roomLightsOn={roomLightsOn} />
    </Canvas>
  )
}

function TeddyWavePaw() {
  const pawRef = useRef(null)
  useFrame(({ clock }) => {
    if (!pawRef.current) return
    pawRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 3.8) * 0.4 - 0.3
  })
  return (
    <group ref={pawRef} position={[0.28, 0, 0.05]}>
      <mesh position={[0.05, -0.03, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#c4a484" />
      </mesh>
    </group>
  )
}

function FallingTeddyGame({ score, setScore, done, onMiss, goal = FALL_CATCH_GOAL }) {
  const [basketX, setBasketX] = useState(50)
  const [bears, setBears] = useState([])
  const boardRef = useRef(null)
  const bearIdRef = useRef(0)
  const basketXRef = useRef(50)
  const rafRef = useRef(null)
  const spawnRef = useRef(null)
  const moveRafRef = useRef(null)
  const onMissRef = useRef(onMiss)
  onMissRef.current = onMiss

  useEffect(() => {
    if (done) return
    spawnRef.current = setInterval(() => {
      setBears((prev) => [
        ...prev,
        {
          id: bearIdRef.current++,
          x: 8 + Math.random() * 84,
          y: -8,
          speed: 0.8 + Math.random() * 0.8,
        },
      ])
    }, 850)
    return () => {
      if (spawnRef.current) clearInterval(spawnRef.current)
    }
  }, [done])

  useEffect(() => {
    if (done) return
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min(2.2, (now - last) / 16.67)
      last = now
      setBears((prev) => {
        const next = []
        let caughtNow = 0
        let missedNow = 0
        prev.forEach((bear) => {
          const ny = bear.y + bear.speed * dt
          const inCatchZone = ny > 82 && ny < 95 && Math.abs(bear.x - basketXRef.current) < 9
          if (inCatchZone) {
            caughtNow += 1
            return
          }
          if (ny <= 102) {
            next.push({ ...bear, y: ny })
          } else {
            missedNow += 1
          }
        })
        if (caughtNow > 0) {
          queueMicrotask(() => setScore((s) => s + caughtNow))
        }
        if (missedNow > 0) {
          const cb = onMissRef.current
          if (cb) queueMicrotask(() => cb(missedNow))
        }
        return next
      })
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [done, setScore])

  const updateBasket = (clientX) => {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((clientX - rect.left) / rect.width) * 100
    const next = Math.max(7, Math.min(93, x))
    basketXRef.current = next
    if (moveRafRef.current) return
    moveRafRef.current = requestAnimationFrame(() => {
      setBasketX(basketXRef.current)
      moveRafRef.current = null
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-3 inline-block rounded-full border border-teddy-base/30 bg-white/80 px-4 py-2 font-semibold text-teddy-dark">
        Score: {score} / {goal}
      </div>
      <div
        ref={boardRef}
        onMouseMove={(e) => updateBasket(e.clientX)}
        onTouchMove={(e) => updateBasket(e.touches[0].clientX)}
        className="relative h-[420px] overflow-hidden rounded-3xl border-4 border-teddy-base/40 bg-[#eaf8ff]"
      >
        {bears.map((bear) => (
          <div
            key={bear.id}
            style={{ left: `${bear.x}%`, top: `${bear.y}%`, transform: 'translate(-50%, -50%)' }}
            className="absolute select-none text-4xl"
          >
            🧸
          </div>
        ))}
        <div
          style={{ left: `${basketX}%`, transform: 'translateX(-50%)' }}
          className="absolute bottom-3 select-none text-6xl will-change-transform"
        >
          🧺
        </div>
      </div>
    </div>
  )
}

function App() {
  const [step, setStep] = useState(0)
  const [catchCount, setCatchCount] = useState(0)
  /** roaming tap target: teddy (+1) or bomb (−1 score) */
  const [game1Target, setGame1Target] = useState(() => ({ x: 50, y: 20, kind: 'teddy' }))
  const [flipCards, setFlipCards] = useState(() => reshuffleFlipCards())
  const [selected, setSelected] = useState([])
  const [fallScore, setFallScore] = useState(0)
  const [lives2, setLives2] = useState(LIVES_PER_LEVEL)
  const [lives3, setLives3] = useState(LIVES_PER_LEVEL)
  const [fallGameKey, setFallGameKey] = useState(0)
  const [typed, setTyped] = useState('')
  const [litCandles, setLitCandles] = useState(CANDLES)
  const [micReady, setMicReady] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [cakeBounce, setCakeBounce] = useState(false)
  const [fireworksReady, setFireworksReady] = useState(false)
  const [songBlocked, setSongBlocked] = useState(false)
  const [bgmOn, setBgmOn] = useState(false)
  const [bgmReady, setBgmReady] = useState(false)
  const extinguisherRef = useRef(null)
  const songPlayedRef = useRef(false)
  const bgmCtxRef = useRef(null)
  const bgmNodesRef = useRef([])

  const game1Done = catchCount >= 10
  const game2Done = flipCards.every((card) => card.matched)
  const game3Done = fallScore >= FALL_CATCH_GOAL
  const letterDone = typed.length === LETTER_TEXT.length
  const allOut = litCandles === 0
  const [roomLightsOn, setRoomLightsOn] = useState(false)

  const loseLife3 = useCallback((n = 1) => {
    const lost = Math.max(1, Math.floor(Number(n) || 1))
    setLives3((l) => {
      const next = l - lost
      if (next <= 0) {
        setFallScore(0)
        setFallGameKey((k) => k + 1)
        return LIVES_PER_LEVEL
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!allOut) setRoomLightsOn(false)
  }, [allOut])

  useEffect(() => {
    if (step !== 5) return
    let idx = 0
    const timer = setInterval(() => {
      idx += 1
      setTyped(LETTER_TEXT.slice(0, idx))
      if (idx >= LETTER_TEXT.length) clearInterval(timer)
    }, 24)
    return () => clearInterval(timer)
  }, [step])

  useEffect(() => {
    if (!allOut) {
      setFireworksReady(false)
      return
    }
    const t = setTimeout(() => setFireworksReady(true), 1200)
    return () => clearTimeout(t)
  }, [allOut])

  const playBirthdaySong = async () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    const notes = [
      [0, 0.35, 392], [0.4, 0.2, 392], [0.65, 0.55, 440], [1.25, 0.55, 392], [1.85, 0.55, 523], [2.45, 1.1, 494],
      [3.7, 0.35, 392], [4.1, 0.2, 392], [4.35, 0.55, 440], [4.95, 0.55, 392], [5.55, 0.55, 587], [6.15, 1.1, 523],
      [7.4, 0.35, 392], [7.8, 0.2, 392], [8.05, 0.55, 784], [8.65, 0.55, 659], [9.25, 0.55, 523], [9.85, 0.55, 494], [10.45, 1.1, 440],
      [11.8, 0.35, 698], [12.2, 0.2, 698], [12.45, 0.55, 659], [13.05, 0.55, 523], [13.65, 0.55, 587], [14.25, 1.3, 523],
    ]

    const master = ctx.createGain()
    master.gain.value = 0.16
    master.connect(ctx.destination)
    const now = ctx.currentTime + 0.06

    notes.forEach(([start, dur, freq]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now + start)
      osc.stop(now + start + dur + 0.05)
    })

    setTimeout(() => {
      ctx.close()
    }, 18000)
  }

  const startBgm = async () => {
    if (bgmCtxRef.current) {
      if (bgmCtxRef.current.state === 'suspended') {
        await bgmCtxRef.current.resume()
      }
      setBgmOn(true)
      setBgmReady(true)
      return
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const master = ctx.createGain()
    master.gain.value = 0.06
    master.connect(ctx.destination)

    const now = ctx.currentTime
    const loopLength = 8
    const notes = [
      [0, 1.8, 261.63],
      [2, 1.8, 329.63],
      [4, 1.8, 392.0],
      [6, 1.8, 329.63],
    ]

    notes.forEach(([start, dur, freq]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.04, now + start + 0.25)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now + start)
      osc.stop(now + loopLength + 0.1)
      bgmNodesRef.current.push(osc, gain)
    })

    const timer = setInterval(() => {
      if (!bgmCtxRef.current || bgmCtxRef.current.state !== 'running') return
      const t = bgmCtxRef.current.currentTime
      notes.forEach(([start, dur, freq]) => {
        const osc = bgmCtxRef.current.createOscillator()
        const gain = bgmCtxRef.current.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, t + start)
        gain.gain.exponentialRampToValueAtTime(0.04, t + start + 0.25)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + start + dur)
        osc.connect(gain)
        gain.connect(master)
        osc.start(t + start)
        osc.stop(t + loopLength + 0.1)
        bgmNodesRef.current.push(osc, gain)
      })
    }, loopLength * 1000)

    bgmCtxRef.current = ctx
    bgmCtxRef.current.__loopTimer = timer
    setBgmOn(true)
    setBgmReady(true)
  }

  const stopBgm = async () => {
    const ctx = bgmCtxRef.current
    if (!ctx) return
    if (ctx.__loopTimer) clearInterval(ctx.__loopTimer)
    bgmCtxRef.current = null
    bgmNodesRef.current = []
    setBgmOn(false)
    if (ctx.state !== 'closed') {
      await ctx.close()
    }
  }

  useEffect(() => {
    if (!(allOut && fireworksReady) || songPlayedRef.current) return
    playBirthdaySong()
      .then(() => {
        songPlayedRef.current = true
        setSongBlocked(false)
      })
      .catch(() => {
        setSongBlocked(true)
      })
  }, [allOut, fireworksReady])

  useEffect(() => {
    if (!micReady || step !== 4 || litCandles === 0) return
    const tick = setInterval(() => {
      setMicLevel((lvl) => {
        if (lvl > 0.5) {
          extinguishOne()
        }
        return Math.max(0, lvl - 0.06)
      })
    }, 200)
    return () => clearInterval(tick)
  }, [micReady, step, litCandles])

  const extinguishOne = () => {
    if (extinguisherRef.current) return
    extinguisherRef.current = setTimeout(() => {
      setLitCandles((v) => Math.max(0, v - 1))
      extinguisherRef.current = null
    }, 450)
  }

  const enableMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      const data = new Uint8Array(analyser.frequencyBinCount)
      source.connect(analyser)
      setMicReady(true)

      const loop = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
        setMicLevel(avg)
        if (step === 4 && litCandles > 0) requestAnimationFrame(loop)
      }
      loop()
    } catch {
      setMicReady(false)
    }
  }

  const cakeScale = cakeBounce ? 'scale-105' : 'scale-100'

  useEffect(() => {
    return () => {
      if (bgmCtxRef.current?.__loopTimer) clearInterval(bgmCtxRef.current.__loopTimer)
      if (bgmCtxRef.current && bgmCtxRef.current.state !== 'closed') {
        bgmCtxRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    if (step !== 1 || game1Done) return
    const timer = setInterval(() => {
      setGame1Target({
        x: 10 + Math.random() * 80,
        y: 12 + Math.random() * 62,
        kind: Math.random() < GAME1_BOMB_CHANCE ? 'bomb' : 'teddy',
      })
    }, 850)
    return () => clearInterval(timer)
  }, [step, game1Done])

  useEffect(() => {
    if (selected.length !== 2) return
    const [a, b] = selected
    if (flipCards[a].icon === flipCards[b].icon) {
      setFlipCards((cards) => cards.map((c, idx) => (idx === a || idx === b ? { ...c, matched: true } : c)))
      setSelected([])
      return
    }
    const timer = setTimeout(() => {
      setLives2((l) => {
        const nl = l - 1
        if (nl <= 0) {
          setFlipCards(reshuffleFlipCards())
          setSelected([])
          return LIVES_PER_LEVEL
        }
        setFlipCards((cards) => cards.map((c, idx) => (idx === a || idx === b ? { ...c, open: false } : c)))
        setSelected([])
        return nl
      })
    }, 650)
    return () => clearTimeout(timer)
  }, [selected, flipCards])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 text-center md:px-8 md:py-8">
      <header className="mb-7">
        <div className="mb-2 flex justify-end">
          <button
            onClick={async () => {
              if (bgmOn) {
                await stopBgm()
              } else {
                await startBgm()
              }
            }}
            className="warm-btn bg-white/75 px-4 py-2 text-sm text-teddy-dark hover:bg-white"
          >
            {bgmOn ? 'BGM: On' : 'BGM: Off'}
          </button>
        </div>
        <h1 className="float-soft text-3xl font-extrabold text-teddy-dark md:text-5xl">Happy Birthday Colleen!!!</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-teddy-dark/85 md:text-xl">I hope you like this gift!</p>
      </header>

      {step === 0 && (
        <section className="card pop-in mx-auto w-full max-w-3xl p-8 md:p-12">
          <h2 className="text-2xl font-bold text-teddy-dark md:text-3xl">Ready for a warm little adventure?</h2>
          <p className="mx-auto mt-4 max-w-xl text-teddy-dark/80">
            Complete 3 mini games, blow out the candles, then unlock a heartfelt letter.
          </p>
          <button
            onClick={async () => {
              if (!bgmReady) await startBgm()
              setLives2(LIVES_PER_LEVEL)
              setLives3(LIVES_PER_LEVEL)
              setCatchCount(0)
              setFlipCards(reshuffleFlipCards())
              setSelected([])
              setFallScore(0)
              setFallGameKey((k) => k + 1)
              setGame1Target({ x: 50, y: 20, kind: 'teddy' })
              setStep(1)
            }}
            className="warm-btn mt-8 bg-teddy-base text-white hover:bg-teddy-dark"
          >
            Start the Surprise
          </button>
        </section>
      )}

      {step === 1 && (
        <MiniGame
          title="Game 1: Catch Teddy"
          done={game1Done}
          onNext={() => setStep(2)}
          lives={LIVES_PER_LEVEL}
          livesMax={LIVES_PER_LEVEL}
        >
          <div className="relative mx-auto h-64 w-full max-w-xl overflow-hidden rounded-3xl border border-teddy-base/25 bg-gradient-to-b from-[#fff9ef] to-[#f3dcc3]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (game1Target.kind === 'bomb') {
                  setCatchCount((v) => Math.max(0, v - 1))
                } else {
                  setCatchCount((v) => v + 1)
                }
              }}
              style={{ left: `${game1Target.x}%`, top: `${game1Target.y}%`, transform: 'translate(-50%, -50%)' }}
              className={`absolute text-5xl transition-transform duration-200 hover:scale-110 active:scale-95 ${
                game1Target.kind === 'bomb' ? 'drop-shadow-[0_2px_2px_rgba(80,30,30,0.35)]' : ''
              }`}
              aria-label={game1Target.kind === 'bomb' ? 'Bomb' : 'Teddy'}
            >
              {game1Target.kind === 'bomb' ? '💣' : '🧸'}
            </button>
          </div>
          <p className="mt-4 text-lg font-semibold text-teddy-dark">Score: {catchCount} / 10</p>
        </MiniGame>
      )}

      {step === 2 && (
        <MiniGame
          title="Game 2: Flip & Match"
          done={game2Done}
          onNext={() => setStep(3)}
          lives={lives2}
          livesMax={LIVES_PER_LEVEL}
        >
          <div className="mx-auto grid max-w-md grid-cols-4 gap-3">
            {flipCards.map((card, i) => (
              <button
                key={card.id}
                onClick={() => {
                  if (selected.length >= 2 || card.open || card.matched) return
                  setFlipCards((cards) => cards.map((c, idx) => (idx === i ? { ...c, open: true } : c)))
                  setSelected((s) => [...s, i])
                }}
                className={`h-20 rounded-2xl border-2 text-2xl transition ${
                  card.open || card.matched ? 'border-teddy-dark bg-teddy-blush' : 'border-teddy-base/30 bg-white/80'
                }`}
              >
                {card.open || card.matched ? card.icon : '❓'}
              </button>
            ))}
          </div>
        </MiniGame>
      )}

      {step === 3 && (
        <MiniGame
          title="Game 3: Catch the Teddy Bears"
          done={game3Done}
          onNext={() => setStep(4)}
          lives={lives3}
          livesMax={LIVES_PER_LEVEL}
        >
          <FallingTeddyGame
            key={fallGameKey}
            score={fallScore}
            setScore={setFallScore}
            done={game3Done}
            onMiss={loseLife3}
            goal={FALL_CATCH_GOAL}
          />
        </MiniGame>
      )}

      {step === 4 && (
        <section className="fade-in mx-auto w-full max-w-5xl">
          <div className="card p-4 md:p-6">
            <h2 className="text-2xl font-bold text-teddy-dark">Make a Wish and blow the candles!</h2>

            <div className={`mt-5 h-[430px] w-full overflow-hidden rounded-3xl border border-teddy-base/20 bg-[#fff7ef] transition ${cakeScale}`}>
              <TeddyCakeScene
                litCandles={litCandles}
                allOut={allOut}
                roomLightsOn={roomLightsOn}
                onCakeTap={() => {
                  setCakeBounce(true)
                  setTimeout(() => setCakeBounce(false), 250)
                }}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button onClick={enableMic} className="warm-btn bg-teddy-light text-teddy-dark hover:bg-teddy-base/90">
                Enable Microphone
              </button>
              <button onClick={extinguishOne} className="warm-btn bg-teddy-dark text-white hover:opacity-90">
                Blow Candles
              </button>
              {allOut && (
                <button
                  type="button"
                  onClick={() => setRoomLightsOn((v) => !v)}
                  className="warm-btn border border-teddy-base/40 bg-teddy-cream text-teddy-dark hover:bg-teddy-light"
                >
                  {roomLightsOn ? 'Lights off' : 'Lights on'}
                </button>
              )}
              <span className="rounded-full bg-white/75 px-4 py-2 text-sm text-teddy-dark">
                Candles Left: {litCandles} | Mic Level: {micLevel.toFixed(2)}
              </span>
            </div>

            {allOut && fireworksReady && (
              <div className="pop-in mt-6">
                <p className="text-lg font-semibold text-teddy-dark">No matter what you wish for! I hope it will come true.</p>
                <button onClick={() => setStep(5)} className="warm-btn mt-4 bg-teddy-base text-white hover:bg-teddy-dark">
                  Open the Letter
                </button>
                {songBlocked && (
                  <button
                    onClick={async () => {
                      await playBirthdaySong()
                      songPlayedRef.current = true
                      setSongBlocked(false)
                    }}
                    className="warm-btn mt-4 ml-2 bg-teddy-light text-teddy-dark hover:bg-teddy-base/90"
                  >
                    Play Birthday Song
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="card fade-in mx-auto w-full max-w-3xl p-6 md:p-10">
          <h2 className="text-2xl font-bold text-teddy-dark">Happy Birthday Letter</h2>
          <article className="mx-auto mt-5 min-h-56 max-w-2xl whitespace-pre-wrap rounded-2xl bg-[#fff7e7] p-6 text-left leading-8 text-teddy-dark shadow-inner">
            {typed}
            {!letterDone && <span className="ml-1 animate-pulse">|</span>}
          </article>
          {letterDone && (
            <button onClick={() => setStep(6)} className="warm-btn mt-6 bg-teddy-base text-white hover:bg-teddy-dark">
              Celebrate Finale
            </button>
          )}
        </section>
      )}

      {step === 6 && (
        <section className="card pop-in mx-auto w-full max-w-3xl p-8 md:p-10">
          <h3 className="glow-text text-4xl font-extrabold text-[#8B5E3C] md:text-6xl">Happy Birthday</h3>
          <p className="mt-4 text-lg text-teddy-dark">Hope you are truly happy today, and for the rest of your life</p>
        </section>
      )}
    </main>
  )
}

export default App
