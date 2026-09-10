'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface Location {
  lat: number
  lng: number
  count: number
  city: string
  country: string
}

const CITIES: Location[] = [
  { lat: 19.0760, lng: 72.8777, count: 312, city: 'Mumbai', country: 'IN' },
  { lat: 40.7128, lng: -74.0060, count: 234, city: 'New York', country: 'US' },
  { lat: 28.6139, lng: 77.2090, count: 178, city: 'Delhi', country: 'IN' },
  { lat: 51.5074, lng: -0.1278, count: 187, city: 'London', country: 'GB' },
  { lat: 35.6762, lng: 139.6503, count: 156, city: 'Tokyo', country: 'JP' },
  { lat: 48.8566, lng: 2.3522, count: 143, city: 'Paris', country: 'FR' },
  { lat: -23.5505, lng: -46.6333, count: 89, city: 'São Paulo', country: 'BR' },
  { lat: -33.8688, lng: 151.2093, count: 87, city: 'Sydney', country: 'AU' },
  { lat: 1.3521, lng: 103.8198, count: 76, city: 'Singapore', country: 'SG' },
  { lat: 34.0522, lng: -118.2437, count: 201, city: 'Los Angeles', country: 'US' },
  { lat: 31.2304, lng: 121.4737, count: 134, city: 'Shanghai', country: 'CN' },
  { lat: 25.2048, lng: 55.2708, count: 94, city: 'Dubai', country: 'AE' },
]

export function Globe({ size = 300 }: { size?: number }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<any>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    camera.position.z = 240

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    // 2. Lighting Setup (Sunlight + Ambient)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.8)
    sunLight.position.set(200, 100, 150)
    scene.add(sunLight)

    const backLight = new THREE.DirectionalLight(0x38bdf8, 0.6)
    backLight.position.set(-200, -100, -150)
    scene.add(backLight)

    // 3. Globe Base Sphere & Texture Loader
    const textureLoader = new THREE.TextureLoader()

    // NASA Satellite Earth Blue Marble Texture Maps
    const earthDayTexture = textureLoader.load(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
    )
    const earthNightTexture = textureLoader.load(
      'https://unpkg.com/three-globe/example/img/earth-night.jpg'
    )
    const earthTopologyTexture = textureLoader.load(
      'https://unpkg.com/three-globe/example/img/earth-topology.png'
    )
    const cloudsTexture = textureLoader.load(
      'https://unpkg.com/three-globe/example/img/earth-clouds.png'
    )

    // Earth Sphere Mesh
    const earthRadius = 75
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64)
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthDayTexture,
      bumpMap: earthTopologyTexture,
      bumpScale: 1.2,
      specular: new THREE.Color(0x222222),
      shininess: 15,
    })
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial)
    scene.add(earthMesh)

    // 4. Outer Atmosphere Cloud Layer Mesh
    const cloudGeometry = new THREE.SphereGeometry(earthRadius + 1.2, 64, 64)
    const cloudMaterial = new THREE.MeshPhongMaterial({
      map: cloudsTexture,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    })
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial)
    scene.add(cloudMesh)

    // 5. Atmospheric Halo Rim Mesh
    const atmosphereGeometry = new THREE.SphereGeometry(earthRadius + 3.5, 64, 64)
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
    })
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
    scene.add(atmosphereMesh)

    // 6. City Telemetry Markers (3D Glowing Beacons)
    const cityGroup = new THREE.Group()

    function latLngToVector3(lat: number, lng: number, radius: number) {
      const phi = (90 - lat) * (Math.PI / 180)
      const theta = (lng + 180) * (Math.PI / 180)
      const x = -(radius * Math.sin(phi) * Math.cos(theta))
      const z = radius * Math.sin(phi) * Math.sin(theta)
      const y = radius * Math.cos(phi)
      return new THREE.Vector3(x, y, z)
    }

    CITIES.forEach((city, index) => {
      const pos = latLngToVector3(city.lat, city.lng, earthRadius + 0.5)

      // Beacon Dot
      const markerGeo = new THREE.SphereGeometry(1.6, 16, 16)
      const markerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      const markerMesh = new THREE.Mesh(markerGeo, markerMat)
      markerMesh.position.copy(pos)
      markerMesh.userData = { index, city }
      cityGroup.add(markerMesh)

      // Glow Ring
      const ringGeo = new THREE.RingGeometry(2.0, 3.2, 32)
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      })
      const ringMesh = new THREE.Mesh(ringGeo, ringMat)
      ringMesh.position.copy(pos)
      ringMesh.lookAt(new THREE.Vector3(0, 0, 0))
      cityGroup.add(ringMesh)
    })

    earthMesh.add(cityGroup)

    // 7. Interactive Drag-to-Rotate Control Logic
    let isMouseDown = false
    let mouseX = 0
    let mouseY = 0
    let targetRotationX = 0
    let targetRotationY = 0

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const onMouseUp = () => {
      isMouseDown = false
    }

    const onMouseMove = (e: MouseEvent) => {
      if (isMouseDown) {
        const deltaX = e.clientX - mouseX
        const deltaY = e.clientY - mouseY
        targetRotationY += deltaX * 0.005
        targetRotationX += deltaY * 0.005
        mouseX = e.clientX
        mouseY = e.clientY
      }
    }

    const domElement = renderer.domElement
    domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)

    // 8. Animation Loop
    let animId: number

    function animate() {
      animId = requestAnimationFrame(animate)

      // Smooth Rotation
      if (!isMouseDown) {
        earthMesh.rotation.y += 0.002
      } else {
        earthMesh.rotation.y += (targetRotationY - earthMesh.rotation.y) * 0.1
        earthMesh.rotation.x += (targetRotationX - earthMesh.rotation.x) * 0.1
      }

      // Cloud Drifting
      cloudMesh.rotation.y += 0.0028

      renderer.render(scene, camera)
    }

    animate()

    // Clean up
    return () => {
      cancelAnimationFrame(animId)
      domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [size])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div ref={mountRef} style={{ width: size, height: size, cursor: 'grab' }} />
    </div>
  )
}
