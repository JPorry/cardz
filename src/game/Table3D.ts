import * as THREE from 'three';
import type { BoardConfig } from '../config/board';
import tableTextureUrl from '../assets/table.png';
import tableBumpMapUrl from '../assets/table_bump_map.png';

const TABLE_TEXTURE_LOADER = new THREE.TextureLoader();
const TABLE_TEXTURE_OVERSCAN = 0.018;

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

export class Table3D {
  mesh: THREE.Group;

  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private texture?: THREE.Texture;
  private bumpTexture?: THREE.Texture;

  constructor(boardConfig: BoardConfig, onTextureReady?: () => void) {
    const width = boardConfig.width;
    const depth = boardConfig.depth;
    const thickness = 4.4;
    const cornerRadius = 1.7;
    const bevelSize = 0.1;
    const topSurfaceY = thickness + 0.01;

    this.mesh = new THREE.Group();

    const outerShape = createRoundedRectShape(width, depth, cornerRadius);
    const bodyGeometry = new THREE.ExtrudeGeometry(outerShape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize,
      bevelSegments: 4,
      curveSegments: 18,
    });
    bodyGeometry.rotateX(-Math.PI / 2);
    this.geometries.push(bodyGeometry);

    const topCapMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.materials.push(topCapMaterial);

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x2d313e,
      transparent: true,
      opacity: 0.42,
      transmission: 0.22,
      roughness: 0.16,
      metalness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      ior: 1.18,
      thickness: 9.2,
      emissive: 0x1a1b24,
      emissiveIntensity: 0.28,
    });
    this.materials.push(glassMaterial);

    const bodyMesh = new THREE.Mesh(bodyGeometry, [topCapMaterial, glassMaterial]);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.mesh.add(bodyMesh);

    const topGeometry = new THREE.ShapeGeometry(createRoundedRectShape(width, depth, cornerRadius));
    topGeometry.rotateX(-Math.PI / 2);
    const positionAttribute = topGeometry.getAttribute('position');
    const uv = new Float32Array(positionAttribute.count * 2);
    for (let index = 0; index < positionAttribute.count; index += 1) {
      const x = positionAttribute.getX(index);
      const z = positionAttribute.getZ(index);
      const baseU = (x + width / 2) / width;
      const baseV = 1 - ((z + depth / 2) / depth);
      uv[index * 2] = THREE.MathUtils.lerp(TABLE_TEXTURE_OVERSCAN, 1 - TABLE_TEXTURE_OVERSCAN, baseU);
      uv[index * 2 + 1] = THREE.MathUtils.lerp(TABLE_TEXTURE_OVERSCAN, 1 - TABLE_TEXTURE_OVERSCAN, baseV);
    }
    topGeometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometries.push(topGeometry);

    const topTexture = TABLE_TEXTURE_LOADER.load(tableTextureUrl, () => {
      onTextureReady?.();
    });
    topTexture.colorSpace = THREE.SRGBColorSpace;
    topTexture.anisotropy = 8;
    topTexture.wrapS = THREE.ClampToEdgeWrapping;
    topTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture = topTexture;

    const bumpTexture = TABLE_TEXTURE_LOADER.load(tableBumpMapUrl, () => {
      onTextureReady?.();
    });
    bumpTexture.colorSpace = THREE.NoColorSpace;
    bumpTexture.anisotropy = 8;
    bumpTexture.wrapS = THREE.ClampToEdgeWrapping;
    bumpTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.bumpTexture = bumpTexture;

    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: topTexture,
      bumpMap: bumpTexture,
      bumpScale: 3,
      roughness: 0.18,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.materials.push(topMaterial);

    const topMesh = new THREE.Mesh(topGeometry, topMaterial);
    topMesh.position.y = topSurfaceY;
    topMesh.receiveShadow = true;
    this.mesh.add(topMesh);

    const borderWidth = 0.22;
    const darkBorderShape = createRoundedRectShape(width, depth, cornerRadius);
    const darkBorderHole = createRoundedRectShape(
      width - borderWidth * 2,
      depth - borderWidth * 2,
      cornerRadius - borderWidth,
    );
    darkBorderShape.holes.push(darkBorderHole);

    const darkBorderGeometry = new THREE.ShapeGeometry(darkBorderShape);
    darkBorderGeometry.rotateX(-Math.PI / 2);
    this.geometries.push(darkBorderGeometry);

    const darkBorderMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.materials.push(darkBorderMaterial);

    const darkBorderMesh = new THREE.Mesh(darkBorderGeometry, darkBorderMaterial);
    darkBorderMesh.position.y = topSurfaceY + 0.004;
    darkBorderMesh.renderOrder = 1;
    this.mesh.add(darkBorderMesh);

    const outlineInset = 0.08;
    const outlineWidth = 0.035;
    const outlineShape = createRoundedRectShape(
      width + bevelSize * 2 - outlineInset,
      depth + bevelSize * 2 - outlineInset,
      cornerRadius + bevelSize - outlineInset / 2,
    );
    const outlineHole = createRoundedRectShape(
      width + bevelSize * 2 - outlineInset - outlineWidth * 2,
      depth + bevelSize * 2 - outlineInset - outlineWidth * 2,
      cornerRadius + bevelSize - outlineInset / 2 - outlineWidth,
    );
    outlineShape.holes.push(outlineHole);

    const outlineGeometry = new THREE.ShapeGeometry(outlineShape);
    outlineGeometry.rotateX(-Math.PI / 2);
    this.geometries.push(outlineGeometry);

    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.materials.push(outlineMaterial);

    const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outlineMesh.position.y = topSurfaceY + 0.012;
    outlineMesh.renderOrder = 3;
    this.mesh.add(outlineMesh);

    const innerShadeGeometry = new THREE.ShapeGeometry(createRoundedRectShape(width - 1.1, depth - 1.1, cornerRadius - 0.34));
    innerShadeGeometry.rotateX(-Math.PI / 2);
    this.geometries.push(innerShadeGeometry);

    const innerShadeMaterial = new THREE.MeshBasicMaterial({
      color: 0x0f1118,
      transparent: true,
      opacity: 0.02,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.materials.push(innerShadeMaterial);

    const innerShadeMesh = new THREE.Mesh(innerShadeGeometry, innerShadeMaterial);
    innerShadeMesh.position.y = topSurfaceY + 0.002;
    innerShadeMesh.renderOrder = 0;
    this.mesh.add(innerShadeMesh);

    this.mesh.position.set(0, -(thickness + 0.08), -3);
  }

  dispose() {
    this.texture?.dispose();
    this.bumpTexture?.dispose();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
  }
}
