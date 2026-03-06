import * as THREE from 'three';
import { useGameStore, computeLaneInsertIndex, computeLaneSlotPosition, type CardState, type DeckState, type GameState, type SelectionItem } from '../store';
import { Card3D } from './Card3D';
import { Table3D } from './Table3D';
import { Lane3D } from './Lane3D';
import { Region3D } from './Region3D';
import { getCardBackUrl } from '../services/marvelCdb';
import { getCardTableEuler } from '../utils/cardOrientation';
import { getCardCenterOffsetBelowTitle, getTitleWorldHeight, REGION_TITLE_LAYOUT } from '../utils/areaLayout';
import { BOARD_CONFIG } from '../config/board';

const DRAG_PLANE_Y = 0.5;
const TABLE_CARD_SCALE = 1.35;
const HAND_DROP_THRESHOLD = -0.5;
const HAND_CARD_SPACING = 1.625;
const HAND_DISTANCE = 3;
const HAND_BASE_SCALE = 0.36;
const HAND_FOCUSED_SCALE = 0.52;
const HAND_FOCUSED_LIFT = 1.5;
const HAND_BASE_Y_OFFSET = -3.5;

type DraggedCardOrigin = {
  cardId: string;
  card: Pick<CardState, 'location' | 'position' | 'rotation' | 'faceUp' | 'laneId' | 'regionId'>;
  sourceDeck?: Pick<DeckState, 'id' | 'position' | 'rotation' | 'cardIds' | 'laneId' | 'regionId'> & {
    laneIndex?: number;
  };
};

type DragOrigin = {
  item: SelectionItem;
  position: [number, number, number];
  rotation: [number, number, number];
  laneId?: string;
  regionId?: string;
  laneIndex?: number;
};

type DragSelectionEntry = {
  item: SelectionItem;
  offset: THREE.Vector3;
};


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

  lastClickTime: number = 0;
  lastClickCardId: string | null = null;
  singleClickTimeout: number | null = null;
  draggedCardOrigin: DraggedCardOrigin | null = null;
  pendingSelectionItem: SelectionItem | null = null;
  pendingCardId: string | null = null;
  isPendingMarquee: boolean = false;
  isMarqueeSelecting: boolean = false;
  isGroupDrag: boolean = false;
  dragSelectionEntries: DragSelectionEntry[] = [];
  dragOrigins: DragOrigin[] = [];
  lastSelectionBoundsKey: string | null = null;

  animationFrameId: number | null = null;
  clock: THREE.Clock = new THREE.Clock();

  // Zoom controls
  baseCameraPos: THREE.Vector3 = new THREE.Vector3(0, 26, 8);
  targetCameraPos: THREE.Vector3 = new THREE.Vector3(0, 26, 8);
  currentZoom: number = 1.0;
  minZoom: number = 0.4;
  maxZoom: number = 1.5;

  constructor(container: HTMLDivElement) {
    this.scene = new THREE.Scene();
    
    // Setup Camera (matches old Canvas setup)
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 26, 8); // Higher up and less Z for a steeper top-down angle
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
      this.syncActiveGroupDrag(state);
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

  private getPointerCoordsFromClient(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return new THREE.Vector2(x, y);
  }

  private getPointerCoords(e: PointerEvent): THREE.Vector2 {
    return this.getPointerCoordsFromClient(e.clientX, e.clientY)
  }

  private isAdditiveSelectionEvent(e: PointerEvent) {
    return e.metaKey || e.ctrlKey
  }

  private isTouchLikePointer(e: PointerEvent) {
    return e.pointerType === 'touch' || e.pointerType === 'pen'
  }

  private getSelectionItemForCard(cardId: string): SelectionItem | null {
    const store = useGameStore.getState()
    const card = store.cards.find((entry) => entry.id === cardId)
    if (!card || (card.location !== 'table' && card.location !== 'deck')) return null

    if (card.location === 'deck') {
      const deck = store.decks.find((entry) => entry.cardIds.includes(cardId))
      return deck ? { id: deck.id, kind: 'deck' } : null
    }

    return { id: card.id, kind: 'card' }
  }

  private isSelectionItemSelected(item: SelectionItem) {
    return useGameStore.getState().selectedItems.some((entry) => entry.id === item.id && entry.kind === item.kind)
  }

  private getRevealPreviewCardId(item: SelectionItem, fallbackCardId: string | null = null) {
    const store = useGameStore.getState()

    if (item.kind === 'card') {
      return fallbackCardId
    }

    const deck = store.decks.find((entry) => entry.id === item.id)
    if (!deck || deck.cardIds.length === 0) return null

    const topCardId = deck.cardIds[deck.cardIds.length - 1]
    const topCard = store.cards.find((entry) => entry.id === topCardId)
    return topCard?.faceUp ? topCardId : null
  }

  private onPointerMove = (e: PointerEvent) => {
    this.pointer.copy(this.getPointerCoords(e));
    const store = useGameStore.getState();
    const dist = Math.hypot(e.clientX - this.dragStartClientPos.x, e.clientY - this.dragStartClientPos.y);

    if (this.isPendingMarquee && dist > 5 && !this.isMarqueeSelecting) {
      this.isMarqueeSelecting = true
      store.startMarqueeSelection(this.dragStartClientPos.x, this.dragStartClientPos.y, this.isAdditiveSelectionEvent(e))
    }

    if (this.isMarqueeSelecting) {
      document.body.style.cursor = 'crosshair'
      store.updateMarqueeSelection(e.clientX, e.clientY)
      this.applyMarqueeSelection(e.clientX, e.clientY, store.marqueeSelection.additive)
      return
    }

    if (this.pendingSelectionItem && dist > 5 && !this.activeDragCardId && !this.activeDragDeckId) {
      if (this.isSelectionItemSelected(this.pendingSelectionItem)) {
        this.beginSelectionDrag(this.pendingSelectionItem)
      } else if (this.pendingCardId) {
        this.beginSingleDrag(this.pendingCardId)
      }
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
   } else if (this.activeDragCardId || this.isGroupDrag) {
      document.body.style.cursor = 'grabbing';
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = new THREE.Vector3();
      const tableHit = new THREE.Vector3();

      if (this.raycaster.ray.intersectPlane(this.dragPlane, hit) && this.raycaster.ray.intersectPlane(this.tablePlane, tableHit)) {
        this.lastDragPos.set(tableHit.x, 0, tableHit.z);

        if (this.isGroupDrag) {
          this.updateGroupDragPositions(hit)
          store.setDraggedSelectionItems(this.getOrderedItemsForDrop())
          store.setDragTargetContext({
            position: [this.lastDragPos.x, this.lastDragPos.y, this.lastDragPos.z],
            rotation: [0, 0, 0],
          })
          this.updateLaneHover(tableHit.x, tableHit.z, this.pendingSelectionItem?.id ?? this.dragSelectionEntries[0]?.item.id)
          this.updateRegionHover(tableHit.x, tableHit.z)
          this.hoveredTargetId = null
          this.hoveredTargetType = null
          return
        }

        const card3D = this.cards.get(this.activeDragCardId!)
        if (!card3D) return

        card3D.group.position.set(hit.x, DRAG_PLANE_Y, hit.z);

        const cardModel = store.cards.find(c => c.id === this.activeDragCardId);
        const isFromHand = cardModel?.location === 'hand';
        if (cardModel) {
          const dragCardModel = isFromHand ? { ...cardModel, location: 'table' as const, faceUp: true } : cardModel
          const dragEuler = getCardTableEuler(dragCardModel, 0, 0.3)
          card3D.group.rotation.set(dragEuler.x, dragEuler.y, dragEuler.z)
        }

        card3D.group.scale.set(TABLE_CARD_SCALE, TABLE_CARD_SCALE, TABLE_CARD_SCALE);

        const dropInHand = this.pointer.y < HAND_DROP_THRESHOLD;
        if (!dropInHand) {
          this.clearHandPreview();
          const target = this.findDropTarget(tableHit.x, tableHit.z, [this.activeDragCardId!]);

          this.updateLaneHover(tableHit.x, tableHit.z, this.activeDragCardId!);
          this.updateRegionHover(tableHit.x, tableHit.z);

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
          this.updateHandPreview(e.clientX, this.activeDragCardId!);
          this.hoveredTargetId = null;
          this.hoveredTargetType = null;
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

    if (this.activeDragCardId || this.activeDragDeckId || this.isGroupDrag) return;

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
        const selectionItem = this.getSelectionItemForCard(cardId)
        
        this.dragStartClientPos.set(e.clientX, e.clientY);
        const tableHit = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.tablePlane, tableHit)) {
          this.lastDragPos.set(tableHit.x, 0, tableHit.z);
        }

        if (selectionItem && (cardModel?.location === 'table' || cardModel?.location === 'deck')) {
          const revealPreviewCardId = this.getRevealPreviewCardId(selectionItem, cardId)
          const isTouchDoubleTap = this.isTouchLikePointer(e)
            && revealPreviewCardId !== null
            && this.lastClickCardId === cardId
            && (performance.now() - this.lastClickTime < 300)

          if (isTouchDoubleTap) {
            store.selectOnly(selectionItem)
            store.setPreviewCard(revealPreviewCardId)
            this.lastClickTime = 0
            this.lastClickCardId = null
            this.pendingSelectionItem = null
            this.pendingCardId = null
            this.isPendingMarquee = false
            return
          }

          this.pendingSelectionItem = selectionItem
          this.pendingCardId = cardId
          this.isPendingMarquee = false
          return
        }

        if (cardModel) {
          this.rememberDraggedCardOrigin(cardModel);
        }
        this.activeDragCardId = cardId;
        this.activeDragDeckId = null;
        this.isFullDeckDrag = false;
        
        const card3D = this.cards.get(cardId);
        if (card3D) {
          card3D.isDragging = true;
          store.setDragging(true, 'card', cardId);
        }
        return
      }
    }

    this.dragStartClientPos.set(e.clientX, e.clientY)
    this.isPendingMarquee = true
    this.pendingSelectionItem = null
    this.pendingCardId = null
  }

  private onPointerUp = (e: PointerEvent) => {
    const store = useGameStore.getState();
    const dist = Math.hypot(e.clientX - this.dragStartClientPos.x, e.clientY - this.dragStartClientPos.y);
    const now = performance.now();

    if (this.isMarqueeSelecting) {
      this.applyMarqueeSelection(e.clientX, e.clientY, store.marqueeSelection.additive)
      store.endMarqueeSelection()
      this.isMarqueeSelecting = false
      this.isPendingMarquee = false
      this.pendingSelectionItem = null
      this.pendingCardId = null
      return
    }

    if (this.pendingSelectionItem && !this.activeDragCardId && !this.activeDragDeckId && !this.isGroupDrag) {
      const item = this.pendingSelectionItem
      const revealPreviewCardId = this.getRevealPreviewCardId(item, this.pendingCardId)
      const isDoubleClick = revealPreviewCardId !== null
        && this.pendingCardId !== null
        && (now - this.lastClickTime < 300)
        && this.lastClickCardId === this.pendingCardId

      if (this.isTouchLikePointer(e) && store.hoveredCardId !== null) {
        store.setHoveredCard(null)
        store.setFocusedCard(null)
      }

      if (this.isAdditiveSelectionEvent(e)) {
        store.toggleSelection(item)
      } else {
        store.selectOnly(item)
      }

      if (isDoubleClick && revealPreviewCardId) {
        store.setPreviewCard(revealPreviewCardId)
        this.lastClickTime = 0
      } else {
        this.lastClickTime = now
        this.lastClickCardId = this.pendingCardId
      }

      this.pendingSelectionItem = null
      this.pendingCardId = null
      return
    }

    if (!this.activeDragCardId && !this.activeDragDeckId && !this.isGroupDrag) {
      if (this.isPendingMarquee && dist < 5) {
        store.clearSelection()
        store.setFocusedCard(null)
        if (this.isTouchLikePointer(e) && store.hoveredCardId !== null) {
          store.setHoveredCard(null)
        }
      }
      this.isPendingMarquee = false
      this.draggedCardOrigin = null;
      return;
    }

    if (this.isGroupDrag) {
      this.completeGroupDrop()
      this.finishGroupDrag()
      return
    }

    this.lastClickTime = 0;

    if (this.activeDragCardId && this.isTouchLikePointer(e) && dist < 5) {
      const tappedCard = store.cards.find((card) => card.id === this.activeDragCardId)
      if (tappedCard?.location === 'hand') {
        const isSameCard = store.hoveredCardId === tappedCard.id
        store.setHoveredCard(isSameCard ? null : tappedCard.id, isSameCard ? null : e.clientX)
        store.setFocusedCard(isSameCard ? null : tappedCard.id)
        this.clearHandPreview()

        const card3D = this.cards.get(this.activeDragCardId)
        if (card3D) {
          card3D.setGhostOpacity(0)
          card3D.isDragging = false
        }

        this.activeDragCardId = null
        this.activeDragDeckId = null
        this.hoveredTargetId = null
        this.hoveredTargetType = null
        this.isFullDeckDrag = false
        this.draggedCardOrigin = null
        store.setDragging(false, null)
        return
      }
    }

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
            const orderWithout = laneData.itemOrder.filter(id => id !== this.activeDragDeckId);
            const insertIdx = computeLaneInsertIndex(laneData, this.lastDragPos.x, countWithout, store.cards, store.decks, orderWithout);
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
             const labelWorldHeight = getTitleWorldHeight(
               REGION_TITLE_LAYOUT.worldWidth,
               REGION_TITLE_LAYOUT.canvasWidth,
               REGION_TITLE_LAYOUT.canvasHeight,
             );
             const cardCenterOffset = getCardCenterOffsetBelowTitle(
               regionData.depth,
               REGION_TITLE_LAYOUT.labelCenterOffset,
               labelWorldHeight,
             );
             store.moveDeck(this.activeDragDeckId, [regionData.position[0], 0, regionData.position[2] + cardCenterOffset], undefined, undefined, region.id);
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
	       const dropInHand = this.pointer.y < HAND_DROP_THRESHOLD;
	       const dropTarget = this.findDropTarget(this.lastDragPos.x, this.lastDragPos.z, [this.activeDragCardId]);

	       if (!dropInHand) {
          this.clearHandPreview();
          const lane = this.findLaneAtPosition(this.lastDragPos.x, this.lastDragPos.z);
          const region = this.findRegionAtPosition(this.lastDragPos.x, this.lastDragPos.z);
          
          if (lane) {
             const laneData = store.lanes.find(l => l.id === lane.id);
             if (laneData) {
               // Remove from previous lane if reordering
               store.removeFromLane(this.activeDragCardId);
               const countWithout = laneData.itemOrder.filter(id => id !== this.activeDragCardId).length;
               const orderWithout = laneData.itemOrder.filter(id => id !== this.activeDragCardId);
               const insertIdx = computeLaneInsertIndex(laneData, this.lastDragPos.x, countWithout, store.cards, store.decks, orderWithout);
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
                const labelWorldHeight = getTitleWorldHeight(
                  REGION_TITLE_LAYOUT.worldWidth,
                  REGION_TITLE_LAYOUT.canvasWidth,
                  REGION_TITLE_LAYOUT.canvasHeight,
                );
                const cardCenterOffset = getCardCenterOffsetBelowTitle(
                  regionData.depth,
                  REGION_TITLE_LAYOUT.labelCenterOffset,
                  labelWorldHeight,
	                );
	                store.moveCard(this.activeDragCardId, 'table', [regionData.position[0], 0, regionData.position[2] + cardCenterOffset], [0, 0, 0], undefined, region.id);
	             }
	          } else {
             // Dropping outside any lane — remove from lane if it was in one
             if (BOARD_CONFIG.allowDirectTableCardDrop === false) {
               this.restoreDraggedCardOrigin();
	             } else {
	               store.removeFromLane(this.activeDragCardId);
	               store.moveCard(this.activeDragCardId, 'table', [this.lastDragPos.x, 0, this.lastDragPos.z], [0, 0, 0]);
	             }
          }
       } else {
           const c = store.cards.find(c => c.id === this.activeDragCardId);
           if (c?.location === 'hand') {
             if (store.handPreviewIndex !== null && store.handPreviewItemId === c.id) {
               store.reorderHand(c.id, store.handPreviewIndex);
             } else {
               this.clearHandPreview();
             }
           } else if (c && c.location === 'table') {
             store.removeFromLane(c.id);
             store.moveCard(c.id, 'hand');
             if (c.faceUp) store.flipCard(c.id);
             const nextState = useGameStore.getState();
             if (nextState.handPreviewIndex !== null && nextState.handPreviewItemId === c.id) {
               nextState.reorderHand(c.id, nextState.handPreviewIndex);
             } else {
               this.clearHandPreview();
             }
          }
       }
       
       const c3D = this.cards.get(this.activeDragCardId);
       if (c3D) { c3D.setGhostOpacity(0); }
    }

    // Clear lane preview BEFORE setting isDragging=false to prevent layout race
    this.clearLaneHover();
    this.clearHandPreview();
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
      this.draggedCardOrigin = null;
	    store.setDragging(false, null);
	  }

  private beginSelectionDrag(anchorItem: SelectionItem) {
    const store = useGameStore.getState()
    const selectedItems = this.isSelectionItemSelected(anchorItem)
      ? store.selectedItems.filter((item) => this.getRenderableSelectionItem(item))
      : [anchorItem]

    if (!this.isSelectionItemSelected(anchorItem)) {
      store.selectOnly(anchorItem)
    }

    const anchorPosition = this.getSelectionItemPosition(anchorItem)
    if (!anchorPosition) return

    this.pendingSelectionItem = null
    this.pendingCardId = null
    this.isPendingMarquee = false
    this.isGroupDrag = true
    this.dragSelectionEntries = selectedItems
      .map((item) => {
        const position = this.getSelectionItemPosition(item)
        if (!position) return null
        return {
          item,
          offset: new THREE.Vector3(position[0] - anchorPosition[0], 0, position[2] - anchorPosition[2]),
        }
      })
      .filter((entry): entry is DragSelectionEntry => Boolean(entry))
    this.dragOrigins = selectedItems
      .map((item) => this.captureDragOrigin(item))
      .filter((entry): entry is DragOrigin => Boolean(entry))

    this.markSelectionDragging(selectedItems, true)
    store.setDraggedSelectionItems(this.getOrderedItemsForDrop())
    store.setDragTargetContext({
      position: [anchorPosition[0], anchorPosition[1], anchorPosition[2]],
      rotation: [0, 0, 0],
    })
    store.setDragging(true, anchorItem.kind, anchorItem.id)
  }

  private beginSingleDrag(cardId: string) {
    const store = useGameStore.getState()
    const cardModel = store.cards.find((entry) => entry.id === cardId)
    if (!cardModel) return

    if (store.selectedItems.length > 0) {
      store.clearSelection()
    }

    this.pendingSelectionItem = null
    this.pendingCardId = null
    this.isPendingMarquee = false
    this.isGroupDrag = false

    if (cardModel.location === 'deck') {
      const sourceDeck = store.decks.find((deck) => deck.cardIds.includes(cardId))
      if (!sourceDeck) return

      this.rememberDraggedCardOrigin(cardModel, sourceDeck)
      const extractedCardId = store.removeTopCardFromDeck(sourceDeck.id) ?? cardId
      this.activeDragCardId = extractedCardId
      this.activeDragDeckId = null
      this.isFullDeckDrag = false

      const card3D = this.cards.get(extractedCardId)
      if (card3D) {
        card3D.isDragging = true
      }

      store.setDragging(true, 'card', extractedCardId)
      return
    }

    this.rememberDraggedCardOrigin(cardModel)
    this.activeDragCardId = cardId
    this.activeDragDeckId = null
    this.isFullDeckDrag = false

    const card3D = this.cards.get(cardId)
    if (card3D) {
      card3D.isDragging = true
    }

    store.setDragging(true, 'card', cardId)
  }

  private getRenderableSelectionItem(item: SelectionItem) {
    const store = useGameStore.getState()
    if (item.kind === 'card') {
      return store.cards.find((card) => card.id === item.id && card.location === 'table')
    }
    return store.decks.find((deck) => deck.id === item.id)
  }

  private captureDragOrigin(item: SelectionItem): DragOrigin | null {
    const store = useGameStore.getState()
    if (item.kind === 'card') {
      const card = store.cards.find((entry) => entry.id === item.id)
      if (!card) return null
      const card3D = this.cards.get(item.id)
      return {
        item,
        position: card3D
          ? [card3D.group.position.x, card3D.group.position.y, card3D.group.position.z]
          : [...card.position],
        rotation: [...card.rotation],
        laneId: card.laneId,
        regionId: card.regionId,
        laneIndex: card.laneId ? store.lanes.find((lane) => lane.id === card.laneId)?.itemOrder.indexOf(card.id) : undefined,
      }
    }

    const deck = store.decks.find((entry) => entry.id === item.id)
    if (!deck) return null
    return {
      item,
      position: [...deck.position],
      rotation: [...deck.rotation],
      laneId: deck.laneId,
      regionId: deck.regionId,
      laneIndex: deck.laneId ? store.lanes.find((lane) => lane.id === deck.laneId)?.itemOrder.indexOf(deck.id) : undefined,
    }
  }

  private getSelectionItemPosition(item: SelectionItem): [number, number, number] | null {
    const store = useGameStore.getState()
    if (item.kind === 'card') {
      const card = store.cards.find((entry) => entry.id === item.id)
      if (!card) return null
      const card3D = this.cards.get(item.id)
      return card3D
        ? [card3D.group.position.x, card3D.group.position.y, card3D.group.position.z]
        : [...card.position] as [number, number, number]
    }

    const deck = store.decks.find((entry) => entry.id === item.id)
    return deck ? [...deck.position] as [number, number, number] : null
  }

  private markSelectionDragging(items: SelectionItem[], dragging: boolean) {
    const store = useGameStore.getState()
    items.forEach((item) => {
      if (item.kind === 'card') {
        const card3D = this.cards.get(item.id)
        if (card3D) card3D.isDragging = dragging
        return
      }

      const deck = store.decks.find((entry) => entry.id === item.id)
      deck?.cardIds.forEach((cardId) => {
        const card3D = this.cards.get(cardId)
        if (card3D) card3D.isDragging = dragging
      })
    })
  }

  private updateGroupDragPositions(hit: THREE.Vector3) {
    const store = useGameStore.getState()
    this.dragSelectionEntries.forEach((entry) => {
      const baseX = hit.x + entry.offset.x
      const baseZ = hit.z + entry.offset.z

      if (entry.item.kind === 'card') {
        const card3D = this.cards.get(entry.item.id)
        const cardModel = store.cards.find((card) => card.id === entry.item.id)
        if (!card3D || !cardModel) return

        const scatter = this.getDraggedCardScatter(entry.item.id)
        card3D.group.position.set(baseX + scatter.x, DRAG_PLANE_Y + scatter.lift, baseZ + scatter.z)
        const dragEuler = getCardTableEuler(cardModel, 0, 0.3, scatter.yaw)
        card3D.group.rotation.set(dragEuler.x, dragEuler.y, dragEuler.z)
        card3D.group.rotation.z += scatter.roll
        card3D.group.scale.set(TABLE_CARD_SCALE, TABLE_CARD_SCALE, TABLE_CARD_SCALE)
        return
      }

      const deck = store.decks.find((entryDeck) => entryDeck.id === entry.item.id)
      if (!deck) return
      deck.cardIds.forEach((cardId, index) => {
        const card3D = this.cards.get(cardId)
        const cardModel = store.cards.find((card) => card.id === cardId)
        if (!card3D || !cardModel) return

        card3D.group.position.set(baseX, DRAG_PLANE_Y + index * 0.03, baseZ)
        const wobble = (index % 2 === 0 ? 1 : -1) * 0.015 * index
        const dragEuler = getCardTableEuler({ ...cardModel, rotation: deck.rotation }, 0, 0.3, wobble)
        card3D.group.rotation.set(dragEuler.x, dragEuler.y, dragEuler.z)
        card3D.group.scale.set(TABLE_CARD_SCALE, TABLE_CARD_SCALE, TABLE_CARD_SCALE)
      })
    })
  }

  private getDraggedCardScatter(itemId: string) {
    let hash = 0
    for (let index = 0; index < itemId.length; index += 1) {
      hash = ((hash << 5) - hash + itemId.charCodeAt(index)) | 0
    }

    const normalizedA = ((hash >>> 0) % 1000) / 999
    const normalizedB = (((hash * 31) >>> 0) % 1000) / 999
    const normalizedC = (((hash * 17) >>> 0) % 1000) / 999
    const normalizedD = (((hash * 47) >>> 0) % 1000) / 999

    return {
      x: (normalizedA - 0.5) * 7.5,
      z: (normalizedB - 0.5) * 7.5,
      lift: normalizedC * 0.2,
      yaw: (normalizedA - 0.5) * 1.8,
      roll: (normalizedD - 0.5) * 2.4,
    }
  }

  private applyMarqueeSelection(clientX: number, clientY: number, additive: boolean) {
    const store = useGameStore.getState()
    const left = Math.min(this.dragStartClientPos.x, clientX)
    const top = Math.min(this.dragStartClientPos.y, clientY)
    const right = Math.max(this.dragStartClientPos.x, clientX)
    const bottom = Math.max(this.dragStartClientPos.y, clientY)

    const selectedByMarquee = this.getSelectableItems().filter((item) => {
      const bounds = this.getSelectionItemScreenBounds(item)
      if (!bounds) return false
      return bounds.x < right && bounds.x + bounds.width > left && bounds.y < bottom && bounds.y + bounds.height > top
    })

    const nextSelection = additive
      ? [
          ...store.selectedItems.filter((item) => !selectedByMarquee.some((entry) => entry.id === item.id && entry.kind === item.kind)),
          ...selectedByMarquee,
        ]
      : selectedByMarquee

    store.setSelectedItems(nextSelection)
  }

  private getSelectableItems(): SelectionItem[] {
    const store = useGameStore.getState()
    return [
      ...store.cards.filter((card) => card.location === 'table').map((card) => ({ id: card.id, kind: 'card' as const })),
      ...store.decks.map((deck) => ({ id: deck.id, kind: 'deck' as const })),
    ]
  }

  private getSelectionItemScreenBounds(item: SelectionItem) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const box = new THREE.Box3()

    if (item.kind === 'card') {
      const card3D = this.cards.get(item.id)
      if (!card3D) return null
      box.setFromObject(card3D.group)
    } else {
      const deck = useGameStore.getState().decks.find((entry) => entry.id === item.id)
      if (!deck) return null
      deck.cardIds.forEach((cardId) => {
        const card3D = this.cards.get(cardId)
        if (card3D) {
          box.union(new THREE.Box3().setFromObject(card3D.group))
        }
      })
    }

    if (box.isEmpty()) return null

    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ]

    const projected = corners.map((corner) => corner.project(this.camera))
    const xs = projected.map((corner) => rect.left + ((corner.x + 1) * rect.width) / 2)
    const ys = projected.map((corner) => rect.top + ((-corner.y + 1) * rect.height) / 2)

    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }
  }

  private getOrderedItemsForDrop() {
    type OrderedDropItem = {
      item: SelectionItem
      x: number
      z: number
      laneId: string | undefined
      laneIndex: number | undefined
    }

    const store = useGameStore.getState()
    const laneIndexMap = new Map<string, number>()
    store.lanes.forEach((lane) => lane.itemOrder.forEach((id, index) => laneIndexMap.set(id, index)))

    return this.dragSelectionEntries
      .map((entry): OrderedDropItem | null => {
        const origin = this.dragOrigins.find((originEntry) => originEntry.item.id === entry.item.id && originEntry.item.kind === entry.item.kind)
        const currentPosition = this.getSelectionItemPosition(entry.item)
        return currentPosition ? {
          item: entry.item,
          x: currentPosition[0],
          z: currentPosition[2],
          laneId: origin?.laneId,
          laneIndex: laneIndexMap.get(entry.item.id) ?? origin?.laneIndex,
        } : null
      })
      .filter((entry): entry is OrderedDropItem => entry !== null)
      .sort((a, b) => {
        if (a.laneId && b.laneId && a.laneId === b.laneId && a.laneIndex !== undefined && b.laneIndex !== undefined) {
          return a.laneIndex - b.laneIndex
        }
        if (Math.abs(a.z - b.z) > 0.01) return a.z - b.z
        return a.x - b.x
      })
      .map((entry) => entry.item)
  }

  private completeGroupDrop() {
    const store = useGameStore.getState()
    const orderedItems = this.getOrderedItemsForDrop()
    const lane = this.findLaneAtPosition(this.lastDragPos.x, this.lastDragPos.z)
    const region = this.findRegionAtPosition(this.lastDragPos.x, this.lastDragPos.z)

    if (orderedItems.length === 1) {
      this.completeSingleSelectionDrop(orderedItems[0])
      return
    }

    if (lane) {
      this.dropSelectionIntoLane(orderedItems, lane.id)
      return
    }

    if (region) {
      this.dropSelectionIntoRegion(orderedItems, region.id)
      return
    }

    if (BOARD_CONFIG.allowDirectTableCardDrop === false) {
      this.restoreGroupDragOrigins()
      return
    }

    orderedItems.forEach((item) => {
      const position = this.getSelectionItemPosition(item)
      if (!position) return
      if (item.kind === 'card') {
        store.removeFromLane(item.id)
        store.removeFromRegion(item.id)
        store.moveCard(item.id, 'table', position, [0, 0, 0])
      } else {
        store.removeFromLane(item.id)
        store.removeFromRegion(item.id)
        store.moveDeck(item.id, position, undefined)
      }
    })
  }

  private completeSingleSelectionDrop(item: SelectionItem) {
    const store = useGameStore.getState()
    const lane = this.findLaneAtPosition(this.lastDragPos.x, this.lastDragPos.z)
    const region = this.findRegionAtPosition(this.lastDragPos.x, this.lastDragPos.z)

    if (item.kind === 'card') {
      const dropInHand = this.pointer.y < HAND_DROP_THRESHOLD
      const dropTarget = this.findDropTarget(this.lastDragPos.x, this.lastDragPos.z, [item.id])

      if (dropInHand) {
        store.removeFromLane(item.id)
        store.moveCard(item.id, 'hand')
        return
      }

      if (lane) {
        this.dropSelectionIntoLane([item], lane.id)
      } else if (dropTarget?.type === 'card') {
        store.createDeck(item.id, dropTarget.id)
      } else if (dropTarget?.type === 'deck') {
        store.addCardToDeck(item.id, dropTarget.id)
      } else if (region) {
        this.dropSelectionIntoRegion([item], region.id)
      } else if (BOARD_CONFIG.allowDirectTableCardDrop === false) {
        this.restoreGroupDragOrigins()
      } else {
        store.removeFromLane(item.id)
        store.moveCard(item.id, 'table', [this.lastDragPos.x, 0, this.lastDragPos.z], [0, 0, 0])
      }
      return
    }

    const dropTarget = this.findDropTarget(this.lastDragPos.x, this.lastDragPos.z, [item.id])
    if (lane) {
      this.dropSelectionIntoLane([item], lane.id)
    } else if (dropTarget?.type === 'deck') {
      store.addDeckToDeck(item.id, dropTarget.id)
    } else if (dropTarget?.type === 'card') {
      store.addCardUnderDeck(dropTarget.id, item.id)
      const targetCard = store.cards.find((card) => card.id === dropTarget.id)
      if (targetCard) {
        store.moveDeck(item.id, [...targetCard.position], undefined)
      }
    } else if (region) {
      this.dropSelectionIntoRegion([item], region.id)
    } else {
      store.removeFromLane(item.id)
      store.moveDeck(item.id, [this.lastDragPos.x, 0, this.lastDragPos.z], undefined)
    }
  }

  private dropSelectionIntoLane(items: SelectionItem[], laneId: string) {
    const store = useGameStore.getState()
    const laneData = store.lanes.find((lane) => lane.id === laneId)
    if (!laneData) return

    const itemIds = items.map((item) => item.id)
    const existingOrderWithoutSelection = laneData.itemOrder.filter((id) => !itemIds.includes(id))
    const insertIdx = computeLaneInsertIndex(laneData, this.lastDragPos.x, existingOrderWithoutSelection.length, store.cards, store.decks, existingOrderWithoutSelection)

    items.forEach((item) => {
      store.removeFromLane(item.id)
      store.removeFromRegion(item.id)
    })

    items.forEach((item, index) => {
      store.insertIntoLane(laneId, item.id, insertIdx + index)
    })

    items.forEach((item, index) => {
      const slotPos = store.getLaneSlotPosition(laneId, insertIdx + index)
      if (!slotPos) return
      if (item.kind === 'card') {
        store.moveCard(item.id, 'table', slotPos, [0, 0, 0], laneId)
      } else {
        store.moveDeck(item.id, slotPos, undefined, laneId)
      }
    })
  }

  private dropSelectionIntoRegion(items: SelectionItem[], regionId: string) {
    const store = useGameStore.getState()
    const regionData = store.regions.find((region) => region.id === regionId)
    if (!regionData) return

    const labelWorldHeight = getTitleWorldHeight(
      REGION_TITLE_LAYOUT.worldWidth,
      REGION_TITLE_LAYOUT.canvasWidth,
      REGION_TITLE_LAYOUT.canvasHeight,
    )
    const cardCenterOffset = getCardCenterOffsetBelowTitle(
      regionData.depth,
      REGION_TITLE_LAYOUT.labelCenterOffset,
      labelWorldHeight,
    )
    const position: [number, number, number] = [regionData.position[0], 0, regionData.position[2] + cardCenterOffset]

    items.forEach((item) => {
      store.removeFromLane(item.id)
      store.removeFromRegion(item.id)
      if (item.kind === 'card') {
        store.moveCard(item.id, 'table', position, [0, 0, 0], undefined, regionId)
      } else {
        store.moveDeck(item.id, position, undefined, undefined, regionId)
      }
    })
  }

  private restoreGroupDragOrigins() {
    const store = useGameStore.getState()
    this.dragOrigins.forEach((origin) => {
      store.removeFromLane(origin.item.id)
      store.removeFromRegion(origin.item.id)

      if (origin.item.kind === 'card') {
        store.moveCard(origin.item.id, 'table', [...origin.position], [...origin.rotation], origin.laneId, origin.regionId)
      } else {
        store.moveDeck(origin.item.id, [...origin.position], [...origin.rotation], origin.laneId, origin.regionId)
      }

      if (origin.laneId && origin.laneIndex !== undefined) {
        store.insertIntoLane(origin.laneId, origin.item.id, origin.laneIndex)
      }
    })
  }

  private finishGroupDrag() {
    const store = useGameStore.getState()
    this.markSelectionDragging(this.dragSelectionEntries.map((entry) => entry.item), false)
    this.dragSelectionEntries = []
    this.dragOrigins = []
    this.isGroupDrag = false
    this.pendingSelectionItem = null
    this.pendingCardId = null
    this.hoveredTargetId = null
    this.hoveredTargetType = null
    this.clearLaneHover()
    this.clearRegionHover()
    this.clearHandPreview()
    store.setDraggedSelectionItems([])
    store.setDragTargetContext(null)
    store.setDragging(false, null)
  }

  private syncActiveGroupDrag(state: GameState) {
    if (!this.isGroupDrag || state.draggedSelectionItems.length === 0) return

    const currentSignature = this.dragSelectionEntries.map((entry) => `${entry.item.kind}:${entry.item.id}`).join('|')
    const nextSignature = state.draggedSelectionItems.map((item) => `${item.kind}:${item.id}`).join('|')
    if (currentSignature === nextSignature) return

    this.markSelectionDragging(this.dragSelectionEntries.map((entry) => entry.item), false)
    this.dragSelectionEntries = state.draggedSelectionItems.map((item) => ({
      item,
      offset: new THREE.Vector3(),
    }))
    this.dragOrigins = state.draggedSelectionItems
      .map((item) => this.captureDragOrigin(item))
      .filter((entry): entry is DragOrigin => Boolean(entry))
    this.markSelectionDragging(state.draggedSelectionItems, true)
  }

  private rememberDraggedCardOrigin(card: CardState, sourceDeck?: DeckState) {
    this.draggedCardOrigin = {
      cardId: card.id,
      card: {
        location: card.location,
        position: [...card.position],
        rotation: [...card.rotation],
        faceUp: card.faceUp,
        laneId: card.laneId,
        regionId: card.regionId,
      },
      sourceDeck: sourceDeck ? {
        id: sourceDeck.id,
        position: [...sourceDeck.position],
        rotation: [...sourceDeck.rotation],
        cardIds: [...sourceDeck.cardIds],
        laneId: sourceDeck.laneId,
        regionId: sourceDeck.regionId,
        laneIndex: sourceDeck.laneId ? useGameStore.getState().lanes.find((lane) => lane.id === sourceDeck.laneId)?.itemOrder.indexOf(sourceDeck.id) : undefined,
      } : undefined,
    };
  }

  private restoreDraggedCardOrigin() {
    const origin = this.draggedCardOrigin;
    if (!origin) return;

    if (origin.card.location === 'deck' && origin.sourceDeck) {
      const sourceDeck = origin.sourceDeck;
      const laneReplacementId = sourceDeck.cardIds[sourceDeck.cardIds.length - 2];

      useGameStore.setState((state) => {
        const deckExists = state.decks.some((deck) => deck.id === sourceDeck.id);

        return {
          lanes: state.lanes.map((lane) => {
            if (lane.id !== sourceDeck.laneId) return lane;
            if (lane.itemOrder.includes(sourceDeck.id) || !laneReplacementId) return lane;

            return {
              ...lane,
              itemOrder: lane.itemOrder.map((id) => id === laneReplacementId ? sourceDeck.id : id),
            };
          }),
          decks: deckExists
            ? state.decks.map((deck) => deck.id === sourceDeck.id ? {
              ...deck,
              position: [...sourceDeck.position],
              rotation: [...sourceDeck.rotation],
              cardIds: [...sourceDeck.cardIds],
              laneId: sourceDeck.laneId,
              regionId: sourceDeck.regionId,
            } : deck)
            : [
              ...state.decks,
              {
                ...sourceDeck,
                position: [...sourceDeck.position],
                rotation: [...sourceDeck.rotation],
                cardIds: [...sourceDeck.cardIds],
              },
            ],
          cards: state.cards.map((card) => {
            if (!sourceDeck.cardIds.includes(card.id)) return card;

            return {
              ...card,
              location: 'deck',
              position: [...sourceDeck.position],
              rotation: [...sourceDeck.rotation],
              laneId: undefined,
              regionId: undefined,
            };
          }),
        };
      });

      return;
    }

    useGameStore.getState().moveCard(
      origin.cardId,
      origin.card.location,
      [...origin.card.position],
      [...origin.card.rotation],
      origin.card.laneId,
      origin.card.regionId,
    );

    const currentCard = useGameStore.getState().cards.find((card) => card.id === origin.cardId);
    if (currentCard && currentCard.faceUp !== origin.card.faceUp) {
      useGameStore.getState().flipCard(origin.cardId);
    }
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
        const orderWithout = lane.itemOrder.filter(id => id !== dragItemId);
        const insertIdx = computeLaneInsertIndex(lane, x, countWithout, store.cards, store.decks, orderWithout);
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

  private getHandWorldPosition(slotIndex: number, totalHandCards: number, liftHUD = 0) {
    this.camera.updateMatrixWorld();

    const startX = -((totalHandCards - 1) * HAND_CARD_SPACING) / 2;
    const xOffset = startX + slotIndex * HAND_CARD_SPACING;
    const vector = new THREE.Vector3(
      xOffset * HAND_BASE_SCALE,
      (HAND_BASE_Y_OFFSET + liftHUD) * HAND_BASE_SCALE,
      -HAND_DISTANCE,
    );

    return vector.applyMatrix4(this.camera.matrixWorld);
  }

  private getHandSlotScreenX(slotIndex: number, totalHandCards: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const projected = this.getHandWorldPosition(slotIndex, totalHandCards).project(this.camera);
    return rect.left + ((projected.x + 1) * 0.5 * rect.width);
  }

  private computeHandInsertIndex(clientX: number, totalHandCards: number) {
    if (totalHandCards <= 1) return 0;

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < totalHandCards; index += 1) {
      const slotScreenX = this.getHandSlotScreenX(index, totalHandCards);
      const distance = Math.abs(clientX - slotScreenX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }

    return closestIndex;
  }

  private updateHandPreview(clientX: number, dragItemId: string) {
    const store = useGameStore.getState();
    const handCards = store.cards.filter((card) => card.location === 'hand');
    const dragCard = store.cards.find((card) => card.id === dragItemId);
    const totalHandCards = handCards.length + (dragCard?.location === 'hand' ? 0 : 1);
    if (totalHandCards === 0) return;

    const insertIdx = this.computeHandInsertIndex(clientX, totalHandCards);
    if (store.handPreviewIndex !== insertIdx || store.handPreviewItemId !== dragItemId) {
      store.setHandPreview(insertIdx, dragItemId);
    }
  }

  private clearHandPreview() {
    const store = useGameStore.getState();
    if (store.handPreviewIndex !== null || store.handPreviewItemId !== null) {
      store.setHandPreview(null, null);
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
    const nextCardIds = new Set(state.cards.map((card) => card.id))
    for (const [cardId, card3D] of this.cards) {
      if (nextCardIds.has(cardId)) continue
      this.scene.remove(card3D.group)
      this.scene.remove(card3D.ghostGroup)
      this.cards.delete(cardId)
    }

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
        c3d.refreshArtwork(data.artworkUrl, data.backArtworkUrl ?? getCardBackUrl(data.typeCode));
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
    const displayHandIds = handCards.map((card) => card.id);

    if (state.handPreviewItemId && state.handPreviewIndex !== null) {
      const previewCardIndex = displayHandIds.indexOf(state.handPreviewItemId);
      if (previewCardIndex !== -1) {
        displayHandIds.splice(previewCardIndex, 1);
      }
      const clampedPreviewIndex = Math.max(0, Math.min(state.handPreviewIndex, displayHandIds.length));
      displayHandIds.splice(clampedPreviewIndex, 0, state.handPreviewItemId);
    }
    const totalHandCards = displayHandIds.length;

    for (const cardData of storeCards) {
      const card3D = this.cards.get(cardData.id);
      if (!card3D) continue;

      const inDeck = cardData.location === 'deck';
      const deck = cardToDeckMap.get(cardData.id);
      const isSelectedCard = state.selectedItems.some((item) => item.kind === 'card' && item.id === cardData.id)
      const isSelectedDeck = deck
        ? state.selectedItems.some((item) => item.kind === 'deck' && item.id === deck.id) && deck.cardIds[deck.cardIds.length - 1] === cardData.id
        : false
      card3D.setSelected(isSelectedCard || isSelectedDeck, isSelectedDeck)
      card3D.setCastShadow(cardData.location === 'table' || inDeck || card3D.isDragging);

      if (card3D.isDragging) continue;

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
          const displayOrder = [...orderWithout];
          if (state.lanePreviewLaneId === laneForCard.id && state.lanePreviewIndex !== null && state.lanePreviewItemId) {
            displayOrder.splice(state.lanePreviewIndex, 0, state.lanePreviewItemId);
          }
          const slotIndex = displayOrder.indexOf(cardData.id);
          const slotPos = computeLaneSlotPosition(laneForCard, slotIndex, state.cards, state.decks, displayOrder);
           
           if (slotIndex === -1) {
             // If for some reason the card is not in the itemOrder, fall back to its absolute position
             card3D.targetPosition.set(cardData.position[0], 0.01 + lift, cardData.position[2]);
           } else {
             card3D.targetPosition.set(slotPos[0], 0.01 + lift, slotPos[2]);
          }
          card3D.targetQuaternion.setFromEuler(getCardTableEuler(cardData, wiggleRot));
          card3D.targetScale.set(TABLE_CARD_SCALE, TABLE_CARD_SCALE, TABLE_CARD_SCALE);
        } else {
          card3D.targetPosition.set(cardData.position[0], 0.01 + lift, cardData.position[2]);
          card3D.targetQuaternion.setFromEuler(getCardTableEuler(cardData, wiggleRot));
          card3D.targetScale.set(TABLE_CARD_SCALE, TABLE_CARD_SCALE, TABLE_CARD_SCALE);
        }
      } else if (inDeck && deck) {
        // Check if deck is in a lane
        const laneForDeck = deck.laneId ? state.lanes.find(l => l.id === deck.laneId) : null;
        let deckBaseX = deck.position[0];
        let deckBaseZ = deck.position[2];
        
        if (laneForDeck) {
          const orderWithout = laneForDeck.itemOrder.filter(id => id !== (state.lanePreviewItemId || ''));
          const displayOrder = [...orderWithout];
          if (state.lanePreviewLaneId === laneForDeck.id && state.lanePreviewIndex !== null && state.lanePreviewItemId) {
            displayOrder.splice(state.lanePreviewIndex, 0, state.lanePreviewItemId);
          }
          let slotIndex = displayOrder.indexOf(deck.id);
          if (slotIndex === -1) slotIndex = 0;
          
          const slotPos = computeLaneSlotPosition(laneForDeck, slotIndex, state.cards, state.decks, displayOrder);
          deckBaseX = slotPos[0];
          deckBaseZ = slotPos[2];
        }
        
        const indexInDeck = deck.cardIds.indexOf(cardData.id);
        const yOffset = 0.01 + lift + indexInDeck * 0.03;
        const wobX = (indexInDeck % 2 === 0 ? 1 : -1) * 0.005;
        const wobZ = (indexInDeck % 2 === 0 ? -1 : 1) * 0.003;
        
        card3D.targetPosition.set(deckBaseX, yOffset, deckBaseZ);
        card3D.targetQuaternion.setFromEuler(
          getCardTableEuler(
            { ...cardData, rotation: deck.rotation },
            wiggleRot,
            wobX,
            wobZ,
          ),
        );
        card3D.targetScale.set(TABLE_CARD_SCALE, TABLE_CARD_SCALE, TABLE_CARD_SCALE);
      } else if (cardData.location === 'hand') {
        const indexInHand = displayHandIds.indexOf(cardData.id);
        const isFocused = state.focusedCardId === cardData.id;
        const currentScale = isFocused ? HAND_FOCUSED_SCALE : HAND_BASE_SCALE;
        const liftHUD = isFocused ? HAND_FOCUSED_LIFT : 0;
        const vector = this.getHandWorldPosition(indexInHand, totalHandCards, liftHUD);
        
        const worldQuat = this.camera.quaternion.clone();
        const localQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 6);
        worldQuat.multiply(localQuat);
        
        card3D.targetPosition.copy(vector);
        card3D.targetQuaternion.copy(worldQuat);
        card3D.targetScale.set(currentScale, currentScale, currentScale);
      }
    }
  }

  private updateSelectionBounds() {
    const store = useGameStore.getState()
    if (store.selectedItems.length === 0) {
      if (store.selectionBounds !== null) {
        store.setSelectionBounds(null)
      }
      this.lastSelectionBoundsKey = null
      return
    }

    const bounds = store.selectedItems
      .map((item) => this.getSelectionItemScreenBounds(item))
      .filter((entry): entry is { x: number, y: number, width: number, height: number } => Boolean(entry))

    if (bounds.length === 0) {
      if (store.selectionBounds !== null) {
        store.setSelectionBounds(null)
      }
      this.lastSelectionBoundsKey = null
      return
    }

    const nextBounds = {
      x: Math.min(...bounds.map((entry) => entry.x)),
      y: Math.min(...bounds.map((entry) => entry.y)),
      width: Math.max(...bounds.map((entry) => entry.x + entry.width)) - Math.min(...bounds.map((entry) => entry.x)),
      height: Math.max(...bounds.map((entry) => entry.y + entry.height)) - Math.min(...bounds.map((entry) => entry.y)),
    }
    const nextKey = `${Math.round(nextBounds.x)}:${Math.round(nextBounds.y)}:${Math.round(nextBounds.width)}:${Math.round(nextBounds.height)}`
    if (nextKey !== this.lastSelectionBoundsKey) {
      this.lastSelectionBoundsKey = nextKey
      store.setSelectionBounds(nextBounds)
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
    this.updateSelectionBounds()

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
