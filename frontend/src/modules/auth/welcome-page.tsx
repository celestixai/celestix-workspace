import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, Mail, CalendarDays, CheckSquare, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoIcon from '@/assets/logo-icon-blue.png';

const features = [
  { icon: MessageCircle, title: 'Messenger', description: 'Real-time chat with your team' },
  { icon: Mail, title: 'Email', description: 'Unified inbox, all in one place' },
  { icon: CalendarDays, title: 'Calendar', description: 'Schedule and organize your day' },
  { icon: CheckSquare, title: 'Tasks', description: 'Track and manage work effortlessly' },
  { icon: Shield, title: 'Secure', description: 'End-to-end encrypted by default' },
];

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-10 animate-fade-in">
          <img src={logoIcon} alt="Celestix" className="w-20 h-20 object-contain mb-4" />
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            Celestix <span className="text-accent-blue">Workspace</span>
          </h1>
          <p className="text-text-secondary mt-2 text-center max-w-md">
            Everything your team needs — messaging, email, tasks, calendar, and files — all in one beautiful workspace.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-10 max-w-lg">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-bg-secondary border border-border-primary text-sm"
            >
              <f.icon size={16} className="text-accent-blue flex-shrink-0" />
              <span className="text-text-primary font-medium">{f.title}</span>
              <span className="text-text-tertiary hidden sm:inline">— {f.description}</span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
          <Button
            className="w-full sm:w-auto flex-1"
            onClick={() => navigate('/register')}
          >
            Get Started <ArrowRight size={16} className="ml-1" />
          </Button>
          <Button
            variant="secondary"
            className="w-full sm:w-auto flex-1"
            onClick={() => navigate('/login')}
          >
            Sign In
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-[11px] text-text-tertiary border-t border-border-primary">
        Celestix Workspace v1.0.0
      </footer>
    </div>
  );
}
