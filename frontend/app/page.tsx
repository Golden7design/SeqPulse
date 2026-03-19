import { Navbar } from "@/components/navbar"

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fdfdfd] text-neutral-900">
      <Navbar />
      {/* TODO: add hero/content sections below */}

      <div className="justify-center items-center flex h-[280vh] w-full" >
        <h1 className="font-display text-7xl text-center" >Your CI says "Success"</h1>
      </div>
    </main>
  );
}
