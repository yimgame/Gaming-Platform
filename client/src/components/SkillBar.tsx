import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";

interface SkillBarProps {
  name: string;
  level: number;
  color: "primary" | "secondary" | "accent" | "neon-green";
}

const colorClasses = {
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
  "neon-green": "text-neon-green",
};

export default function SkillBar({ name, level, color }: SkillBarProps) {
  const [displayLevel, setDisplayLevel] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0;
      const increment = level / 50;
      const interval = setInterval(() => {
        current += increment;
        if (current >= level) {
          setDisplayLevel(level);
          clearInterval(interval);
        } else {
          setDisplayLevel(Math.floor(current));
        }
      }, 20);
      return () => clearInterval(interval);
    }, 100);
    return () => clearTimeout(timer);
  }, [level]);

  return (
    <div className="space-y-2" data-testid={`skill-${name.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex justify-between items-center">
        <span className="font-medium text-foreground/90" data-testid="text-skill-name">{name}</span>
        <span 
          className={`font-mono text-sm ${colorClasses[color]}`}
          style={{ filter: "drop-shadow(0 0 4px currentColor)" }}
          data-testid="text-skill-level"
        >
          {displayLevel}%
        </span>
      </div>
      <Progress 
        value={displayLevel} 
        className="h-2 bg-muted/30"
        style={{
          filter: `drop-shadow(0 0 8px hsl(var(--${color})))`,
        }}
      />
    </div>
  );
}
