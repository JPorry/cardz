import * as THREE from 'three';
import type { CardState } from '../store';
import { getCardTableEuler } from '../utils/cardOrientation';

const CARD_WIDTH = 1.44;
const CARD_HEIGHT = 2.09;
const CARD_THICKNESS = 0.025;

export class Card3D {
  id: string;
  group: THREE.Group;
  
  targetPosition: THREE.Vector3;
  targetQuaternion: THREE.Quaternion;
  targetScale: THREE.Vector3;
  
  basePosition: THREE.Vector3;
  
  isDragging: boolean = false;
  ghostGroup: THREE.Group;
  ghostTargetOpacity: number = 0;
  selectionMesh: THREE.Mesh;
  selectionMaterial: THREE.MeshBasicMaterial;

  frontMesh?: THREE.Mesh;
  frontMat?: THREE.MeshStandardMaterial;
  backMesh?: THREE.Mesh;
  backMat?: THREE.MeshStandardMaterial;
  currentArtworkUrl?: string;
  currentBackArtworkUrl?: string;
  currentArtworkRotation: number = 0;
  currentBackArtworkRotation: number = 0;

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
    this.basePosition = new THREE.Vector3();
    
    this.setupMeshes();
    this.setupGhostMeshes();
    this.selectionMesh = this.createSelectionMesh()
    this.selectionMaterial = this.selectionMesh.material as THREE.MeshBasicMaterial
    this.group.add(this.selectionMesh)
    
    // Initial State Setup
    if (cardData.location === 'table') {
      this.targetPosition.set(cardData.position[0], CARD_THICKNESS / 2, cardData.position[2]);
      this.targetScale.set(1, 1, 1);
      this.targetQuaternion.setFromEuler(getCardTableEuler(cardData));
    } else {
      this.targetPosition.set(0, -10, 0);
      this.targetScale.set(0.3, 0.3, 0.3); // 0.375 / 1.25
      this.targetQuaternion.setFromEuler(new THREE.Euler(-Math.PI / 4, 0, 0));
    }
    
    // Snap to initial positions immediately
    this.basePosition.copy(this.targetPosition);
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

    const centerMat = new THREE.MeshStandardMaterial({ color: 0x222222, transparent: false, opacity: 1 });
    const centerMesh = new THREE.Mesh(centerGeometry, centerMat);
    centerMesh.castShadow = true;
    centerMesh.receiveShadow = true;
    this.group.add(centerMesh);

    // Front face
    const faceShape = this.createRoundedRectShape(CARD_WIDTH * 0.95, CARD_HEIGHT * 0.95, 0.08);
    const faceGeometry = new THREE.ShapeGeometry(faceShape);
    
    this.frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: false, opacity: 1 });
    this.frontMesh = new THREE.Mesh(faceGeometry, this.frontMat);
    this.frontMesh.position.set(0, 0, CARD_THICKNESS / 2 + 0.005);
    
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
    this.backMat = new THREE.MeshStandardMaterial({ color: 0xb20000, transparent: false, opacity: 1 });
    this.backMesh = new THREE.Mesh(faceGeometry, this.backMat);
    this.backMesh.position.set(0, 0, -CARD_THICKNESS / 2 - 0.005);
    this.backMesh.rotation.set(0, Math.PI, 0);
    this.group.add(this.backMesh);
  }

  refreshArtwork(artworkUrl?: string, backArtworkUrl?: string) {
    if (artworkUrl && artworkUrl !== this.currentArtworkUrl) {
      this.currentArtworkUrl = artworkUrl;
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(artworkUrl, (texture) => {
        if (this.frontMat) {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = 4;
          this.currentArtworkRotation = this.getTextureRotation(texture, false);
          this.applyTextureRotation(texture, this.currentArtworkRotation);
          this.frontMat.map = texture;
          this.frontMat.color.set(0xffffff); // Ensure it's white to show texture clearly
          this.frontMat.needsUpdate = true;
        }
      });
    }

    if (backArtworkUrl && backArtworkUrl !== this.currentBackArtworkUrl) {
      this.currentBackArtworkUrl = backArtworkUrl;
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(backArtworkUrl, (texture) => {
        if (this.backMat) {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = 4;
          this.currentBackArtworkRotation = this.getTextureRotation(texture, true);
          this.applyTextureRotation(texture, this.currentBackArtworkRotation);
          this.backMat.map = texture;
          this.backMat.color.set(0xffffff); // Ensure it's white to show texture clearly
          this.backMat.needsUpdate = true;
        }
      });
    }
  }

  private applyTextureRotation(texture: THREE.Texture, rotation: number) {
    texture.center.set(0.5, 0.5);
    texture.rotation = rotation;
    texture.needsUpdate = true;
  }

  private getTextureRotation(texture: THREE.Texture, isBack: boolean) {
    const image = texture.image as { width?: number, height?: number } | undefined;
    if (!image?.width || !image?.height) {
      return isBack ? this.currentBackArtworkRotation : this.currentArtworkRotation;
    }

    const isLandscape = image.width > image.height;
    if (!isLandscape) {
      return 0;
    }

    return isBack ? Math.PI / 2 : -Math.PI / 2;
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

  private createSelectionMesh() {
    const selectionShape = this.createRoundedRectShape(CARD_WIDTH * 1.08, CARD_HEIGHT * 1.08, 0.14)
    const selectionGeometry = new THREE.ShapeGeometry(selectionShape)
    const selectionMaterial = new THREE.MeshBasicMaterial({
      color: 0x5aa8ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const selectionMesh = new THREE.Mesh(selectionGeometry, selectionMaterial)
    selectionMesh.position.set(0, 0, CARD_THICKNESS / 2 + 0.003)
    selectionMesh.renderOrder = 5
    selectionMesh.visible = false
    return selectionMesh
  }

  setSelected(selected: boolean, stackSelected = false) {
    this.selectionMesh.visible = selected
    this.selectionMaterial.opacity = selected ? (stackSelected ? 0.42 : 0.34) : 0
    this.selectionMaterial.color.setHex(stackSelected ? 0x73b8ff : 0x4a90ff)
    this.selectionMesh.scale.set(stackSelected ? 1.06 : 1, stackSelected ? 1.06 : 1, 1)
  }
  
  setGhostColor(colorHex: number) {
    this.ghostGroup.children.forEach((child) => {
      const material = child instanceof THREE.Mesh ? child.material : null;
      if (material && 'color' in material) {
        material.color.setHex(colorHex);
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
    this.ghostGroup.children.forEach((mesh) => {
      const material = mesh instanceof THREE.Mesh ? mesh.material : null;
      if (material && 'opacity' in material) {
        material.opacity = THREE.MathUtils.lerp(material.opacity, this.ghostTargetOpacity, 15 * delta);
      }
    });

    if (this.isDragging) {
      // Keep basePosition synced with the manual dragging position
      this.basePosition.copy(this.group.position);
      return;
    }

    // Simulate spring-like damping with lerp/slerp
    const tension = 15;
    const currentSpeed = tension * delta;
    
    // Add dynamic lift if the card is actively rotating significantly
    const angleDiff = this.group.quaternion.angleTo(this.targetQuaternion);
    // angleDiff is 0 when fully rested, up to PI when 180deg flipped
    // We want the peak of the arc to be at PI/2 difference.
    // Sin(angleDiff) gives us a curve that peaks at PI/2 and goes to 0 at 0 and PI.
    const flipArcHeight = 1.6; // How high it lifts
    
    // Lerp base position
    this.basePosition.lerp(this.targetPosition, currentSpeed);
    this.group.quaternion.slerp(this.targetQuaternion, currentSpeed);
    this.group.scale.lerp(this.targetScale, currentSpeed);
    
    // Apply temporary lift if rotating (e.g., flipping)
    let currentLift = 0;
    if (angleDiff > 0.01) {
       currentLift = Math.sin(angleDiff) * flipArcHeight;
    }
    
    this.group.position.copy(this.basePosition);
    this.group.position.y += currentLift;
  }

  updateTransform() {
    this.basePosition.copy(this.targetPosition);
    this.group.position.copy(this.targetPosition);
    this.group.quaternion.copy(this.targetQuaternion);
    this.group.scale.copy(this.targetScale);
  }
}
