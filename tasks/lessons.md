# Lessons (self-correction log — review at session start)

## July 10 DAY ATTACK
1. INDEPENDENT GATE ≠ AUTHOR VERIFY. I deployed a safety fix on the author lane's own
   36/50-sample verification and softened the user-facing caveat; the independent suite
   then contradicted it (different harness conditions). Deploying an improvement early
   can be right; softening the user-facing claim before the INDEPENDENT gate is green
   never is.
2. NEVER PROBE WITH A WRITE. I used a mutating mint endpoint as a deploy-activation
   signal; it created 21 stray prod sessions (cleaned, existence-guarded). Activation
   probes must be read-only, and health-green ≠ new-image — poll a route whose
   BEHAVIOR distinguishes the images.
3. RULE UNIFORMITY BEATS PER-LANE RULINGS. I gave the no-SQL-teardown rule to one lane
   and not another; both "divergences" were my inconsistent orders, not lane failures.
   New standing rules go in the repo file (DAY-ORDERS/OWNERSHIP) the moment they're
   made, addressed to ALL lanes.
4. MAILBOXES DROP; EVIDENCE BEFORE ESCALATION. ~6 message crossings/drops today.
   Re-relay critical orders + check the repo/tree for in-flight work BEFORE
   escalating a "stalled" lane — one prepared handoff would have destroyed live work.
5. VERIFY-TENANT NAMES: realistic demo names (Kaan), never "X (internal)" — names
   render in screenshots.
