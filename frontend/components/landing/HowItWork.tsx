"use client";

import { Suspense, useLayoutEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import OverlayTexts from "./OverlayTexts3D";

function Pipeline({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const gltf = useGLTF("/models/pipeline3.glb");
  const scene = gltf.scene;
  const camera = gltf.cameras?.[0] as THREE.PerspectiveCamera | undefined;

  const setState = useThree((state) => state.set);
  const defaultCamera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useLayoutEffect(() => {
    if (camera && !scene.children.includes(camera)) scene.add(camera);
    if (camera) setState({ camera });
    return () => setState({ camera: defaultCamera });
  }, [camera, defaultCamera, setState, scene]);

  useLayoutEffect(() => {
    if (camera) {
      camera.aspect = size.width / size.height;
      camera.updateProjectionMatrix();
    }
  }, [camera, size]);

  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const actions = useMemo(
    () =>
      gltf.animations.map((clip) => {
        const action = mixer.clipAction(clip);
        action.play();
        action.paused = true;
        action.clampWhenFinished = true;
        action.setEffectiveWeight(1);
        action.time = 0;
        return { clip, action };
      }),
    [gltf.animations, mixer]
  );

  const maxDuration = useMemo(() => Math.max(...gltf.animations.map((c) => c.duration)), [gltf.animations]);

  useFrame(() => {
    const progress = progressRef.current;
    const globalTime = progress * maxDuration;
    actions.forEach(({ clip, action }) => (action.time = Math.min(globalTime, clip.duration)));
    mixer.update(0);
  });

  return <primitive object={scene} />;
}

useGLTF.preload("/models/pipeline3.glb");

export default function HowItWork() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const SCROLL_DISTANCE = 6500;

  useLayoutEffect(() => {
    if (!sectionRef.current) return;
    let ctx: any;
    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top top",
          end: `+=${SCROLL_DISTANCE}`,
          scrub: true,
          onUpdate: (self) => {
            progressRef.current = self.progress;
            setProgress(self.progress);
          },
        });
      }, sectionRef);
    })();
    return () => ctx?.revert?.();
  }, []);

  return (
    <section ref={sectionRef} className="relative mt-25 w-full overflow-visible">
      <div className="relative z-30 px-18 pt-12 pb-6">
        <h2 className="font-display font-medium text-4xl text-seqpulse-black">How It Works</h2>
        <p className="mt-2 text-2xl text-seqpulse-slowblack">A simple workflow: capture, analyze, decide — and know what to do next.</p>
      </div>

      {/* Bloc sticky commun pour conserver profondeur : overlay z-10, canvas z-20 */}
      <div className="sticky top-0 h-screen w-full overflow-visible">
        <div className="pointer-events-none absolute inset-0 z-10">
          <OverlayTexts progress={progress} />
        </div>

        <div className="pointer-events-auto relative z-20 h-full w-full">
          <Canvas
            camera={{ position: [0, 0, 8], fov: 45, near: 0.1, far: 100 }}
            dpr={[1, 1.5]}
            gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          >
            <Suspense fallback={null}>
              <hemisphereLight intensity={0.4} />
              <directionalLight position={[5, 5, 5]} intensity={1} />
              <Pipeline progressRef={progressRef} />
              <Environment preset="studio" />
            </Suspense>
          </Canvas>
        </div>
      </div>

      {/* Debug progress 
      
      <div className="fixed bottom-4 left-4 z-50 rounded bg-black px-3 py-1 text-sm text-white">
        progress: {progress.toFixed(2)}
      </div>
      */}

      <div style={{ height: `${SCROLL_DISTANCE}px` }} aria-hidden />


    </section>
  );
}
