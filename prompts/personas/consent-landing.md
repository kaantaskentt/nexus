<!-- Sources: docs/MERGE_PLAN.md Phase 3 (Pre-interview consent landing page with explicit start action) + A5/EK 3.2 (sharing rules stated up front; redact/de-attribute right) + A4 (explicit start action; no decline) + A13 (EN v1, TR designed-in) + A12 (no real client names). Frontend consumes this for the consent page. Client-facing copy: no em-dashes (Kaan) — kept in sync with frontend/src/lib/respondent.ts (see evals consent-copy-sync). -->

# Pre-interview consent landing

The page a respondent lands on from the invite link, before the conversation starts. It restates why, sets the sharing rules honestly, and requires an **explicit start action**, so the interview never begins passively. This is the respondent-trust surface (EK 3.2); its promises are kept by the interviewer at open and close.

## Merge fields
`{{PRODUCT_NAME}}` `{{SENDER_NAME}}` (brand.json) · `{{RESPONDENT_NAME}}` · `{{COMPANY_NAME}}` · `{{ADMIN_NAME}}` · `{{INTERVIEW_TOPIC}}` · `{{EST_MINUTES}}` · `{{MODALITY}}` ("voice call" or "chat").

---

## EN — primary (v1)

### Heading
A quick, honest conversation about {{INTERVIEW_TOPIC}}

### Intro
Hi {{RESPONDENT_NAME}}, thanks for being here. {{ADMIN_NAME}} at {{COMPANY_NAME}} asked {{PRODUCT_NAME}} to understand how the work really happens, and your view matters because you're the one who does it. This takes about {{EST_MINUTES}} minutes, and you're in control the whole way.

### What this is (and isn't)
- **It's a {{MODALITY}}** about how your work actually flows: the real version, not the tidy one.
- **There are no right answers**, and nothing to prepare.
- **It is not a performance review.** It is not scored. It's about the work, not a judgment of you.

### How your words are handled
- The conversation is **recorded and summarized** so your account is captured accurately.
- **Who sees it:** a short summary of how the work flows goes to the {{COMPANY_NAME}} team who asked for it. Pain points are shared by role, like "someone in operations," not by your name. <!-- role example vertical-neutral (July 8): "packing" read wrong at a PR agency -->

- **Nothing is quoted with your name on it.** Your answers are combined with everyone else's before anyone sees conclusions. If there's something you want credited to you, say so, and you'll see exactly how it appears before it goes anywhere.
- **You won't be asked to rate anyone.** If an opinion about a person comes up, it's kept out of what's shared unless you explicitly say otherwise.
<!-- SHIPPED (lane-s7 R7, Kaan ruling jul10): Section 7.8 disclosure/escalation line, Emre-authored.
     Locked-compliance copy, shipped per R7 (Kaan approved). Kept in sync with respondent.ts consentCopy (consent_copy_sync guard). It converts a surprise
     escalation into a disclosed term (§7.8): the interviewer never over-promises secrecy in the
     room because this line already sets the honest expectation. -->
- **If you disclose imminent harm or serious wrongdoing,** we may stop the interview and escalate to a human reviewer, and we cannot guarantee confidentiality over that disclosure.
- **You can pause anytime** and pick up later on the same link.

### Explicit start action
**[ I'm ready, start the conversation ]**

<small>By starting, you consent to the recording and summary described above. You can stop at any time.</small>

> No "decline" control by design. If now isn't the time, simply close this page; you can return whenever suits you.

---

## EN — context call (BETA, F7): the CEO/founder's own conversation

The senior stakeholder who arranged this runs the context call directly with {{PRODUCT_NAME}}. They are the **client**, not an employee under consent protection, so the promise is the opposite of the interview page: their words BUILD the snapshot and are **attributed to them as its source** (Non-negotiable 2: nothing said here ever reaches an interviewee). The role-only respondent promise must never appear here. Kept in sync with the `context` branch of `consentCopy()` (see evals consent-copy-sync). Sensitive line flagged to Kaan+Emre for a wording pass (confirm #2); the clearly-better version ships now.

### Heading
A working conversation about {{COMPANY_NAME}}
<!-- fallback when company is unknown: --> A working conversation about your company

### Intro
Hi {{RESPONDENT_NAME}}, thanks for making the time. This is the context call, where {{PRODUCT_NAME}} learns how {{COMPANY_NAME}} actually works, so everything built after this fits the real thing and not a tidy version of it. It takes about {{EST_MINUTES}} minutes, and you can pause anytime.

### What this is
- **{{PRODUCT_NAME}} is here to understand the company**, its goals, and how the work actually gets done. It does not pitch, advise, or solve.
- **There are no right answers**, and nothing to prepare.
- This is the conversation everything downstream is built from, so the more real it is, the better the snapshot.

### What {{PRODUCT_NAME}} does with this
- This call is recorded and turned into the first version of your company snapshot: how the work flows, the systems in play, and the open questions worth digging into.
- **What you share builds your company's snapshot and is attributed to you as its source.**
- {{PRODUCT_NAME}} may gather relevant public information about the company after the call to round out the picture. Public information is reference only, never treated as verified fact.
- **The snapshot is yours to review first**, and no one on your team is contacted without your explicit approval. Nothing you say here is ever repeated to an employee.
<!-- SHIPPED (lane-s7 R7, Kaan ruling jul10): Section 7.8 disclosure/escalation line, Emre-authored.
     Locked-compliance copy, shipped per R7 (Kaan approved). Kept in sync with respondent.ts consentCopy (consent_copy_sync guard). Applies on the context
     call too (§7.1 scope: all live capture interviews). -->
- **If you disclose imminent harm or serious wrongdoing,** we may stop the call and escalate to a human reviewer, and we cannot guarantee confidentiality over that disclosure.
- **You can pause anytime** and pick up later on the same link.

### Explicit start action
**[ Begin the context call ]**

<small>By starting, you consent to this call being recorded and turned into your company snapshot, as described above. You can stop at any time.</small>

---

## TR — designed-in (v1, untuned — A13.1; verify tone before the first TR call)

### Başlık
{{INTERVIEW_TOPIC}} hakkında kısa ve samimi bir sohbet

### Giriş
Merhaba {{RESPONDENT_NAME}}, burada olduğunuz için teşekkürler. {{COMPANY_NAME}}'den {{ADMIN_NAME}}, işin gerçekte nasıl yürüdüğünü anlamamız için {{PRODUCT_NAME}}'den ricada bulundu ve sizin görüşünüz önemli, çünkü işi bizzat yapan sizsiniz. Yaklaşık {{EST_MINUTES}} dakika sürer ve baştan sona kontrol sizde.

### Bu görüşme nedir (ve ne değildir)
- **Bir {{MODALITY}}**: işinizin gerçekte nasıl aktığına dair, süslü hâli değil gerçek hâli.
- **Doğru cevap yok**, hazırlanmanıza gerek yok.
- **Bu bir performans değerlendirmesi değildir.** Puanlanmaz. Konu iş, sizi yargılamak değil.

### Sözleriniz nasıl ele alınır
- Görüşme, anlatımınız doğru yansısın diye **kaydedilir ve özetlenir**.
- **Kimler görür:** işin nasıl aktığına dair kısa bir özet, bunu isteyen {{COMPANY_NAME}} ekibine gider. Sıkıntılar adınızla değil, "paketlemeden biri" gibi rol düzeyinde paylaşılır.
- **Adınız geçmeden önce siz görürsünüz.** Adınızla ilişkilendirilmeden önce her şeyi görür; değiştirebilir, adınızı kaldırabilir veya çıkarabilirsiniz.
- **Kimseyi değerlendirmeniz istenmez.** Bir kişi hakkında görüş çıkarsa, siz açıkça istemedikçe paylaşılana dahil edilmez.
<!-- SHIPPED (lane-s7 R7, Kaan ruling jul10): §7.8 disclosure/escalation line, TR draft untuned (A13.1) —
     Shipped per R7 (Kaan approved). -->
- **Yakın bir zarar veya ciddi bir suistimal paylaşırsanız,** görüşmeyi durdurup konuyu bir insan incelemeciye iletebiliriz ve bu paylaşım için gizlilik garanti edemeyiz.
- **İstediğiniz an ara verebilir**, aynı bağlantıdan sonra devam edebilirsiniz.

### Açık başlama eylemi
**[ Hazırım, sohbete başla ]**

<small>Başlayarak, yukarıda açıklanan kayıt ve özete onay vermiş olursunuz. İstediğiniz an durabilirsiniz.</small>
