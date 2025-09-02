import { useState } from "react";
import Hero from "@/components/Hero";
import QueryInput from "@/components/QueryInput";
import ThemeToggle from "@/components/ThemeToggle";
import GoogleMap from "@/components/GoogleMap";
import MapSkeleton from "@/components/MapSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MapPin, RotateCcw, Navigation, Maximize2, Layers, Move3d } from "lucide-react";
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
      
      {currentView === 'results' && cityCoordinates && (
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
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <h1 className="text-xl font-semibold">SiteSelect AI</h1>
                </div>
              </div>
              
              <Button 
                variant="outline"
                onClick={handleNewSearch}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                New Search
              </Button>
            </div>
          </header>
          
          {/* Map Content */}
          <div className="flex-1 p-6">
            <div className="container mx-auto">
              {isLoading ? (
                <MapSkeleton />
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold mb-2">
                      {currentCity}
                    </h2>
                    <p className="text-muted-foreground text-lg">
                      Explore {currentCity} in 2D and 3D with satellite imagery and street views
                    </p>
                  </div>
                  
                  <GoogleMap 
                    city={currentCity}
                    coordinates={cityCoordinates}
                  />
                  
                  {/* Additional Info Cards */}
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Navigation className="h-4 w-4 text-muted-foreground" />
                          Coordinates
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">
                          {cityCoordinates[1].toFixed(4)}°
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {cityCoordinates[0].toFixed(4)}°
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          View Modes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-medium">2D/3D Maps</p>
                        <p className="text-sm text-muted-foreground">
                          Satellite, Hybrid, Street
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Move3d className="h-4 w-4 text-muted-foreground" />
                          3D Features
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-medium">Buildings & Terrain</p>
                        <p className="text-sm text-muted-foreground">
                          45° Tilt View
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Maximize2 className="h-4 w-4 text-muted-foreground" />
                          Controls
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm font-medium">Full Navigation</p>
                        <p className="text-sm text-muted-foreground">
                          Zoom, Rotate, Street View
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
