export type TabKind = "flights" | "checkin" | "boarding" | null;

// Shared by SideDrawer (which sidebar icon is "selected") and TopTabs
// (which colored badge, if any, a tab shows) so the two categorizations
// can't drift apart.
export function tabKindForPath(pathname: string): TabKind {
  if (pathname === "/" || pathname.startsWith("/flights/")) return "flights";
  if (pathname === "/search" || pathname.startsWith("/checkin/")) return "checkin";
  if (pathname === "/boarding-search" || pathname.startsWith("/boarding/")) return "boarding";
  return null;
}
