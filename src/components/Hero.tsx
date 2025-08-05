import { MapPin, Brain, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroProps {
  onGetStarted: () => void;
}

const Hero = ({ onGetStarted }: HeroProps) => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden mesh-gradient">
      {/* Dynamic background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary-glow/3 to-transparent" />
      
      {/* Floating animated orbs */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-primary/20 to-primary-glow/30 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-gradient-to-r from-accent/15 to-accent/25 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-gradient-to-r from-primary-glow/20 to-primary/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center animate-scale-up">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-3 px-6 py-3 glass rounded-full mb-8 hover:scale-105 transition-all duration-300">
            <Brain className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary tracking-wide">AI-Powered Location Intelligence</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black text-gradient mb-8 leading-tight tracking-tight">
            SiteSelect AI
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed font-medium">
            Discover the perfect location for your business with AI-powered precision. 
            <span className="text-foreground font-semibold"> Simply describe your vision</span>, and we'll 
            unveil the ideal spots with intelligent analysis.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="group p-8 glass-card rounded-2xl hover:scale-105 transition-all duration-500 hover:shadow-glow">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-glow rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-foreground">AI Analysis</h3>
            <p className="text-muted-foreground leading-relaxed">Advanced AI understands your requirements and finds suitable locations with unprecedented accuracy</p>
          </div>
          
          <div className="group p-8 glass-card rounded-2xl hover:scale-105 transition-all duration-500 hover:shadow-accent">
            <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent/80 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-foreground">Smart Mapping</h3>
            <p className="text-muted-foreground leading-relaxed">Interactive maps with detailed location insights, demographic data, and comprehensive analytics</p>
          </div>
          
          <div className="group p-8 glass-card rounded-2xl hover:scale-105 transition-all duration-500 hover:shadow-lg">
            <div className="w-16 h-16 bg-gradient-to-br from-success to-success/80 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-foreground">Instant Results</h3>
            <p className="text-muted-foreground leading-relaxed">Get ranked recommendations with detailed suitability scores and actionable insights in seconds</p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-6">
          <Button 
            variant="hero" 
            size="lg" 
            onClick={onGetStarted}
            className="text-xl px-12 py-6 h-auto btn-glow font-bold tracking-wide group"
          >
            Find My Perfect Location
            <MapPin className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
          </Button>
          
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              No registration required
            </span>
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              AI-powered analysis
            </span>
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              Free to use
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;