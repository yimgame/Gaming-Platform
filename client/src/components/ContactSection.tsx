import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MessageSquare, User, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/hooks/use-site-settings";

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { settings } = useSiteSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/contact-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      toast({
        title: settings.contactSuccessTitle,
        description: settings.contactSuccessDescription,
      });
      setFormData({ name: "", email: "", message: "" });
    } catch (_error) {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-muted/20">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, rgb(255 16 240) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(255 16 240) 1px, transparent 1px)
          `,
          backgroundSize: "70px 70px",
        }} />
      </div>

      <div className="relative max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold mb-4 text-secondary"
            style={{
              filter: "drop-shadow(0 0 16px currentColor)",
            }}
            data-testid="text-contact-title"
          >
            {settings.contactTitle}
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-secondary to-transparent mx-auto mb-6" 
            style={{ filter: "drop-shadow(0 0 8px rgb(255 0 110))" }} 
          />
          <p className="text-foreground/70 text-lg" data-testid="text-contact-subtitle">
            {settings.contactSubtitle}
          </p>
        </div>

        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary via-secondary to-accent rounded-lg opacity-20 blur-xl" />
          
          <form 
            onSubmit={handleSubmit}
            className="relative bg-card/50 backdrop-blur-sm border-2 border-primary/30 rounded-lg p-8 space-y-6"
            data-testid="form-contact"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                {settings.contactNameLabel}
              </label>
              <Input
                type="text"
                placeholder={settings.contactNamePlaceholder}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-background/50 border-primary/30 focus:border-primary text-foreground placeholder:text-foreground/40"
                style={{ filter: "drop-shadow(0 0 4px rgb(0 240 255 / 0.1))" }}
                required
                data-testid="input-name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                <Mail className="w-4 h-4 text-secondary" />
                {settings.contactEmailLabel}
              </label>
              <Input
                type="email"
                placeholder={settings.contactEmailPlaceholder}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-background/50 border-secondary/30 focus:border-secondary text-foreground placeholder:text-foreground/40"
                style={{ filter: "drop-shadow(0 0 4px rgb(255 0 110 / 0.1))" }}
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent" />
                {settings.contactMessageLabel}
              </label>
              <Textarea
                placeholder={settings.contactMessagePlaceholder}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="bg-background/50 border-accent/30 focus:border-accent text-foreground placeholder:text-foreground/40 min-h-[150px]"
                style={{ filter: "drop-shadow(0 0 4px rgb(157 0 255 / 0.1))" }}
                required
                data-testid="input-message"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-primary to-secondary text-white font-semibold"
              style={{
                filter: "drop-shadow(0 0 16px rgb(0 240 255 / 0.5))",
              }}
              data-testid="button-submit"
            >
              <Send className="w-5 h-5 mr-2" />
              {isSubmitting ? "Enviando..." : settings.contactButtonLabel}
            </Button>

            <p className="text-xs text-foreground/50 text-center">
              {settings.contactDestination}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
