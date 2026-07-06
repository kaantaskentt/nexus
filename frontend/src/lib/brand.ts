// Brand is config (A13.2) — the single source is config/brand.json at repo root.
// brand.data.json is a committed copy synced from that source (see scripts/sync-brand.mjs);
// the import stays inside frontend/ so Vercel's frontend-root build can resolve it.
import brand from "./brand.data.json";

export default brand as {
  product_name: string;
  sender_name: string;
  email_from: string;
  logo_path: string | null;
};
