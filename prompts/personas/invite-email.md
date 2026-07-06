<!-- Sources: docs/MERGE_PLAN.md Phase 3 Invite email (benefit-framed subject, locked purpose block, consent line, one reminder max) + A4 (Send flow: message preview before send; no decline button; one gentle reminder — abandoned-checkout pattern) + A13.1/A13.2 (EN v1, TR designed-in; brand-as-config) + A12 (no real client names). Non-negotiables 2 & 3 (nothing leaks; nothing reaches employees without the gate). Frontend consumes this for the Send-flow preview. -->

# Invite email

The email a respondent receives after the human gate approves their interview. Benefit-framed, honest about what it is, consent built in. The **locked purpose block** and **consent line** are not editable in the Send-flow preview — they are compliance surface, not copy to tune.

## Merge fields
`{{PRODUCT_NAME}}` `{{SENDER_NAME}}` (brand.json) · `{{RESPONDENT_NAME}}` (first name) · `{{COMPANY_NAME}}` · `{{ADMIN_NAME}}` (who invited them — trust anchor) · `{{INTERVIEW_TOPIC}}` (neutral area, e.g. "how orders move through the workshop" — never a claim, never who-said-what) · `{{EST_MINUTES}}` (≈20–30) · `{{INTERVIEW_LINK}}` (token URL).

---

## EN — primary (v1)

**Subject (benefit-framed):** Your take on {{INTERVIEW_TOPIC}} — {{EST_MINUTES}} min, whenever suits you

**Body:**

Hi {{RESPONDENT_NAME}},

{{ADMIN_NAME}} at {{COMPANY_NAME}} has asked {{PRODUCT_NAME}} to understand how things really work day to day — and your view on {{INTERVIEW_TOPIC}} is one they specifically wanted to hear.

It's a relaxed conversation, about {{EST_MINUTES}} minutes, and you can do it whenever it's convenient — start now or come back to the same link later. There are no right answers and nothing to prepare. We just want the real, on-the-ground version from the person who actually does the work.

<!-- LOCKED purpose block — not editable in the Send preview -->
> **Why you're getting this:** {{COMPANY_NAME}} is working with {{PRODUCT_NAME}} to document how work actually happens, so the people who run it are understood accurately. This is not a performance review, and it is not scored. Your words help build a clear picture of the process — not a judgment of you.

**[ Start the conversation → ]({{INTERVIEW_LINK}})**

<!-- Consent line — not editable -->
By starting, you agree to have this conversation recorded and summarized so your account of the work can be captured accurately. Before anything is attributed to you by name, you'll get to review it — and you can change it, remove your name, or leave anything out.

Thanks,
{{SENDER_NAME}}

---

## Reminder (one only — A4 abandoned-checkout pattern, no decline button)

Sent once if the invite is opened-but-not-completed or untouched after a set interval. Gentle, no pressure, no guilt.

**Subject:** Still open whenever you have {{EST_MINUTES}} minutes

**Body:**

Hi {{RESPONDENT_NAME}},

Just a gentle nudge — your conversation about {{INTERVIEW_TOPIC}} is still open, and it's about {{EST_MINUTES}} minutes whenever it suits you. No rush, and no need to reply if now isn't a good time.

**[ Pick it up here → ]({{INTERVIEW_LINK}})**

{{SENDER_NAME}}

> Note: there is deliberately **no decline button** (A4 — a decline is a bias signal). Non-response is the signal; only one reminder is ever sent.

---

## TR — designed-in (v1, untuned — A13.1; verify tone before the first TR call)

**Konu:** {{INTERVIEW_TOPIC}} hakkında görüşünüz — {{EST_MINUTES}} dakika, size uygun olduğunda

Merhaba {{RESPONDENT_NAME}},

{{COMPANY_NAME}}'den {{ADMIN_NAME}}, işlerin gündelik hayatta gerçekte nasıl yürüdüğünü anlamamız için {{PRODUCT_NAME}}'den ricada bulundu — ve {{INTERVIEW_TOPIC}} konusunda özellikle sizin görüşünüzü almak istediler.

Rahat bir sohbet, yaklaşık {{EST_MINUTES}} dakika, size uygun olduğunda yapabilirsiniz — şimdi başlayın ya da aynı bağlantıdan sonra devam edin. Doğru ya da yanlış cevap yok, hazırlanmanıza da gerek yok. Sadece işi bizzat yapan kişiden, sahadaki gerçek hâlini duymak istiyoruz.

<!-- LOCKED — düzenlenemez -->
> **Bu mesajı neden aldınız:** {{COMPANY_NAME}}, işin gerçekte nasıl yürüdüğünü doğru biçimde belgelemek için {{PRODUCT_NAME}} ile çalışıyor. Bu bir performans değerlendirmesi değildir ve puanlanmaz. Sözleriniz süreci netleştirmeye yarar — sizi yargılamaya değil.

**[ Sohbete başla → ]({{INTERVIEW_LINK}})**

<!-- Onay satırı — düzenlenemez -->
Başlayarak, işe dair anlatımınızın doğru şekilde kaydedilip özetlenmesi için bu görüşmenin kaydedilmesini kabul etmiş olursunuz. Adınızla ilişkilendirilmeden önce her şeyi görebilir; değiştirebilir, adınızı kaldırabilir veya istediğinizi çıkarabilirsiniz.

Teşekkürler,
{{SENDER_NAME}}
