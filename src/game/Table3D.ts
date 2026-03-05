import * as THREE from 'three';

export class Table3D {
  mesh: THREE.Mesh;

  constructor() {
    // Width, Height (thickness), Depth
    const geometry = new THREE.BoxGeometry(28, 0.1, 18);
    // A simple wood-like color for now
    const material = new THREE.MeshStandardMaterial({ color: 0xd4a373 });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, -0.05, -3); // Shifted back on Z to leave room for the hand return area
    this.mesh.receiveShadow = true;
  }
}
