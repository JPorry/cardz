import * as THREE from 'three';
import type { CardState } from '../store';

const CARD_WIDTH = 1.0;
const CARD_HEIGHT = 1.45;
const CARD_THICKNESS = 0.02;

export class Card3D {
  id: string;
  group: THREE.Group;
  
  targetPosition: THREE.Vector3;
  targetQuaternion: THREE.Quaternion;
  targetScale: THREE.Vector3;
  
  isDragging: boolean = false;
  ghostGroup: THREE.Group;
  ghostTargetOpacity: number = 0;

  frontMesh?: THREE.Mesh;
  frontMat?: THREE.MeshStandardMaterial;
  currentArtworkUrl?: string;

  constructor(cardData: CardState) {
    this.id = cardData.id;
    this.group = new THREE.Group();
    
    // Ghost mesh setup for showing drops
    this.ghostGroup = new THREE.Group();
    this.ghostGroup.position.set(0, -10, 0);
    this.ghostGroup.rotation.set(-Math.PI / 2, 0, 0);
    
    this.targetPosition = new THREE.Vector3();
    this.targetQuaternion = new THREE.Quaternion();
    this.targetScale = new THREE.Vector3(1, 1, 1);
    
    this.setupMeshes();
    this.setupGhostMeshes();
    
    // Initial State Setup
    if (cardData.location === 'table') {
      this.targetPosition.set(cardData.position[0], CARD_THICKNESS / 2, cardData.position[2]);
      this.targetScale.set(1, 1, 1);
      const rotX = cardData.faceUp ? -Math.PI / 2 : Math.PI / 2;
      this.targetQuaternion.setFromEuler(new THREE.Euler(rotX, cardData.rotation[1], cardData.rotation[2]));
    } else {
      this.targetPosition.set(0, -10, 0);
      this.targetScale.set(0.375, 0.375, 0.375);
      this.targetQuaternion.setFromEuler(new THREE.Euler(-Math.PI / 4, 0, 0));
    }
    
    // Snap to initial positions immediately
    this.group.position.copy(this.targetPosition);
    this.group.quaternion.copy(this.targetQuaternion);
    this.group.scale.copy(this.targetScale);
    
    // Custom user data for raycasting identification
    this.group.userData = { cardId: this.id, isCard: true };
    this.group.children.forEach(c => c.userData = this.group.userData);
  }

  private createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;
    shape.moveTo(x, y + radius);
    shape.lineTo(x, y + height - radius);
    shape.quadraticCurveTo(x, y + height, x + radius, y + height);
    shape.lineTo(x + width - radius, y + height);
    shape.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
    shape.lineTo(x + width, y + radius);
    shape.quadraticCurveTo(x + width, y, x + width - radius, y);
    shape.lineTo(x + radius, y);
    shape.quadraticCurveTo(x, y, x, y + radius);
    return shape;
  }

  private setupMeshes() {
    const cardShape = this.createRoundedRectShape(CARD_WIDTH, CARD_HEIGHT, 0.1);
    
    // Main extruded body
    const extrudeSettings = {
      steps: 1,
      depth: CARD_THICKNESS,
      bevelEnabled: false
    };
    const centerGeometry = new THREE.ExtrudeGeometry(cardShape, extrudeSettings);
    centerGeometry.translate(0, 0, -CARD_THICKNESS / 2); // Center on Z

    const centerMat = new THREE.MeshStandardMaterial({ color: 0x222222, transparent: true, opacity: 1 });
    const centerMesh = new THREE.Mesh(centerGeometry, centerMat);
    centerMesh.castShadow = true;
    centerMesh.receiveShadow = true;
    this.group.add(centerMesh);

    // Front face
    const faceShape = this.createRoundedRectShape(CARD_WIDTH * 0.95, CARD_HEIGHT * 0.95, 0.08);
    const faceGeometry = new THREE.ShapeGeometry(faceShape);
    
    this.frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    this.frontMesh = new THREE.Mesh(faceGeometry, this.frontMat);
    this.frontMesh.position.set(0, 0, CARD_THICKNESS / 2 + 0.001);
    
    // Manually fix UVs for the face geometry to ensure they are [0, 1]
    const pos = faceGeometry.attributes.position;
    const uv = faceGeometry.attributes.uv;
    const w = CARD_WIDTH * 0.95;
    const h = CARD_HEIGHT * 0.95;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      uv.setXY(i, (x + w / 2) / w, (y + h / 2) / h);
    }
    uv.needsUpdate = true;

    this.group.add(this.frontMesh);

    // Back face
    const backMat = new THREE.MeshStandardMaterial({ color: 0xb20000, transparent: true, opacity: 1 });
    const backMesh = new THREE.Mesh(faceGeometry, backMat);
    backMesh.position.set(0, 0, -CARD_THICKNESS / 2 - 0.001);
    backMesh.rotation.set(0, Math.PI, 0);
    this.group.add(backMesh);
  }

  refreshArtwork(artworkUrl?: string) {
    if (!artworkUrl || artworkUrl === this.currentArtworkUrl) return;
    this.currentArtworkUrl = artworkUrl;

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(artworkUrl, (texture) => {
      if (this.frontMat) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 4;
        this.frontMat.map = texture;
        this.frontMat.color.set(0xffffff); // Ensure it's white to show texture clearly
        this.frontMat.needsUpdate = true;
      }
    });
  }

  private setupGhostMeshes() {
    const cardShape = this.createRoundedRectShape(CARD_WIDTH, CARD_HEIGHT, 0.1);
    const extrudeSettings = { steps: 1, depth: CARD_THICKNESS, bevelEnabled: false };
    const centerGeometry = new THREE.ExtrudeGeometry(cardShape, extrudeSettings);
    centerGeometry.translate(0, 0, -CARD_THICKNESS / 2);
    
    const centerMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0, depthWrite: false });
    const centerMesh = new THREE.Mesh(centerGeometry, centerMat);
    this.ghostGroup.add(centerMesh);

    const faceShape = this.createRoundedRectShape(CARD_WIDTH * 0.95, CARD_HEIGHT * 0.95, 0.08);
    const faceGeometry = new THREE.ShapeGeometry(faceShape);
    
    const frontMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const frontMesh = new THREE.Mesh(faceGeometry, frontMat);
    frontMesh.position.set(0, 0, CARD_THICKNESS / 2 + 0.001);
    this.ghostGroup.add(frontMesh);

    const backMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const backMesh = new THREE.Mesh(faceGeometry, backMat);
    backMesh.position.set(0, 0, -CARD_THICKNESS / 2 - 0.001);
    backMesh.rotation.set(0, Math.PI, 0);
    this.ghostGroup.add(backMesh);
  }
  
  setGhostColor(colorHex: number) {
    this.ghostGroup.children.forEach((child: any) => {
      if (child.material && child.material.color) {
        child.material.color.setHex(colorHex);
      }
    });
  }
  
  setGhostOpacity(opacity: number) {
    this.ghostTargetOpacity = opacity;
    // Fast path: if opacity is 0, just hide it completely until it fades back in
    if (opacity === 0) {
        this.ghostGroup.visible = false;
    } else {
        this.ghostGroup.visible = true;
    }
  }
  
  setGhostPosition(x: number, y: number, z: number) {
    this.ghostGroup.position.set(x, y, z);
  }

  setCastShadow(cast: boolean) {
    this.group.children.forEach(c => {
      c.castShadow = cast;
    });
  }

  update(delta: number) {
    // Smooth lerping for the ghost UI opacity
    this.ghostGroup.children.forEach((mesh: any) => {
      if (mesh.material) {
        mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, this.ghostTargetOpacity, 15 * delta);
      }
    });

    if (this.isDragging) return;

    // Simulate spring-like damping with lerp/slerp
    const tension = 15;
    this.group.position.lerp(this.targetPosition, tension * delta);
    this.group.quaternion.slerp(this.targetQuaternion, tension * delta);
    this.group.scale.lerp(this.targetScale, tension * delta);
  }

  updateTransform() {
    this.group.position.copy(this.targetPosition);
    this.group.quaternion.copy(this.targetQuaternion);
    this.group.scale.copy(this.targetScale);
  }
}
