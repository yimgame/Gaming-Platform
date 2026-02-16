import { Github, Youtube, Mail } from "lucide-react";
import { BsDiscord } from "react-icons/bs";
import { SiGithubcopilot } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/use-site-settings";

export default function Footer() {
  const { settings } = useSiteSettings();

  const socialLinks = [
    { icon: Github, href: settings.footerGithubUrl, label: "GitHub", color: "text-primary" },
    { icon: BsDiscord, href: settings.footerDiscordUrl, label: "Discord", color: "text-secondary" },
    { icon: Youtube, href: settings.footerYoutubeUrl, label: "YouTube", color: "text-accent" },
    { icon: Mail, href: `mailto:${settings.footerEmail}`, label: "Email", color: "text-neon-green" },
  ];

  return (
    <footer className="relative border-t border-primary/20 bg-background/50 backdrop-blur-sm">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col items-center gap-6">
          <div 
            className="font-serif text-3xl font-bold text-primary"
            style={{
              filter: "drop-shadow(0 0 12px currentColor)",
            }}
          >
            {settings.siteName}
          </div>

          <div className="flex gap-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <Button
                  key={social.label}
                  size="icon"
                  variant="ghost"
                  onClick={() => window.open(social.href, '_blank')}
                  className={`${social.color} hover:bg-primary/10`}
                  style={{
                    filter: "drop-shadow(0 0 6px currentColor)",
                  }}
                  data-testid={`button-social-${social.label.toLowerCase()}`}
                >
                  <Icon className="w-5 h-5" />
                </Button>
              );
            })}
          </div>

          <div className="text-center space-y-2">
            <p className="text-foreground/60 text-sm font-mono" data-testid="text-footer-copyright">
              {settings.footerCopyright}
            </p>
            <p className="text-foreground/40 text-xs flex items-center justify-center gap-1">
              <SiGithubcopilot className="h-3.5 w-3.5" />
              {settings.footerDevelopedBy}
            </p>
          </div>
        </div>
      </div>

      <div 
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgb(0 240 255 / 0.1) 2px,
            rgb(0 240 255 / 0.1) 4px
          )`,
        }}
      />
    </footer>
  );
}
