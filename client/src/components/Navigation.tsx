import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
    setIsOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-primary/30 bg-background/80 backdrop-blur-lg">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div 
            className="font-serif text-2xl font-bold text-primary cursor-pointer"
            style={{
              filter: "drop-shadow(0 0 8px currentColor)",
            }}
            onClick={() => scrollToSection("hero")}
            data-testid="link-logo"
          >
            Yim Game
          </div>

          <div className="hidden md:flex items-center gap-8">
            {[
              { id: "games", label: "Juegos" },
              { id: "about", label: "Nosotros" },
              { id: "stats", label: "Stats" },
              { id: "contact", label: "Soporte" }
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="text-foreground/70 hover:text-primary transition-colors relative group font-medium uppercase tracking-wider text-sm"
                data-testid={`link-${id}`}
              >
                {label}
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-primary group-hover:w-full transition-all duration-300" 
                  style={{ filter: "drop-shadow(0 0 4px currentColor)" }} 
                />
              </button>
            ))}
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="md:hidden text-primary"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="button-menu-toggle"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-primary/30 bg-card/95 backdrop-blur-lg">
          <div className="px-4 py-4 space-y-3">
            {[
              { id: "games", label: "Juegos" },
              { id: "about", label: "Nosotros" },
              { id: "stats", label: "Stats" },
              { id: "contact", label: "Soporte" }
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="block w-full text-left px-4 py-2 text-foreground/70 hover:text-primary hover:bg-primary/10 rounded-md transition-colors uppercase tracking-wider text-sm font-medium"
                data-testid={`link-mobile-${id}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
