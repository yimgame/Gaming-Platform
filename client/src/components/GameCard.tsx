import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gamepad2, Globe, Users } from "lucide-react";
import { Link } from "wouter";

interface GameCardProps {
  title: string;
  description: string;
  tags: string[];
  image: string;
  connectUrl?: string;
  status?: "online" | "offline" | "maintenance";
  playerCount?: string;
}

export default function GameCard({ 
  title, 
  description, 
  tags, 
  image, 
  connectUrl,
  status = "online",
  playerCount = "0/32"
}: GameCardProps) {
  const isOnline = status === "online";
  const gameSlug = title.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
  
  
  return (
    <Card 
      className="group relative overflow-hidden bg-card/50 backdrop-blur-sm border-2 border-primary/30 hover:border-primary/60 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2"
      style={{
        filter: "drop-shadow(0 0 20px rgba(0, 240, 255, 0.1))",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative aspect-video overflow-hidden bg-muted">
        {/* Placeholder gradient for game image since we don't have game screenshots yet */}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
        <img 
          src={image} 
          alt={title}
          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-4 right-4 z-20">
          <Badge variant={isOnline ? "default" : "destructive"} className={isOnline ? "bg-green-500 hover:bg-green-600" : "bg-red-500"}>
            {status.toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="relative p-6 z-20">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary mb-2">
              {title}
            </h3>
            <div className="flex gap-2 mb-4 flex-wrap">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="border-primary/50 text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <p className="text-muted-foreground mb-6 line-clamp-3">
          {description}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="w-4 h-4 mr-2" />
            <span>{playerCount} Players</span>
          </div>

          <div className="flex gap-3">
            <Link href={`/games/${gameSlug}`}>
              <Button variant="outline" size="sm">
                <Globe className="w-4 h-4 mr-2" />
                Info
              </Button>
            </Link>
            {connectUrl && (
              <Button size="sm" className="bg-primary hover:bg-primary/90" asChild>
                <a href={connectUrl}>
                  <Gamepad2 className="w-4 h-4 mr-2" />
                  Jugar
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
