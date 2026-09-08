type Placement = { x: number; y: number; width: number; height: number };

export function pdfPlacement(p: Placement, width: number, height: number, rotation: number) {
  const r = ((rotation % 360) + 360) % 360;
  const displayWidth = r === 90 || r === 270 ? height : width;
  const displayHeight = r === 90 || r === 270 ? width : height;
  const w = p.width * displayWidth, h = p.height * displayHeight;
  if (r === 90) return { x: (p.y + p.height) * width, y: p.x * height, width: w, height: h, rotate: 90 };
  if (r === 180) return { x: (1 - p.x) * width, y: (p.y + p.height) * height, width: w, height: h, rotate: 180 };
  if (r === 270) return { x: (1 - p.y - p.height) * width, y: (1 - p.x) * height, width: w, height: h, rotate: 270 };
  return { x: p.x * width, y: (1 - p.y - p.height) * height, width: w, height: h, rotate: 0 };
}

