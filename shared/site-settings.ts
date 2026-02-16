import { z } from "zod";

export const SiteSettingsSchema = z.object({
  siteName: z.string().min(1),
  heroSubtitle: z.string().min(1),
  heroDescription: z.string().min(1),
  aboutTitle: z.string().min(1),
  aboutLines: z.array(z.string()),
  contactTitle: z.string().min(1),
  contactSubtitle: z.string().min(1),
  contactNameLabel: z.string().min(1),
  contactEmailLabel: z.string().min(1),
  contactMessageLabel: z.string().min(1),
  contactNamePlaceholder: z.string().min(1),
  contactEmailPlaceholder: z.string().min(1),
  contactMessagePlaceholder: z.string().min(1),
  contactButtonLabel: z.string().min(1),
  contactSuccessTitle: z.string().min(1),
  contactSuccessDescription: z.string().min(1),
  contactDestination: z.string().min(1),
  footerGithubUrl: z.string().min(1),
  footerDiscordUrl: z.string().min(1),
  footerYoutubeUrl: z.string().min(1),
  footerEmail: z.string().email(),
  footerCopyright: z.string().min(1),
  footerDevelopedBy: z.string().min(1),
});

export type SiteSettingsData = z.infer<typeof SiteSettingsSchema>;

export const DEFAULT_SITE_SETTINGS: SiteSettingsData = {
  siteName: "Yim Game",
  heroSubtitle: "Yim Game | CS2 • Quake • Minecraft",
  heroDescription:
    "Servidores dedicados, comunidad activa y eventos. La mejor experiencia de juego online en un solo lugar.",
  aboutTitle: "About Me",
  aboutLines: [
    "$ whoami",
    "> Security Researcher | Red Team Operator | DevOps Engineer",
    "",
    "$ cat experience.txt",
    "> 8+ years in cybersecurity and infrastructure automation",
    "> Specialized in offensive security and cloud-native architectures",
    "> Led red team engagements for Fortune 500 companies",
    "",
    "$ grep -i 'passion' mission.log",
    "> Breaking systems to build better security",
    "> Automating the impossible",
    "> Teaching others to think like attackers",
  ],
  contactTitle: "Get In Touch",
  contactSubtitle: "Have a project in mind? Let's work together",
  contactNameLabel: "Name",
  contactEmailLabel: "Email",
  contactMessageLabel: "Message",
  contactNamePlaceholder: "Your name",
  contactEmailPlaceholder: "your.email@example.com",
  contactMessagePlaceholder: "Tell me about your project...",
  contactButtonLabel: "Send Message",
  contactSuccessTitle: "Message Sent!",
  contactSuccessDescription: "Thanks for reaching out. I'll get back to you soon.",
  contactDestination: "Se guarda en Admin > Mensajes",
  footerGithubUrl: "https://github.com/yimgame/Gaming-Platform#readme",
  footerDiscordUrl: "https://discord.com/invite/pT4nmpS",
  footerYoutubeUrl: "https://www.youtube.com/@fraggingtimes",
  footerEmail: "yimgame@gmail.com",
  footerCopyright: "© 2026 Yim Game. Todos los derechos reservados.",
  footerDevelopedBy: "Desarrollado por GitHub Copilot",
};

export const UpdateSiteSettingsSchema = SiteSettingsSchema.partial();

export const ContactMessageInputSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(255),
  message: z.string().min(5).max(4000),
});

export type ContactMessageInput = z.infer<typeof ContactMessageInputSchema>;
