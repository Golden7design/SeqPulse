# Intégration de Lemon Squeezy avec SEQPULSE

**Dernière mise à jour**: 15 février 2025
**Auteur**: Mistral Vibe (pour Nassir/SEQPULSE)
**Statut**: Prêt pour l'implémentation ✅

---

## 📋 Sommaire

1. [Introduction](#introduction)
2. [Pourquoi Lemon Squeezy ?](#pourquoi-lemon-squeezy)
3. [Prérequis](#prérequis)
4. [Configuration de Lemon Squeezy](#configuration-de-lemon-squeezy)
   - [Étape 1: Créer un compte](#étape-1-créer-un-compte)
   - [Étape 2: Configurer votre store](#étape-2-configurer-votre-store)
   - [Étape 3: Créer le produit "Pro Plan"](#étape-3-créer-le-produit-pro-plan)
   - [Étape 4: Configurer les webhooks](#étape-4-configurer-les-webhooks)
   - [Étape 5: Configurer les payouts (retraits)](#étape-5-configurer-les-payouts-retraits)
5. [Intégration Backend (FastAPI)](#intégration-backend-fastapi)
   - [Modèle de données](#modèle-de-données)
   - [Création d'un checkout](#création-dun-checkout)
   - [Gestion des webhooks](#gestion-des-webhooks)
   - [Vérification des abonnements](#vérification-des-abonnements)
6. [Intégration Frontend (Next.js)](#intégration-frontend-nextjs)
   - [Bouton d'upgrade](#bouton-dupgrade)
   - [Page de succès](#page-de-succès)
   - [Page d'annulation](#page-dannulation)
7. [Gestion des Échecs de Paiement](#gestion-des-échecs-de-paiement)
8. [Tests](#tests)
9. [Déploiement en Production](#déploiement-en-production)
10. [Dépannage](#dépannage)
11. [Annexes](#annexes)
   - [Exemple de payload webhook](#exemple-de-payload-webhook)
   - [Listes des événements webhook](#listes-des-événements-webhook)
   - [Frais Lemon Squeezy](#frais-lemon-squeezy)

---

## Introduction

Ce document explique comment intégrer **Lemon Squeezy** à SEQPULSE pour gérer les abonnements au plan Pro ($49/mois). Lemon Squeezy est une alternative à Stripe, disponible au Congo, qui permet aux clients de payer par **carte bancaire** ou **PayPal**, avec des renouvellements automatiques.

---

## Pourquoi Lemon Squeezy ?

✅ **Disponible au Congo** (contrairement à Stripe)
✅ **Paiements par PayPal et carte bancaire**
✅ **Abonnements récurrents automatiques**
✅ **Retraits faciles via Wise/Payoneer → Mobile Money**
✅ **API simple et documentation claire**
✅ **Gestion des taxes et factures automatiques**

---

## Prérequis

Avant de commencer, assurez-vous d'avoir :

- Un compte **Lemon Squeezy** ([https://www.lemonsqueezy.com](https://www.lemonsqueezy.com))
- Un compte **Wise** ou **Payoneer** pour les retraits
- Un projet **SEQPULSE** avec un backend FastAPI et un frontend Next.js
- Une base de données (PostgreSQL) avec les tables `Project` et `Subscription`

---

## Configuration de Lemon Squeezy

### Étape 1: Créer un compte

1. Allez sur [https://www.lemonsqueezy.com](https://www.lemonsqueezy.com)
2. Cliquez sur **"Get Started"** et inscrivez-vous avec votre email.
3. Validez votre email et complétez votre profil.

📌 **Note** : Utilisez une adresse email professionnelle (ex: `billing@seqpulse.dev`).

---

### Étape 2: Configurer votre store

1. Après la création du compte, Lemon Squeezy vous demande de créer un **store**.
2. Remplissez les informations :
   - **Store Name**: `SEQPULSE`
   - **Store URL**: `https://seqpulse.dev` (ou votre URL actuelle)
   - **Currency**: `USD` (ou `EUR` si vous préférez)
   - **Country**: Sélectionnez votre pays (même si vous êtes au Congo, choisissez un pays supporté comme le Sénégal ou la France)

3. Cliquez sur **"Create Store"**.

---

### Étape 3: Créer le produit "Pro Plan"

1. Dans le dashboard Lemon Squeezy, allez dans **Products** → **Create Product**.
2. Remplissez les informations :
   - **Product Name**: `SEQPULSE Pro Plan`
   - **Product Description**: `Unlimited deployments, SDH (Smart Hints), and advanced metrics for your CI/CD pipeline.`
   - **Price**: `49` (en USD)
   - **Interval**: `Monthly` (pour un abonnement récurrent)
   - **Trial Period**: `None` (ou `14 days` si vous voulez offrir un essai gratuit)

3. Cliquez sur **"Create Product"**.

4. **Notez les IDs suivants** (disponibles dans l'URL ou les settings) :
   - `STORE_ID`: L'ID de votre store (ex: `12345`)
   - `PRODUCT_ID`: L'ID du produit Pro Plan (ex: `67890`)
   - `VARIANT_ID`: L'ID de la variante (même que `PRODUCT_ID` pour les abonnements simples)

---

### Étape 4: Configurer les webhooks

Les webhooks permettent à Lemon Squeezy de notifier SEQPULSE quand un paiement réussit, échoue, ou est annulé.

1. Allez dans **Settings** → **Webhooks**.
2. Cliquez sur **"Add Endpoint"**.
3. Remplissez :
   - **Endpoint URL**: `https://votre-site.com/api/webhooks/lemonsqueezy` (à adapter)
   - **Secret**: Générez un secret aléatoire (ex: `whsec_abc123`) et **notez-le** (nécessaire pour vérifier les signatures)

4. Sélectionnez les événements à écouter :
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_payment_success`
   - `subscription_payment_failed`

5. Cliquez sur **"Save"**.

---

### Étape 5: Configurer les payouts (retraits)

Pour retirer l'argent de Lemon Squeezy vers votre compte :

1. Allez dans **Payouts** → **Settings**.
2. Cliquez sur **"Add Payout Method"**.
3. Choisissez **Wise** ou **Payoneer** :
   - **Wise** (recommandé) :
     - Créez un compte Wise ([https://wise.com](https://wise.com))
     - Liez-le à Lemon Squeezy en suivant les instructions.
     - Wise permet de retirer vers **Mobile Money** (Orange Money, Airtel Money).
   - **Payoneer** :
     - Alternative à Wise ([https://www.payoneer.com](https://www.payoneer.com))
     - Permet aussi les retraits via Mobile Money.

4. Une fois configuré, vous pourrez demander des payouts manuellement ou automatiquement.

---

## Intégration Backend (FastAPI)

### Modèle de données

Assurez-vous que votre modèle `Subscription` contient les champs nécessaires :

```python
# app/db/models/subscription.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from app.db.base import Base

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), unique=True, nullable=False)
    plan_type = Column(String, default="free")  # free ou pro
    status = Column(String, default="active")  # active, past_due, cancelled
    lemon_squeezy_id = Column(String, nullable=True)  # ID de l'abonnement Lemon Squeezy
    lemon_squeezy_status = Column(String, nullable=True)  # Statut côté Lemon Squeezy
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
```

---

### Création d'un checkout

Ce endpoint crée une session de paiement et redirige le client vers Lemon Squeezy.

```python
# app/api/routes/billing.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import requests
from app.db.deps import get_db
from app.db.models import Project, Subscription
from app.core.config import settings

router = APIRouter(prefix="/api/billing", tags=["billing"])

@router.post("/create-checkout")
async def create_checkout(
    project_id: int,
    db: Session = Depends(get_db)
):
    """
    Crée une session de paiement Lemon Squeezy pour un projet.
    Redirige le client vers la page de paiement.
    """
    # 1. Vérifier que le projet existe
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2. Vérifier qu'il n'y a pas déjà un abonnement actif
    existing_sub = db.query(Subscription).filter(
        Subscription.project_id == project_id,
        Subscription.status == "active"
    ).first()
    
    if existing_sub:
        raise HTTPException(
            status_code=400,
            detail="Project already has an active subscription"
        )

    # 3. Créer une checkout session avec Lemon Squeezy
    try:
        response = requests.post(
            "https://api.lemonsqueezy.com/v1/checkouts",
            json={
                "data": {
                    "type": "checkouts",
                    "attributes": {
                        "product_id": settings.LEMON_PRODUCT_ID,
                        "variant_id": settings.LEMON_VARIANT_ID,
                        "custom_price": 4900,  # $49.00 en cents
                        "product_options": {
                            "redirect_url": f"{settings.FRONTEND_URL}/billing/success?projectId={project_id}",
                            "receipt_button_text": "Return to SEQPULSE",
                            "receipt_thank_you_note": "Thank you for upgrading to Pro! Your SDH is now activated."
                        },
                        "checkout_options": {
                            "embed": False,
                            "media": False,
                            "logo": True
                        },
                        "checkout_data": {
                            "email": project.owner.email,
                            "custom": {
                                "project_id": project_id
                            }
                        }
                    }
                }
            },
            headers={
                "Authorization": f"Bearer {settings.LEMON_API_KEY}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            timeout=10
        )
        
        response.raise_for_status()
        checkout_url = response.json()["data"]["attributes"]["url"]
        
        return {"checkout_url": checkout_url}
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create checkout: {str(e)}"
        )
```

---

### Gestion des webhooks

Ce endpoint reçoit les notifications de Lemon Squeezy et met à jour la base de données.

```python
# app/api/routes/webhooks.py
from fastapi import APIRouter, Request, HTTPException, Header
import hmac
import hashlib
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.db.models import Subscription
from app.core.config import settings

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

@router.post("/lemonsqueezy")
async def lemonsqueezy_webhook(
    request: Request,
    x_signature: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Webhook pour les événements Lemon Squeezy.
    Met à jour les abonnements en fonction des événements.
    """
    # 1. Vérifier la signature (sécurité)
    payload = await request.body()
    expected_signature = hmac.new(
        settings.LEMON_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(x_signature, expected_signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    # 2. Parser l'événement
    event = await request.json()
    event_type = event.get("meta", {}).get("event_name")
    data = event.get("data", {})
    attributes = data.get("attributes", {})
    custom_data = attributes.get("custom_data", {})
    
    if not event_type or not custom_data:
        raise HTTPException(status_code=400, detail="Invalid event data")
    
    project_id = custom_data.get("project_id")
    if not project_id:
        raise HTTPException(status_code=400, detail="Missing project_id")

    # 3. Trouver ou créer la subscription
    subscription = db.query(Subscription).filter(
        Subscription.project_id == project_id
    ).first()
    
    if not subscription:
        subscription = Subscription(
            project_id=project_id,
            plan_type="free",
            status="active"
        )
        db.add(subscription)

    # 4. Traiter l'événement
    if event_type == "subscription_created":
        subscription.plan_type = "pro"
        subscription.status = "active"
        subscription.lemon_squeezy_id = data["id"]
        subscription.lemon_squeezy_status = attributes.get("status")
        
    elif event_type == "subscription_updated":
        subscription.lemon_squeezy_status = attributes.get("status")
        
    elif event_type == "subscription_cancelled":
        subscription.status = "cancelled"
        subscription.plan_type = "free"
        
    elif event_type == "subscription_payment_success":
        subscription.status = "active"
        subscription.lemon_squeezy_status = attributes.get("status")
        
    elif event_type == "subscription_payment_failed":
        subscription.status = "past_due"
        
    db.commit()
    
    return {"status": "success"}
```

---

### Vérification des abonnements

Un middleware pour vérifier si un projet a un abonnement Pro actif.

```python
# app/api/deps.py
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.deps import get_db
from app.db.models import Subscription

def require_pro_plan(
    project_id: int,
    db: Session = Depends(get_db)
) -> None:
    """
    Vérifie si un projet a un abonnement Pro actif.
    Lève une exception 402 si ce n'est pas le cas.
    """
    subscription = db.query(Subscription).filter(
        Subscription.project_id == project_id
    ).first()
    
    if not subscription or subscription.plan_type != "pro" or subscription.status != "active":
        raise HTTPException(
            status_code=402,
            detail="Pro plan required. Upgrade to access this feature.",
            headers={"X-Upgrade-Url": f"/pricing?projectId={project_id}"}
        )
```

---

## Intégration Frontend (Next.js)

### Bouton d'upgrade

```tsx
// components/UpgradeToProButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UpgradeToProButton({ projectId }: { projectId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout");
      }

      const { checkout_url } = await response.json();
      window.location.href = checkout_url;
    } catch (error) {
      console.error("Upgrade failed:", error);
      alert("Failed to create checkout. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleUpgrade}
      disabled={isLoading}
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition"
    >
      {isLoading ? "Processing..." : "Upgrade to Pro ($49/month)"}
    </button>
  );
}
```

---

### Page de succès

```tsx
// app/billing/success/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { checkSubscriptionStatus } from "@/lib/api";

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  useEffect(() => {
    if (!projectId) {
      router.push("/");
      return;
    }

    // Vérifier le statut de l'abonnement après 3 secondes
    const timer = setTimeout(async () => {
      try {
        const status = await checkSubscriptionStatus(projectId);
        if (status === "active") {
          router.push(`/projects/${projectId}?upgrade=success`);
        }
      } catch (error) {
        console.error("Failed to check subscription:", error);
        router.push(`/projects/${projectId}?upgrade=pending`);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [projectId, router]);

  return (
    <div className="max-w-md mx-auto text-center py-12">
      <h1 className="text-2xl font-bold mb-4">Processing your upgrade...</h1>
      <p className="text-gray-600 dark:text-gray-400">
        Please wait while we activate your Pro plan.
      </p>
    </div>
  );
}
```

---

### Page d'annulation

```tsx
// app/billing/cancel/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function CancelPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  return (
    <div className="max-w-md mx-auto text-center py-12">
      <h1 className="text-2xl font-bold mb-4">Upgrade Cancelled</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Your upgrade to Pro was cancelled. You can try again anytime.
      </p>
      <Link
        href={projectId ? `/projects/${projectId}` : "/"}
        className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded"
      >
        Return to Project
      </Link>
    </div>
  );
}
```

---

## Gestion des Échecs de Paiement

### Scénario : Paiement échoué

1. **Lemon Squeezy tente de débiter** le client à la date d'échéance.
2. **Si échec** (carte expirée, fonds insuffisants) :
   - Lemon Squeezy envoie un événement `subscription_payment_failed`.
   - Votre webhook met `subscription.status = "past_due"`.
   - Le client perd l'accès aux features Pro (SDH, etc.).

3. **Lemon Squeezy envoie des emails automatiques** au client pour mettre à jour sa méthode de paiement.

4. **Si le client met à jour sa carte** :
   - Lemon Squeezy retente le paiement.
   - Si succès → événement `subscription_payment_success` → accès rétabli.

### Code pour gérer les échecs

```python
# Dans votre webhook (déjà implémenté ci-dessus)
elif event_type == "subscription_payment_failed":
    subscription.status = "past_due"
    # Optionnel: Envoyer un email au client
    send_payment_failed_email(subscription.project_id)
    db.commit()
```

---

## Tests

### 1. Test en Sandbox

Lemon Squeezy propose un **mode test** pour simuler les paiements :

1. Activez le mode test dans **Store Settings** → **Test Mode**.
2. Utilisez les cartes de test :
   - **Succès**: `4242 4242 4242 4242`
   - **Échec**: `4000 0000 0000 0002`

### 2. Test des Webhooks

Utilisez un outil comme **ngrok** pour exposer votre backend localement et tester les webhooks :

```bash
# Installer ngrok
npm install -g ngrok

# Exposer votre backend (port 8000)
ngrok http 8000

# Configurer le webhook dans Lemon Squeezy avec l'URL ngrok
# Ex: https://abc123.ngrok.io/api/webhooks/lemonsqueezy
```

### 3. Test du Flow Complet

1. Créer un projet en Free.
2. Cliquer sur "Upgrade to Pro".
3. Être redirigé vers Lemon Squeezy (sandbox).
4. Payer avec la carte de test `4242...`.
5. Être redirigé vers `/billing/success`.
6. Vérifier que `subscription.plan_type = "pro"` en base de données.

---

## Déploiement en Production

### 1. Passer en Mode Live

1. Dans Lemon Squeezy, désactivez le **Test Mode**.
2. Remplacez les clés API (sandbox → live).
3. Testez avec une vraie carte (ou PayPal).

### 2. Sécurité

- **Ne jamais exposer** `LEMON_API_KEY` ou `LEMON_WEBHOOK_SECRET` en frontend.
- Utilisez des variables d'environnement :
  ```bash
  # .env
  LEMON_API_KEY=your_live_api_key
  LEMON_WEBHOOK_SECRET=your_webhook_secret
  LEMON_PRODUCT_ID=12345
  LEMON_VARIANT_ID=67890
  ```

### 3. Monitoring

- Surveillez les logs des webhooks pour détecter les échecs.
- Configurez des alertes pour les événements `subscription_payment_failed`.

---

## Dépannage

### Problème : Le webhook n'est pas appelé

**Causes possibles** :
- URL du webhook mal configurée dans Lemon Squeezy.
- Le serveur backend n'est pas accessible depuis internet.
- Erreur de signature (vérifiez `LEMON_WEBHOOK_SECRET`).

**Solution** :
- Vérifiez les logs de Lemon Squeezy (onglet **Webhooks**).
- Testez le webhook avec `curl` :
  ```bash
  curl -X POST https://votre-site.com/api/webhooks/lemonsqueezy \
    -H "X-Signature: votre_signature" \
    -H "Content-Type: application/json" \
    -d '{"meta": {"event_name": "subscription_created"}, "data": {"id": "1", "attributes": {"custom_data": {"project_id": 1}}}}'
  ```

### Problème : Le statut de l'abonnement n'est pas mis à jour

**Causes possibles** :
- Erreur dans la logique du webhook.
- La transaction n'est pas commit en base de données.

**Solution** :
- Ajoutez des logs dans le webhook.
- Vérifiez que `db.commit()` est appelé.

### Problème : Le client est facturé mais n'a pas accès au Pro

**Causes possibles** :
- Le webhook n'a pas été appelé.
- Une erreur dans le webhook a empêché la mise à jour.

**Solution** :
- Vérifiez manuellement la subscription en base de données.
- Mettez à jour manuellement si nécessaire.

---

## Annexes

### Exemple de Payload Webhook

```json
{
  "meta": {
    "event_name": "subscription_created",
    "custom_data": {
      "project_id": 123
    }
  },
  "data": {
    "type": "subscriptions",
    "id": "1",
    "attributes": {
      "status": "active",
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "created_at": "2025-02-15T10:00:00Z",
      "updated_at": "2025-02-15T10:00:00Z"
    }
  }
}
```

---

### Listes des Événements Webhook

| Événement | Description | Action dans SEQPULSE |
|-----------|-------------|----------------------|
| `subscription_created` | Un nouvel abonnement est créé | Mettre `plan_type = "pro"`, `status = "active"` |
| `subscription_updated` | Un abonnement est mis à jour | Mettre à jour `lemon_squeezy_status` |
| `subscription_cancelled` | Un abonnement est annulé | Mettre `plan_type = "free"`, `status = "cancelled"` |
| `subscription_payment_success` | Un paiement a réussi | Mettre `status = "active"` |
| `subscription_payment_failed` | Un paiement a échoué | Mettre `status = "past_due"` |

---

### Frais Lemon Squeezy

| Type de Frais | Montant |
|---------------|---------|
| Frais de transaction | 5% + $0.30 par paiement |
| Frais de payout (retrait) | 1% (minimum $1) |
| Frais mensuels | $0 (gratuit) |

**Exemple** : Pour un paiement de $49 :
- Frais Lemon Squeezy : $2.45 + $0.30 = **$2.75**
- Vous recevez : **$46.25**

---

## Conclusion

Cette intégration permet à SEQPULSE de :
1. **Accepter les paiements** par carte bancaire et PayPal.
2. **Gérer les abonnements récurrents** sans effort.
3. **Être disponible au Congo** (contrairement à Stripe).
4. **Retirer les fonds** via Wise/Payoneer → Mobile Money.

**Prochaine étape** : Implémenter le code ci-dessus et tester en sandbox avant de passer en production.

---

*Document généré par Mistral Vibe pour SEQPULSE* 🚀
*Co-Authored-By: Mistral Vibe <vibe@mistral.ai>*
