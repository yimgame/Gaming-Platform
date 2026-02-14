import ProjectCard from "./ProjectCard";
import securityDashboard from "@assets/generated_images/security_dashboard_project_thumbnail.png";
import devopsPipeline from "@assets/generated_images/devops_pipeline_project_thumbnail.png";
import pentestingTool from "@assets/generated_images/pentesting_tool_project_thumbnail.png";

const projects = [
  {
    title: "Security Monitoring Platform",
    description: "Enterprise-grade security monitoring dashboard with real-time threat detection, automated incident response, and comprehensive audit logging. Integrates with SIEM systems and provides actionable security insights.",
    tags: ["React", "Node.js", "PostgreSQL", "Elasticsearch", "Docker"],
    image: securityDashboard,
    demoUrl: "#",
    githubUrl: "#",
    glowColor: "primary" as const,
  },
  {
    title: "DevOps Automation Suite",
    description: "Complete CI/CD pipeline automation with Kubernetes orchestration, infrastructure as code, and automated deployment workflows. Reduces deployment time by 80% with zero-downtime deployments.",
    tags: ["Kubernetes", "Terraform", "Jenkins", "AWS", "Python"],
    image: devopsPipeline,
    demoUrl: "#",
    githubUrl: "#",
    glowColor: "secondary" as const,
  },
  {
    title: "Penetration Testing Toolkit",
    description: "Custom penetration testing framework with automated vulnerability scanning, exploit development tools, and comprehensive reporting. Used for red team engagements and security assessments.",
    tags: ["Python", "Metasploit", "Nmap", "Burp Suite", "Go"],
    image: pentestingTool,
    demoUrl: "#",
    githubUrl: "#",
    glowColor: "accent" as const,
  },
];

export default function ProjectsSection() {
  return (
    <section id="projects" className="relative py-24 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, rgb(255 0 110) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(255 0 110) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold mb-4 text-secondary"
            style={{
              filter: "drop-shadow(0 0 16px currentColor)",
            }}
            data-testid="text-projects-title"
          >
            Featured Projects
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-secondary to-transparent mx-auto mb-6" 
            style={{ filter: "drop-shadow(0 0 8px rgb(255 0 110))" }} 
          />
          <p className="text-foreground/70 text-lg max-w-2xl mx-auto" data-testid="text-projects-subtitle">
            Security research, automation tools, and infrastructure projects
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => (
            <ProjectCard key={project.title} {...project} />
          ))}
        </div>
      </div>
    </section>
  );
}
