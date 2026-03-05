import * as THREE from 'three';
import { useGameStore, computeLaneInsertIndex, computeLaneSlotPosition, type CardState, type DeckState, type GameState } from '../store';
import { Card3D } from './Card3D';
import { Table3D } from './Table3D';
import { Lane3D } from './Lane3D';
import { Region3D } from './Region3D';

const DRAG_PLANE_Y = 0.5;
const TABLE_CARD_SCALE = 1.35;


export class SceneManager {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  
  table: Table3D;
  cards: Map<string, Card3D> = new Map();
  lanes: Map<string, Lane3D> = new Map();
  regions: Map<string, Region3D> = new Map();
  
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2 = new THREE.Vector2(-10, -10);
  
  dragPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y);
  tablePlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  
  activeDragCardId: string | null = null;
  activeDragDeckId: string | null = null;
  isFullDeckDrag: boolean = false;
  
  hoveredTargetId: string | null = null;
  hoveredTargetType: 'card' | 'deck' | null = null;
  
  dragStartClientPos: THREE.Vector2 = new THREE.Vector2();
  lastDragPos: THREE.Vector3 = new THREE.Vector3();

  // Gesture Recognition State
  lastClickTime: number = 0;
  lastClickCardId: string | null = null;
  longClickTimeout: number | null = null;
  singleClickTimeout: number | null = null;
  isRadialDragMode: boolean = false;

  animationFrameId: number | null = null;
  clock: THREE.Clock = new THREE.Clock();

  // Zoom controls
  baseCameraPos: THREE.Vector3 = new THREE.Vector3(0, 22, 10);
  targetCameraPos: THREE.Vector3 = new THREE.Vector3(0, 22, 10);
  currentZoom: number = 1.0;
  minZoom: number = 0.4;
  maxZoom: number = 1.5;

  constructor(container: HTMLDivElement) {
    this.scene = new THREE.Scene();
    
    // Setup Camera (matches old Canvas setup)
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 22, 10); // Higher up and closer on Z for a steeper top-down angle
    this.camera.lookAt(0, 0, 0);

    // Setup Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Fix sRGB output encoding (default in R3F)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Setup Raycaster
    this.raycaster = new THREE.Raycaster();

    // Environment map (cheap fake for now, to replace Environment preset="city")
    this.scene.background = new THREE.Color(0x333333);
    
    // Lights (adjusted to make shadows more transparent and softer)
    const ambientLight = new THREE.AmbientLight(0xffffff, Math.PI * 0.8); // Brighter ambient fills the shadow
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, Math.PI * 0.5); // Softer directional light
    dirLight.position.set(10, 10, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.bias = -0.001;
    // Add radius for a much more blurred PCFSoftShadowMap effect
    dirLight.shadow.radius = 8;
    this.scene.add(dirLight);

    // Table
    this.table = new Table3D();
    this.scene.add(this.table.mesh);

    // Initial load from store
    const storeState = useGameStore.getState();
    
    // Create lanes from store
    for (const laneData of storeState.lanes) {
      const lane3D = new Lane3D(laneData);
      this.lanes.set(laneData.id, lane3D);
      this.scene.add(lane3D.group);
    }
    
    // Create regions from store
    for (const regionData of storeState.regions) {
      const region3D = new Region3D(regionData);
      this.regions.set(regionData.id, region3D);
      this.scene.add(region3D.group);
    }
    
    this.sync(storeState);

    // Subscribe to store updates
    useGameStore.subscribe((state) => {
      this.sync(state);
    });

    // Event Listeners
    window.addEventListener('resize', this.onWindowResize);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    
    // Start Loop
    this.start();
  }

  private onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomSpeed = 0.001;
    this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom + e.deltaY * zoomSpeed));
    this.targetCameraPos.copy(this.baseCameraPos).multiplyScalar(this.currentZoom);
  }

  private getPointerCoords(e: PointerEvent): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    return new THREE.Vector2(x, y);
  }

  private onPointerMove = (e: PointerEvent) => {
    this.pointer.copy(this.getPointerCoords(e));
    const store = useGameStore.getState();

    // Check distance for long click cancel
    const dist = Math.hypot(e.clientX - this.dragStartClientPos.x, e.clientY - this.dragStartClientPos.y);
    
    if (dist > 5) {
      if (this.longClickTimeout) {
        clearTimeout(this.longClickTimeout);
        this.longClickTimeout = null;
        
        if (this.activeDragDeckId && !this.isFullDeckDrag) {
          useGameStore.getState().removeTopCardFromDeck(this.activeDragDeckId);
          this.activeDragDeckId = null;
        }
      }
    }

    // Radial Menu Dragging
    if (this.isRadialDragMode && store.radialMenu.isOpen) {
       document.body.style.cursor = 'crosshair';
       
       if (dist > 25) { // Deadzone for center
         const dx = e.clientX - this.dragStartClientPos.x;
         const dy = e.clientY - this.dragStartClientPos.y;
         // Inverted standard atan2 to match CSS coordinates (y is down)
         const angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
         
         let slice: 'n' | 'e' | 's' | 'w' | 'c' = 'c';
         if (angleDeg >= 315 || angleDeg < 45) slice = 'e';
         else if (angleDeg >= 45 && angleDeg < 135) slice = 's';
         else if (angleDeg >= 135 && angleDeg < 225) slice = 'w';
         else if (angleDeg >= 225 && angleDeg < 315) slice = 'n';
         store.setRadialHover(slice);
       } else {
         store.setRadialHover('c');
       }
       return;
    }

    if (this.activeDragDeckId && this.isFullDeckDrag) {
       document.body.style.cursor = 'grabbing';
       this.raycaster.setFromCamera(this.pointer, this.camera);
       const hit = new THREE.Vector3();
       const tableHit = new THREE.Vector3();

       if (this.raycaster.ray.intersectPlane(this.dragPlane, hit) && this.raycaster.ray.intersectPlane(this.tablePlane, tableHit)) {
         this.lastDragPos.set(tableHit.x, 0, tableHit.z);
         
         const deck = store.decks.find(d => d.id === this.activeDragDeckId);
         if (deck) {
            deck.cardIds.forEach((id, idx) => {
             const cb = this.cards.get(id);
             if (cb) {
                cb.group.position.set(hit.x, DRAG_PLANE_Y + idx * 0.03, hit.z);
                const wobX = (idx % 2 === 0 ? 1 : -1) * 0.005;
                const wobZ = (idx % 2 === 0 ? -1 : 1) * 0.003;
                cb.group.rotation.set(-Math.PI / 2 + 0.3 + wobX, deck.rotation[1] + wobZ, deck.rotation[2]);
                cb.group.scale.set(TABLE_CARD_SCALE, TABLE_CARD_SCALE, TABLE_CARD_SCALE);
             }
          });
                    // Determine if hovering over a valid target
           const ignoreIds = [...deck.cardIds, deck.id];
           const target = this.findDropTarget(tableHit.x, tableHit.z, ignoreIds);
           
           // Check lane hover
           this.updateLaneHover(tableHit.x, tableHit.z, this.activeDragDeckId!);
           this.updateRegionHover(tableHit.x, tableHit.z);
           
           // If inside a lane, suppress card/deck stacking targets — lane insertion takes priority
           const insideLane = this.findLaneAtPosition(tableHit.x, tableHit.z);
           const insideRegion = this.findRegionAtPosition(tableHit.x, tableHit.z);
           if (insideLane || insideRegion) {
             this.hoveredTargetId = null;
             this.hoveredTargetType = null;
           } else {
             this.hoveredTargetId = target?.id || null;
             this.hoveredTargetType = target?.type || null;
           }
           
           const bottomCard = this.cards.get(deck.cardIds[0]);
           if (bottomCard) {
              bottomCard.setGhostOpacity(0);
           }
        }
      }
   } else if (this.activeDragCardId) {
      document.body.style.cursor = 'grabbing';
      const card3D = this.cards.get(this.activeDragCardId);
      if (!card3D) return;

      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = new THREE.Vector3();
      const tableHit = new THREE.Vector3();

      if (this.raycaster.ray.intersectPlane(this.dragPlane, hit) && this.raycaster.ray.intersectPlane(this.tablePlane, tableHit)) {
        this.lastDragPos.set(tableHit.x, 0, tableHit.z);
        
        // Zero-lag tracking
        card3D.group.position.set(hit.x, DRAG_PLANE_Y, hit.z);
        
        // Maintain face-up/down rotation during drag
        const cardModel = store.cards.find(c => c.id === this.activeDragCardId);
        // Hand cards visually act face-up while dragging
        const isFromHand = cardModel?.location === 'hand';
        const flipYRot = (cardModel?.faceUp || isFromHand) ? 0 : Math.PI;
        const tapRot = cardModel?.tapped ? -Math.PI / 2 : 0;
        card3D.group.rotation.set(-Math.PI / 2 + 0.3, flipYRot, tapRot); // Tilt slightly to reveal the drop spot
        
        card3D.group.scale.set(TABLE_CARD_SCALE, TABLE_CARD_SCALE, TABLE_CARD_SCALE);
        
        const dropInHand = this.pointer.y < -0.5;
        if (!dropInHand) {
          const target = this.findDropTarget(tableHit.x, tableHit.z, [this.activeDragCardId]);
          
          // Check lane hover
          this.updateLaneHover(tableHit.x, tableHit.z, this.activeDragCardId!);
          this.updateRegionHover(tableHit.x, tableHit.z);
          
          // If inside a lane, suppress card/deck stacking targets — lane insertion takes priority
          const insideLane = this.findLaneAtPosition(tableHit.x, tableHit.z);
          const insideRegion = this.findRegionAtPosition(tableHit.x, tableHit.z);
          if (insideLane || insideRegion) {
            this.hoveredTargetId = null;
            this.hoveredTargetType = null;
          } else {
            this.hoveredTargetId = target?.id || null;
            this.hoveredTargetType = target?.type || null;
          }
          
          card3D.setGhostOpacity(0);
        } else {
          this.hoveredTargetId = null;
          this.hoveredTargetType = null;
          // Clear lane highlight when heading for hand
          this.clearLaneHover();
          this.clearRegionHover();
          card3D.setGhostOpacity(0);
        }
      }
    } else {
      // Hover logic
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const meshes = Array.from(this.cards.values()).map(c => c.group);
      const intersects = this.raycaster.intersectObjects(meshes, true);
      
      if (intersects.length > 0) {
        document.body.style.cursor = 'grab';
        
        // Find the group userData
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && !obj.userData?.isCard) {
          obj = obj.parent;
        }
        
        const cardId = obj?.userData?.cardId;
        if (cardId && store.hoveredCardId !== cardId) {
          store.setHoveredCard(cardId, e.clientX);
          
          // Focus hand cards on hover for desktop
          const card = store.cards.find(c => c.id === cardId);
          if (card?.location === 'hand') {
            store.setFocusedCard(cardId);
          } else {
            store.setFocusedCard(null);
          }
        }
      } else {
        document.body.style.cursor = 'auto';
        if (store.hoveredCardId !== null) {
          store.setHoveredCard(null);
          store.setFocusedCard(null);
        }
      }
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    // Left click only
    if (e.button !== 0) return;
    
    if (this.singleClickTimeout) {
      clearTimeout(this.singleClickTimeout);
      this.singleClickTimeout = null;
    }

    // If radial menu is open and we click down, we don't start a drag
    if (useGameStore.getState().radialMenu.isOpen) return;

    if (this.activeDragCardId) return;

    this.pointer.copy(this.getPointerCoords(e));
    this.raycaster.setFromCamera(this.pointer, this.camera);
    
    // Check intersection with cards
    const cardGroups = Array.from(this.cards.values()).map(c => c.group);
    const intersects = this.raycaster.intersectObjects(cardGroups, true);

    if (intersects.length > 0) {
      // Find the group userData
      let obj: THREE.Object3D | null = intersects[0].object;
      while (obj && !obj.userData?.isCard) {
        obj = obj.parent;
      }
      
      const cardId = obj?.userData?.cardId;
      if (cardId) {
        const store = useGameStore.getState();
        const cardModel = store.cards.find(c => c.id === cardId);
        
        this.dragStartClientPos.set(e.clientX, e.clientY);
        const tableHit = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.tablePlane, tableHit)) {
          this.lastDragPos.set(tableHit.x, 0, tableHit.z);
        }

        if (cardModel?.location === 'deck') {
           const deck = store.decks.find(d => d.cardIds.includes(cardId));
           if (deck) {
             this.activeDragDeckId = deck.id;
             this.activeDragCardId = deck.cardIds[deck.cardIds.length - 1]; // top card by default
             this.isFullDeckDrag = false;
             
             const c3D = this.cards.get(this.activeDragCardId);
             if (c3D) c3D.isDragging = true;
             
             store.setDragging(true, 'card', this.activeDragCardId);

             this.longClickTimeout = window.setTimeout(() => {
                this.longClickTimeout = null;
                this.isFullDeckDrag = true;
                this.activeDragCardId = null; // Dragging deck instead
                store.setDragging(true, 'deck', this.activeDragDeckId);
                
                // Visual affordance: immediately lift the deck to the drag plane
                this.raycaster.setFromCamera(this.pointer, this.camera);
                const hit = new THREE.Vector3();
                const intersection = this.raycaster.ray.intersectPlane(this.dragPlane, hit);
                
                deck.cardIds.forEach((id, idx) => {
                  const cb = this.cards.get(id);
                  if (cb) {
                     cb.isDragging = true;
                     if (intersection) {
                        cb.group.position.set(hit.x, DRAG_PLANE_Y + idx * 0.025, hit.z);
                        const stackWobbleRot = (idx % 2 === 0 ? 1 : -1) * 0.015 * idx;
                        const cardModel = store.cards.find(c => c.id === id);
                        const flipYRot = cardModel?.faceUp ? 0 : Math.PI;
                        const tapRot = cardModel?.tapped ? -Math.PI / 2 : 0;
                        cb.group.rotation.set(-Math.PI / 2 + 0.3, deck.rotation[1] + stackWobbleRot + flipYRot, deck.rotation[2] + tapRot);
                     }
                  }
                });
             }, 400);
           }
        } else {
           this.activeDragCardId = cardId;
           this.activeDragDeckId = null;
           this.isFullDeckDrag = false;
           
           const card3D = this.cards.get(cardId);
           if (card3D) {
             card3D.isDragging = true;
             store.setDragging(true, 'card', cardId);

             if (cardModel?.location === 'table') {
                 this.longClickTimeout = window.setTimeout(() => {
                    this.longClickTimeout = null;
                    this.isRadialDragMode = true;
                    
                    card3D.isDragging = false; 
                    this.activeDragCardId = null;
                    store.setDragging(false, null);
                    card3D.setGhostOpacity(0);
                    card3D.updateTransform(); 
                    
                    store.openRadialMenu(e.clientX, e.clientY, cardId, 'card');
                 }, 400);
             }
           }
        }
      }
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    const store = useGameStore.getState();

    const dist = Math.hypot(e.clientX - this.dragStartClientPos.x, e.clientY - this.dragStartClientPos.y);
    const now = performance.now();

    // Clear long press if it hasn't fired
    if (this.longClickTimeout) {
      clearTimeout(this.longClickTimeout);
      this.longClickTimeout = null;
    }

    // Radial drag resolution
    if (this.isRadialDragMode) {
      this.isRadialDragMode = false;
      const hovered = store.radialMenu.hoveredSlice;
      const itemId = store.radialMenu.itemId;
      const itemType = store.radialMenu.itemType;
      
      if (hovered && itemId) {
         // Map directional gestures to actions
         if (itemType === 'card') {
            if (hovered === 'c') store.setPreviewCard(itemId);
            else if (hovered === 'e') store.tapCard(itemId);
            else if (hovered === 's') store.flipCard(itemId);
         } else if (itemType === 'deck') {
            if (hovered === 'c') {
               const deck = store.decks.find(d => d.id === itemId);
               if (deck && deck.cardIds.length > 0) {
                 store.setPreviewCard(deck.cardIds[deck.cardIds.length - 1]);
               }
            }
            else if (hovered === 'e') store.tapDeck(itemId);
            else if (hovered === 's') store.flipDeck(itemId);
         }
      }
      store.closeRadialMenu();
      return; 
    }

    if (!this.activeDragCardId && !this.activeDragDeckId) {
      if (dist < 5) {
        store.setFocusedCard(null);
      }
      return;
    }
    const isDoubleClick = (now - this.lastClickTime < 300) && (this.lastClickCardId === this.activeDragCardId);

    // Tap logic
    if (dist < 5) {
       if (this.activeDragDeckId) { 
          this.lastClickTime = now;
          this.lastClickCardId = this.activeDragCardId; // ID of top card
          
          if (this.singleClickTimeout) {
             clearTimeout(this.singleClickTimeout);
             this.singleClickTimeout = null;
          }
          store.openRadialMenu(e.clientX, e.clientY, this.activeDragDeckId, 'deck');
          
          // Cleanup deck specific drag
          const c3D = this.cards.get(this.activeDragCardId!);
          if (c3D) c3D.isDragging = false;
       } else if (this.activeDragCardId) {
          const c = store.cards.find(x => x.id === this.activeDragCardId);
          if (c) {
             if (isDoubleClick) {
                if (this.singleClickTimeout) {
                    clearTimeout(this.singleClickTimeout);
                    this.singleClickTimeout = null;
                }
                store.setPreviewCard(c.id);
                store.closeRadialMenu(); 
                this.lastClickTime = 0; 
             } else {
                this.lastClickTime = now;
                this.lastClickCardId = c.id;
                
                if (c.location === 'table') {
                    this.singleClickTimeout = window.setTimeout(() => {
                        this.singleClickTimeout = null;
                        store.openRadialMenu(e.clientX, e.clientY, c.id, 'card');
                    }, 250);
                } else if (c.location === 'hand') {
                    store.setFocusedCard(store.focusedCardId === c.id ? null : c.id);
                }
             }
          }
          const c3D = this.cards.get(this.activeDragCardId);
          if (c3D) c3D.isDragging = false;
       }

       this.activeDragCardId = null;
       this.activeDragDeckId = null;
       this.hoveredTargetId = null;
       this.hoveredTargetType = null;
       this.isFullDeckDrag = false;
       store.setDragging(false, null);
       store.setLanePreview(null, null, null); // Added this line
       this.clearRegionHover();
       return;
    }

    this.lastClickTime = 0;

    // Drop logic
    if (this.activeDragDeckId && this.isFullDeckDrag) {
       const deck = store.decks.find(d => d.id === this.activeDragDeckId);
       const dropTarget = this.findDropTarget(this.lastDragPos.x, this.lastDragPos.z, [this.activeDragDeckId]);
       const lane = this.findLaneAtPosition(this.lastDragPos.x, this.lastDragPos.z);
       const region = this.findRegionAtPosition(this.lastDragPos.x, this.lastDragPos.z);
       
       if (lane) {
          const laneData = store.lanes.find(l => l.id === lane.id);
          if (laneData) {
            // Remove from previous lane if reordering
            store.removeFromLane(this.activeDragDeckId);
            const countWithout = laneData.itemOrder.filter(id => id !== this.activeDragDeckId).length;
            const insertIdx = computeLaneInsertIndex(laneData, this.lastDragPos.x, countWithout);
            store.insertIntoLane(lane.id, this.activeDragDeckId, insertIdx);
            const slotPos = store.getLaneSlotPosition(lane.id, insertIdx);
            if (slotPos) {
              store.moveDeck(this.activeDragDeckId, slotPos, undefined, lane.id);
            } else {
              store.moveDeck(this.activeDragDeckId, [this.lastDragPos.x, 0, this.lastDragPos.z], undefined);
            }
          }
       } else if (dropTarget?.type === 'deck') {
          store.addDeckToDeck(this.activeDragDeckId, dropTarget.id);
       } else if (dropTarget?.type === 'card') {
          // Drop deck onto a single card: add the card to the bottom of the deck
          store.addCardUnderDeck(dropTarget.id, this.activeDragDeckId);
          // Move deck to the card's position
          const targetCard = store.cards.find(c => c.id === dropTarget.id);
          if (targetCard) {
            store.moveDeck(this.activeDragDeckId, [...targetCard.position], undefined);
          }
       } else if (region) {
          const regionData = store.regions.find(r => r.id === region.id);
          if (regionData) {
             store.removeFromLane(this.activeDragDeckId);
             store.removeFromRegion(this.activeDragDeckId);
             store.moveDeck(this.activeDragDeckId, [regionData.position[0], 0, regionData.position[2]], undefined, undefined, region.id);
          }
       } else {
          // Dropping on table outside lane
          store.removeFromLane(this.activeDragDeckId);
          store.moveDeck(this.activeDragDeckId, [this.lastDragPos.x, 0, this.lastDragPos.z], undefined);
       }
        
        if (deck) {
          deck.cardIds.forEach(id => {
             const c3D = this.cards.get(id);
             if (c3D) { c3D.setGhostOpacity(0); }
          });
       }
    } else if (this.activeDragCardId) {
       const dropInHand = this.pointer.y < -0.5;
       const dropTarget = this.findDropTarget(this.lastDragPos.x, this.lastDragPos.z, [this.activeDragCardId]);

       const cardModel = store.cards.find(c => c.id === this.activeDragCardId);
       const fromHand = cardModel?.location === 'hand';

       if (!dropInHand) {
          const lane = this.findLaneAtPosition(this.lastDragPos.x, this.lastDragPos.z);
          const region = this.findRegionAtPosition(this.lastDragPos.x, this.lastDragPos.z);
          
          if (lane) {
             const laneData = store.lanes.find(l => l.id === lane.id);
             if (laneData) {
               // Remove from previous lane if reordering
               store.removeFromLane(this.activeDragCardId);
               const countWithout = laneData.itemOrder.filter(id => id !== this.activeDragCardId).length;
               const insertIdx = computeLaneInsertIndex(laneData, this.lastDragPos.x, countWithout);
               store.insertIntoLane(lane.id, this.activeDragCardId, insertIdx);
               const slotPos = store.getLaneSlotPosition(lane.id, insertIdx);
               if (slotPos) {
                 store.moveCard(this.activeDragCardId, 'table', slotPos, [0, 0, 0], lane.id);
               } else {
                 store.moveCard(this.activeDragCardId, 'table', [this.lastDragPos.x, 0, this.lastDragPos.z], [0, 0, 0]);
               }
             }
          } else if (dropTarget?.type === 'card') {
             store.createDeck(this.activeDragCardId, dropTarget.id);
          } else if (dropTarget?.type === 'deck') {
             store.addCardToDeck(this.activeDragCardId, dropTarget.id);
          } else if (region) {
             const regionData = store.regions.find(r => r.id === region.id);
             if (regionData) {
                store.removeFromLane(this.activeDragCardId);
                store.removeFromRegion(this.activeDragCardId);
                store.moveCard(this.activeDragCardId, 'table', [regionData.position[0], 0, regionData.position[2]], [0, 0, 0], undefined, region.id);
             }
          } else {
             // Dropping outside any lane — remove from lane if it was in one
             store.removeFromLane(this.activeDragCardId);
             store.moveCard(this.activeDragCardId, 'table', [this.lastDragPos.x, 0, this.lastDragPos.z], [0, 0, 0]);
          }

          if (fromHand && cardModel && !cardModel.faceUp) {
             store.flipCard(this.activeDragCardId);
          }
       } else {
           const c = store.cards.find(c => c.id === this.activeDragCardId);
           if (c && c.location === 'table') {
             store.moveCard(c.id, 'hand');
             if (c.faceUp) store.flipCard(c.id);
          }
       }
       
       const c3D = this.cards.get(this.activeDragCardId);
       if (c3D) { c3D.setGhostOpacity(0); }
    }

    // Clear lane preview BEFORE setting isDragging=false to prevent layout race
    this.clearLaneHover();
    this.clearRegionHover();

    // Now release the drag state
    if (this.activeDragCardId) {
      const c3D = this.cards.get(this.activeDragCardId);
      if (c3D) c3D.isDragging = false;
    }
    if (this.activeDragDeckId) {
      const store2 = useGameStore.getState();
      const deck = store2.decks.find(d => d.id === this.activeDragDeckId);
      if (deck) {
        deck.cardIds.forEach(id => {
          const c3D = this.cards.get(id);
          if (c3D) c3D.isDragging = false;
        });
      }
    }

    this.activeDragCardId = null;
    this.activeDragDeckId = null;
    this.hoveredTargetId = null;
    this.hoveredTargetType = null;
    this.isFullDeckDrag = false;
    store.setDragging(false, null);
  }

  private findDropTarget(x: number, z: number, ignoreIds: string[]): { type: 'card'|'deck', id: string } | null {
    const store = useGameStore.getState();
    const dropRadius = 1.0; 
    
    // Check Decks first
    for (const deck of store.decks) {
      if (ignoreIds.includes(deck.id)) continue;
      const dx = deck.position[0] - x;
      const dz = deck.position[2] - z;
      if (Math.hypot(dx, dz) < dropRadius) {
        return { type: 'deck', id: deck.id };
      }
    }
    
    // Check Table Cards
    for (const card of store.cards) {
      if (card.location === 'table' && !ignoreIds.includes(card.id)) {
        const dx = card.position[0] - x;
        const dz = card.position[2] - z;
        if (Math.hypot(dx, dz) < dropRadius) {
          return { type: 'card', id: card.id };
        }
      }
    }
    
    return null;
  }

  private findLaneAtPosition(x: number, z: number): { id: string } | null {
    const store = useGameStore.getState();
    for (const lane of store.lanes) {
      const lane3D = this.lanes.get(lane.id);
      if (lane3D && lane3D.containsPoint(x, z, lane)) {
        return { id: lane.id };
      }
    }
    return null;
  }

  private updateLaneHover(x: number, z: number, dragItemId?: string) {
    const store = useGameStore.getState();
    const laneResult = this.findLaneAtPosition(x, z);
    const newLaneId = laneResult?.id || null;
    if (store.activeLaneId !== newLaneId) {
      store.setActiveLane(newLaneId);
    }
    // Update lane3D highlights
    for (const [id, lane3D] of this.lanes) {
      lane3D.setHighlighted(id === newLaneId);
    }
    // Compute preview insertion index
    if (newLaneId && dragItemId) {
      const lane = store.lanes.find(l => l.id === newLaneId);
      if (lane) {
        // Count items excluding the dragged one (for reorder case)
        const countWithout = lane.itemOrder.filter(id => id !== dragItemId).length;
        const insertIdx = computeLaneInsertIndex(lane, x, countWithout);
        if (store.lanePreviewIndex !== insertIdx || store.lanePreviewLaneId !== newLaneId || store.lanePreviewItemId !== dragItemId) {
          store.setLanePreview(newLaneId, insertIdx, dragItemId);
        }
      }
    } else {
      if (store.lanePreviewLaneId !== null) {
        store.setLanePreview(null, null, null);
      }
    }
  }

  private clearLaneHover() {
    const store = useGameStore.getState();
    // Clear preview FIRST so layout doesn't have stale preview filtering
    if (store.lanePreviewLaneId !== null) {
      store.setLanePreview(null, null, null);
    }
    if (store.activeLaneId !== null) {
      store.setActiveLane(null);
    }
    for (const lane3D of this.lanes.values()) {
      lane3D.setHighlighted(false);
    }
  }

  private findRegionAtPosition(x: number, z: number): { id: string } | null {
    const store = useGameStore.getState();
    for (const region of store.regions) {
      const region3D = this.regions.get(region.id);
      if (region3D && region3D.containsPoint(x, z, region)) {
        return { id: region.id };
      }
    }
    return null;
  }

  private updateRegionHover(x: number, z: number) {
    const store = useGameStore.getState();
    const regionResult = this.findRegionAtPosition(x, z);
    const newRegionId = regionResult?.id || null;
    if (store.activeRegionId !== newRegionId) {
      store.setActiveRegion(newRegionId);
    }
    for (const [id, region3D] of this.regions) {
      region3D.setHighlighted(id === newRegionId);
    }
  }

  private clearRegionHover() {
    const store = useGameStore.getState();
    if (store.activeRegionId !== null) {
      store.setActiveRegion(null);
    }
    for (const region3D of this.regions.values()) {
      region3D.setHighlighted(false);
    }
  }

  private sync(state: GameState) {
    // 1. Add new cards or update instances
    for (const data of state.cards) {
      if (!this.cards.has(data.id)) {
        const c3d = new Card3D(data);
        this.cards.set(data.id, c3d);
        this.scene.add(c3d.group);
        this.scene.add(c3d.ghostGroup);
      }
      
      const c3d = this.cards.get(data.id);
      if (c3d) {
        c3d.refreshArtwork(data.artworkUrl);
      }
    }

    this.updateLayout(state);
  }

  private updateLayout(state: GameState) {
    // 2. Compute Layout directly in SceneManager instead of individual Cards
    const storeCards = state.cards;
    const storeDecks = state.decks;

    // Map cards to decks for quick lookup
    const cardToDeckMap = new Map<string, DeckState>();
    for (const deck of storeDecks) {
      for (const cardId of deck.cardIds) {
        cardToDeckMap.set(cardId, deck);
      }
    }

    const handCards = storeCards.filter((c: CardState) => c.location === 'hand');
    const totalHandCards = handCards.length;

    for (const cardData of storeCards) {
      const card3D = this.cards.get(cardData.id);
      if (!card3D) continue;

      const inDeck = cardData.location === 'deck';
      card3D.setCastShadow(cardData.location === 'table' || inDeck || card3D.isDragging);

      if (card3D.isDragging) continue;

      const deck = cardToDeckMap.get(cardData.id);

      let isHoveredTarget = false;
      if (this.hoveredTargetId) {
         if (this.hoveredTargetType === 'card' && cardData.id === this.hoveredTargetId) {
            isHoveredTarget = true;
         } else if (this.hoveredTargetType === 'deck' && deck && deck.id === this.hoveredTargetId) {
            isHoveredTarget = true;
         }
      }

      const wiggleRot = isHoveredTarget ? Math.sin(performance.now() * 0.025) * 0.1 : 0;
      const lift = isHoveredTarget ? 0.05 : 0; // slight lift on hover

      if (cardData.location === 'table' && !inDeck) {
        // Check if this card is in a lane — if so, position from lane ordering
        const laneForCard = cardData.laneId ? state.lanes.find(l => l.id === cardData.laneId) : null;
        if (laneForCard) {
          // Position from lane slot
          const orderWithout = laneForCard.itemOrder.filter(id => id !== (state.lanePreviewItemId || ''));
          let slotIndex = orderWithout.indexOf(cardData.id);
          // Removed the forced slotIndex = 0 here to allow the fallback to absolute position
          
          // If there's a preview insertion happening in this lane, shift items to make space
          if (state.lanePreviewLaneId === laneForCard.id && state.lanePreviewIndex !== null && state.lanePreviewItemId) {
            // Items at or after the preview index get shifted right by one slot
            if (state.lanePreviewItemId !== cardData.id && slotIndex >= state.lanePreviewIndex) {
              slotIndex += 1;
            }
          }
          
           const slotPos = computeLaneSlotPosition(laneForCard, slotIndex);
           
           if (slotIndex === -1) {
             // If for some reason the card is not in the itemOrder, fall back to its absolute position
             card3D.targetPosition.set(cardData.position[0], 0.01 + lift, cardData.position[2]);
           } else {
             card3D.targetPosition.set(slotPos[0], 0.01 + lift, slotPos[2]);
           }
          const tapRot = cardData.tapped ? -Math.PI / 2 : 0;
          const flipYRot = cardData.faceUp ? 0 : Math.PI;
          const rotX = -Math.PI / 2;
          card3D.targetQuaternion.setFromEuler(new THREE.Euler(rotX, cardData.rotation[1] + wiggleRot + flipYRot, cardData.rotation[2] + wiggleRot + tapRot));
          card3D.targetScale.set(TABLE_CARD_SCALE, TABLE_CARD_SCALE, TABLE_CARD_SCALE);
        } else {
          card3D.targetPosition.set(cardData.position[0], 0.01 + lift, cardData.position[2]);
          const tapRot = cardData.tapped ? -Math.PI / 2 : 0;
          const flipYRot = cardData.faceUp ? 0 : Math.PI;
          const rotX = -Math.PI / 2;
          card3D.targetQuaternion.setFromEuler(new THREE.Euler(rotX, cardData.rotation[1] + wiggleRot + flipYRot, cardData.rotation[2] + wiggleRot + tapRot));
          card3D.targetScale.set(TABLE_CARD_SCALE, TABLE_CARD_SCALE, TABLE_CARD_SCALE);
        }
      } else if (inDeck && deck) {
        // Check if deck is in a lane
        const laneForDeck = deck.laneId ? state.lanes.find(l => l.id === deck.laneId) : null;
        let deckBaseX = deck.position[0];
        let deckBaseZ = deck.position[2];
        
        if (laneForDeck) {
          const orderWithout = laneForDeck.itemOrder.filter(id => id !== (state.lanePreviewItemId || ''));
          let slotIndex = orderWithout.indexOf(deck.id);
          if (slotIndex === -1) slotIndex = 0;
          
          if (state.lanePreviewLaneId === laneForDeck.id && state.lanePreviewIndex !== null && state.lanePreviewItemId) {
            if (state.lanePreviewItemId !== deck.id && slotIndex >= state.lanePreviewIndex) {
              slotIndex += 1;
            }
          }
          
          const slotPos = computeLaneSlotPosition(laneForDeck, slotIndex);
          deckBaseX = slotPos[0];
          deckBaseZ = slotPos[2];
        }
        
        const indexInDeck = deck.cardIds.indexOf(cardData.id);
        const yOffset = 0.01 + lift + indexInDeck * 0.03;
        const wobX = (indexInDeck % 2 === 0 ? 1 : -1) * 0.005;
        const wobZ = (indexInDeck % 2 === 0 ? -1 : 1) * 0.003;
        
        card3D.targetPosition.set(deckBaseX, yOffset, deckBaseZ);
        const tapRot = cardData.tapped ? -Math.PI / 2 : 0;
        const flipYRot = cardData.faceUp ? 0 : Math.PI;
        const rotX = -Math.PI / 2;
        card3D.targetQuaternion.setFromEuler(new THREE.Euler(rotX + wobX, deck.rotation[1] + wobZ + wiggleRot + flipYRot, deck.rotation[2] + wiggleRot + tapRot));
        card3D.targetScale.set(TABLE_CARD_SCALE, TABLE_CARD_SCALE, TABLE_CARD_SCALE);
      } else if (cardData.location === 'hand') {
        const indexInHand = handCards.findIndex((c: CardState) => c.id === cardData.id);
        const isFocused = state.focusedCardId === cardData.id;
        
        // HUD Tracking calculation identical to old useFrame
        this.camera.updateMatrixWorld();

        const spacing = 1.3;
        const startX = -(totalHandCards - 1) * spacing / 2;
        const xOffset = startX + indexInHand * spacing;
        
        const distance = 3;
        const baseScale = 0.45;
        const focusedScale = 0.65;
        const currentScale = isFocused ? focusedScale : baseScale;
        const liftHUD = isFocused ? 1.2 : 0;

        // Pushing Y further down so they tuck into the bottom border
        const vector = new THREE.Vector3(xOffset * baseScale, (-2.8 + liftHUD) * baseScale, -distance);
        vector.applyMatrix4(this.camera.matrixWorld);
        
        const worldQuat = this.camera.quaternion.clone();
        const localQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 6);
        worldQuat.multiply(localQuat);
        
        card3D.targetPosition.copy(vector);
        card3D.targetQuaternion.copy(worldQuat);
        card3D.targetScale.set(currentScale, currentScale, currentScale);
      }
    }
  }

  private start() {
    this.clock.start();
    const loop = () => {
      this.animationFrameId = requestAnimationFrame(loop);
      this.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  private update() {
    const delta = this.clock.getDelta();
    // Use capped delta to avoid huge jumps on tab switch
    const safeDelta = Math.min(delta, 0.1);
    
    // Smooth camera zoom
    this.camera.position.lerp(this.targetCameraPos, 10 * safeDelta);
    this.camera.lookAt(0, 0, 0);

    // Keep hand layout attached to moving camera
    this.updateLayout(useGameStore.getState());

    // Update all cards and their layout
    for (const card of this.cards.values()) {
      card.update(safeDelta);
    }
    
    // Update lane animations
    for (const lane of this.lanes.values()) {
      lane.update(safeDelta);
    }
    
    // Update region animations
    for (const region of this.regions.values()) {
      region.update(safeDelta);
    }
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    
    this.renderer.domElement.remove();
    this.renderer.dispose();
    
    // Cleanup lanes
    for (const lane of this.lanes.values()) {
      lane.dispose();
    }
    this.lanes.clear();
    
    // Cleanup regions
    for (const region of this.regions.values()) {
      region.dispose();
    }
    this.regions.clear();
    
    this.scene.clear();
  }
}
