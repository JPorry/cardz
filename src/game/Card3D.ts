import * as THREE from 'three';
import type { CardState } from '../store';
import { CARD_HEIGHT, CARD_WIDTH, getCardTableEuler } from '../utils/cardOrientation';
import {
  CARD_COUNTER_BADGE_COLORS,
  CARD_STATUS_BADGE_COLORS,
  hasVisibleCardMetadata,
} from '../utils/cardMetadata';

const CARD_THICKNESS = 0.025;
const OVERLAY_TEXTURE_WIDTH = 512;
const OVERLAY_TEXTURE_HEIGHT = 768;
const OVERLAY_PLANE_WIDTH = CARD_WIDTH * 0.94;
const OVERLAY_PLANE_HEIGHT = CARD_HEIGHT * 0.94;
const OVERLAY_OFFSET = CARD_THICKNESS / 2 + 0.008;

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
  metadataOverlayFrontTexture?: THREE.CanvasTexture;
  metadataOverlayBackTexture?: THREE.CanvasTexture;
  metadataOverlayFront?: THREE.Mesh;
  metadataOverlayBack?: THREE.Mesh;

  frontMesh?: THREE.Mesh;
  frontMat?: THREE.MeshStandardMaterial;
  backMesh?: THREE.Mesh;
  backMat?: THREE.MeshStandardMaterial;
  currentArtworkUrl?: string;
  currentBackArtworkUrl?: string;
  currentArtworkRotation: number = 0;
  currentBackArtworkRotation: number = 0;
  isOverlayRendering: boolean = false;

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
    this.setupMetadataOverlay()
    this.updateMetadata(cardData)
    
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
    const borderShape = this.createRoundedRectShape(CARD_WIDTH, CARD_HEIGHT, 0.1);
    const innerBorderHole = this.createRoundedRectShape(CARD_WIDTH * 0.965, CARD_HEIGHT * 0.965, 0.08);
    borderShape.holes.push(innerBorderHole);
    
    // Main extruded body
    const extrudeSettings = {
      steps: 1,
      depth: CARD_THICKNESS,
      bevelEnabled: false
    };
    const centerGeometry = new THREE.ExtrudeGeometry(cardShape, extrudeSettings);
    centerGeometry.translate(0, 0, -CARD_THICKNESS / 2); // Center on Z

    const centerMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      transparent: false,
      opacity: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const centerMesh = new THREE.Mesh(centerGeometry, centerMat);
    centerMesh.castShadow = true;
    centerMesh.receiveShadow = true;
    centerMesh.userData.renderOrderOffset = 0;
    this.group.add(centerMesh);

    const borderGeometry = new THREE.ShapeGeometry(borderShape);
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: 0x17191f,
      transparent: false,
      opacity: 1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });

    const frontBorderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
    frontBorderMesh.position.set(0, 0, CARD_THICKNESS / 2 + 0.003);
    frontBorderMesh.userData.renderOrderOffset = -1;
    this.group.add(frontBorderMesh);

    const backBorderMesh = new THREE.Mesh(borderGeometry.clone(), borderMaterial.clone());
    backBorderMesh.position.set(0, 0, -CARD_THICKNESS / 2 - 0.003);
    backBorderMesh.rotation.set(0, Math.PI, 0);
    backBorderMesh.userData.renderOrderOffset = -1;
    this.group.add(backBorderMesh);

    // Front face
    const faceShape = this.createRoundedRectShape(CARD_WIDTH * 0.95, CARD_HEIGHT * 0.95, 0.08);
    const faceGeometry = new THREE.ShapeGeometry(faceShape);
    
    this.frontMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: false,
      opacity: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.frontMesh = new THREE.Mesh(faceGeometry, this.frontMat);
    this.frontMesh.position.set(0, 0, CARD_THICKNESS / 2 + 0.005);
    this.frontMesh.userData.renderOrderOffset = 0;
    
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
    this.backMat = new THREE.MeshStandardMaterial({
      color: 0xb20000,
      transparent: false,
      opacity: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.backMesh = new THREE.Mesh(faceGeometry, this.backMat);
    this.backMesh.position.set(0, 0, -CARD_THICKNESS / 2 - 0.005);
    this.backMesh.rotation.set(0, Math.PI, 0);
    this.backMesh.userData.renderOrderOffset = 0;
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
    centerMesh.userData.renderOrderOffset = 0;
    this.ghostGroup.add(centerMesh);

    const faceShape = this.createRoundedRectShape(CARD_WIDTH * 0.95, CARD_HEIGHT * 0.95, 0.08);
    const faceGeometry = new THREE.ShapeGeometry(faceShape);
    
    const frontMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const frontMesh = new THREE.Mesh(faceGeometry, frontMat);
    frontMesh.position.set(0, 0, CARD_THICKNESS / 2 + 0.001);
    frontMesh.userData.renderOrderOffset = 0;
    this.ghostGroup.add(frontMesh);

    const backMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const backMesh = new THREE.Mesh(faceGeometry, backMat);
    backMesh.position.set(0, 0, -CARD_THICKNESS / 2 - 0.001);
    backMesh.rotation.set(0, Math.PI, 0);
    backMesh.userData.renderOrderOffset = 0;
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
    selectionMesh.userData.renderOrderOffset = 1
    selectionMesh.renderOrder = 1
    selectionMesh.visible = false
    return selectionMesh
  }

  private setupMetadataOverlay() {
    const frontCanvas = document.createElement('canvas');
    frontCanvas.width = OVERLAY_TEXTURE_WIDTH;
    frontCanvas.height = OVERLAY_TEXTURE_HEIGHT;
    const backCanvas = document.createElement('canvas');
    backCanvas.width = OVERLAY_TEXTURE_WIDTH;
    backCanvas.height = OVERLAY_TEXTURE_HEIGHT;

    const frontTexture = new THREE.CanvasTexture(frontCanvas);
    frontTexture.colorSpace = THREE.SRGBColorSpace;
    frontTexture.minFilter = THREE.LinearFilter;
    frontTexture.magFilter = THREE.LinearFilter;
    frontTexture.anisotropy = 4;

    const backTexture = new THREE.CanvasTexture(backCanvas);
    backTexture.colorSpace = THREE.SRGBColorSpace;
    backTexture.minFilter = THREE.LinearFilter;
    backTexture.magFilter = THREE.LinearFilter;
    backTexture.anisotropy = 4;

    const geometry = new THREE.PlaneGeometry(OVERLAY_PLANE_WIDTH, OVERLAY_PLANE_HEIGHT);
    const frontMaterial = new THREE.MeshBasicMaterial({
      map: frontTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const backMaterial = new THREE.MeshBasicMaterial({
      map: backTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.metadataOverlayFrontTexture = frontTexture;
    this.metadataOverlayBackTexture = backTexture;
    this.metadataOverlayFront = new THREE.Mesh(geometry, frontMaterial);
    this.metadataOverlayFront.position.set(0, 0, OVERLAY_OFFSET);
    this.metadataOverlayFront.userData.renderOrderOffset = 2;

    this.metadataOverlayBack = new THREE.Mesh(geometry, backMaterial);
    this.metadataOverlayBack.position.set(0, 0, -OVERLAY_OFFSET);
    this.metadataOverlayBack.rotation.set(0, Math.PI, 0);
    this.metadataOverlayBack.userData.renderOrderOffset = 2;

    this.group.add(this.metadataOverlayFront);
    this.group.add(this.metadataOverlayBack);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    const appliedRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + appliedRadius, y);
    ctx.lineTo(x + width - appliedRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + appliedRadius);
    ctx.lineTo(x + width, y + height - appliedRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - appliedRadius, y + height);
    ctx.lineTo(x + appliedRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - appliedRadius);
    ctx.lineTo(x, y + appliedRadius);
    ctx.quadraticCurveTo(x, y, x + appliedRadius, y);
    ctx.closePath();
  }

  private drawBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: number,
    color: string,
  ) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    this.roundRect(ctx, x, y, width, height, 22);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(12, 16, 24, 0.72)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + 34);

    ctx.font = '800 58px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x + width / 2, y + 72);
    ctx.textAlign = 'left';
  }

  private drawStatusChip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: string,
  ) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    this.roundRect(ctx, x, y, width, height, 18);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(10, 14, 20, 0.68)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + height / 2 + 2);
    ctx.textAlign = 'left';
  }

  private drawMetadataOverlay(
    texture: THREE.CanvasTexture,
    cardData: CardState,
    face: 'front' | 'back',
  ) {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawWidth = cardData.tapped ? canvas.height : canvas.width;
    const drawHeight = cardData.tapped ? canvas.width : canvas.height;

    if (cardData.tapped) {
      ctx.save();
      const overlayRotation = face === 'front' ? Math.PI / 2 : -Math.PI / 2;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(overlayRotation);
      ctx.translate(-drawWidth / 2, -drawHeight / 2);
    }

    const badges = [
      { key: 'damage', label: 'DMG', color: CARD_COUNTER_BADGE_COLORS.damage },
      { key: 'acceleration', label: 'ACC', color: CARD_COUNTER_BADGE_COLORS.acceleration },
      { key: 'threat', label: 'THR', color: CARD_COUNTER_BADGE_COLORS.threat },
      { key: 'allPurpose', label: 'ALL', color: CARD_COUNTER_BADGE_COLORS.allPurpose },
    ] as const;
    const activeBadges = badges.filter(({ key }) => cardData.counters[key] > 0);
    const badgeWidth = 112;
    const badgeHeight = 112;
    const badgeGap = 10;
    const totalBadgeHeight = activeBadges.length > 0
      ? activeBadges.length * badgeHeight + (activeBadges.length - 1) * badgeGap
      : 0;
    const badgeStartY = (drawHeight - totalBadgeHeight) / 2;

    activeBadges.forEach((badge, index) => {
      this.drawBadge(
        ctx,
        drawWidth - badgeWidth - 10,
        badgeStartY + index * (badgeHeight + badgeGap),
        badgeWidth,
        badgeHeight,
        badge.label,
        cardData.counters[badge.key],
        badge.color,
      );
    });

    const statuses = [
      { key: 'stunned', label: 'STUN', color: CARD_STATUS_BADGE_COLORS.stunned },
      { key: 'confused', label: 'CONF', color: CARD_STATUS_BADGE_COLORS.confused },
      { key: 'tough', label: 'TOUGH', color: CARD_STATUS_BADGE_COLORS.tough },
    ] as const;
    const activeStatuses = statuses.filter(({ key }) => cardData.statuses[key]);
    const chipGap = 12;
    const chipHeight = 56;
    const chipWidth = activeStatuses.length === 1 ? 180 : activeStatuses.length === 2 ? 150 : 132;
    const totalWidth = activeStatuses.length * chipWidth + Math.max(0, activeStatuses.length - 1) * chipGap;
    const startX = (drawWidth - totalWidth) / 2;
    const chipY = drawHeight - chipHeight;

    activeStatuses.forEach((status, index) => {
      this.drawStatusChip(
        ctx,
        startX + index * (chipWidth + chipGap),
        chipY,
        chipWidth,
        chipHeight,
        status.label,
        status.color,
      );
    });

    if (cardData.tapped) {
      ctx.restore();
    }
    texture.needsUpdate = true;
  }

  updateMetadata(cardData: CardState, options?: { showOnTopOfDeck?: boolean }) {
    if (
      !this.metadataOverlayFrontTexture
      || !this.metadataOverlayBackTexture
      || !this.metadataOverlayFront
      || !this.metadataOverlayBack
    ) {
      return;
    }

    const shouldShow = Boolean(
      (cardData.location === 'table' || options?.showOnTopOfDeck)
      && hasVisibleCardMetadata(cardData.counters, cardData.statuses)
    );
    this.metadataOverlayFront.visible = shouldShow && cardData.faceUp;
    this.metadataOverlayBack.visible = shouldShow && !cardData.faceUp;

    if (!shouldShow) {
      return;
    }

    this.drawMetadataOverlay(this.metadataOverlayFrontTexture, cardData, 'front');
    this.drawMetadataOverlay(this.metadataOverlayBackTexture, cardData, 'back');
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

  setRenderOrder(order: number) {
    this.group.traverse((object) => {
      const renderOrderOffset = object.userData.renderOrderOffset ?? 0;
      object.renderOrder = order + renderOrderOffset;
    });
    this.ghostGroup.traverse((object) => {
      const renderOrderOffset = object.userData.renderOrderOffset ?? 0;
      object.renderOrder = order + renderOrderOffset;
    });
  }

  setOverlayRendering(enabled: boolean) {
    this.isOverlayRendering = enabled
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
