# Stratégie de Pricing pour SEQPULSE - Plan Pro

**Dernière mise à jour**: 15 février 2025
**Auteur**: Mistral Vibe (avec Nassir)

---

## 🎯 Principes Fondamentaux

### Modèle de Facturation
**1 Projet = 1 Plan** : Chaque projet a son propre abonnement indépendant, car tous les projets n'ont pas la même importance ou le même impact business.

### Valeur Clé
Le **SDH (Smart Deployment Hints)** est la feature premium exclusive au plan Pro. Elle justifie à elle seule l'upsell grâce à :
- Réduction du temps de debug (économie de coûts dev)
- Optimisation des déploiements (moins de downtime)
- Détéction proactive des anomalies

---

## 💰 Structure des Plans (Version MVP Simplifiée)

### 1. Plan Free
**Prix**: $0/projet/mois

**Features incluses**:
- **50 déploiements/mois** (≈ 2/semaine)
- Intégrations CI/CD basiques (GitHub Actions, GitLab CI)
- Metrics de base (7 jours de rétention)
- Accès à l'interface de monitoring

**Limites clés**:
- ❌ Pas de SDH (Smart Deployment Hints)
- ❌ Pas d'alertes automatisées
- ❌ Intégrations CI/CD limitées (GitHub/GitLab uniquement)

**Cible**: Développeurs solo, MVP techniques, projets personnels pour tester SEQPULSE

**Objectif**: Permettre aux utilisateurs de découvrir la plateforme et atteindre rapidement la limite de 50 déploiements pour inciter à l'upgrade

---

### 2. Plan Pro
**Prix**: $49/projet/mois (prix unique, pas de tiers)

**Toutes les features incluses**:
- ✅ **Déploiements illimités** (plus de quota)
- ✅ **SDH (Smart Deployment Hints) activé** - La feature premium qui justifie le prix
- ✅ **Toutes les intégrations CI/CD** (GitHub, GitLab, Jenkins, CircleCI, Bitbucket, etc.)
- ✅ **30 jours de rétention des metrics** (vs 7 jours en Free)
- ✅ **Alertes email/Slack** pour les anomalies détectées
- ✅ **Webhooks personnalisables** pour intégrer avec d'autres outils
- ✅ **Export des données** (CSV/JSON) pour analyse externe

**Avantages clés vs Free**:
1. **SDH**: Détection automatique des régressions et anomalies avant qu'elles n'impactent les utilisateurs
2. **Illimité**: Plus de stress sur les quotas de déploiements
3. **Intégrations complètes**: Compatible avec tous les pipelines CI/CD professionnels
4. **Historique étendu**: 30 jours pour analyser les tendances (vs 7 jours)

**Cible**: Startups, équipes de développement, projets en production, toute équipe sérieuse avec un pipeline CI/CD actif

**Pourquoi $49 ?**:
- Prix accessible pour les petites équipes
- Suffisamment élevé pour filtrer les projets non sérieux
- Justifié par le SDH qui fait gagner des heures de debug par semaine

---

## 📊 Comparatif Visuel (À Afficher sur la Page de Pricing)

| Feature               | Free                     | Pro ($49/mois)               |
|-----------------------|--------------------------|------------------------------|
| **Déploiements/mois** | 50 (≈ 2/semaine)         | **Illimité**                 |
| **SDH**               | ❌                       | ✅ **Activé** (feature clé)  |
| **Intégrations CI/CD**| GitHub & GitLab seulement | **Toutes** (Jenkins, CircleCI, etc.) |
| **Rétention metrics** | 7 jours                  | 30 jours                     |
| **Alertes**           | ❌                       | ✅ Email + Slack             |
| **Webhooks**          | ❌                       | ✅ 5 inclus                   |
| **Export données**    | ❌                       | ✅ CSV/JSON                   |

---

## 🎯 Stratégie de Conversion Free → Pro

### 1. Limite de Déploiements (50/mois)
- **Mécanisme**: Compter les déploiements et bloquer avec un message clair à 50
- **Message d'erreur**:
  ```
  "Vous avez atteint la limite de 50 déploiements ce mois-ci.
  Passez au plan Pro pour des déploiements illimités et activez le SDH.
  [Mettre à niveau maintenant]"
  ```
- **Timing**: La plupart des équipes sérieuses atteignent cette limite en 2-4 semaines

### 2. Feature Gating sur le SDH
- **Free**: Le SDH est visible mais grisé avec un tooltip:
  ```
  "Le SDH (Smart Deployment Hints) est disponible sur le plan Pro.
  Il aurait pu détecter [X] anomalies ce mois-ci."
  ```
- **Pro**: SDH pleinement fonctionnel avec insights en temps réel

### 3. Email d'Upsell Automatique
Envoyé quand un utilisateur atteint 40 déploiements (80% de la limite):
```
Subject: Votre projet [Nom] est prêt pour le plan Pro 🚀

Bonjour [Prénom],

Votre projet "[Nom]" a effectué 40 déploiements ce mois-ci - vous approchez de la limite Free (50).

🔍 Ce que vous ratez avec le plan Free:
- SDH (Smart Hints): [X] anomalies auraient pu être détectées ce mois-ci
- Alertes Slack: Soyez notifié immédiatement en cas de régression
- Historique étendu: 30 jours de metrics vs 7 jours

💡 Passez au plan Pro pour $49/mois et:
✅ Déployez sans limites
✅ Activez le SDH pour gagner du temps
✅ Intégrez avec Jenkins/CircleCI si besoin

[Bouton: Mettre à niveau maintenant]

PS: Le SDH se paye tout seul en évitant 2h de debug par semaine.
```

### 4. Rapport Mensuel de Valeur
Envoyé à tous les utilisateurs Free:
```
📊 Votre activité en [Mois] [Année]

🔹 Déploiements: [X]/50 utilisés ([Y]%)
🔹 Temps moyen de déploiement: [Z] secondes
🔹 Anomalies détectables par SDH: [A] (non visibles en Free)

🚀 Avec le plan Pro, vous auriez eu:
- [A] alertes SDH pour éviter des régressions
- 30 jours d'historique pour analyser les tendances
- Intégration avec [autres CI/CD utilisés]

[Voir les plans Pro]
```

---

## 📈 Modèle de Revenue Simplifié

### Phase 1: Lancement (0-3 mois)
| Plan       | Nombre de Projets | Revenue Mensuel |
|------------|-------------------|-----------------|
| Free       | 100               | $0              |
| Pro        | 20                | $980            |
| **Total**  | **120**           | **$980 MRR**    |

**Hypothèses**:
- 20% des utilisateurs Free convertissent en Pro
- Acquisition de 100 projets Free en 3 mois

### Phase 2: Growth (3-6 mois)
| Plan       | Nombre de Projets | Revenue Mensuel |
|------------|-------------------|-----------------|
| Free       | 200               | $0              |
| Pro        | 60                | $2,940          |
| **Total**  | **260**           | **$2,940 MRR**  |

**Hypothèses**:
- 30% de conversion Free → Pro
- Acquisition de 100 projets Free supplémentaires

### Phase 3: Scale (6-12 mois)
| Plan       | Nombre de Projets | Revenue Mensuel |
|------------|-------------------|-----------------|
| Free       | 500               | $0              |
| Pro        | 200               | $9,800          |
| **Total**  | **700**           | **$9,800 MRR**  |

**Hypothèses**:
- 40% de conversion Free → Pro
- Acquisition organique et virale

---

## 🛠️ Implémentation Technique Minimale

### 1. Backend: Vérification des Limites
```python
# app/api/deps.py
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.db.models import Deployment, Subscription

def check_deployment_limit(
    project_id: int,
    db: Session = Depends(get_db)
) -> None:
    """Vérifie si le projet a atteint sa limite de déploiements."""
    subscription = db.query(Subscription).filter(
        Subscription.project_id == project_id
    ).first()
    
    if not subscription:
        raise HTTPException(
            status_code=404,
            detail="Project subscription not found"
        )
    
    # Compter les déploiements ce mois-ci
    first_day_of_month = datetime.now().replace(day=1)
    deployment_count = db.query(Deployment).filter(
        Deployment.project_id == project_id,
        Deployment.created_at >= first_day_of_month
    ).count()
    
    if subscription.plan_type == "free" and deployment_count >= 50:
        raise HTTPException(
            status_code=402,
            detail="Deployment limit reached (50/month). Upgrade to Pro for unlimited deployments.",
            headers={
                "X-Upgrade-Url": f"/pricing?projectId={project_id}",
                "X-Limit-Reset": first_day_of_month.strftime("%Y-%m-%d")
            }
        )

def require_pro_plan(
    project_id: int,
    db: Session = Depends(get_db)
) -> None:
    """Vérifie si le projet a un plan Pro pour les features premium."""
    subscription = db.query(Subscription).filter(
        Subscription.project_id == project_id
    ).first()
    
    if not subscription or subscription.plan_type != "pro":
        raise HTTPException(
            status_code=402,
            detail="Pro plan required for this feature. Upgrade to unlock SDH and more.",
            headers={"X-Upgrade-Url": f"/pricing?projectId={project_id}"}
        )
```

### 2. Frontend: Composant de Pricing
```tsx
// components/Pricing.tsx
"use client";

import { CheckIcon, XIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";

export default function Pricing() {
  const router = useRouter();

  const tiers = [
    {
      name: "Free",
      id: "free",
      price: "$0",
      description: "Pour tester SEQPULSE et les petits projets.",
      features: [
        { name: "50 déploiements/mois", included: true },
        { name: "Intégrations GitHub & GitLab", included: true },
        { name: "7 jours de metrics", included: true },
        { name: "SDH (Smart Hints)", included: false },
        { name: "Alertes automatisées", included: false },
        { name: "Déploiements illimités", included: false },
      ],
      cta: "Commencer gratuitement",
      highlighted: false,
    },
    {
      name: "Pro",
      id: "pro",
      price: "$49",
      description: "Pour les équipes sérieuses avec des pipelines CI/CD actifs.",
      features: [
        { name: "Déploiements illimités", included: true },
        { name: "SDH (Smart Hints) ✨", included: true },
        { name: "Toutes les intégrations CI/CD", included: true },
        { name: "30 jours de metrics", included: true },
        { name: "Alertes Email/Slack", included: true },
        { name: "Webhooks personnalisables", included: true },
      ],
      cta: "Passer à Pro",
      highlighted: true,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Pricing simple, basé sur vos besoins
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
          Pas de tiers complexes. Juste Free pour tester, Pro pour les équipes sérieuses.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`rounded-2xl p-8 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 ${
              tier.highlighted
                ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-600 dark:border-blue-500"
                : "bg-white dark:bg-gray-800"
            }`}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tier.name}
            </h3>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              {tier.description}
            </p>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                {tier.price}
              </span>
              {tier.name === "Pro" && (
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  /mois
                </span>
              )}
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              {tier.features.map((feature) => (
                <li key={feature.name} className="flex items-center">
                  {feature.included ? (
                    <CheckIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <XIcon className="h-5 w-5 text-gray-400" />
                  )}
                  <span
                    className={`ml-3 ${
                      feature.included
                        ? "text-gray-700 dark:text-gray-300"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {feature.name}
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => {
                if (tier.name === "Free") {
                  router.push("/signup");
                } else {
                  router.push("/pricing/pro");
                }
              }}
              className={`mt-8 w-full rounded-md py-2 text-sm font-semibold transition ${
                tier.highlighted
                  ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  : "bg-gray-800 text-white hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600"
              }`}
            >
              {tier.cta}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          Besoin d'un plan personnalisé pour votre entreprise ? 
          <button
            onClick={() => router.push("/contact")}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Contactez-nous
          </button>
        </p>
      </div>
    </div>
  );
}
```

### 3. Base de Données: Modèle Subscription
```python
# app/db/models/subscription.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from app.db.base import Base

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), unique=True, nullable=False)
    plan_type = Column(String, default="free")  # free ou pro uniquement
    status = Column(String, default="active")  # active, cancelled
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Pour le futur si on ajoute des add-ons
    has_sdh = Column(Boolean, default=False)  # Redondant avec plan_type, mais utile pour les requêtes
```

---

## 🎯 Pourquoi Cette Simplification ?

### 1. **Réduction de la Complexité**
- **Avant**: 3 plans (Free, Pro avec 3 tiers, Enterprise)
- **Maintenant**: 2 plans (Free, Pro) avec un prix unique

### 2. **Focus sur la Valeur Clé**
- Le **SDH** est la seule feature premium qui compte
- Pas de distraction avec des options inutiles

### 3. **Lancement Rapide**
- Moins de code à écrire et tester
- Moins de documentation à rédiger
- Moins de confusion pour les utilisateurs

### 4. **Upsell Clair**
- **Free → Pro**: Une seule décision à prendre
- Pas de "quel tier Pro choisir ?"

### 5. **Évolutif**
- On peut toujours ajouter des add-ons plus tard:
  - +$20 pour des alertes SMS
  - +$50 pour du support prioritaire
  - Mais **pas au lancement**

---

## 📢 Communication & Positionnement

### Message Clé
> **"SEQPULSE est gratuit pour tester, $49/mois pour les équipes sérieuses."**

### Landing Page
**Titre**: "Le co-pilote de vos déploiements CI/CD"

**Sous-titre**: "Gratuit pour les petits projets. $49/mois pour les équipes qui déploient souvent."

**CTA**: "Commencer gratuitement →"

### FAQ
**Q: Pourquoi payer $49/mois ?**
R: Pour le SDH (Smart Hints) qui vous fait gagner des heures de debug, et les déploiements illimités. La plupart des équipes atteignent la limite Free en 2-3 semaines.

**Q: Puis-je essayer le SDH avant de payer ?**
R: Oui ! Le plan Free vous permet de voir ce que le SDH aurait détecté (mais pas en temps réel). C'est la meilleure façon de mesurer la valeur avant de upgrader.

**Q: Y a-t-il des contrats ou engagements ?**
R: Non. Passez de Free à Pro en 1 clic, et annulez à tout moment. Pas de questions posées.

---

## 🚀 Checklist de Lancement (Version Simplifiée)

- [ ] Implémenter le modèle `Subscription` (backend)
- [ ] Ajouter `check_deployment_limit` et `require_pro_plan`
- [ ] Protéger les routes SDH avec `require_pro_plan`
- [ ] Créer la page `/pricing` (frontend)
- [ ] Configurer Stripe pour le plan Pro ($49)
- [ ] Écrire les emails d'upsell (40/50 déploiements)
- [ ] Ajouter le badge "Upgrade" sur les features Pro dans l'UI
- [ ] Tester le flow complet (Free → limite atteinte → upgrade → SDH débloqué)

---

## 📌 Conclusion

Cette version simplifiée permet de:
1. **Lancer rapidement** avec seulement 2 plans
2. **Se concentrer sur l'essentiel**: le SDH vend le plan Pro
3. **Éviter la paralysie par l'analyse**: pas de tiers complexes à justifier
4. **Itérer plus tard**: ajouter des options si les clients en demandent

**Prochaine étape**: Implémenter le backend pour la limite de 50 déploiements et protéger les routes SDH. Une fois cela fait, la page frontend peut être connectée.

---

## 📊 Modèle de Revenue Projeté

### Scénario Early-Stage (0-6 mois)
| Type de Projet       | Nombre | Prix Unitaire | Revenue Mensuel |
|----------------------|---------|---------------|------------------|
| Free                 | 100     | $0            | $0               |
| Pro (Faible)         | 30      | $19           | $570             |
| Pro (Moyen)          | 10      | $29           | $290             |
| Pro (Élevé)          | 2       | $49           | $98              |
| **Total**            | **142** |               | **$958 MRR**     |

### Scénario Growth (6-12 mois)
| Type de Projet       | Nombre | Prix Unitaire | Revenue Mensuel |
|----------------------|---------|---------------|------------------|
| Free                 | 200     | $0            | $0               |
| Pro (Faible)         | 80      | $19           | $1,520           |
| Pro (Moyen)          | 30      | $29           | $870             |
| Pro (Élevé)          | 10      | $49           | $490             |
| Enterprise           | 3       | $150*         | $450             |
| **Total**            | **323** |               | **$3,330 MRR**   |

*Prix moyen Enterprise estimé

### Scénario Scale (12-24 mois)
| Type de Projet       | Nombre | Prix Unitaire | Revenue Mensuel |
|----------------------|---------|---------------|------------------|
| Free                 | 500     | $0            | $0               |
| Pro (Faible)         | 200     | $19           | $3,800           |
| Pro (Moyen)          | 100     | $29           | $2,900           |
| Pro (Élevé)          | 50      | $49           | $2,450           |
| Enterprise           | 20      | $150*         | $3,000           |
| **Total**            | **870** |               | **$12,150 MRR**  |

---

## 🎯 Stratégie d'Upsell

### 1. Questionnaire d'Onboarding
Intégrez un formulaire court pour évaluer l'impact du projet et suggérer le bon tier:

```markdown
1. Quel est le trafic mensuel de votre projet ?
   - [ ] <10k visites
   - [ ] 10k-100k visites
   - [ ] 100k+ visites

2. Votre projet génère-t-il des revenus ?
   - [ ] Non
   - [ ] Oui, <$10k/mois
   - [ ] Oui, >$10k/mois

3. Combien de développeurs travaillent sur ce projet ?
   - [ ] 1-2
   - [ ] 3-5
   - [ ] 5+

4. Quel est le secteur d'activité ?
   - [ ] Personnel/Education
   - [ ] Startup/Tech
   - [ ] E-commerce/Fintech/Santé
```

**Logique de recommandation**:
- 3-4 réponses "basses" → Suggestion: Plan Free ou Pro $19
- Mixte → Suggestion: Pro $29
- 3-4 réponses "hautes" → Suggestion: Pro $49

---

### 2. Essai Gratuit (Trial)
- **Durée**: 14 jours du plan Pro (toutes features, y compris SDH)
- **Conversion**:
  - Email J+7: "Découvrez comment le SDH a optimisé vos déploiements"
  - Email J+12: "Votre trial expire dans 48h - Verrouillez votre tarif"
  - J+14: Bascule automatique en Free si pas de paiement

---

### 3. Alertes de Dépassement
Trigger des notifications quand un projet Free dépasse les limites:

**Exemple d'email**:
```
Subject: Votre projet [Nom] a besoin de plus de puissance ⚡

Bonjour [Prénom],

Votre projet "[Nom]" a dépassé 500 requêtes API aujourd'hui.

🔍 Ce que vous ratez avec le plan Free:
- SDH (Smart Deployment Hints) qui aurait pu détecter [X] anomalies cette semaine
- Alertes en temps réel pour vos déploiements
- Historique complet de vos metrics

💡 Passez au Pro pour seulement $19/mois et débloquez ces features.

[Bouton: Mettre à niveau maintenant]
```

---

### 4. Facturation Annuelle
Offrez une réduction pour engagement long terme:
- **Paiement mensuel**: $19/$29/$49
- **Paiement annuel**: $15.20/$23.20/$39.20/mois (-20%)

**Argumentaire**:
> "Économisez 2 mois par an en choisissant le paiement annuel."

---

## 🛠️ Implémentation Technique

### Backend (FastAPI)

#### 1. Modèle de Données
```python
# app/db/models/subscription.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.db.base import Base

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), unique=True)
    plan_type = Column(String, default="free")  # free, pro, enterprise
    pricing_tier = Column(String, nullable=True)  # low, medium, high (pour Pro)
    status = Column(String, default="active")  # active, cancelled, trialing
    trial_ends_at = Column(DateTime, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
```

#### 2. Middleware de Vérification
```python
# app/api/deps.py
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.models import Subscription
from app.db.deps import get_db

def get_project_subscription(
    project_id: int,
    db: Session = Depends(get_db)
) -> Subscription:
    subscription = db.query(Subscription).filter(
        Subscription.project_id == project_id
    ).first()
    
    if not subscription:
        # Créer une subscription Free par défaut
        subscription = Subscription(
            project_id=project_id,
            plan_type="free",
            status="active"
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
    
    return subscription

def require_pro_plan(subscription: Subscription = Depends(get_project_subscription)):
    if subscription.plan_type not in ["pro", "enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Pro plan required for this feature. Please upgrade.",
            headers={"X-Upgrade-Url": "/pricing?projectId=" + str(subscription.project_id)}
        )
```

#### 3. Protection des Routes
```python
# app/sdh/routes.py
from fastapi import APIRouter, Depends
from app.api.deps import require_pro_plan

router = APIRouter(prefix="/sdh", tags=["sdh"])

@router.get("/hints", dependencies=[Depends(require_pro_plan)])
async def get_sdh_hints(...):
    # Logique SDH
    ...
```

---

### Frontend (Next.js)

#### 1. Page de Pricing Dynamique
```tsx
// app/pricing/page.tsx
"use client";

import { useProject } from "@/hooks/useProject";
import { PricingCard } from "@/components/pricing-card";

export default function PricingPage({
  searchParams,
}: {
  searchParams: { projectId: string };
}) {
  const { data: project, isLoading } = useProject(searchParams.projectId);

  // Algorithme simplifié pour déterminer le tier recommandé
  const assessImpact = (project: any): "low" | "medium" | "high" => {
    if (project.revenue > 10000 || project.monthlyVisits > 100000) {
      return "high";
    } else if (project.revenue > 0 || project.monthlyVisits > 10000) {
      return "medium";
    }
    return "low";
  };

  const recommendedTier = project ? assessImpact(project) : "low";

  const tiers = [
    {
      name: "Free",
      price: "$0",
      priceId: null,
      features: [
        "1 environment",
        "Basic metrics (7 days)",
        "500 API requests/day",
      ],
      cta: "Current Plan",
      disabled: project?.subscription?.plan_type === "free",
    },
    {
      name: "Pro",
      price: recommendedTier === "high" ? "$49" : recommendedTier === "medium" ? "$29" : "$19",
      priceId: recommendedTier === "high" ? "pro_high" : recommendedTier === "medium" ? "pro_medium" : "pro_low",
      features: [
        "Unlimited environments",
        "SDH (Smart Deployment Hints)",
        "Advanced metrics (30 days)",
        "5,000 API requests/day",
        "Email/Slack alerts",
      ],
      highlighted: true,
      cta: project?.subscription?.plan_type === "pro" ? "Current Plan" : "Upgrade to Pro",
      disabled: project?.subscription?.plan_type === "pro",
    },
  ];

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Pricing for {project?.name}
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
          Choose the right plan for your project's needs.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
        {tiers.map((tier) => (
          <PricingCard key={tier.name} tier={tier} projectId={searchParams.projectId} />
        ))}
      </div>

      <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          Not sure which plan is right for you? 
          <button
            onClick={() => alert("Contact support")}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Contact our team
          </button>
        </p>
      </div>
    </div>
  );
}
```

#### 2. Composant PricingCard
```tsx
// components/pricing-card.tsx
"use client";

import { CheckIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";

export function PricingCard({
  tier,
  projectId,
}: {
  tier: {
    name: string;
    price: string;
    priceId: string | null;
    features: string[];
    cta: string;
    disabled?: boolean;
    highlighted?: boolean;
  };
  projectId: string;
}) {
  const router = useRouter();

  const handleUpgrade = () => {
    if (tier.priceId) {
      router.push(`/checkout?projectId=${projectId}&priceId=${tier.priceId}`);
    }
  };

  return (
    <div
      className={`rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 ${
        tier.highlighted ? "border-2 border-blue-600 dark:border-blue-500" : ""
      }`}
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {tier.name}
      </h3>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          {tier.price}
        </span>
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
          /month
        </span>
      </p>

      <ul className="mt-8 space-y-3 text-sm">
        {tier.features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <CheckIcon className="h-6 w-5 flex-none text-blue-600 dark:text-blue-400" />
            <span className="text-gray-700 dark:text-gray-300">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleUpgrade}
        disabled={tier.disabled}
        className={`mt-8 block w-full rounded-md py-2 text-center text-sm font-semibold transition ${
          tier.disabled
            ? "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed"
            : tier.highlighted
            ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            : "bg-gray-800 text-white hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600"
        }`}
      >
        {tier.cta}
      </button>
    </div>
  );
}
```

---

### Intégration Stripe

#### 1. Création d'un Checkout Session
```python
# app/billing/routes.py
import stripe
from fastapi import APIRouter, HTTPException
from app.db.deps import get_db
from app.db.models import Project, Subscription

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["billing"])

@router.post("/create-checkout-session")
async def create_checkout_session(
    project_id: int,
    price_id: str,  # pro_low, pro_medium, pro_high
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Déterminer le prix Stripe ID based on price_id
    stripe_price_id = {
        "pro_low": "price_123_low",
        "pro_medium": "price_123_medium",
        "pro_high": "price_123_high",
    }.get(price_id)

    if not stripe_price_id:
        raise HTTPException(status_code=400, detail="Invalid price ID")

    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price": stripe_price_id,
                "quantity": 1,
            }],
            mode="subscription",
            success_url=f"{settings.FRONTEND_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/pricing?projectId={project_id}",
            metadata={
                "project_id": str(project_id),
                "price_tier": price_id,
            },
            customer_email=project.owner.email,
        )
        return {"url": checkout_session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

#### 2. Webhook Stripe
```python
# app/billing/webhooks.py
from fastapi import APIRouter, Request, HTTPException
import stripe
from app.db.deps import get_db

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter()

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Handle checkout.session.completed
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        
        project_id = int(session["metadata"]["project_id"])
        price_tier = session["metadata"]["price_tier"]
        
        subscription = db.query(Subscription).filter(
            Subscription.project_id == project_id
        ).first()
        
        if subscription:
            subscription.plan_type = "pro"
            subscription.pricing_tier = price_tier.replace("pro_", "")
            subscription.status = "active"
            subscription.stripe_subscription_id = session["subscription"]
            subscription.stripe_customer_id = session["customer"]
            db.commit()

    # Handle invoice.payment_succeeded
    elif event["type"] == "invoice.payment_succeeded":
        # Mettre à jour le status si nécessaire
        pass

    # Handle customer.subscription.deleted
    elif event["type"] == "customer.subscription.deleted":
        subscription = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == event["data"]["object"]["id"]
        ).first()
        
        if subscription:
            subscription.status = "cancelled"
            subscription.plan_type = "free"
            db.commit()

    return {"status": "success"}
```

---

## 📢 Communication & Marketing

### Messages Clés pour Vendre le Plan Pro

1. **Pour les petits projets ($19)**:
   > "Pour moins de 25€/mois, obtenez des insights que même les seniors devs mettent des heures à trouver. Le SDH vous fait gagner 5h par semaine."

2. **Pour les projets moyens ($29)**:
   > "Votre projet génère des revenus ? Ne laissez pas un mauvais déploiement tout faire s'écrouler. Le SDH surveille 24/7 pour $29/mois."

3. **Pour les projets critiques ($49)**:
   > "À $49/mois, le SDH se paye tout seul en évitant UN seul incident de production par an. Combien coûte 1h de downtime pour vous ?"

### Page de Vente (Landing Page)
**Titre**: "Le SDH que même les équipes senior rêveraient d'avoir"

**Sous-titre**: "Détectez les anomalies avant qu'elles n'impactent vos utilisateurs. Parce que même les meilleurs devs ont besoin d'un coup de pouce."

**Features à mettre en avant**:
- ⚡ Détection en temps réel des régressions
- 🔍 Analyse automatique des métriques de déploiement
- 📊 Historique complet pour le post-mortem
- 🛠️ Intégration directe dans votre workflow CI/CD

**CTA**: "Essayez le SDH gratuitement pendant 14 jours →"

---

## 📊 Metrics à Suivre

### KPIs Business
1. **Conversion Free → Pro**: % de projets Free qui passent Pro
   - Objectif: 5-10%
2. **Churn Rate**: % de projets Pro qui annulent
   - Objectif: <3%
3. **ARPU (Average Revenue Per User)**: Revenue moyen par projet payant
   - Objectif: $30+
4. **LTV (Lifetime Value)**: ARPU / Churn Rate
   - Exemple: $30 / 0.03 = $1,000 LTV

### KPIs Produit
1. **Utilisation du SDH**: Nombre de hints générés/consultés par projet
2. **Taux d'adoption**: % de projets Pro utilisant le SDH
3. **Impact business**: Corrélation entre utilisation SDH et réduction des incidents

---

## 🔮 Roadmap Pricing

### Phase 1 (0-3 mois)
- Lancer avec Free et Pro ($19/$29/$49)
- Offrir 2 mois gratuits aux early adopters
- Collecter des feedbacks sur les tiers

### Phase 2 (3-6 mois)
- Introduire le plan Enterprise ($99+)
- Ajouter des add-ons (ex: +$10 pour 5k API calls supplémentaires)
- Lancer un programme de parrainage (1 mois offert pour chaque ami converti)

### Phase 3 (6-12 mois)
- Pricing par utilisation (pay-as-you-go) pour les très gros projets
- Packs "Team" pour gérer plusieurs projets (ex: 5 projets à $89/mois)
- Partenariats avec des hébergeurs (Vercel, Railway) pour des bundles

---

## 📝 Checklist de Lancement

- [ ] Finaliser les prix Stripe (pro_low, pro_medium, pro_high)
- [ ] Implémenter le modèle `Subscription` dans la DB
- [ ] Ajouter le middleware `require_pro_plan`
- [ ] Protéger les routes SDH
- [ ] Créer la page `/pricing` dynamique
- [ ] Configurer les webhooks Stripe
- [ ] Rédiger les emails de trial/upsell
- [ ] Préparer la landing page SDH
- [ ] Configurer les metrics de suivi (Amplitude/PostHog)
- [ ] Tester le flow complet (Free → Trial → Pro)

---

## 💬 FAQ (À Intégrer dans la Doc)

**Q: Puis-je changer de tier Pro plus tard ?**
R: Oui, vous pouvez passer d'un tier à l'autre à tout moment depuis votre dashboard. Le prix est ajusté au prorata.

**Q: Que se passe-t-il si je dépasse les limites du plan Free ?**
R: Votre projet continue de fonctionner, mais certaines features sont désactivées jusqu'au cycle suivant. Nous vous enverrons une alerte pour vous suggérer de passer Pro.

**Q: Le SDH fonctionne-t-il avec tous les frameworks ?**
R: Oui, le SDH analyse les metrics universelles (temps de réponse, taux d'erreur, etc.) et ne dépend pas de votre stack.

**Q: Puis-je annuler à tout moment ?**
R: Oui, pas de engagement. Vous pouvez annuler depuis votre compte et continuer à utiliser le service jusqu'à la fin de la période payée.

**Q: Offrez-vous des remises pour les startups/ONG ?**
R: Oui, contactez-nous avec une preuve de votre statut pour discuter des options.

---

## 📌 Conclusion

Cette stratégie de pricing **par projet** permet de:
1. **Capter tous les segments** (des side-projects aux apps critiques)
2. **Maximiser la valeur perçue** grâce au SDH
3. **Scaler les revenus** avec la croissance des projets clients
4. **Réduire le churn** en alignant prix et valeur

**Prochaine étape**: Implémenter le modèle `Subscription` et protéger les routes SDH avec le middleware. Une fois cela fait, la page de pricing frontend pourra être connectée.

---

*Document généré par Mistral Vibe pour SEQPULSE* 🚀
*Co-Authored-By: Mistral Vibe <vibe@mistral.ai>*
