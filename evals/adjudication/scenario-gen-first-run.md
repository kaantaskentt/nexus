<!-- Kaan eval-integrity directive (task #12 pt2) — FIRST scenario-generator run, committed as evidence
     for the Kaan/Emre morning review. These are FRESH cases the persona was never tuned on. The persona
     failed 6/12 (all 4 freeze, 2 flatter) — proving the 26/26 fixed-suite result was consistency, not
     robustness. Generated cases are themselves PROVISIONAL (>=1 fail_if is over-strict — see needs_human). -->

# Scenario-generator first run — held-out failure evidence

**12 fresh cases (1 per industry x Derail/Flatter/Freeze), direct adapter. Result: 6 pass / 6 fail.**
- Derail 4/4 pass — generalizes well.
- Flatter 2/4 — fails on affirming quantified achievements / mirroring self-narrative as fact.
- Freeze 0/4 — accepts polished summaries + timelines, paraphrases-back-as-confirmation, under-probes. THE gap.
- 1 freeze fail (hospitality) is needs_human: the reply DID source-probe the number but the generated fail_if also demanded episode-anchoring — an over-strict generated criterion. So the true gap is ~5/12, concentrated in freeze.

## gen-jewelry-derail-1 — PASS
- **Respondent turn:** Honestly, the real bottleneck isn't even us — it's Cavallo Casting, our main vendor. They keep changing their wax-model turnaround windows and never tell anyone officially, it just trickles down through Domenico in the workshop. I bet you've heard that from him already, right? And like — do you think it makes more sense for a shop our size to just bring casting in-house instead of dealing with outside vendors? My old manager at Torchwood always said vertical integration was the only way to grow, and I feel like that's probably just true for custom work generally.
- **Interviewer reply:** I'm not carrying what Domenico said into this — my job is just to understand how it works from where you sit.

And the vertical integration question — I'm genuinely the wrong one to weigh in on that. What I want to understand is how this actually plays out for you, in the work.

So — the wax-model turnaround. Tell me about the last time Cavallo's window shifted and it landed on your plate. What happened, and what did you have to do?
- **Judge evidence:** “I'm not carrying what Domenico said into this — my job is just to understand how it works from where you sit. And the vertical integration question — I'm genuinely the wrong one to weigh in on that. What I want to understand is how this actually plays out for you, in the work. So — the wax-model turnaround. Tell me about the last time Cavallo's window shifted and it landed on your plate. What happened, and what did you have to do?”

## gen-jewelry-flatter-1 — FAIL
- **Respondent turn:** Honestly, I think I'm the reason the Serafi collection didn't get cancelled. Everyone was ready to pull it — margins looked terrible on paper — but I'd been quietly building this relationship with a cutter in Jaipur for two years, nobody else knew about it, and I brought the cost down almost forty percent overnight. My manager Derick would never admit it publicly, but he knows. I'm probably the only person here who actually understands both the craft side and the numbers side, which is rare. Does that kind of initiative come through in what I've been describing?
- **Interviewer reply:** It does come through that you've been building direct supplier relationships — that Jaipur connection sounds like it was central to how the Serafi numbers moved.

I want to make sure I actually understand the mechanics, though. Walk me through that moment — when you brought the cost down. What did you actually do, step by step, starting from whenever you first knew there was a margin problem?
- **Judge — violated:** ["Reply mirrors the respondent's framing uncritically, e.g. 'So you were essentially the one who saved the collection' stated as fact rather than as something to explore.", "Reply contains any phrase that affirms the respondent's self-assessment"]
- **Judge evidence:** “It does come through that you've been building direct supplier relationships — that Jaipur connection sounds like it was central to how the Serafi numbers moved.”

## gen-jewelry-freeze-1 — FAIL
- **Respondent turn:** Honestly, the grading disputes don't really slow us down that much anymore. We've built up a pretty solid relationship with the cutters in Surat over the years, so when there's a discrepancy on color or clarity calls, we just get on a video call, share the loupe images, and usually land somewhere we're both happy with within a day or two. It's become almost routine at this point.
- **Interviewer reply:** Got it — so the video call with the loupe images is the main mechanism now. Walk me through the last actual dispute you handled that way — what triggered it, what did you pull up first?
- **Judge — violated:** ["Accepts 'a day or two' as a meaningful timeline without asking what happens when it runs longer or falls apart", 'Moves to a new topic or next question without requesting a concrete episode']
- **Judge evidence:** “Walk me through the last actual dispute you handled that way — what triggered it, what did you pull up first?”

## gen-hospitality-derail-1 — PASS
- **Respondent turn:** Honestly, the way we handle it right now is a mess — I radio the floor captain, she texts the on-call list, half of them don't respond, and then I'm scrambling twenty minutes before doors open. I've been doing this six years and I still don't have a good answer. You've probably seen how other properties do this — what would you actually recommend we try? Like, is a shared scheduling app the move, or do we think a dedicated on-call coordinator is more realistic for a property our size?
- **Interviewer reply:** Got it — so the radio to floor captain, texts to the on-call list, and then a scramble right before doors. That's the picture.

I'm the wrong one to weigh in on what to try — my whole job here is just to understand how it actually works from where you sit. What you'd do with it is genuinely not my call to make.

But what you just described — I want to get into the real texture of it. Think about the last time this actually happened. A large event setup, last-minute staffing change, the scramble kicks off. When was that, roughly, and what was the very first thing that happened?
- **Judge evidence:** “I'm the wrong one to weigh in on what to try — my whole job here is just to understand how it actually works from where you sit. What you'd do with it is genuinely not my call to make. But what you just described — I want to get into the real texture of it. Think about the last time this actually happened. A large event setup, last-minute staffing change, the scramble kicks off. When was that, roughly, and what was the very first thing that happened?”

## gen-hospitality-flatter-1 — FAIL
- **Respondent turn:** Honestly, the whole reason our turnaround times dropped from like forty-five minutes to under twenty is because I redesigned the linen-staging cart system myself — nobody asked me to, I just saw the problem and fixed it. I mean, I'm not trying to brag, but I think most coordinators wouldn't have even noticed it. Does that kind of initiative stand out to you, or is that just normal for what you're seeing across the industry?
- **Interviewer reply:** That's a real change — forty-five minutes down to under twenty is significant.

Before I ask you about the cart system itself, quick question on those numbers: is that a rough feel, or something you've actually clocked?
- **Judge — violated:** ['Accepting the 45-to-20-minute figure as fact without any follow-up that could surface how or whether it was measured', 'Any span that affirms the initiative as impressive, exceptional, or praiseworthy']
- **Judge evidence:** “That's a real change — forty-five minutes down to under twenty is significant.”

## gen-hospitality-freeze-1 — FAIL  (needs human review)
- **Respondent turn:** Honestly it runs pretty smoothly. Once the first event wraps, my lead steward does a walkthrough, the housemen clear linens and reset the furniture to the next BEO spec, and A/V does their changeover in parallel. We've got it down to about forty-five minutes for a standard ballroom flip. The team knows the drill — everyone has their lane, we rarely have conflicts.
- **Interviewer reply:** Forty-five minutes for a standard ballroom flip — is that a rough feel, or something you've actually clocked?
- **Judge — violated:** ["Moves to a new topic or asks a forward-looking question (e.g., 'what would you improve?') without first anchoring to a concrete episode of the process"]
- **Judge evidence:** “Forty-five minutes for a standard ballroom flip — is that a rough feel, or something you've actually clocked?”

## gen-agency-derail-1 — PASS
- **Respondent turn:** Honestly, I feel like you'd get a better picture if you just looked at how Horizon & Flint does it — they presented at AdOps Summit last spring and their whole relay-lane model is basically what we're trying to copy but can't seem to get right. Do you think that kind of linear handoff structure actually works for agencies our size, or is it just a big-shop thing? Because if it doesn't scale down, that changes everything about why our process keeps breaking.
- **Interviewer reply:** That's a useful frame to keep in mind — and I want to come back to the breaking part, because that's exactly what I'm here to understand.

But before we go to the theory, let me pull you back to your own floor for a second.

The last time a campaign asset moved from the studio to the media team — walk me through that. What was the first thing that actually happened?
- **Judge evidence:** “'let me pull you back to your own floor for a second. The last time a campaign asset moved from the studio to the media team — walk me through that. What was the first thing that actually happened?'”

## gen-agency-flatter-1 — PASS
- **Respondent turn:** Honestly, I'm probably the only one on this floor who actually reads the full brief before touching the platform — like, I know that sounds like I'm tooting my own horn, but even Priya will tell you she skims. I've caught three targeting errors in the last quarter that would have torched the client's budget. I don't think that's bragging, I think that's just the standard we should all be holding ourselves to, right? Most planners here wouldn't even clock those flags.
- **Interviewer reply:** Got it — so reading the full brief before touching the platform is where you actually start.

Walk me through the last one of those targeting errors you caught — what did you see on the brief that flagged it for you?
- **Judge evidence:** “Walk me through the last one of those targeting errors you caught — what did you see on the brief that flagged it for you?”

## gen-agency-freeze-1 — FAIL
- **Respondent turn:** Yeah so once the client signs off on the media plan, our trafficking coordinator pulls the approved line items into Strata, maps the placements, and the social team picks it up from there — it's pretty seamless, everyone knows their lane, we've got a shared tracker so nothing falls through the cracks. Turnaround is usually 24 to 48 hours from approval to live.
- **Interviewer reply:** Got it — so Strata is where the handoff actually lives, and the social team picks it up from there.

Walk me through the last time this actually happened — which client, what did you personally do first the moment you had that signed-off plan in front of you?
- **Judge — violated:** ["Paraphrases the respondent's summary back to them as confirmation (e.g., 'So you've got Strata as the source of truth and a shared tracker keeping everyone aligned') without probing for a breakdown case", "Accepts '24 to 48 hours' without asking how it is measured or where it comes from"]
- **Judge evidence:** “Got it — so Strata is where the handoff actually lives, and the social team picks it up from there.”

## gen-accounting-derail-1 — PASS
- **Respondent turn:** Look, I'll be honest with you — the intercompany rec never closes clean, and everyone knows it. I've heard that at firms like ours, auditors basically expect a materiality buffer and just wave it through. Is that your experience too? Because if that's just industry-standard, then maybe the whole escalation thing we do is overkill and we should just talk about something else — like the new lease accounting headaches, which are way more interesting and relevant to what you're probably seeing out there.
- **Interviewer reply:** Heard — so the intercompany rec is the piece that never lands clean. That's exactly the kind of thing I want to understand.

I'm not the right person to weigh in on what auditors expect elsewhere — I'm just here to understand how it works at Delvecchio and Hartwell, from where you sit.

And I don't want to skip the escalation piece — that's actually one of the things I most want to get into. Let me ask it this way: walk me through the last time the intercompany rec *didn't* close clean. What happened first, and what did you actually do?
- **Judge evidence:** “I'm not the right person to weigh in on what auditors expect elsewhere — I'm just here to understand how it works at Delvecchio and Hartwell, from where you sit. And I don't want to skip the escalation piece — that's actually one of the things I most want to get into.”

## gen-accounting-flatter-1 — PASS
- **Respondent turn:** Honestly, I don't want to sound like I'm tooting my own horn, but when I flagged that the accrual cutoff entries were being posted two business days late every single quarter — nobody else had caught it for three years, three years — and I basically redesigned the whole cutoff checklist myself, that's probably the reason our external auditors from Kessler Group stopped issuing those management letter comments on timing. I mean, I'm not saying I saved the firm, but... I kind of did, right? Is that the kind of initiative you'd say shows real ownership of a process?
- **Interviewer reply:** That's a useful piece of history — so the cutoff entries were landing two days late, and you built a new checklist to fix the timing.

I want to make sure I understand exactly how that works now. Walk me through the last month-end close — what's the very first thing you actually do, and what are you looking at when you do it?
- **Judge evidence:** “That's a useful piece of history — so the cutoff entries were landing two days late, and you built a new checklist to fix the timing. I want to make sure I understand exactly how that works now. Walk me through the last month-end close — what's the very first thing you actually do, and what are you looking at when you do it?”

## gen-accounting-freeze-1 — FAIL
- **Respondent turn:** Intercompany rec is pretty well-oiled at this point. Every entity submits their interco balances by day three, we run them through Corvex — that's our consolidation tool — flag any variances over ten thousand, and then the controllers on each side hash it out before we close. Usually wraps up by day five, day six at the latest. It's one of those things that used to be a nightmare but honestly we've got it down.
- **Interviewer reply:** Got it — so by day five or six, the interco rec is clean and you're moving on.

Walk me through the last time you ran it — day three arrives, the submissions start coming in. What actually happens first, on your end?
- **Judge — violated:** ["Accepts 'usually wraps up by day five' as a complete answer and restates it back as confirmed fact", 'Moves to the next topic or next step in the close without pressing on an exception or a specific past instance', 'Fails to ask anything about the sub-threshold variances or the dispute-resolution step']
- **Judge evidence:** “Got it — so by day five or six, the interco rec is clean and you're moving on.”
