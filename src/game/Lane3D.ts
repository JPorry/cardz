import * as THREE from 'three';
import type { LaneState } from '../store';
import { getAreaTitleTransform, LANE_TITLE_LAYOUT } from '../utils/areaLayout';

function createRoundedRectShape(width: number, depth: number, radius: number) {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(radius, hw, hd);

  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  return shape;
}

function createRoundedRectPoints(width: number, depth: number, radius: number, segments = 8) {
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(radius, hw, hd);
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const angle = Math.PI + (Math.PI / 2) * (i / segments);
    points.push(new THREE.Vector3(-hw + r + Math.cos(angle) * r, 0, -hd + r + Math.sin(angle) * r));
  }
  for (let i = 0; i <= segments; i += 1) {
    const angle = Math.PI * 1.5 + (Math.PI / 2) * (i / segments);
    points.push(new THREE.Vector3(hw - r + Math.cos(angle) * r, 0, -hd + r + Math.sin(angle) * r));
  }
  for (let i = 0; i <= segments; i += 1) {
    const angle = (Math.PI / 2) * (i / segments);
    points.push(new THREE.Vector3(hw - r + Math.cos(angle) * r, 0, hd - r + Math.sin(angle) * r));
  }
  for (let i = 0; i <= segments; i += 1) {
    const angle = Math.PI / 2 + (Math.PI / 2) * (i / segments);
    points.push(new THREE.Vector3(-hw + r + Math.cos(angle) * r, 0, hd - r + Math.sin(angle) * r));
  }

  return points;
}

export class Lane3D {
  id: string;
  group: THREE.Group;
  borderMesh: THREE.LineLoop;
  glowBorderMesh: THREE.LineLoop;
  fillMesh: THREE.Mesh;
  highlightMesh: THREE.Mesh;
  labelMesh: THREE.Mesh;
  fillMaterial: THREE.MeshPhysicalMaterial;
  highlightMaterial: THREE.MeshBasicMaterial;
  borderMaterial: THREE.LineBasicMaterial;
  glowBorderMaterial: THREE.LineBasicMaterial;

  private isHighlighted = false;

  constructor(lane: LaneState) {
    this.id = lane.id;
    this.group = new THREE.Group();
    this.group.position.set(lane.position[0], 0.005, lane.position[2]);

    const panelShape = createRoundedRectShape(lane.width, lane.depth, 0.6);
    const points = createRoundedRectPoints(lane.width, lane.depth, 0.6, 10);

    const fillGeometry = new THREE.ShapeGeometry(panelShape);
    fillGeometry.rotateX(-Math.PI / 2);
    this.fillMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x374052,
      transparent: true,
      opacity: 0.08,
      transmission: 0.45,
      roughness: 0.08,
      metalness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      thickness: 0.45,
      depthWrite: false,
    });
    this.fillMesh = new THREE.Mesh(fillGeometry, this.fillMaterial);
    this.fillMesh.position.y = -0.001;
    this.fillMesh.renderOrder = 0;
    this.group.add(this.fillMesh);

    const highlightGeometry = new THREE.ShapeGeometry(createRoundedRectShape(lane.width - 0.08, lane.depth - 0.08, 0.56));
    highlightGeometry.rotateX(-Math.PI / 2);
    this.highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
    });
    this.highlightMesh = new THREE.Mesh(highlightGeometry, this.highlightMaterial);
    this.highlightMesh.position.y = 0.002;
    this.highlightMesh.renderOrder = 1;
    this.group.add(this.highlightMesh);

    const borderGeometry = new THREE.BufferGeometry().setFromPoints(points);
    this.borderMaterial = new THREE.LineBasicMaterial({
      color: 0x8f98ab,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });
    this.borderMesh = new THREE.LineLoop(borderGeometry, this.borderMaterial);
    this.borderMesh.position.y = 0.003;
    this.borderMesh.renderOrder = 5;
    this.group.add(this.borderMesh);

    this.glowBorderMaterial = new THREE.LineBasicMaterial({
      color: 0xff6f3c,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    this.glowBorderMesh = new THREE.LineLoop(borderGeometry.clone(), this.glowBorderMaterial);
    this.glowBorderMesh.position.y = 0.004;
    this.glowBorderMesh.renderOrder = 4;
    this.group.add(this.glowBorderMesh);

    this.labelMesh = this.createLabelMesh(lane.label);
    const titleTransform = getAreaTitleTransform(
      lane.label,
      lane.width,
      lane.depth,
      LANE_TITLE_LAYOUT,
      lane.titlePosition,
    );
    this.labelMesh.position.set(titleTransform.x, 0.005, titleTransform.z);
    this.labelMesh.rotation.y = titleTransform.rotationY;
    this.labelMesh.renderOrder = 2;
    this.group.add(this.labelMesh);
  }

  private createLabelMesh(text: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    const canvasWidth = LANE_TITLE_LAYOUT.canvasWidth;
    const canvasHeight = LANE_TITLE_LAYOUT.canvasHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fontSize = LANE_TITLE_LAYOUT.baseFontSize;
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    if (metrics.width > canvasWidth * LANE_TITLE_LAYOUT.maxWidthRatio) {
      const scale = (canvasWidth * LANE_TITLE_LAYOUT.maxWidthRatio) / metrics.width;
      ctx.font = `600 ${fontSize * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 1)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide,
    });

    const worldWidth = LANE_TITLE_LAYOUT.worldWidth;
    const worldHeight = worldWidth * (canvasHeight / canvasWidth);
    const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
    geometry.rotateX(-Math.PI / 2);

    return new THREE.Mesh(geometry, material);
  }

  setHighlighted(highlighted: boolean) {
    this.isHighlighted = highlighted;
    this.highlightMaterial.opacity = highlighted ? 0.08 : 0;
  }

  update(delta: number) {
    void delta;
    if (!this.isHighlighted) return;
  }

  containsPoint(worldX: number, worldZ: number, lane: LaneState): boolean {
    const lx = worldX - lane.position[0];
    const lz = worldZ - lane.position[2];
    return Math.abs(lx) <= lane.width / 2 && Math.abs(lz) <= lane.depth / 2;
  }

  dispose() {
    this.borderMesh.geometry.dispose();
    this.glowBorderMesh.geometry.dispose();
    this.fillMesh.geometry.dispose();
    this.highlightMesh.geometry.dispose();
    this.labelMesh.geometry.dispose();
    (this.labelMesh.material as THREE.MeshBasicMaterial).map?.dispose();

    this.borderMaterial.dispose();
    this.glowBorderMaterial.dispose();
    this.fillMaterial.dispose();
    this.highlightMaterial.dispose();
    (this.labelMesh.material as THREE.Material).dispose();
  }
}
