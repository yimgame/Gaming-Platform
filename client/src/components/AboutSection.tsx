import { useEffect, useMemo, useRef, useState } from "react";
import { Terminal } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-site-settings";

const CHAR_TYPE_MS = 18; // velocidad de tipeo, ms por letra
const LINE_PAUSE_MS = 250; // pausa entre una línea y la siguiente

export default function AboutSection() {
  const { settings } = useSiteSettings();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  const terminalLines = useMemo(() => settings.aboutLines, [settings.aboutLines]);

  // Arranca el tipeo recién cuando la sección entra en foco (viewport),
  // como el efecto original -- no apenas se monta el componente.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || hasStarted) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasStarted]);

  // Reinicia el tipeo si cambia el contenido (ej. se edita desde /admin)
  useEffect(() => {
    setLineIndex(0);
    setCharIndex(0);
  }, [terminalLines]);

  // Motor de tipeo letra por letra: avanza charIndex dentro de la línea
  // actual; al completarla, hace una pausa corta y pasa a la siguiente.
  useEffect(() => {
    if (!hasStarted) return;
    if (lineIndex >= terminalLines.length) return;

    const currentLine = terminalLines[lineIndex] ?? "";

    if (charIndex < currentLine.length) {
      const timer = setTimeout(() => setCharIndex((c) => c + 1), CHAR_TYPE_MS);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setLineIndex((l) => l + 1);
      setCharIndex(0);
    }, LINE_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [hasStarted, lineIndex, charIndex, terminalLines]);

  const isDone = lineIndex >= terminalLines.length;

  return (
    <section id="about" className="relative py-24 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, rgb(0 240 255) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(0 240 255) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold mb-4 text-primary"
            style={{
              filter: "drop-shadow(0 0 16px currentColor)",
            }}
            data-testid="text-about-title"
          >
            {settings.aboutTitle}
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto"
            style={{ filter: "drop-shadow(0 0 8px rgb(0 240 255))" }}
          />
        </div>

        <div className="max-w-4xl mx-auto">
          <div ref={containerRef} className="bg-card/30 backdrop-blur-sm border-2 border-primary/30 rounded-lg overflow-hidden"
            style={{ filter: "drop-shadow(0 0 24px rgb(0 240 255 / 0.2))" }}
          >
            <div className="bg-primary/10 border-b border-primary/30 px-4 py-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm text-primary" data-testid="text-terminal-header">
                terminal@redteam:~$
              </span>
              <div className="ml-auto flex gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive/50" />
                <div className="w-3 h-3 rounded-full bg-secondary/50" />
                <div className="w-3 h-3 rounded-full bg-neon-green/50" />
              </div>
            </div>

            <div className="p-6 font-mono text-sm space-y-2 min-h-[400px]">
              {terminalLines.slice(0, isDone ? terminalLines.length : lineIndex + 1).map((fullText, index) => {
                const isCurrentLine = !isDone && index === lineIndex;
                const displayedText = isCurrentLine ? fullText.slice(0, charIndex) : fullText;
                const isCursorHere = isDone ? index === terminalLines.length - 1 : isCurrentLine;

                return (
                  <div
                    key={index}
                    className={`${
                      fullText.startsWith('$')
                        ? 'text-primary'
                        : fullText.startsWith('>')
                          ? 'text-foreground/80'
                          : 'text-foreground/40'
                    }`}
                    data-testid={`text-terminal-line-${index}`}
                  >
                    {displayedText}
                    {isCursorHere && (
                      <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="text-center p-6 bg-card/20 border border-primary/20 rounded-lg">
              <div className="text-4xl font-bold text-primary mb-2" data-testid="text-stat-experience">8+</div>
              <div className="text-foreground/70">Years Experience</div>
            </div>
            <div className="text-center p-6 bg-card/20 border border-secondary/20 rounded-lg">
              <div className="text-4xl font-bold text-secondary mb-2" data-testid="text-stat-projects">50+</div>
              <div className="text-foreground/70">Security Projects</div>
            </div>
            <div className="text-center p-6 bg-card/20 border border-accent/20 rounded-lg">
              <div className="text-4xl font-bold text-accent mb-2" data-testid="text-stat-certs">15+</div>
              <div className="text-foreground/70">Certifications</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
