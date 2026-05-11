# Intégration pipeline 3D (Blender ➜ howitwork.tsx + ScrollTrigger)

## 1. Export Blender
- Bake contraintes/IK du rig caméra, appliquer transforms, échelle 1, unités en mètres, FPS noté (30/60).
- Export `.glb` : clip nommé `CameraMove`, caméra + mesh pipeline, pas de lights. Orientation `+Y up`.
- Optionnel : HDRI `studio.hdr` ou lightmap si l’éclairage Blender doit être conservé.

## 2. Assets projet
- Déposer `public/3d/pipeline.glb` (+ `studio.hdr` éventuel).
- Prévoir un loader R3F (`useProgress`) pour afficher l’état de chargement.

## 3. Scène React Three Fiber
- Créer un `<Canvas>` dans `howitwork.tsx` dédié à la section.
- Charger le GLB via `useGLTF`; récupérer la caméra importée (`gltf.cameras[0]`) ou copier ses keys sur la caméra R3F.
- Instancier un `AnimationMixer`, récupérer le clip `CameraMove`, **ne pas jouer automatiquement** : le temps sera piloté par le scroll.

## 4. ScrollTrigger + scrub
- `gsap.registerPlugin(ScrollTrigger)` (une seule fois).
- Timeline : `gsap.timeline({ scrollTrigger: { trigger: sectionRef, start: "top top", end: "+=2000", pin: true, scrub: true } })`.
- `onUpdate`: `mixer.setTime(self.progress * clip.duration)` pour lier le temps d’anim au scroll (ease none). Appeler `ScrollTrigger.refresh()` après le chargement du modèle.
- Cleanup React : `ctx.revert()` ou `ScrollTrigger.getAll().forEach(t => t.kill())` dans le `useLayoutEffect` cleanup.

## 5. Performance & UX
- Color management cohérent (envMap ou fond couleur), `dpr={[1,2]}`, `shadows` seulement si nécessaire.
- Si besoin de douceur : `scrub: 0.5` (lissage léger). Garder le clip linéaire.
- Fallback non-WebGL : image héro statique.

## 6. QA rapide
- Dev : `markers: true` pour ajuster start/end.
- Mobile : réduire `end` (ex. `"+=1200"`), maillage/tex légers.
- Re-run `ScrollTrigger.refresh()` après resize et après chargement complet des assets.

## 7. Next steps
- Générer le squelette `howitwork.tsx` (Canvas + loader + mixer + ScrollTrigger hook).
- Tester desktop/mobile, puis retirer `markers`.
