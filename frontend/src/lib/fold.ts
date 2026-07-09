// Diacritic-insensitive text folding for search (July 8, Emre doc-2 P1: "yildirim"
// found 0 records although many contain "yıldırım" — critical for the Turkish SMB
// market). Applied to BOTH the haystack and the query, so either spelling matches
// either. NFD strips combining marks (ş→s, ğ→g, ü→u, ö→o, ç→c, â→a …); dotless ı has
// no decomposition and is mapped explicitly. If search ever moves server-side, the
// equivalent is an expression index on unaccent(lower(col)) plus the ı→i mapping.
export function foldText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
}
