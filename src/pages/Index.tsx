import { useState } from "react";
import Hero from "@/components/Hero";
import QueryInput from "@/components/QueryInput";
import ThemeToggle from "@/components/ThemeToggle";
import OSMVacantSpaceDetector from "@/components/OSMVacantSpaceDetector";
import MapSkeleton from "@/components/MapSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MapPin, RotateCcw, Navigation, Maximize2, Layers, Move3d, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [currentView, setCurrentView] = useState<'hero' | 'search' | 'analysis'>('hero');
  const [isLoading, setIsLoading] = useState(false);
  const [currentCity, setCurrentCity] = useState('');
  const { toast } = useToast();

  const showCityMap = async (city: string, selectedBuildingType?: string) => {
    setIsLoading(true);
    
    try {
      // Set the city for the analysis view
      setCurrentCity(city);
      
      // Go directly to analysis view for vacant space detection
      setCurrentView('analysis');
      toast({
        title: "Ready for AI Analysis! 🤖",
        description: `Enter a location and analyze vacant spaces using OpenStreetMap and Qwen-VL.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (city: string) => {
    showCityMap(city);
  };

  const handleNewSearch = () => {
    setCurrentView('search');
    setCurrentCity('');
  };

  const handleBackToHome = () => {
    setCurrentView('hero');
    setCurrentCity('');
  };

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />
      
      {currentView === 'hero' && (
        <Hero onGetStarted={() => setCurrentView('search')} />
      )}
      
      {currentView === 'search' && (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleBackToHome}
                  aria-label="Back to home"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <h1 className="text-xl font-semibold">SiteSelect AI</h1>
                </div>
              </div>
            </div>
          </header>
          
          <div className="flex-1 flex items-center justify-center py-8">
            <QueryInput 
              onSearch={handleSubmit}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}
      
      {/* AI Analysis View */}
      {currentView === 'analysis' && (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentView('search')}
                  aria-label="Back to search"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-primary" />
                  </div>
                  <h1 className="text-xl font-semibold">AI Vacant Space Analysis</h1>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={handleNewSearch}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  New Search
                </Button>
              </div>
            </div>
          </header>
          
          {/* Analysis Content */}
          <div className="flex-1 p-6">
            <OSMVacantSpaceDetector initialLocation={currentCity || 'New York City'} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
