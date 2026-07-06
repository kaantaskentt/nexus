#!/usr/bin/env python3
# Provenance record for the V2 dress-rehearsal Artifact (claude.ai artifact
# 805116fc-339e-4c66-a66c-d2d041c1e779). Generates dress-rehearsal-v2.html by
# inlining the frame jpgs (in a sibling art/ dir) as data URIs. The frames are the
# UI-review screenshots kept out of the repo per .gitignore (/*.png); this script is
# committed as the evidence trail for how the visual record was built, not to run in CI.
import base64, pathlib

ART = pathlib.Path(__file__).parent / "art"
OUT = pathlib.Path(__file__).parent / "dress-rehearsal-v2.html"

def data_uri(name):
    b = (ART / name).read_bytes()
    return "data:image/jpeg;base64," + base64.b64encode(b).decode()

IMG = {k: data_uri(f"{k}.jpg") for k in [
    "picker-v2", "snapshot-v2-final", "snapshot-v2-drawer",
    "plans-list-v2", "plan-v2-approved", "report-v2",
    "wf-editor-render", "wf-editor-ops", "wf-blueprint", "wf-blueprint-edited",
]}

SURFACES = [
    ("picker-v2", "Entry", "Workspace picker",
     "The pilot workspace leads, tagged <b>Approved for pilot</b>, with its founder, "
     "focus, and seeded-context counts; other tenants sit quiet below. Real data from the "
     "<code>bee-goddess-demo</code> tenant, not mock."),
    ("snapshot-v2-final", "Stage 5", "Company Snapshot",
     "Rebuilt to the V2 bar: a hover-lifting card grid over a deeper cream so white cards "
     "lift. Each learned card reads title-first with a topic glyph derived from the linked "
     "claim (Company, Vocabulary, Pain point, People, Process) instead of six identical "
     "icons. Section headers carry tabular count pills. Trust badges are the four ruled "
     "labels; nothing upgrades a guess."),
    ("snapshot-v2-drawer", "Stage 5 &middot; flagship", "Area drawer (the quality reference)",
     "The surface the team set as the bar for everything else: a real glass panel over a "
     "blurred, darkened scrim, spring slide-in, sections that cascade once it settles, and "
     "elevated stat boxes. The pain-signal meter was <i>removed</i> on purpose: a fixed "
     "two-thirds fill implied a measurement we do not have (F28 honesty)."),
    ("plans-list-v2", "Stage 6", "Interview plans index",
     "One mission per person. Rows lift on hover; the copy states the rule honestly: "
     "non-response is a signal, one gentle reminder, no decline."),
    ("plan-v2-approved", "Stage 6", "Interview plan (approved)",
     "Every control does something real. Send appears only in the approved state; Revoke "
     "shows where the server allows it; the follow-up template is disabled with a "
     "<b>Coming in this build</b> tag rather than faking a click. Refine-with-Nexus is an "
     "honestly disabled composer until its endpoint lands, so no fabricated reply ever "
     "appears in a conversation surface."),
    ("report-v2", "Stage 8", "Post-interview report",
     "The verified workflow map as a canvas of elevated step cards, key findings, "
     "follow-ups, and a qualitative quality read. Perception gaps show an honest empty "
     "state until a second voice contradicts the founder. SOP export and the transcript "
     "view are disabled with tooltips, owed to a later build step."),
]

WF_SURFACES = [
    ("wf-editor-render", "Stage 8 &middot; flagship", "The interactive workflow editor",
     "The compiled workflow opens as an editable canvas. Evidence-backed steps carry an "
     "<b>Evidence</b> marker and stay the record; the ontology subtitle states the contract "
     "up front &mdash; your edits are tracked overlays that never rewrite what was said. Every "
     "step exposes reorder, note, and a reversible hide."),
    ("wf-editor-ops", "Stage 8 &middot; edits", "Overlays, not rewrites",
     "The same canvas after a live pass on the running stack: a step renamed, a note attached, "
     "a step soft-hidden and restored, and one manual step added. Each mutation is an "
     "append-only overlay with prior-value provenance &mdash; the touched steps show an "
     "<b>edited</b> chip, the added step a <b>Manual</b> chip, and a hidden step collapses to a "
     "restore control. Nothing edits the base record."),
    ("wf-blueprint", "Stage 8 &middot; drawer", "The Skill Blueprint",
     "A glass drawer scores each step against the nine universal slots plus an action boundary "
     "&mdash; a completeness map of what an automation would need to know, marked "
     "<b>non-executable</b> on purpose. It reads the gaps honestly (&ldquo;not captured "
     "yet&rdquo;), never inventing a build spec. No skill is generated in v1; the spine is "
     "preserved for later."),
    ("wf-blueprint-edited", "Stage 8 &middot; drawer", "The Blueprint reflects the edits",
     "The same drawer after the live edit pass, from the running stack: the manually added step "
     "flows into the completeness map as its own entry, scored <b>0/10</b> until it is "
     "described. The map moves with the workflow &mdash; edits are never hidden from the "
     "sufficiency read &mdash; and it stays non-executable throughout."),
]

PILLARS = [
    ("Design system V2",
     "A warm surface ladder, a four-step layered elevation scale, glass reserved for "
     "floating chrome, a type scale, a density dial, and a real motion vocabulary, all as "
     "tokens, plus a shared motion library so animation is consistent, not per-component. "
     "Reduced-motion and focus rings are honored globally."),
    ("Every button works",
     "A hard acceptance rule this pass. No decorative click targets: each control performs "
     "a real action, is disabled with an honest &ldquo;coming in this build&rdquo; tooltip, "
     "or is removed. Dead buttons across plans and the report were closed out."),
    ("Honest states",
     "State is told truthfully. Off-happy-path plans get real treatments (a paused hold, an "
     "aged reminder with the one legal action, a terminal revoke); transitions surface "
     "failures inline instead of swallowing them; conversation surfaces never mock a reply."),
]

def render_figures(surfaces):
    return "\n".join(f"""
      <figure class="surface">
        <figcaption>
          <span class="eyebrow">{step}</span>
          <h3>{title}</h3>
          <p>{cap}</p>
        </figcaption>
        <div class="shot"><img alt="{title}" src="{IMG[key]}"></div>
      </figure>""" for (key, step, title, cap) in surfaces)

figures = render_figures(SURFACES)
wf_figures = render_figures(WF_SURFACES)

pillars = "\n".join(f"""
        <article class="pillar">
          <h3>{t}</h3>
          <p>{b}</p>
        </article>""" for (t, b) in PILLARS)

HTML = f"""<title>Nexus V2 &middot; Dress Rehearsal</title>
<style>
:root, :root[data-theme="light"] {{
  --canvas:#f4efe6; --surface:#fffdf8; --raised:#fffefb; --sunken:#efe8db;
  --border:#e4dbca; --border-2:#d4c9b5; --hairline:rgba(255,255,255,.7);
  --ink:#1f1a13; --ink-soft:#5c5347; --ink-faint:#8f8474;
  --accent:#e8641b; --accent-ink:#9c3d08; --accent-soft:#fbe6d8;
  --good:#2e7d4f; --good-soft:#dcece0;
  --elev-1:0 1px 2px rgba(31,26,19,.05),0 1px 1px rgba(31,26,19,.04);
  --elev-2:0 1px 3px rgba(31,26,19,.06),0 8px 22px rgba(31,26,19,.07);
  --serif:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
}}
@media (prefers-color-scheme:dark) {{
  :root {{
    --canvas:#171310; --surface:#211b16; --raised:#271f19; --sunken:#141009;
    --border:#352b22; --border-2:#443628; --hairline:rgba(255,255,255,.06);
    --ink:#f3ece1; --ink-soft:#c3b7a6; --ink-faint:#8c8070;
    --accent:#f0762f; --accent-ink:#f0a877; --accent-soft:#3a2416;
    --good:#5cae7e; --good-soft:#1e3a2a;
    --elev-1:0 1px 2px rgba(0,0,0,.4);
    --elev-2:0 1px 3px rgba(0,0,0,.4),0 10px 26px rgba(0,0,0,.5);
  }}
}}
:root[data-theme="dark"] {{
  --canvas:#171310; --surface:#211b16; --raised:#271f19; --sunken:#141009;
  --border:#352b22; --border-2:#443628; --hairline:rgba(255,255,255,.06);
  --ink:#f3ece1; --ink-soft:#c3b7a6; --ink-faint:#8c8070;
  --accent:#f0762f; --accent-ink:#f0a877; --accent-soft:#3a2416;
  --good:#5cae7e; --good-soft:#1e3a2a;
  --elev-1:0 1px 2px rgba(0,0,0,.4);
  --elev-2:0 1px 3px rgba(0,0,0,.4),0 10px 26px rgba(0,0,0,.5);
}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--canvas);color:var(--ink);font-family:var(--sans);
  line-height:1.6;-webkit-font-smoothing:antialiased;font-size:16px}}
.wrap{{max-width:940px;margin:0 auto;padding:clamp(28px,5vw,64px) clamp(20px,4vw,40px) 80px}}
.spark{{width:26px;height:26px;display:block;margin-bottom:22px}}
.eyebrow{{font-size:12px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;
  color:var(--accent-ink)}}
h1{{font-family:var(--serif);font-weight:600;font-size:clamp(2.2rem,6vw,3.4rem);
  line-height:1.04;letter-spacing:-.015em;margin:.5rem 0 0;text-wrap:balance}}
.lede{{font-size:clamp(1.02rem,2.4vw,1.18rem);color:var(--ink-soft);max-width:60ch;margin:1rem 0 0}}
.lede code{{font-family:'SF Mono',ui-monospace,Menlo,monospace;font-size:.82em;
  background:var(--sunken);padding:1px 6px;border-radius:5px}}
.status{{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}}
.chip{{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:500;
  padding:6px 12px;border-radius:999px;background:var(--surface);border:1px solid var(--border);
  box-shadow:var(--elev-1)}}
.chip.good{{background:var(--good-soft);border-color:transparent;color:var(--good)}}
.chip .dot{{width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.9}}
.chip b{{font-variant-numeric:tabular-nums}}
h2{{font-family:var(--serif);font-weight:600;font-size:clamp(1.5rem,3.6vw,2rem);
  letter-spacing:-.01em;margin:0 0 4px}}
section{{margin-top:clamp(46px,7vw,74px)}}
.section-head{{display:flex;align-items:baseline;gap:12px;margin-bottom:22px;flex-wrap:wrap;
  padding-bottom:14px;border-bottom:1px solid var(--border)}}
.section-head .eyebrow{{color:var(--ink-faint)}}
.pillars{{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}}
.pillar{{background:var(--surface);border:1px solid var(--border);border-radius:14px;
  padding:20px;box-shadow:var(--elev-1),inset 0 1px 0 0 var(--hairline)}}
.pillar h3{{font-family:var(--serif);font-weight:600;font-size:1.18rem;margin:0 0 8px}}
.pillar p{{margin:0;font-size:14.5px;color:var(--ink-soft)}}
.surface{{margin:0 0 clamp(34px,5vw,52px);background:var(--surface);border:1px solid var(--border);
  border-radius:18px;overflow:hidden;box-shadow:var(--elev-2),inset 0 1px 0 0 var(--hairline)}}
.surface figcaption{{padding:22px clamp(18px,3vw,28px) 4px}}
.surface h3{{font-family:var(--serif);font-weight:600;font-size:1.35rem;letter-spacing:-.01em;
  margin:6px 0 8px;text-wrap:balance}}
.surface figcaption p{{margin:0 0 18px;font-size:14.5px;color:var(--ink-soft);max-width:66ch}}
.surface code{{font-family:'SF Mono',ui-monospace,Menlo,monospace;font-size:.85em;
  background:var(--sunken);padding:1px 6px;border-radius:5px}}
.shot{{background:var(--sunken);border-top:1px solid var(--border);padding:clamp(14px,2.5vw,26px)}}
.shot img{{display:block;width:100%;height:auto;border-radius:10px;border:1px solid var(--border-2);
  box-shadow:var(--elev-2)}}
.note{{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--accent);
  border-radius:12px;padding:18px 20px}}
.note h3{{margin:0 0 6px;font-size:13px;letter-spacing:.05em;text-transform:uppercase;color:var(--accent-ink)}}
.note ul{{margin:0;padding-left:18px}}
.note li{{font-size:14.5px;color:var(--ink-soft);margin:6px 0}}
footer{{margin-top:64px;padding-top:22px;border-top:1px solid var(--border);
  font-size:13px;color:var(--ink-faint);display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:space-between}}
.toggle{{position:fixed;top:16px;right:16px;z-index:9;font:inherit;font-size:13px;font-weight:500;
  cursor:pointer;padding:7px 13px;border-radius:999px;background:var(--surface);
  border:1px solid var(--border);color:var(--ink-soft);box-shadow:var(--elev-1)}}
.toggle:hover{{color:var(--ink)}}
:focus-visible{{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}}
.surface{{transition:box-shadow .2s ease}}
@media (prefers-reduced-motion:reduce){{*{{transition:none!important}}}}
</style>

<button class="toggle" id="tg" aria-label="Toggle light and dark theme">Theme</button>
<div class="wrap">
  <header>
    <svg class="spark" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden="true"><path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z"/></svg>
    <span class="eyebrow">Dress rehearsal &middot; V2 overnight</span>
    <h1>Nexus, two tiers up overnight</h1>
    <p class="lede">The visual record of the V2 build: the admin surfaces rebuilt to a
      &ldquo;10k designer&rdquo; bar, every button made real, and every state told honestly.
      Screenshots are the live app against the seeded <code>bee-goddess-demo</code> tenant.</p>
    <div class="status">
      <span class="chip good"><span class="dot"></span>Production build green</span>
      <span class="chip"><b>23</b>&nbsp;badge tests passing</span>
      <span class="chip"><b>5</b>&nbsp;surfaces on the V2 system</span>
      <span class="chip">Voice: callable, pending first human call</span>
    </div>
  </header>

  <section>
    <div class="section-head"><h2>What changed</h2><span class="eyebrow">three throughlines</span></div>
    <div class="pillars">{pillars}
    </div>
  </section>

  <section>
    <div class="section-head"><h2>The surfaces</h2><span class="eyebrow">picker &rarr; snapshot &rarr; plan &rarr; report</span></div>
    {figures}
  </section>

  <section>
    <div class="section-head"><h2>The workflow editor</h2><span class="eyebrow">render &rarr; edit &rarr; blueprint</span></div>
    {wf_figures}
  </section>

  <section>
    <div class="section-head"><h2>Honest footnotes</h2><span class="eyebrow">no theater</span></div>
    <div class="note">
      <h3>Read these annotations straight</h3>
      <ul>
        <li>The area drawer is the agreed quality reference; the other surfaces were built to match it.</li>
        <li>The workflow editor now ships: its overlays and Blueprint drawer were driven live on the running stack (shown above). The report&rsquo;s own SOP export and transcript view are the remaining controls tagged &ldquo;coming in this build&rdquo; &mdash; owed to a later step, not decoration.</li>
        <li>A few em-dashes remain in seeded workspace and report <i>data</i> (a tagline, a couple of generated lines). They are routed to the prompts sweep; the app&rsquo;s own authored copy is em-dash-free.</li>
        <li>Voice is wired and callable end to end; the honest gate is that it has not yet taken a first live human call.</li>
      </ul>
    </div>
  </section>

  <footer>
    <span>Nexus &middot; V2 overnight dress rehearsal</span>
    <span>Finds context, not solutions.</span>
  </footer>
</div>

<script>
(function(){{
  var b=document.getElementById('tg');
  b.addEventListener('click',function(){{
    var el=document.documentElement, cur=el.getAttribute('data-theme');
    if(!cur){{cur=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}}
    el.setAttribute('data-theme', cur==='dark'?'light':'dark');
  }});
}})();
</script>"""

OUT.write_text(HTML, encoding="utf-8")
print("wrote", OUT, f"{len(HTML)/1024:.0f} KB")
