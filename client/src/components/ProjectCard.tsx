import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Github } from "lucide-react";

interface ProjectCardProps {
  title: string;
  description: string;
  tags: string[];
  image: string;
  demoUrl?: string;
  githubUrl?: string;
  glowColor: "primary" | "secondary" | "accent";
}

const glowStyles = {
  primary: "rgb(0 240 255 / 0.3)",
  secondary: "rgb(255 0 110 / 0.3)",
  accent: "rgb(157 0 255 / 0.3)",
};

const borderColors = {
  primary: "border-primary/30 hover:border-primary/60",
  secondary: "border-secondary/30 hover:border-secondary/60",
  accent: "border-accent/30 hover:border-accent/60",
};

export default function ProjectCard({ 
  title, 
  description, 
  tags, 
  image, 
  demoUrl, 
  githubUrl,
  glowColor = "primary"
}: ProjectCardProps) {
  return (
    <Card 
      className={`group relative overflow-hidden bg-card/50 backdrop-blur-sm border-2 ${borderColors[glowColor]} transition-all duration-300 hover:shadow-2xl hover:-translate-y-2`}
      style={{
        filter: `drop-shadow(0 0 20px ${glowStyles[glowColor]})`,
      }}
      data-testid={`card-project-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative aspect-video overflow-hidden">
        <img 
          src={image} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          style={{
            filter: "brightness(0.7) contrast(1.2)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
      </div>

      <div className="p-6 space-y-4">
        <h3 
          className="font-serif text-2xl font-bold text-primary group-hover:text-secondary transition-colors"
          style={{
            filter: "drop-shadow(0 0 8px currentColor)",
          }}
          data-testid={`text-project-title-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {title}
        </h3>

        <p className="text-foreground/70 leading-relaxed" data-testid="text-project-description">
          {description}
        </p>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge 
              key={tag} 
              variant="outline" 
              className="border-primary/30 text-primary bg-primary/5 font-mono text-xs"
              data-testid={`badge-tag-${tag.toLowerCase()}`}
            >
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          {demoUrl && (
            <Button
              size="sm"
              variant="default"
              onClick={() => window.open(demoUrl, '_blank')}
              className="bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
              data-testid="button-demo"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Live Demo
            </Button>
          )}
          {githubUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(githubUrl, '_blank')}
              className="border-foreground/20 hover:border-primary/50"
              data-testid="button-github"
            >
              <Github className="w-4 h-4 mr-2" />
              Source
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
