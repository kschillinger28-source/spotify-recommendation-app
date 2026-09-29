import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import PlaygroundSection from "@/components/PlaygroundSection";
import Story from "@/components/Story";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B0B10] text-[#F4F4F8] font-body">
      <Navbar />
      <main>
        <Hero />
        <Marquee />
        <PlaygroundSection />
        <Story />
      </main>
      <Footer />
    </div>
  );
}
