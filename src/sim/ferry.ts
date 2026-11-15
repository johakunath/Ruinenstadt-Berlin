// Ferry (M11b, Johannes 2026-11-15: "a little boat you hop in that drives slowly to the other side").
// A lane across water with a fixed pier at each end and a boat that shuttles between them on a fixed
// timetable. The boat position is a pure function of sim time, so the sim needs no extra state and the
// renderer shows exactly what the sim uses. Bodies standing on the boat ride along (`stepSim`).

export interface FerryLane {
  x: number;
  z: number;
  /** Direction of travel across, as a facing angle (0 = along +Z). */
  rot: number;
  len: number;
  width: number;
}

export const FERRY = {
  /** Fixed pier length at each end of the lane. */
  pier: 5,
  /** Boat length along the lane (its width is the lane width). */
  boat: 8,
  /** Meters per second while crossing. */
  speed: 1.4,
  /** Seconds docked at each pier. */
  wait: 5,
};

/** Distance the boat travels between the two piers. */
export function ferryTravel(f: FerryLane): number {
  return Math.max(0, f.len - 2 * FERRY.pier - FERRY.boat);
}

/** Boat center along the lane (0 = lane center) at time t. Starts docked at the +along end. */
export function ferryAlong(f: FerryLane, t: number): number {
  const travel = ferryTravel(f);
  const cross = travel / FERRY.speed;
  const period = 2 * (FERRY.wait + cross);
  let u = t % period;
  const end = travel / 2;
  if (u < FERRY.wait) return end;
  u -= FERRY.wait;
  if (u < cross) return end - u * FERRY.speed;
  u -= cross;
  if (u < FERRY.wait) return -end;
  u -= FERRY.wait;
  return -end + u * FERRY.speed;
}

/** World position of the boat center at time t. */
export function ferryPos(f: FerryLane, t: number): { x: number; z: number } {
  const a = ferryAlong(f, t);
  return { x: f.x + Math.sin(f.rot) * a, z: f.z + Math.cos(f.rot) * a };
}

/** Is (x, z) on the boat deck at time t (`pad` shrinks the deck, e.g. for the rail)? */
export function onFerryBoat(f: FerryLane, t: number, x: number, z: number, pad = 0): boolean {
  const ux = Math.sin(f.rot);
  const uz = Math.cos(f.rot);
  const dx = x - f.x;
  const dz = z - f.z;
  const along = dx * ux + dz * uz - ferryAlong(f, t);
  const across = -dx * uz + dz * ux;
  return Math.abs(along) <= FERRY.boat / 2 - pad && Math.abs(across) <= f.width / 2 - pad;
}

/** Is (x, z) on one of the two fixed piers? */
export function onFerryPier(f: FerryLane, x: number, z: number): boolean {
  const ux = Math.sin(f.rot);
  const uz = Math.cos(f.rot);
  const dx = x - f.x;
  const dz = z - f.z;
  const along = Math.abs(dx * ux + dz * uz);
  const across = Math.abs(-dx * uz + dz * ux);
  // The pier reaches half a meter under the docked boat so walking on and off has no seam.
  return along <= f.len / 2 && along >= f.len / 2 - FERRY.pier - 0.5 && across <= f.width / 2;
}
