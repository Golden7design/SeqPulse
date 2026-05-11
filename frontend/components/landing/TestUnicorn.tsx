"use client"
// npm install unicornstudio-react
// or
// yarn add unicornstudio-react
// or
// pnpm add unicornstudio-react

// then import the component
import UnicornScene from "unicornstudio-react";

// documentation: https://www.npmjs.com/package/unicornstudio-react
export default function TestUnicorn() {
  return (
    <UnicornScene
      projectId="3NuD5caJaM8Pdy5SbUQX"
      width="1440px"
      height="900px"
      scale={1}
      dpi={1.5}
      sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@2.1.9/dist/unicornStudio.umd.js"
    />
  );
}