export type PlacePixelEvent = { x: number; y: number; color: string; userId: string; t: number };
export type CooldownEvent = { msRemaining: number };
export type ChunkCoord = { cx: number; cy: number }; // chunk indices
export const GRID_W = 10000;
export const GRID_H = 10000;
export const CHUNK_SIZE = 256;
export const COOLDOWN_MS = 10000; // 10s par défaut
