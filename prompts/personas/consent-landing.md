<!-- Sources: docs/MERGE_PLAN.md Phase 3 (Pre-interview consent landing page with explicit start action) + A5/EK 3.2 (sharing rules stated up front; redact/de-attribute right) + A4 (explicit start action; no decline) + A13 (EN v1, TR designed-in) + A12 (no real client names). Frontend consumes this for the consent page. -->

# Pre-interview consent landing

The page a respondent lands on from the invite link, before the conversation starts. It restates why, sets the sharing rules honestly, and requires an **explicit start action** — the interview never begins passively. This is the respondent-trust surface (EK 3.2); its promises are kept by the interviewer at open and close.

## Merge fields
`{{PRODUCT_NAME}}` `{{SENDER_NAME}}` (brand.json) · `{{RESPONDENT_NAME}}` · `{{COMPANY_NAME}}` · `{{ADMIN_NAME}}` · `{{INTERVIEW_TOPIC}}` · `{{EST_MINUTES}}` · `{{MODALITY}}` ("voice call" or "chat").

---

## EN — primary (v1)

### Heading
A quick, honest conversation about {{INTERVIEW_TOPIC}}

### Intro
Hi {{RESPONDENT_NAME}} — thanks for being here. {{ADMIN_NAME}} at {{COMPANY_NAME}} asked {{PRODUCT_NAME}} to understand how the work really happens, and your view matters because you're the one who does it. This takes about {{EST_MINUTES}} minutes, and you're in control the whole way.

### What this is (and isn't)
- **It's a {{MODALITY}}** about how your work actually flows — the real version, not the tidy one.
- **There are no right answers**, and nothing to prepare.
- **It is not a performance review.** It is not scored. It's about the work, not a judgment of you.

### How your words are handled
- The conversation is **recorded and summarized** so your account is captured accurately.
- **You review before you're named.** Before anything is attributed to you by name, you'll see it — and you can change it, take your name off it, or leave it out.
- **You won't be asked to rate anyone.** If an opinion about a person comes up, it's kept out of what's shared unless you explicitly say otherwise.
- **You can pause anytime** and pick up later on the same link.

### Explicit start action
**[ I'm ready — start the conversation ]**

<small>By starting, you consent to the recording and summary described above. You can stop at any time.</small>

> No "decline" control by design — if now isn't the time, simply close this page; you can return whenever suits you.

---

## TR — designed-in (v1, untuned — A13.1; verify tone before the first TR call)

### Başlık
{{INTERVIEW_TOPIC}} hakkında kısa ve samimi bir sohbet

### Giriş
Merhaba {{RESPONDENT_NAME}} — burada olduğunuz için teşekkürler. {{COMPANY_NAME}}'den {{ADMIN_NAME}}, işin gerçekte nasıl yürüdüğünü anlamamız için {{PRODUCT_NAME}}'den ricada bulundu ve sizin görüşünüz önemli, çünkü işi bizzat yapan sizsiniz. Yaklaşık {{EST_MINUTES}} dakika sürer ve baştan sona kontrol sizde.

### Bu görüşme nedir (ve ne değildir)
- **Bir {{MODALITY}}** — işinizin gerçekte nasıl aktığına dair, süslü hâli değil gerçek hâli.
- **Doğru cevap yok**, hazırlanmanıza gerek yok.
- **Bu bir performans değerlendirmesi değildir.** Puanlanmaz. Konu iş, sizi yargılamak değil.

### Sözleriniz nasıl ele alınır
- Görüşme, anlatımınız doğru yansısın diye **kaydedilir ve özetlenir**.
- **Adınız geçmeden önce siz görürsünüz.** Adınızla ilişkilendirilmeden önce her şeyi görür; değiştirebilir, adınızı kaldırabilir veya çıkarabilirsiniz.
- **Kimseyi değerlendirmeniz istenmez.** Bir kişi hakkında görüş çıkarsa, siz açıkça istemedikçe paylaşılana dahil edilmez.
- **İstediğiniz an ara verebilir**, aynı bağlantıdan sonra devam edebilirsiniz.

### Açık başlama eylemi
**[ Hazırım — sohbete başla ]**

<small>Başlayarak, yukarıda açıklanan kayıt ve özete onay vermiş olursunuz. İstediğiniz an durabilirsiniz.</small>
