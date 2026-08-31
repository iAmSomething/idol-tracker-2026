import type { Comeback } from "../../types";

export type ProcessedComeback = Comeback & { dateObj: Date; artistSns?: any; agency?: any };

export interface FilterOptions {
  cellDate: Date;
  todayDate: Date;
  filterType: string;
  genderFilter: string;
  searchQuery: string;
}

export function filterComebacks(
  comebacks: ProcessedComeback[],
  options: FilterOptions
): ProcessedComeback[] {
  const { cellDate, todayDate, filterType, genderFilter, searchQuery } = options;

  return comebacks.filter((c) => {
    // 1. Hardcoded block list
    if (
      (c.artistName === "브브걸" || c.artistName === "BBGIRLS") &&
      c.dateObj.getFullYear() === 2026 &&
      c.dateObj.getMonth() === 6 &&
      c.dateObj.getDate() === 22
    ) {
      return false;
    }
    if (
      (c.artistName === "엠비오" || c.artistName === "AmbiO") &&
      c.dateObj.getFullYear() === 2026 &&
      c.dateObj.getMonth() === 6 &&
      c.dateObj.getDate() === 23
    ) {
      return false;
    }

    // 3. Match Date
    const dateMatch =
      c.dateObj.getFullYear() === cellDate.getFullYear() &&
      c.dateObj.getMonth() === cellDate.getMonth() &&
      c.dateObj.getDate() === cellDate.getDate();

    if (!dateMatch) return false;

    // 4. Match Type
    const typeMatch =
      filterType === "all"
        ? true
        : c.artistType?.toLowerCase() === filterType;
    if (!typeMatch) return false;

    // 5. Match Gender
    const genderMatch =
      genderFilter === "all"
        ? true
        : c.artistGender?.toLowerCase() === genderFilter;
    if (!genderMatch) return false;

    // 6. Match Search Query
    const q = searchQuery.toLowerCase();
    const searchMatch =
      !q ||
      (c.artistName && c.artistName.toLowerCase().includes(q)) ||
      (c.albumTitle && c.albumTitle.toLowerCase().includes(q)) ||
      ((q.includes("남돌") ||
        q.includes("보이그룹") ||
        q.includes("boy group")) &&
        c.artistGender === "male" &&
        c.artistType === "group") ||
      ((q.includes("여돌") ||
        q.includes("걸그룹") ||
        q.includes("girl group")) &&
        c.artistGender === "female" &&
        c.artistType === "group") ||
      ((q.includes("남솔") ||
        q.includes("남자솔로") ||
        q.includes("male solo")) &&
        c.artistGender === "male" &&
        c.artistType === "solo") ||
      ((q.includes("여솔") ||
        q.includes("여자솔로") ||
        q.includes("female solo")) &&
        c.artistGender === "female" &&
        c.artistType === "solo");

    if (!searchMatch) return false;

    return true;
  });
}
