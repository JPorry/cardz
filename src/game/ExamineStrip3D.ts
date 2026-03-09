import * as THREE from 'three'
import type { BoardConfig } from '../config/board'

const STRIP_DEPTH = 5.1
const STRIP_CENTER_X = 0
const STRIP_CENTER_Y = 4.5
const STRIP_RENDER_ORDER_BASE = 10000
const STRIP_BACKGROUND_COLOR = 0x1b202b

type ButtonKind = 'keep' | 'shuffle'

function createRoundedRectShape(width: number, depth: number, radius: number) {
  const shape = new THREE.Shape()
  const hw = width / 2
  const hd = depth / 2
  const r = Math.min(radius, hw, hd)

  shape.moveTo(-hw + r, -hd)
  shape.lineTo(hw - r, -hd)
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r)
  shape.lineTo(hw, hd - r)
  shape.quadraticCurveTo(hw, hd, hw - r, hd)
  shape.lineTo(-hw + r, hd)
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r)
  shape.lineTo(-hw, -hd + r)
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd)

  return shape
}

function createRoundedRectPoints(width: number, depth: number, radius: number, segments = 10) {
  const hw = width / 2
  const hd = depth / 2
  const r = Math.min(radius, hw, hd)
  const points: THREE.Vector3[] = []

  for (let index = 0; index <= segments; index += 1) {
    const angle = Math.PI + (Math.PI / 2) * (index / segments)
    points.push(new THREE.Vector3(-hw + r + Math.cos(angle) * r, 0, -hd + r + Math.sin(angle) * r))
  }
  for (let index = 0; index <= segments; index += 1) {
    const angle = Math.PI * 1.5 + (Math.PI / 2) * (index / segments)
    points.push(new THREE.Vector3(hw - r + Math.cos(angle) * r, 0, -hd + r + Math.sin(angle) * r))
  }
  for (let index = 0; index <= segments; index += 1) {
    const angle = (Math.PI / 2) * (index / segments)
    points.push(new THREE.Vector3(hw - r + Math.cos(angle) * r, 0, hd - r + Math.sin(angle) * r))
  }
  for (let index = 0; index <= segments; index += 1) {
    const angle = Math.PI / 2 + (Math.PI / 2) * (index / segments)
    points.push(new THREE.Vector3(-hw + r + Math.cos(angle) * r, 0, hd - r + Math.sin(angle) * r))
  }

  return points
}

function createTextPlane(text: string, width: number, height: number, options?: {
  fontSize?: number
  fontWeight?: number
  color?: string
  background?: string
  radius?: number
  border?: string
}) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = Math.max(128, Math.round((canvas.width * height) / width))
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to create canvas context for examine strip label.')
  }

  const radius = options?.radius ?? 28
  context.clearRect(0, 0, canvas.width, canvas.height)

  if (options?.background) {
    context.fillStyle = options.background
    context.beginPath()
    context.moveTo(radius, 0)
    context.lineTo(canvas.width - radius, 0)
    context.quadraticCurveTo(canvas.width, 0, canvas.width, radius)
    context.lineTo(canvas.width, canvas.height - radius)
    context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height)
    context.lineTo(radius, canvas.height)
    context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius)
    context.lineTo(0, radius)
    context.quadraticCurveTo(0, 0, radius, 0)
    context.closePath()
    context.fill()
  }

  if (options?.border) {
    context.strokeStyle = options.border
    context.lineWidth = 8
    context.stroke()
  }

  context.font = `${options?.fontWeight ?? 600} ${options?.fontSize ?? 84}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = options?.color ?? '#f3f6ff'
  context.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.colorSpace = THREE.SRGBColorSpace

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  })
  const geometry = new THREE.PlaneGeometry(width, height)
  geometry.rotateX(-Math.PI / 2)
  return new THREE.Mesh(geometry, material)
}

export class ExamineStrip3D {
  group: THREE.Group
  private materials: THREE.Material[] = []
  private geometries: THREE.BufferGeometry[] = []
  private cardBackdropMesh: THREE.Mesh
  private titleMesh: THREE.Mesh
  private subtitleMesh: THREE.Mesh
  private keepButtonMesh: THREE.Mesh
  private shuffleButtonMesh: THREE.Mesh
  private currentTitle = 'Examine Stack'
  private shuffleEnabled = true

  constructor(boardConfig: BoardConfig) {
    const stripWidth = boardConfig.width - boardConfig.padding * 2 - 0.6
    const stripCenterZ = -boardConfig.depth / 2 - 3 + boardConfig.padding + STRIP_DEPTH / 2 + 2.85
    this.group = new THREE.Group()
    this.group.position.set(STRIP_CENTER_X, STRIP_CENTER_Y, stripCenterZ)

    const cardBackdropGeometry = new THREE.ShapeGeometry(createRoundedRectShape(stripWidth, STRIP_DEPTH, 0.6))
    cardBackdropGeometry.rotateX(-Math.PI / 2)
    this.geometries.push(cardBackdropGeometry)
    const cardBackdropMaterial = new THREE.MeshBasicMaterial({
      color: STRIP_BACKGROUND_COLOR,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      depthTest: false,
    })
    this.materials.push(cardBackdropMaterial)
    this.cardBackdropMesh = new THREE.Mesh(cardBackdropGeometry, cardBackdropMaterial)
    this.cardBackdropMesh.position.y = -0.09
    this.cardBackdropMesh.renderOrder = STRIP_RENDER_ORDER_BASE
    this.group.add(this.cardBackdropMesh)

    const borderGeometry = new THREE.BufferGeometry().setFromPoints(
      createRoundedRectPoints(stripWidth, STRIP_DEPTH, 0.6, 12),
    )
    this.geometries.push(borderGeometry)
    const borderMaterial = new THREE.LineBasicMaterial({
      color: 0xaab5c8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
    })
    this.materials.push(borderMaterial)
    const borderMesh = new THREE.LineLoop(borderGeometry, borderMaterial)
    borderMesh.position.y = -0.07
    borderMesh.renderOrder = STRIP_RENDER_ORDER_BASE + 1
    this.group.add(borderMesh)

    this.titleMesh = createTextPlane('Examine Stack', 6.8, 0.62, { fontSize: 92, fontWeight: 700 })
    this.titleMesh.position.set(0, -0.035, -STRIP_DEPTH / 2 + 0.42)
    this.titleMesh.renderOrder = STRIP_RENDER_ORDER_BASE + 2
    ;(this.titleMesh.material as THREE.MeshBasicMaterial).depthTest = false
    this.group.add(this.titleMesh)

    this.subtitleMesh = createTextPlane('0 cards', 3.2, 0.42, { fontSize: 68, color: '#d4dae8' })
    this.subtitleMesh.position.set(-stripWidth / 2 + 2.25, -0.035, -STRIP_DEPTH / 2 + 0.42)
    this.subtitleMesh.renderOrder = STRIP_RENDER_ORDER_BASE + 2
    ;(this.subtitleMesh.material as THREE.MeshBasicMaterial).depthTest = false
    this.group.add(this.subtitleMesh)

    this.keepButtonMesh = createTextPlane('Close and keep order', 4.15, 0.68, {
      fontSize: 62,
      fontWeight: 700,
      background: '#edf1fa',
      color: '#212734',
      radius: 36,
    })
    this.keepButtonMesh.position.set(stripWidth / 2 - 6.95, -0.03, -STRIP_DEPTH / 2 + 0.42)
    this.keepButtonMesh.renderOrder = STRIP_RENDER_ORDER_BASE + 3
    this.keepButtonMesh.userData = { examineButton: 'keep' satisfies ButtonKind }
    ;(this.keepButtonMesh.material as THREE.MeshBasicMaterial).depthTest = false
    this.group.add(this.keepButtonMesh)

    this.shuffleButtonMesh = createTextPlane('Close and shuffle', 3.75, 0.68, {
      fontSize: 62,
      fontWeight: 700,
      background: '#ff8a53',
      color: '#ffffff',
      radius: 36,
    })
    this.shuffleButtonMesh.position.set(stripWidth / 2 - 2.95, -0.03, -STRIP_DEPTH / 2 + 0.42)
    this.shuffleButtonMesh.renderOrder = STRIP_RENDER_ORDER_BASE + 3
    this.shuffleButtonMesh.userData = { examineButton: 'shuffle' satisfies ButtonKind }
    ;(this.shuffleButtonMesh.material as THREE.MeshBasicMaterial).depthTest = false
    this.group.add(this.shuffleButtonMesh)
    this.group.userData.stripWidth = stripWidth
  }

  get width() {
    return this.group.userData.stripWidth as number
  }

  get depth() {
    return STRIP_DEPTH
  }

  get position(): [number, number, number] {
    return [this.group.position.x, this.group.position.y, this.group.position.z]
  }

  containsPoint(worldX: number, worldZ: number) {
    const localX = worldX - this.group.position.x
    const localZ = worldZ - this.group.position.z
    return Math.abs(localX) <= this.width / 2 && Math.abs(localZ) <= STRIP_DEPTH / 2
  }

  updateCardCount(cardCount: number) {
    const nextMesh = createTextPlane(`${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`, 3.2, 0.42, {
      fontSize: 68,
      color: '#d4dae8',
    })
    nextMesh.position.copy(this.subtitleMesh.position)
    nextMesh.renderOrder = STRIP_RENDER_ORDER_BASE + 2
    ;(nextMesh.material as THREE.MeshBasicMaterial).depthTest = false
    this.group.remove(this.subtitleMesh)
    this.disposeMesh(this.subtitleMesh)
    this.subtitleMesh = nextMesh
    this.group.add(this.subtitleMesh)
  }

  setTitle(title: string) {
    if (title === this.currentTitle) return
    const nextMesh = createTextPlane(title, 6.8, 0.62, { fontSize: 92, fontWeight: 700 })
    nextMesh.position.copy(this.titleMesh.position)
    nextMesh.renderOrder = STRIP_RENDER_ORDER_BASE + 2
    ;(nextMesh.material as THREE.MeshBasicMaterial).depthTest = false
    this.group.remove(this.titleMesh)
    this.disposeMesh(this.titleMesh)
    this.titleMesh = nextMesh
    this.currentTitle = title
    this.group.add(this.titleMesh)
  }

  setShuffleEnabled(enabled: boolean) {
    if (enabled === this.shuffleEnabled) return
    this.shuffleButtonMesh.visible = enabled
    this.shuffleEnabled = enabled
  }

  getButtonMeshes() {
    return [this.keepButtonMesh, this.shuffleButtonMesh]
  }

  private disposeMesh(mesh: THREE.Mesh) {
    mesh.geometry.dispose()
    const material = mesh.material
    if (Array.isArray(material)) {
      material.forEach((entry) => {
        if ('map' in entry) {
          const texture = entry.map
          if (texture instanceof THREE.Texture) {
            texture.dispose()
          }
        }
        entry.dispose()
      })
      return
    }

    if ('map' in material) {
      const texture = material.map
      if (texture instanceof THREE.Texture) {
        texture.dispose()
      }
    }
    material.dispose()
  }

  dispose() {
    this.disposeMesh(this.titleMesh)
    this.disposeMesh(this.subtitleMesh)
    this.disposeMesh(this.keepButtonMesh)
    this.disposeMesh(this.shuffleButtonMesh)
    this.materials.forEach((material) => material.dispose())
    this.geometries.forEach((geometry) => geometry.dispose())
  }
}
