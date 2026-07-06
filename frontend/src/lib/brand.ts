// Brand is config (A13.2) — the single source is config/brand.json at repo root.
import brand from "../../../config/brand.json";

export default brand as {
  product_name: string;
  sender_name: string;
  email_from: string;
  logo_path: string | null;
};
