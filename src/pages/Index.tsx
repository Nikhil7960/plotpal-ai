import { useState } from "react";
import Hero from "@/components/Hero";
import QueryInput from "@/components/QueryInput";
import ThemeToggle from "@/components/ThemeToggle";
import GoogleMap from "@/components/GoogleMap";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [currentView, setCurrentView] = useState<'hero' | 'search' | 'results'>('hero');
  const [isLoading, setIsLoading] = useState(false);
  const [currentCity, setCurrentCity] = useState('');
  const [cityCoordinates, setCityCoordinates] = useState<[number, number] | null>(null);
  const { toast } = useToast();

  const showCityMap = async (city: string) => {
    setIsLoading(true);
    
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      // Use Google Maps Geocoding API directly
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${apiKey}`;
      
      const response = await fetch(geocodeUrl);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        throw new Error('City not found');
      }

      const result = data.results[0];
      const { lat, lng } = result.geometry.location;
      const cityName = result.formatted_address;
      
      setCurrentCity(cityName);
      setCityCoordinates([lng, lat]);
      setCurrentView('results');
      
      toast({
        title: "City Found! 🗺️",
        description: `Showing map for ${cityName}`,
      });
      
    } catch (error) {
      console.error('Location error:', error);
      toast({
        title: "Location Failed",
        description: "Sorry, we couldn't find this city. Please try again.",
        variant: "destructive",
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
    setCityCoordinates(null);
  };

  const handleBackToHome = () => {
    setCurrentView('hero');
    setCurrentCity('');
    setCityCoordinates(null);
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <ThemeToggle />
      
      {currentView === 'hero' && (
        <Hero onGetStarted={() => setCurrentView('search')} />
      )}
      
      {currentView === 'search' && (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="border-b border-border/30 glass sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleBackToHome}
                  className="hover:scale-110 transition-transform duration-200"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                  <div className="p-1.5 bg-gradient-to-br from-primary to-primary-glow rounded-lg">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-gradient">SiteSelect AI</span>
                </h1>
              </div>
            </div>
          </header>
          
          <div className="flex-1 py-8">
            <QueryInput 
              onSearch={handleSubmit}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}
      
      {currentView === 'results' && cityCoordinates && (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="border-b border-border/30 glass sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentView('search')}
                  className="hover:scale-110 transition-transform duration-200"
                  title="Back to Search"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                  <div className="p-1.5 bg-gradient-to-br from-primary to-primary-glow rounded-lg">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-gradient">SiteSelect AI</span>
                </h1>
              </div>
              
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline"
                  onClick={handleNewSearch}
                  className="hover:scale-105 transition-transform duration-200 font-semibold"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  New Search
                </Button>
              </div>
            </div>
          </header>
          
          {/* Map Content */}
          <div className="flex-1 p-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-gradient mb-2">
                  {currentCity}
                </h2>
                <p className="text-muted-foreground text-lg">
                  Explore {currentCity} in 2D and 3D with satellite imagery and street views
                </p>
              </div>
              
              <GoogleMap 
                city={currentCity}
                coordinates={cityCoordinates}
                className="animate-scale-up"
              />
              
              {/* Additional Info Section */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-card p-6 text-center">
                  <h3 className="font-semibold text-lg mb-2">Coordinates</h3>
                  <p className="text-muted-foreground">
                    {cityCoordinates[1].toFixed(4)}°, {cityCoordinates[0].toFixed(4)}°
                  </p>
                </div>
                <div className="glass-card p-6 text-center">
                  <h3 className="font-semibold text-lg mb-2">View Modes</h3>
                  <p className="text-muted-foreground">
                    2D/3D, Satellite, Hybrid, Street
                  </p>
                </div>
                <div className="glass-card p-6 text-center">
                  <h3 className="font-semibold text-lg mb-2">3D Features</h3>
                  <p className="text-muted-foreground">
                    Buildings, Terrain, 45° Tilt
                  </p>
                </div>
                <div className="glass-card p-6 text-center">
                  <h3 className="font-semibold text-lg mb-2">Controls</h3>
                  <p className="text-muted-foreground">
                    Zoom, Rotate, Street View
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;