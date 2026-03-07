import * as THREE from 'three';
import { BOARD_CONFIG } from '../config/board';

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

function createRoundedRectPoints(width: number, depth: number, radius: number, segments = 10) {
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

export class Table3D {
  mesh: THREE.Group;

  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  constructor() {
    const width = BOARD_CONFIG.width;
    const depth = BOARD_CONFIG.depth;
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

    const bodyMesh = new THREE.Mesh(bodyGeometry, glassMaterial);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.mesh.add(bodyMesh);

    const topGeometry = new THREE.ShapeGeometry(createRoundedRectShape(width - 0.34, depth - 0.34, cornerRadius - 0.08));
    topGeometry.rotateX(-Math.PI / 2);
    this.geometries.push(topGeometry);

    const topMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x394050,
      transparent: true,
      opacity: 0.16,
      transmission: 0.55,
      roughness: 0.08,
      metalness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      ior: 1.12,
      thickness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.materials.push(topMaterial);

    const topMesh = new THREE.Mesh(topGeometry, topMaterial);
    topMesh.position.y = topSurfaceY;
    topMesh.receiveShadow = true;
    this.mesh.add(topMesh);

    const rimOuterWidth = width + bevelSize * 2;
    const rimOuterDepth = depth + bevelSize * 2;
    const rimOuterRadius = cornerRadius + bevelSize;
    const rimThickness = 0.015;

    const topFrameOuterShape = createRoundedRectShape(rimOuterWidth, rimOuterDepth, rimOuterRadius);
    const topFrameInnerShape = createRoundedRectShape(
      rimOuterWidth - rimThickness,
      rimOuterDepth - rimThickness,
      rimOuterRadius - rimThickness / 2,
    );
    topFrameOuterShape.holes.push(topFrameInnerShape);

    const topFrameGeometry = new THREE.ShapeGeometry(topFrameOuterShape);
    topFrameGeometry.rotateX(-Math.PI / 2);
    this.geometries.push(topFrameGeometry);

    const topFrameMaterial = new THREE.MeshBasicMaterial({
      color: 0xf4f7ff,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    this.materials.push(topFrameMaterial);

    const topFrameMesh = new THREE.Mesh(topFrameGeometry, topFrameMaterial);
    topFrameMesh.position.y = topSurfaceY + 0.018;
    topFrameMesh.renderOrder = 1;
    this.mesh.add(topFrameMesh);

    const innerShadeGeometry = new THREE.ShapeGeometry(createRoundedRectShape(width - 1.1, depth - 1.1, cornerRadius - 0.34));
    innerShadeGeometry.rotateX(-Math.PI / 2);
    this.geometries.push(innerShadeGeometry);

    const innerShadeMaterial = new THREE.MeshBasicMaterial({
      color: 0x0f1118,
      transparent: true,
      opacity: 0.22,
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

    const borderGeometry = new THREE.BufferGeometry().setFromPoints(
      createRoundedRectPoints(width - 0.12, depth - 0.12, cornerRadius - 0.04, 12),
    );
    this.geometries.push(borderGeometry);

    const borderMaterial = new THREE.LineBasicMaterial({
      color: 0x7f8798,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });
    this.materials.push(borderMaterial);

    const borderLine = new THREE.LineLoop(borderGeometry, borderMaterial);
    borderLine.position.y = topSurfaceY + 0.02;
    borderLine.renderOrder = 5;
    this.mesh.add(borderLine);

    const outerPerimeterGeometry = new THREE.BufferGeometry().setFromPoints(
      createRoundedRectPoints(rimOuterWidth, rimOuterDepth, rimOuterRadius, 14),
    );
    this.geometries.push(outerPerimeterGeometry);

    const outerPerimeterMaterial = new THREE.LineBasicMaterial({
      color: 0x666e80,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });
    this.materials.push(outerPerimeterMaterial);

    const outerPerimeterLine = new THREE.LineLoop(outerPerimeterGeometry, outerPerimeterMaterial);
    outerPerimeterLine.position.y = topSurfaceY + 0.024;
    outerPerimeterLine.renderOrder = 5;
    this.mesh.add(outerPerimeterLine);

    const glowMaterial = new THREE.LineBasicMaterial({
      color: 0xff6d38,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    this.materials.push(glowMaterial);

    const glowLine = new THREE.LineLoop(borderGeometry.clone(), glowMaterial);
    this.geometries.push(glowLine.geometry as THREE.BufferGeometry);
    glowLine.position.y = topSurfaceY + 0.021;
    glowLine.renderOrder = 4;
    this.mesh.add(glowLine);

    const glowBand = 0.012;
    const perimeterGlowShape = createRoundedRectShape(
      rimOuterWidth + glowBand,
      rimOuterDepth + glowBand,
      rimOuterRadius + glowBand / 2,
    );
    const perimeterGlowHole = createRoundedRectShape(
      rimOuterWidth - glowBand,
      rimOuterDepth - glowBand,
      rimOuterRadius - glowBand / 2,
    );
    perimeterGlowShape.holes.push(perimeterGlowHole);

    const perimeterGlowGeometry = new THREE.ShapeGeometry(perimeterGlowShape);
    perimeterGlowGeometry.rotateX(-Math.PI / 2);
    this.geometries.push(perimeterGlowGeometry);

    const perimeterGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8a57,
      transparent: true,
      opacity: 0.02,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.materials.push(perimeterGlowMaterial);

    const perimeterGlowMesh = new THREE.Mesh(perimeterGlowGeometry, perimeterGlowMaterial);
    perimeterGlowMesh.position.y = topSurfaceY + 0.016;
    perimeterGlowMesh.renderOrder = 0;
    this.mesh.add(perimeterGlowMesh);

    this.mesh.position.set(0, -(thickness + 0.08), -3);
  }

  dispose() {
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
  }
}
