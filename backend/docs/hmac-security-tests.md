# HMAC SeqPulse — Couverture des 4 vulnérabilités clés

Ce document explique **comment le HMAC de SeqPulse protège** contre 4 vulnérabilités classiques, et **comment les tester** rapidement.

> Important : la validation HMAC est effectuée **par l’app du client** (ex: endpoint `/ds-metrics`).
> SeqPulse envoie les headers signés ; l’app doit refuser toute requête invalide.

**Payload signé (v2)**
```
timestamp|METHOD|canonical_path|nonce
```

**Note sécurité (messages d’erreur)**
Pour le debug, des messages précis sont utiles.
En production, il est recommandé de renvoyer un message générique (`401 Unauthorized`)
afin de ne pas aider un attaquant à deviner la cause exacte.

---

## 1) Signature invalide (secret incorrect / altération)

**Vulnérabilité**
- Quelqu’un modifie la requête ou utilise un mauvais secret → la signature ne correspond plus.

**Comment HMAC protège**
- L’app recalcule la signature à partir du secret.
- Si le secret est faux ou les données ont été modifiées → rejet immédiat.

**Test rapide**
- Remplacer temporairement le secret côté app par une mauvaise valeur.

**Résultat attendu**
- `401 Invalid signature`

---

## 2) Timestamp trop vieux / trop futur (replay temporel)

**Vulnérabilité**
- Un attaquant rejoue une requête valide mais trop ancienne.

**Comment HMAC protège**
- L’app vérifie que le timestamp est dans une fenêtre de tolérance.
- En dehors de la fenêtre → rejet.

**Test rapide**
- Mettre `SEQPULSE_HMAC_MAX_SKEW_PAST=0` temporairement côté app.

**Résultat attendu**
- `401 Invalid timestamp`

---

## 3) Replay (nonce réutilisé)

**Vulnérabilité**
- Une requête valide est rejouée exactement à l’identique.

**Comment HMAC protège**
- Chaque requête contient un `nonce` unique.
- L’app stocke les nonces déjà vus (TTL court) et refuse les doublons.

**Test rapide**
- Envoyer **deux fois la même requête** avec le même `nonce`.

**Résultat attendu**
- 1ère requête : `200 OK`
- 2ème requête : `401 Nonce reuse`

---

## 4) Mauvais path / proxy / rewrite

**Vulnérabilité**
- Une signature valide est rejouée vers un autre endpoint (`/admin`, `/health`, etc.).
- Ou un proxy change le path (ex: `/api/ds-metrics`).

**Comment HMAC protège**
- Le path fait partie de la signature (`timestamp|METHOD|path|nonce`).
- Si le path ne correspond pas → signature invalide.

**Test rapide**
- Forcer `X-SeqPulse-Canonical-Path` à une mauvaise valeur.

**Résultat attendu**
- `401 Invalid signature`

---

## Résumé rapide (sécurité couverte)

- Signature invalide → **rejetée**
- Timestamp hors fenêtre → **rejeté**
- Nonce déjà vu → **rejeté**
- Path modifié → **rejeté**

Si ces 4 tests passent, le HMAC SeqPulse est **fonctionnel et correctement sécurisé**.

---

## Ce que le HMAC ne protège pas
- Une application déjà compromise (attacker côté serveur).
- Un secret exposé dans le code ou les logs.
- Un attaquant qui contrôle l’infrastructure du client.

---

## FAQ

**Q: Dois-je activer HMAC en production ?**  
Oui, c’est fortement recommandé. Cela empêche les appels non autorisés à `/ds-metrics`.

**Q: Que faire si je perds le secret HMAC ?**  
Utilisez la rotation du secret (ou réactivez HMAC) pour générer une nouvelle clé, puis mettez à jour l’app.

**Q: Pourquoi les erreurs sont parfois génériques ?**  
En production, répondre `401 Unauthorized` sans détails réduit les indices pour un attaquant.

**Q: Comment gérer les nonces en multi‑instance ?**  
Utilisez un cache partagé (Redis) avec un TTL court : `MAX_SKEW_PAST + MAX_SKEW_FUTURE`.

**Q: Est‑ce que HMAC suffit si je n’ai pas HTTPS ?**  
Non. HMAC ne remplace pas TLS. HTTPS reste obligatoire.
