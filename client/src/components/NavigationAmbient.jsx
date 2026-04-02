import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/* Soft neutral specks — matches gray bases; brand color is in the UI chrome */
const COLORS = { dark: 0x80868b, light: 0x9aa0a6 }

/**
 * Subtle full-screen particle field; pulses when `motionEpoch` changes (folder / tab navigation).
 */
export default function NavigationAmbient({ theme, motionEpoch }) {
  const mountRef = useRef(null)
  const epochRef = useRef(motionEpoch)
  const themeRef = useRef(theme)
  epochRef.current = motionEpoch
  themeRef.current = theme

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 60)
    camera.position.z = 5.2

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    const canvas = renderer.domElement
    canvas.style.cssText = 'display:block;width:100%;height:100%'
    mount.appendChild(canvas)

    const count = 260
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      positions[i3] = (Math.random() - 0.5) * 16
      positions[i3 + 1] = (Math.random() - 0.5) * 11
      positions[i3 + 2] = (Math.random() - 0.5) * 7
      velocities[i3] = (Math.random() - 0.5) * 0.014
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.014
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.01
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      size: 0.048,
      color: COLORS[themeRef.current === 'light' ? 'light' : 'dark'],
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    let lastEpoch = epochRef.current
    let pulse = 0
    let rafId = 0
    const clock = new THREE.Clock()

    function resize() {
      const w = mount.clientWidth || 2
      const h = mount.clientHeight || 2
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    function animate() {
      rafId = requestAnimationFrame(animate)
      const e = epochRef.current
      if (e !== lastEpoch) {
        lastEpoch = e
        pulse = 1
      }

      const t = clock.getElapsedTime()
      material.color.setHex(COLORS[themeRef.current === 'light' ? 'light' : 'dark'])

      pulse *= 0.93
      if (pulse < 0.015) pulse = 0

      const pos = geometry.attributes.position.array
      const boost = 1 + pulse * 10
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        pos[i3] += velocities[i3] * boost
        pos[i3 + 1] += velocities[i3 + 1] * boost
        pos[i3 + 2] += velocities[i3 + 2] * boost * 0.85
        if (Math.abs(pos[i3]) > 8) velocities[i3] *= -1
        if (Math.abs(pos[i3 + 1]) > 5.5) velocities[i3 + 1] *= -1
        if (Math.abs(pos[i3 + 2]) > 4) velocities[i3 + 2] *= -1
      }
      geometry.attributes.position.needsUpdate = true

      points.rotation.y = t * 0.038 + pulse * 0.2
      points.rotation.x = Math.sin(t * 0.1) * 0.07 + pulse * 0.09
      material.opacity = 0.12 + pulse * 0.38

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      mount.removeChild(canvas)
    }
  }, [])

  return <div ref={mountRef} className="navigation-ambient" aria-hidden="true" />
}
