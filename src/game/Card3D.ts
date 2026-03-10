import * as THREE from 'three';
import { useGameStore, type CardState } from '../store';
import { CARD_HEIGHT, CARD_WIDTH, getCardTableEuler } from '../utils/cardOrientation';
import { getGameDefinition } from '../games/registry';
import { getCounterBadgeColors, getStatusBadgeColors, hasVisibleCardMetadata } from '../utils/cardMetadata';

const CARD_THICKNESS = 0.025;
const OVERLAY_TEXTURE_WIDTH = 512;
const OVERLAY_TEXTURE_HEIGHT = 768;
const OVERLAY_PLANE_WIDTH = CARD_WIDTH * 0.94;
const OVERLAY_PLANE_HEIGHT = CARD_HEIGHT * 0.94;
const OVERLAY_OFFSET = CARD_THICKNESS / 2 + 0.02;
const CARD_CORNER_RADIUS = 0.1;
const CARD_FACE_INSET_X = CARD_WIDTH * 0.025;
const CARD_FACE_INSET_Y = CARD_HEIGHT * 0.025;
const CARD_FACE_RADIUS = 0.08;
const CARD_BORDER_FRONT_Z_OFFSET = CARD_THICKNESS / 2 + 0.003;
const CARD_BORDER_BACK_Z_OFFSET = -CARD_THICKNESS / 2 - 0.003;
const CARD_FACE_FRONT_Z_OFFSET = CARD_THICKNESS / 2 + 0.005;
const CARD_FACE_BACK_Z_OFFSET = -CARD_THICKNESS / 2 - 0.005;
const PLACEHOLDER_FRONT_COLOR = new THREE.Color(0xd8d1c4);
const PLACEHOLDER_BACK_COLOR = new THREE.Color(0x566072);
const SHARED_TEXTURE_LOADER = new THREE.TextureLoader();

SHARED_TEXTURE_LOADER.setCrossOrigin('anonymous');

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
  bodyMat?: THREE.MeshStandardMaterial;
  frontBorderMat?: THREE.MeshBasicMaterial;
  backBorderMat?: THREE.MeshBasicMaterial;
  currentArtworkUrl?: string;
  currentBackArtworkUrl?: string;
  currentArtworkRotation: number = 0;
  currentBackArtworkRotation: number = 0;
  isOverlayRendering: boolean = false;
  private frontTextureLoadVersion = 0;
  private backTextureLoadVersion = 0;
  private metadataSignature: string | null = null;

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
    this.resetArtworkMaterial(this.frontMat, 'front');
    this.resetArtworkMaterial(this.backMat, 'back');
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

  private resetArtworkMaterial(
    material: THREE.MeshStandardMaterial | undefined,
    face: 'front' | 'back',
  ) {
    if (!material) return;
    material.map?.dispose();
    material.map = null;
    material.color.copy(face === 'front' ? PLACEHOLDER_FRONT_COLOR : PLACEHOLDER_BACK_COLOR);
    material.needsUpdate = true;
  }

  private applyLoadedTexture(
    material: THREE.MeshStandardMaterial | undefined,
    texture: THREE.Texture,
    face: 'front' | 'back',
  ) {
    if (!material) {
      texture.dispose();
      return;
    }

    material.map?.dispose();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;
    const rotation = this.getTextureRotation(texture, face === 'back');
    if (face === 'front') {
      this.currentArtworkRotation = rotation;
    } else {
      this.currentBackArtworkRotation = rotation;
    }
    this.applyTextureRotation(texture, rotation);
    material.map = texture;
    material.color.set(0xffffff);
    material.needsUpdate = true;
  }

  startSettleAnimation() {
    this.basePosition.copy(this.targetPosition);
    this.basePosition.y += 0.35;
    this.group.position.copy(this.basePosition);
    this.group.quaternion.copy(this.targetQuaternion);
    this.group.scale.copy(this.targetScale).multiplyScalar(1.015);
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

  private createCardFaceShape() {
    return this.createRoundedRectShape(
      CARD_WIDTH - CARD_FACE_INSET_X * 2,
      CARD_HEIGHT - CARD_FACE_INSET_Y * 2,
      CARD_FACE_RADIUS,
    );
  }

  private setupMeshes() {
    const cardShape = this.createRoundedRectShape(CARD_WIDTH, CARD_HEIGHT, CARD_CORNER_RADIUS);
    const borderShape = this.createRoundedRectShape(CARD_WIDTH, CARD_HEIGHT, CARD_CORNER_RADIUS);
    const faceShape = this.createCardFaceShape();
    const faceWidth = CARD_WIDTH - CARD_FACE_INSET_X * 2;
    const faceHeight = CARD_HEIGHT - CARD_FACE_INSET_Y * 2;
    const innerBorderHole = this.createCardFaceShape();
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
    this.bodyMat = centerMat;
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
      depthWrite: false,
    });
    this.frontBorderMat = borderMaterial;

    const frontBorderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
    frontBorderMesh.position.set(0, 0, CARD_BORDER_FRONT_Z_OFFSET);
    frontBorderMesh.userData.renderOrderOffset = 0;
    this.group.add(frontBorderMesh);

    const backBorderMaterial = borderMaterial.clone();
    this.backBorderMat = backBorderMaterial;
    const backBorderMesh = new THREE.Mesh(borderGeometry.clone(), backBorderMaterial);
    backBorderMesh.position.set(0, 0, CARD_BORDER_BACK_Z_OFFSET);
    backBorderMesh.rotation.set(0, Math.PI, 0);
    backBorderMesh.userData.renderOrderOffset = 0;
    this.group.add(backBorderMesh);

    // Front face
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
    this.frontMesh.position.set(0, 0, CARD_FACE_FRONT_Z_OFFSET);
    this.frontMesh.userData.renderOrderOffset = 0;
    
    // Manually fix UVs for the face geometry to ensure they are [0, 1]
    const pos = faceGeometry.attributes.position;
    const uv = faceGeometry.attributes.uv;
    const w = faceWidth;
    const h = faceHeight;
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
    this.backMesh.position.set(0, 0, CARD_FACE_BACK_Z_OFFSET);
    this.backMesh.rotation.set(0, Math.PI, 0);
    this.backMesh.userData.renderOrderOffset = 0;
    this.group.add(this.backMesh);
  }

  refreshArtwork(artworkUrl?: string, backArtworkUrl?: string) {
    if (artworkUrl !== this.currentArtworkUrl) {
      this.currentArtworkUrl = artworkUrl;
      const requestVersion = ++this.frontTextureLoadVersion;
      this.resetArtworkMaterial(this.frontMat, 'front');
      if (artworkUrl) {
        SHARED_TEXTURE_LOADER.load(artworkUrl, (texture) => {
        if (!this.frontMat || requestVersion !== this.frontTextureLoadVersion || artworkUrl !== this.currentArtworkUrl) {
          texture.dispose();
          return;
        }

          this.applyLoadedTexture(this.frontMat, texture, 'front');
        });
      }
    }

    if (backArtworkUrl !== this.currentBackArtworkUrl) {
      this.currentBackArtworkUrl = backArtworkUrl;
      const requestVersion = ++this.backTextureLoadVersion;
      this.resetArtworkMaterial(this.backMat, 'back');
      if (backArtworkUrl) {
        SHARED_TEXTURE_LOADER.load(backArtworkUrl, (texture) => {
        if (!this.backMat || requestVersion !== this.backTextureLoadVersion || backArtworkUrl !== this.currentBackArtworkUrl) {
          texture.dispose();
          return;
        }

          this.applyLoadedTexture(this.backMat, texture, 'back');
        });
      }
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
    const cardShape = this.createRoundedRectShape(CARD_WIDTH, CARD_HEIGHT, CARD_CORNER_RADIUS);
    const extrudeSettings = { steps: 1, depth: CARD_THICKNESS, bevelEnabled: false };
    const centerGeometry = new THREE.ExtrudeGeometry(cardShape, extrudeSettings);
    centerGeometry.translate(0, 0, -CARD_THICKNESS / 2);
    
    const centerMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0, depthWrite: false });
    const centerMesh = new THREE.Mesh(centerGeometry, centerMat);
    centerMesh.userData.renderOrderOffset = 0;
    this.ghostGroup.add(centerMesh);

    const faceShape = this.createCardFaceShape();
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
      alphaTest: 0.05,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.FrontSide,
    });
    const backMaterial = new THREE.MeshBasicMaterial({
      map: backTexture,
      transparent: true,
      alphaTest: 0.05,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.FrontSide,
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

    const game = getGameDefinition(useGameStore.getState().activeGameId);
    const counterColors = getCounterBadgeColors(game.cardSemantics.counters);
    const statusColors = getStatusBadgeColors(game.cardSemantics.statuses);
    const badges = game.cardSemantics.counters.map((counter) => ({
      key: counter.key,
      label: counter.shortLabel,
      color: counterColors[counter.key],
    }));
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

    const statuses = game.cardSemantics.statuses.map((status) => ({
      key: status.key,
      label: status.shortLabel,
      color: statusColors[status.key],
    }));
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
      && hasVisibleCardMetadata(getGameDefinition(useGameStore.getState().activeGameId).cardSemantics, cardData.counters, cardData.statuses)
    );
    const nextSignature = JSON.stringify({
      faceUp: cardData.faceUp,
      tapped: cardData.tapped ?? false,
      location: cardData.location,
      showOnTopOfDeck: options?.showOnTopOfDeck ?? false,
      counters: cardData.counters,
      statuses: cardData.statuses,
      shouldShow,
    });
    if (this.metadataSignature === nextSignature) {
      return;
    }
    this.metadataSignature = nextSignature;
    const overlayDepthTest = !(options?.showOnTopOfDeck ?? false);
    const frontMaterial = this.metadataOverlayFront.material as THREE.MeshBasicMaterial;
    const backMaterial = this.metadataOverlayBack.material as THREE.MeshBasicMaterial;
    if (frontMaterial.depthTest !== overlayDepthTest) {
      frontMaterial.depthTest = overlayDepthTest;
      frontMaterial.needsUpdate = true;
    }
    if (backMaterial.depthTest !== overlayDepthTest) {
      backMaterial.depthTest = overlayDepthTest;
      backMaterial.needsUpdate = true;
    }
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

  setDragging(dragging: boolean) {
    this.isDragging = dragging
  }

  setOverlayRendering(enabled: boolean) {
    this.isOverlayRendering = enabled
    const depthTest = !enabled
    ;[
      this.bodyMat,
      this.frontBorderMat,
      this.backBorderMat,
      this.frontMat,
      this.backMat,
    ].forEach((material) => {
      if (!material || material.depthTest === depthTest) return
      material.depthTest = depthTest
      material.needsUpdate = true
    })
  }

  update(delta: number) {
    // Smooth lerping for the ghost UI opacity
    let isAnimating = false
    this.ghostGroup.children.forEach((mesh) => {
      const material = mesh instanceof THREE.Mesh ? mesh.material : null;
      if (material && 'opacity' in material) {
        const nextOpacity = THREE.MathUtils.lerp(material.opacity, this.ghostTargetOpacity, 15 * delta);
        if (Math.abs(nextOpacity - material.opacity) > 0.001 || Math.abs(this.ghostTargetOpacity - nextOpacity) > 0.001) {
          isAnimating = true
        }
        material.opacity = nextOpacity;
      }
    });

    if (this.isDragging) {
      // Keep basePosition synced with the manual dragging position
      this.basePosition.copy(this.group.position);
      return true;
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
       isAnimating = true
    }
    
    this.group.position.copy(this.basePosition);
    this.group.position.y += currentLift;
    if (
      this.group.position.distanceToSquared(this.targetPosition) > 0.0001
      || angleDiff > 0.001
      || this.group.scale.distanceToSquared(this.targetScale) > 0.0001
    ) {
      isAnimating = true
    }
    return isAnimating;
  }

  updateTransform() {
    this.basePosition.copy(this.targetPosition);
    this.group.position.copy(this.targetPosition);
    this.group.quaternion.copy(this.targetQuaternion);
    this.group.scale.copy(this.targetScale);
  }

  dispose() {
    this.frontTextureLoadVersion += 1
    this.backTextureLoadVersion += 1
    this.frontMat?.map?.dispose()
    this.backMat?.map?.dispose()
    this.metadataOverlayFrontTexture?.dispose()
    this.metadataOverlayBackTexture?.dispose()

    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const material = object.material
      if (Array.isArray(material)) {
        material.forEach((entry) => {
          if ('map' in entry && entry.map instanceof THREE.Texture) {
            entry.map.dispose()
          }
          entry.dispose()
        })
        return
      }
      if ('map' in material && material.map instanceof THREE.Texture) {
        material.map.dispose()
      }
      material.dispose()
    })

    this.ghostGroup.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const material = object.material
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose())
        return
      }
      material.dispose()
    })
  }
}
