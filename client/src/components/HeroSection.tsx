import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Gamepad2, Server, Globe } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-site-settings";

export default function HeroSection() {
  const [displayText, setDisplayText] = useState("");
  const { settings } = useSiteSettings();
  const fullText = settings.heroSubtitle;

  useEffect(() => {
    setDisplayText("");
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setDisplayText(fullText.substring(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [fullText]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: `linear-gradient(135deg, rgb(0 0 0 / 0.8) 0%, rgb(20 0 40 / 0.8) 100%)`,
          filter: "brightness(0.4)",
        }}
      />
      
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(to right, rgb(0 240 255 / 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 240 255 / 0.1) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="mb-6 flex justify-center gap-4 animate-float">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30" style={{ filter: "drop-shadow(0 0 12px rgb(0 240 255 / 0.5))" }}>
            <Gamepad2 className="w-8 h-8 text-primary" />
          </div>
          <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/30" style={{ filter: "drop-shadow(0 0 12px rgb(255 0 110 / 0.5))" }}>
            <Server className="w-8 h-8 text-secondary" />
          </div>
          <div className="p-3 rounded-lg bg-accent/10 border border-accent/30" style={{ filter: "drop-shadow(0 0 12px rgb(157 0 255 / 0.5))" }}>
            <Globe className="w-8 h-8 text-accent" />
          </div>
        </div>

        <h1 
          className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 text-primary"
          style={{
            filter: "drop-shadow(0 0 20px currentColor) drop-shadow(0 0 40px currentColor)",
          }}
          data-testid="text-hero-title"
        >
          {settings.siteName}
        </h1>

        <div className="font-mono text-xl sm:text-2xl md:text-3xl mb-8 h-12 text-foreground/90">
          <span data-testid="text-hero-subtitle">{displayText}</span>
          <span className="animate-pulse text-primary">_</span>
        </div>

        <p className="text-lg sm:text-xl text-foreground/70 mb-12 max-w-2xl mx-auto font-light" data-testid="text-hero-description">
          {settings.heroDescription}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => scrollToSection("games")}
            className="bg-primary text-primary-foreground border border-primary hover:shadow-xl group relative overflow-hidden"
            style={{
              filter: "drop-shadow(0 0 12px rgb(0 240 255 / 0.5))",
            }}
            data-testid="button-view-projects"
          >
            <span className="relative z-10">Ver Juegos</span>
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            onClick={() => scrollToSection("contact")}
            className="border-secondary text-secondary hover:bg-secondary/10 backdrop-blur-sm"
            style={{
              filter: "drop-shadow(0 0 8px rgb(255 0 110 / 0.3))",
            }}
            data-testid="button-contact"
          >
            Soporte
          </Button>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-primary/50 rounded-full flex justify-center pt-2">
          <div className="w-1 h-2 bg-primary rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
}
