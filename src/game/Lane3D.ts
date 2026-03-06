import * as THREE from 'three';
import type { LaneState } from '../store';
import { LANE_TITLE_LAYOUT } from '../utils/areaLayout';

export class Lane3D {
  id: string;
  group: THREE.Group;
  borderMesh: THREE.LineLoop;
  fillMesh: THREE.Mesh;
  labelMesh: THREE.Mesh;
  fillMaterial: THREE.MeshBasicMaterial;
  borderMaterial: THREE.LineBasicMaterial;

  private _isHighlighted: boolean = false;
  private _highlightPulse: number = 0;

  constructor(lane: LaneState) {
    this.id = lane.id;
    this.group = new THREE.Group();
    this.group.position.set(lane.position[0], 0.005, lane.position[2]);

    const hw = lane.width / 2;
    const hd = lane.depth / 2;
    const cornerRadius = 0.6;
    const segments = 8;

    // Build rounded rectangle points
    const points: THREE.Vector3[] = [];

    // Bottom-left to bottom-right
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI + Math.PI / 2 * (i / segments);
      points.push(new THREE.Vector3(
        -hw + cornerRadius + Math.cos(angle) * cornerRadius,
        0,
        -hd + cornerRadius + Math.sin(angle) * cornerRadius
      ));
    }
    // Bottom-right to top-right
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI * 1.5 + Math.PI / 2 * (i / segments);
      points.push(new THREE.Vector3(
        hw - cornerRadius + Math.cos(angle) * cornerRadius,
        0,
        -hd + cornerRadius + Math.sin(angle) * cornerRadius
      ));
    }
    // Top-right to top-left
    for (let i = 0; i <= segments; i++) {
      const angle = 0 + Math.PI / 2 * (i / segments);
      points.push(new THREE.Vector3(
        hw - cornerRadius + Math.cos(angle) * cornerRadius,
        0,
        hd - cornerRadius + Math.sin(angle) * cornerRadius
      ));
    }
    // Top-left to bottom-left
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI / 2 + Math.PI / 2 * (i / segments);
      points.push(new THREE.Vector3(
        -hw + cornerRadius + Math.cos(angle) * cornerRadius,
        0,
        hd - cornerRadius + Math.sin(angle) * cornerRadius
      ));
    }

    // Border outline
    const borderGeometry = new THREE.BufferGeometry().setFromPoints(points);
    this.borderMaterial = new THREE.LineBasicMaterial({
      color: 0x99ccff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this.borderMesh = new THREE.LineLoop(borderGeometry, this.borderMaterial);
    this.group.add(this.borderMesh);

    // Semi-transparent fill
    const fillShape = new THREE.Shape();
    fillShape.moveTo(points[0].x, points[0].z);
    for (let i = 1; i < points.length; i++) {
      fillShape.lineTo(points[i].x, points[i].z);
    }
    fillShape.closePath();

    const fillGeometry = new THREE.ShapeGeometry(fillShape);
    fillGeometry.rotateX(-Math.PI / 2); // Lay flat on XZ plane

    this.fillMaterial = new THREE.MeshBasicMaterial({
      color: 0x4488cc,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.fillMesh = new THREE.Mesh(fillGeometry, this.fillMaterial);
    this.fillMesh.position.y = -0.001; // Slightly below border to avoid z-fighting
    this.group.add(this.fillMesh);

    // Label mesh (flat on surface)
    this.labelMesh = this.createLabelMesh(lane.label);
    // Position the label inside the top edge of the lane
    this.labelMesh.position.set(0, 0.005, -hd + LANE_TITLE_LAYOUT.labelCenterOffset);
    this.group.add(this.labelMesh);
  }

  private createLabelMesh(text: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    // Using higher resolution for sharper text
    const canvasWidth = LANE_TITLE_LAYOUT.canvasWidth;
    const canvasHeight = LANE_TITLE_LAYOUT.canvasHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Modern typography
    const fontSize = LANE_TITLE_LAYOUT.baseFontSize;
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Measure text
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    
    // Auto-scale font if it would overflow horizontally
    if (textWidth > canvasWidth * LANE_TITLE_LAYOUT.maxWidthRatio) {
      const scale = (canvasWidth * LANE_TITLE_LAYOUT.maxWidthRatio) / textWidth;
      ctx.font = `600 ${fontSize * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    }

    // Heavy shadow for maximum contrast
    ctx.shadowColor = 'rgba(0, 0, 0, 1.0)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
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
      side: THREE.FrontSide
    });

    const worldWidth = LANE_TITLE_LAYOUT.worldWidth;
    const worldHeight = worldWidth * (canvasHeight / canvasWidth);
    const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
    geometry.rotateX(-Math.PI / 2); // Lay flat

    return new THREE.Mesh(geometry, material);
  }

  setHighlighted(highlighted: boolean) {
    this._isHighlighted = highlighted;
    if (!highlighted) {
      // Reset to default appearance
      this.borderMaterial.opacity = 0.6;
      this.borderMaterial.color.setHex(0x99ccff);
      this.fillMaterial.opacity = 0.1;
      this.fillMaterial.color.setHex(0x4488cc);
    }
  }

  update(_delta: number) {
    if (this._isHighlighted) {
      this._highlightPulse += _delta * 3;
      const pulse = 0.5 + Math.sin(this._highlightPulse) * 0.2;

      this.borderMaterial.opacity = 0.5 + pulse * 0.4;
      this.borderMaterial.color.setHex(0x66ccff);
      this.fillMaterial.opacity = 0.08 + pulse * 0.06;
      this.fillMaterial.color.setHex(0x66ccff);
    }
  }

  containsPoint(worldX: number, worldZ: number, lane: LaneState): boolean {
    const lx = worldX - lane.position[0];
    const lz = worldZ - lane.position[2];
    return Math.abs(lx) <= lane.width / 2 && Math.abs(lz) <= lane.depth / 2;
  }

  dispose() {
    this.borderMesh.geometry.dispose();
    (this.borderMesh.material as THREE.Material).dispose();
    this.fillMesh.geometry.dispose();
    (this.fillMesh.material as THREE.Material).dispose();
    this.labelMesh.geometry.dispose();
    (this.labelMesh.material as THREE.MeshBasicMaterial).map?.dispose();
    (this.labelMesh.material as THREE.Material).dispose();
  }
}
