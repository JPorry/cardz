import * as THREE from 'three';

export class Table3D {
  mesh: THREE.Mesh;

  constructor() {
    const width = 28;
    const depth = 18;
    const thickness = 0.8;
    const cornerRadius = 1.5;

    // Create a rounded rectangle shape
    const shape = new THREE.Shape();
    const hw = width / 2;
    const hd = depth / 2;
    const r = cornerRadius;

    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
    shape.lineTo(hw, hd - r);
    shape.quadraticCurveTo(hw, hd, hw - r, hd);
    shape.lineTo(-hw + r, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 3,
      curveSegments: 12,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate so the extrusion goes along Y axis (upward) instead of Z
    geometry.rotateX(-Math.PI / 2);

    // A simple wood-like color for now
    const material = new THREE.MeshStandardMaterial({ color: 0xd4a373 });

    this.mesh = new THREE.Mesh(geometry, material);
    // Position so the top surface (including bevel) sits just below y=0
    this.mesh.position.set(0, -(thickness + 0.08), -3); // Shifted back on Z to leave room for the hand return area
    this.mesh.receiveShadow = true;
  }
}
