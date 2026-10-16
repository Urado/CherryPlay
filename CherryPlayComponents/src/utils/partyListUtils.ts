export interface PartyWithEventDate {
  eventDateTime?: string | null;
}

export const comparePartiesByEventDateDesc = (
  a: PartyWithEventDate,
  b: PartyWithEventDate,
): number => {
  const aTime = a.eventDateTime ? new Date(a.eventDateTime).getTime() : null;
  const bTime = b.eventDateTime ? new Date(b.eventDateTime).getTime() : null;

  if (aTime === null && bTime === null) {
    return 0;
  }
  if (aTime === null) {
    return 1;
  }
  if (bTime === null) {
    return -1;
  }

  return bTime - aTime;
};

export const sortPartiesByEventDateDesc = <T extends PartyWithEventDate>(parties: T[]): T[] => {
  return [...parties].sort(comparePartiesByEventDateDesc);
};
