/* Pixel-art blue winged fairy sprite logo */
export function FairyLogo({ size = 48, className = '' }: { size?: number; className?: string }) {

  // Pixel grid: each entry is [col, row, color]
  const pixels: [number, number, string][] = [
    // Wings (left)
    [1,3,'#bfdbfe'],[2,3,'#93c5fd'],[1,4,'#93c5fd'],[0,4,'#bfdbfe'],
    [1,5,'#93c5fd'],[0,5,'#bfdbfe'],[1,6,'#bfdbfe'],[0,6,'#dbeafe'],
    [2,4,'#bfdbfe'],[2,5,'#bfdbfe'],
    // Wings (right)
    [14,3,'#bfdbfe'],[13,3,'#93c5fd'],[14,4,'#bfdbfe'],[15,4,'#bfdbfe'],
    [13,4,'#93c5fd'],[14,5,'#bfdbfe'],[15,5,'#bfdbfe'],[13,5,'#93c5fd'],
    [14,6,'#dbeafe'],[15,6,'#bfdbfe'],[13,6,'#bfdbfe'],
    // Hair
    [6,1,'#1e3a8a'],[7,1,'#1e3a8a'],[8,1,'#1e3a8a'],[9,1,'#1e3a8a'],
    [5,2,'#1e3a8a'],[6,2,'#2563eb'],[9,2,'#2563eb'],[10,2,'#1e3a8a'],
    [5,3,'#1e3a8a'],[10,3,'#1e3a8a'],
    // Face
    [6,3,'#fde68a'],[7,3,'#fde68a'],[8,3,'#fde68a'],[9,3,'#fde68a'],
    [6,4,'#fde68a'],[7,4,'#fde68a'],[8,4,'#fde68a'],[9,4,'#fde68a'],
    // Eyes
    [7,3,'#1e3a8a'],[9,3,'#1e3a8a'],
    // Antennae
    [5,0,'#60a5fa'],[6,0,'#93c5fd'],[10,0,'#60a5fa'],[9,0,'#93c5fd'],
    // Body / dress
    [5,5,'#3b82f6'],[6,5,'#3b82f6'],[7,5,'#3b82f6'],[8,5,'#3b82f6'],[9,5,'#3b82f6'],[10,5,'#3b82f6'],
    [4,6,'#2563eb'],[5,6,'#3b82f6'],[6,6,'#3b82f6'],[7,6,'#3b82f6'],[8,6,'#3b82f6'],[9,6,'#3b82f6'],[10,6,'#3b82f6'],[11,6,'#2563eb'],
    [4,7,'#2563eb'],[5,7,'#3b82f6'],[6,7,'#60a5fa'],[7,7,'#60a5fa'],[8,7,'#60a5fa'],[9,7,'#3b82f6'],[10,7,'#3b82f6'],[11,7,'#2563eb'],
    [5,8,'#1d4ed8'],[6,8,'#2563eb'],[7,8,'#3b82f6'],[8,8,'#3b82f6'],[9,8,'#2563eb'],[10,8,'#1d4ed8'],
    // Legs
    [6,9,'#1d4ed8'],[7,9,'#2563eb'],[8,9,'#2563eb'],[9,9,'#1d4ed8'],
    [6,10,'#1d4ed8'],[9,10,'#1d4ed8'],
    // Shoes
    [5,11,'#1e3a8a'],[6,11,'#1e40af'],[9,11,'#1e40af'],[10,11,'#1e3a8a'],
    // Wand
    [11,5,'#fbbf24'],[12,4,'#f59e0b'],[13,3,'#fbbf24'],
    [12,3,'#fef3c7'],
    // Magic sparkles
    [14,1,'#dbeafe'],[15,2,'#bfdbfe'],[0,2,'#dbeafe'],[1,1,'#bfdbfe'],
  ]

  return (
    <svg
      width={size}
      height={size * 0.875}
      viewBox={`0 0 16 14`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ imageRendering: 'pixelated' }}
      aria-label="Pixey fairy logo"
    >
      {pixels.map(([col, row, color], i) => (
        <rect key={i} x={col} y={row} width={1} height={1} fill={color} />
      ))}
    </svg>
  )
}

export function PixeyWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      <span className="text-accent-light">Pi</span>
      <span className="text-slate-200">xey</span>
    </span>
  )
}
