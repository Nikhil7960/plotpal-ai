import { MapPin, Brain, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface HeroProps {
  onGetStarted: () => void;
}

const Hero = ({ onGetStarted }: HeroProps) => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-background to-secondary/20">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      
      {/* Pattern overlay for visual interest */}
      <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        {/* Header */}
        <div className="mb-12 space-y-6">
          <Badge variant="secondary" className="px-4 py-1.5">
            <Brain className="w-4 h-4 mr-2" />
            AI-Powered Location Intelligence
          </Badge>
          
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              SiteSelect AI
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            Discover the perfect location for your business with AI-powered precision.
            <span className="text-foreground font-semibold block mt-2">
              Simply describe your vision, and we'll unveil the ideal spots with intelligent analysis.
            </span>
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto group-hover:bg-primary/20 transition-colors">
                <Brain className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-xl">AI Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Advanced AI understands your requirements and finds suitable locations with unprecedented accuracy
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto group-hover:bg-primary/20 transition-colors">
                <MapPin className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Smart Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Interactive maps with detailed location insights, demographic data, and comprehensive analytics
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto group-hover:bg-primary/20 transition-colors">
                <Zap className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Instant Results</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Get ranked recommendations with detailed suitability scores and actionable insights in seconds
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="space-y-6">
          <Button 
            size="lg" 
            onClick={onGetStarted}
            className="text-lg px-8 py-6 h-auto font-semibold group shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Sparkles className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
            Find My Perfect Location
            <MapPin className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              No registration required
            </span>
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              AI-powered analysis
            </span>
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Free to use
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
