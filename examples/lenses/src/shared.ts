// Plain values and rules that both versions of the booking page use.

/** The days a guest can pick (one fixed month keeps the example small). */
export const DAYS = Array.from({ length: 14 }, (_, i) => i + 1);

/** Price for one guest for one night. */
export const RATE = 50;

/** The largest number of guests in one booking. */
export const MAX_GUESTS = 6;

export type Day = number;

/** The number of nights between the two picked days, or 0. */
export function nights(checkIn: Day | null, checkOut: Day | null): number {
  return checkIn !== null && checkOut !== null ? checkOut - checkIn : 0;
}

/** The CSS class of one day button. */
export function dayClass(day: Day, checkIn: Day | null, checkOut: Day | null): string {
  if (day === checkIn || day === checkOut) return "day picked";
  if (checkIn !== null && checkOut !== null && day > checkIn && day < checkOut)
    return "day in-range";
  return "day";
}
