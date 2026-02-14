import { Trophy, Users, Clock, Zap, Play, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const gameStats = [
  {
    icon: Trophy,
    title: "Counter Strike 1.6",
    color: "primary" as const,
    rankings: [
      { name: "xXSniperXx", kills: 15420, rank: "#1", extra: undefined },
      { name: "ProGamer98", kills: 14230, rank: "#2", extra: undefined },
      { name: "H3ADSHOT", kills: 13890, rank: "#3", extra: undefined },
      { name: "NoScope", kills: 12650, rank: "#4", extra: undefined },
    ],
  },
  {
    icon: Zap,
    title: "Counter Strike 2",
    color: "secondary" as const,
    rankings: [
      { name: "FragMaster", kills: 8920, rank: "#1", extra: undefined },
      { name: "AcePlayer", kills: 8340, rank: "#2", extra: undefined },
      { name: "ClutchKing", kills: 7890, rank: "#3", extra: undefined },
      { name: "SprayControl", kills: 7120, rank: "#4", extra: undefined },
    ],
  },
  {
    icon: Users,
    title: "Minecraft Survival",
    color: "accent" as const,
    rankings: [
      { name: "BuilderPro", kills: 450, rank: "#1", extra: "hrs" },
      { name: "Miner69", kills: 398, rank: "#2", extra: "hrs" },
      { name: "Redstoner", kills: 367, rank: "#3", extra: "hrs" },
      { name: "Farmer420", kills: 289, rank: "#4", extra: "hrs" },
    ],
  },
];

const serverStats = [
  { name: "Total Players", value: "25,000+", icon: Users, color: "primary" as const },
  { name: "Uptime", value: "99.9%", icon: Clock, color: "secondary" as const },
  { name: "Active Servers", value: "6", icon: Zap, color: "accent" as const },
  { name: "Daily Matches", value: "1,200+", icon: Trophy, color: "primary" as const },
];

const highlights = [
  {
    game: "CS 1.6",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop",
    title: "Ace clutch 1v5",
    views: "12.5K",
  },
  {
    game: "CS2",
    image: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&auto=format&fit=crop",
    title: "Tournament Finals",
    views: "8.2K",
  },
  {
    game: "Minecraft",
    image: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=800&auto=format&fit=crop",
    title: "Mega Build Showcase",
    views: "15.8K",
  },
];

export default function SkillsSection() {
  return (
    <section id="stats" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-muted/20">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, rgb(157 0 255) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(157 0 255) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold mb-4 text-accent"
            style={{
              filter: "drop-shadow(0 0 16px currentColor)",
            }}
            data-testid="text-stats-title"
          >
            Stats & Rankings
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-accent to-transparent mx-auto mb-6" 
            style={{ filter: "drop-shadow(0 0 8px rgb(157 0 255))" }} 
          />
          <p className="text-foreground/70 text-lg max-w-2xl mx-auto" data-testid="text-stats-subtitle">
            Top jugadores, estadísticas de servidores y highlights de la comunidad
          </p>
        </div>

        {/* Server Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {serverStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div 
                key={stat.name}
                className={`bg-card/30 backdrop-blur-sm border border-${stat.color}/30 rounded-lg p-6 text-center hover:border-${stat.color}/60 transition-all`}
                style={{ filter: `drop-shadow(0 0 12px hsl(var(--${stat.color}) / 0.2))` }}
              >
                <Icon className={`w-8 h-8 text-${stat.color} mx-auto mb-3`} />
                <div className={`text-3xl font-bold text-${stat.color} mb-1`}>{stat.value}</div>
                <div className="text-sm text-foreground/60">{stat.name}</div>
              </div>
            );
          })}
        </div>

        {/* Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {gameStats.map((game) => {
            const Icon = game.icon;
            return (
              <div 
                key={game.title}
                className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg p-6"
                data-testid={`card-ranking-${game.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className={`p-2 rounded-lg bg-${game.color}/10 border border-${game.color}/30`}
                    style={{ filter: `drop-shadow(0 0 8px hsl(var(--${game.color})))` }}
                  >
                    <Icon className={`w-6 h-6 text-${game.color}`} />
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-foreground">
                    {game.title}
                  </h3>
                </div>
                <div className="space-y-3">
                  {game.rankings.map((player, idx) => (
                    <div 
                      key={player.name}
                      className={`flex items-center justify-between p-3 rounded-lg bg-background/50 border border-${game.color}/20 hover:border-${game.color}/40 transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl font-bold ${idx === 0 ? `text-${game.color}` : 'text-foreground/40'}`}>
                          {player.rank}
                        </span>
                        <span className="font-mono text-foreground">{player.name}</span>
                      </div>
                      <span className={`text-${game.color} font-semibold`}>
                        {player.kills} {player.extra || 'kills'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Highlights */}
        <div className="bg-card/20 backdrop-blur-sm border border-primary/30 rounded-lg p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 
              className="font-serif text-2xl font-bold text-primary"
              style={{ filter: "drop-shadow(0 0 8px currentColor)" }}
            >
              Highlights & Screenshots
            </h3>
            <Button 
              variant="outline" 
              className="border-primary/50 hover:bg-primary/10"
            >
              Ver todos
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {highlights.map((highlight) => (
              <div 
                key={highlight.title}
                className="group relative rounded-lg overflow-hidden border border-primary/20 hover:border-primary/60 transition-all cursor-pointer"
              >
                <div className="aspect-video relative overflow-hidden">
                  <img 
                    src={highlight.image} 
                    alt={highlight.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                  <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground px-2 py-1 rounded text-xs font-semibold">
                    {highlight.game}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-primary/80 flex items-center justify-center">
                      <Play className="w-8 h-8 text-primary-foreground ml-1" fill="currentColor" />
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h4 className="font-semibold text-foreground mb-1">{highlight.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-foreground/60">
                    <ImageIcon className="w-3 h-3" />
                    <span>{highlight.views} views</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
