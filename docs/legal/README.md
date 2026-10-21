# Testi legali

La fonte di verità di Informativa privacy, Cookie Policy e Norme legali sono i file di localizzazione
(`client/src/locales/{it,en,de,es,fr}.json`, chiavi `privacy`, `cookie_policy`, `legal`).
Le vecchie bozze markdown in questa cartella sono state rimosse per non farle divergere dai testi veri.

Prima di pubblicare (`client/src/config/legalPages.json` → `published: true`):

1. Sostituisci in tutte e 5 le lingue i segnaposto `[DATA]`, `[EMAIL PRIVACY]`, `[DA COMPILARE…]` e `[DA VERIFICARE…]`
   (cerca con `grep -rn "DA COMPILARE\|DA VERIFICARE\|\[DATA\]\|\[EMAIL PRIVACY\]" client/src/locales`).
2. Per i periodi di conservazione i testi riportano una *proposta*: confermala o cambiala.
3. Fai rivedere i testi a un legale o al DPO. Non sono una consulenza legale.
4. Aggiorna `policyVersion` in `legalPages.json` a ogni modifica sostanziale: viene registrata con ogni consenso.
