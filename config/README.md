# config/

Brand-as-config (A13.2): `brand.json` is the single home of the product name, sender identity, and logo. Backend reads it via `get_brand()`, frontend via `src/lib/brand.ts` — renaming the product is a one-file change, nothing else may hardcode the name.
