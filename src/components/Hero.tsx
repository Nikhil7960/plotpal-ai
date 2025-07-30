import { MapPin, Brain, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroProps {
  onGetStarted: () => void;
}

const Hero = ({ onGetStarted }: HeroProps) => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-primary-glow/10" />
      
      {/* Animated background patterns */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-32 h-32 bg-primary rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-accent rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-primary-glow rounded-full blur-2xl animate-pulse delay-500" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-6">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Location Intelligence</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary via-accent to-primary-glow bg-clip-text text-transparent mb-6 leading-tight">
            SiteSelect AI
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Find the perfect location for your business using AI-powered analysis. 
            Simply describe what you want to build, and we'll find the ideal spots.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="p-6 bg-card rounded-xl border border-border shadow-card hover:shadow-lg transition-all duration-300">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">AI Analysis</h3>
            <p className="text-muted-foreground">Advanced AI understands your requirements and finds suitable locations</p>
          </div>
          
          <div className="p-6 bg-card rounded-xl border border-border shadow-card hover:shadow-lg transition-all duration-300">
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <MapPin className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Smart Mapping</h3>
            <p className="text-muted-foreground">Interactive maps with detailed location information and insights</p>
          </div>
          
          <div className="p-6 bg-card rounded-xl border border-border shadow-card hover:shadow-lg transition-all duration-300">
            <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <Zap className="w-6 h-6 text-success" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Instant Results</h3>
            <p className="text-muted-foreground">Get ranked recommendations with detailed suitability scores</p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <Button 
            variant="hero" 
            size="lg" 
            onClick={onGetStarted}
            className="text-lg px-8 py-4 h-auto"
          >
            Find My Perfect Location
            <MapPin className="w-5 h-5" />
          </Button>
          
          <p className="text-sm text-muted-foreground">
            No registration required • AI-powered analysis • Free to use
          </p>
        </div>
      </div>
    </div>
  );
};

export default Hero;