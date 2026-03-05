import { useGameStore, type RadialSlice } from '../store'

// Helper to calculate SVG arc paths
function describeArc(x: number, y: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  const startOuter = polarToCartesian(x, y, outerRadius, endAngle);
  const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
  const startInner = polarToCartesian(x, y, innerRadius, endAngle);
  const endInner = polarToCartesian(x, y, innerRadius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  const d = [
    "M", startOuter.x, startOuter.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 0, endOuter.x, endOuter.y,
    "L", endInner.x, endInner.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, startInner.x, startInner.y,
    "Z"
  ].join(" ");

  return d;
}

export function RadialMenu() {
  const radialMenu = useGameStore(state => state.radialMenu)
  const closeMenu = useGameStore(state => state.closeRadialMenu)
  const setHover = useGameStore(state => state.setRadialHover)
  const setPreviewCard = useGameStore(state => state.setPreviewCard)
  // Additional actions can be mapped to store functions

  if (!radialMenu.isOpen) return null

  // Slices definitions: id, start angle, end angle, label/icon
  // North: -45 to 45 (or 315 to 45), East: 45 to 135, South: 135 to 225, West: 225 to 315
  const slices: { id: RadialSlice; start: number; end: number; label: string }[] = [
    { id: 'n', start: 315, end: 405, label: 'N' },
    { id: 'e', start: 45, end: 135, label: 'E' },
    { id: 's', start: 135, end: 225, label: 'S' },
    { id: 'w', start: 225, end: 315, label: 'W' },
  ]

  const innerRadius = 30
  const outerRadius = 80
  const centerRadius = 25

  const handleSliceClick = (id: RadialSlice) => {
    console.log(`Action ${id} executed on card ${radialMenu.cardId}`);
    // Example: flip card on center click or North click
    if (id === 'c' && radialMenu.cardId) {
       setPreviewCard(radialMenu.cardId)
    }
    closeMenu()
  }

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1000,
        // The backdrop: click to close
      }}
      onPointerDown={(e) => {
        // Close only if clicking directly on the backdrop, not on the SVG elements
        if (e.target === e.currentTarget) closeMenu()
      }}
    >
      <div style={{
        position: 'absolute',
        top: radialMenu.y,
        left: radialMenu.x,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none' // Let SVG handle events
      }}>
        <svg width={200} height={200} viewBox="0 0 200 200" style={{ pointerEvents: 'auto' }}>
          {/* Menu Slices */}
          <g transform="translate(100, 100)">
            {slices.map((slice) => {
              // Adjust angles so North is centered at top (0 degrees is top in our describeArc logic due to -90)
              const d = describeArc(0, 0, innerRadius, outerRadius, slice.start, slice.end)
              const isHovered = radialMenu.hoveredSlice === slice.id
              return (
                <g 
                  key={slice.id}
                  onMouseEnter={() => setHover(slice.id)}
                  onMouseLeave={() => setHover(null)}
                  onPointerUp={(e) => { e.stopPropagation(); handleSliceClick(slice.id) }}
                  style={{ cursor: 'pointer' }}
                >
                  <path 
                    d={d} 
                    fill={isHovered ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.6)'} 
                    stroke="rgba(255, 255, 255, 0.2)"
                    strokeWidth="2"
                    style={{ transition: 'fill 0.2s' }}
                  />
                  {/* Label Positioning Placeholder */}
                </g>
              )
            })}

            {/* Center Circle */}
            <g
                onMouseEnter={() => setHover('c')}
                onMouseLeave={() => setHover(null)}
                onPointerUp={(e) => { e.stopPropagation(); handleSliceClick('c') }}
                style={{ cursor: 'pointer' }}
            >
                <circle 
                    cx="0" cy="0" r={centerRadius} 
                    fill={radialMenu.hoveredSlice === 'c' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.6)'} 
                    stroke="rgba(255, 255, 255, 0.2)"
                    strokeWidth="2"
                    style={{ transition: 'fill 0.2s' }}
                />
            </g>
          </g>
        </svg>
      </div>
    </div>
  )
}
