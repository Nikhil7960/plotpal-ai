import { useState } from "react";
import Hero from "@/components/Hero";
import QueryInput from "@/components/QueryInput";
import MapView from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LocationResult {
  id: string;
  title: string;
  address: string;
  coordinates: [number, number];
  score: number;
  justification: string;
  zoning: string;
  size: string;
  attributes: string[];
  price: number;
  plotType: string;
  amenities: string[];
}

const Index = () => {
  const [currentView, setCurrentView] = useState<'hero' | 'search' | 'results'>('hero');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [currentCity, setCurrentCity] = useState('');
  const { toast } = useToast();

  const analyzeLocations = async (query: string, city: string, size: string) => {
    setIsLoading(true);
    
    try {
      // First, geocode the city to get coordinates
      const geocodeResponse = await supabase.functions.invoke('geocode-city', {
        body: { city }
      });

      if (geocodeResponse.error) {
        throw new Error('Failed to find city location');
      }

      const { city: cityData } = geocodeResponse.data;
      
      // Fetch plots for the city
      const { data: plots, error: plotsError } = await supabase
        .from('plots')
        .select(`
          *,
          cities (
            name,
            state,
            latitude,
            longitude
          )
        `)
        .eq('city_id', cityData.id);

      if (plotsError) {
        console.error('Error fetching plots:', plotsError);
        throw new Error('Failed to fetch plots');
      }

      // Calculate scores and format results
      const formattedResults: LocationResult[] = (plots || []).map((plot, index) => {
        // Simple scoring algorithm based on plot attributes
        let score = 70;
        
        // Boost score for commercial plots if query suggests business
        if (plot.plot_type === 'commercial' && 
            (query.toLowerCase().includes('business') || 
             query.toLowerCase().includes('shop') || 
             query.toLowerCase().includes('office'))) {
          score += 15;
        }
        
        // Boost score for residential plots if query suggests housing
        if (plot.plot_type === 'residential' && 
            (query.toLowerCase().includes('house') || 
             query.toLowerCase().includes('home') || 
             query.toLowerCase().includes('apartment'))) {
          score += 15;
        }
        
        // Add points for amenities
        score += Math.min(plot.amenities?.length * 3, 15);
        
        // Reduce score based on position (first plots get higher scores)
        score = Math.max(score - index * 5, 60);

        const formatPrice = (price: number) => {
          if (price >= 10000000) return `₹${(price / 10000000).toFixed(1)}Cr`;
          if (price >= 100000) return `₹${(price / 100000).toFixed(1)}L`;
          return `₹${price.toLocaleString()}`;
        };

        return {
          id: plot.id,
          title: plot.title,
          address: plot.address,
          coordinates: [plot.longitude, plot.latitude] as [number, number],
          score: Math.min(score, 100),
          justification: `${plot.plot_type === 'commercial' ? 'Prime commercial location' : 
                          plot.plot_type === 'residential' ? 'Excellent residential area' : 
                          'Strategic location'} in ${cityData.name}. ${plot.area_sqft} sq ft ${plot.plot_type} plot with ${plot.amenities?.length || 0} key amenities. ${plot.availability_status === 'available' ? 'Currently available for development.' : 'Limited availability.'}`,
          zoning: plot.zoning || plot.plot_type,
          size: `${plot.area_sqft?.toLocaleString()} sq ft`,
          attributes: [...(plot.amenities || []), ...(plot.suitable_for || [])],
          price: plot.total_price || 0,
          plotType: plot.plot_type,
          amenities: plot.amenities || []
        };
      });

      // Sort by score
      formattedResults.sort((a, b) => b.score - a.score);
      
      setSearchResults(formattedResults);
      setCurrentCity(cityData.name);
      setCurrentView('results');
      
      toast({
        title: "Analysis Complete!",
        description: `Found ${formattedResults.length} suitable plots in ${cityData.name}`,
      });
      
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "Sorry, we couldn't analyze locations right now. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {currentView === 'hero' && (
        <Hero onGetStarted={() => setCurrentView('search')} />
      )}
      
      {currentView === 'search' && (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentView('hero')}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  SiteSelect AI
                </h1>
              </div>
            </div>
          </header>
          
          <div className="flex-1 py-8">
            <QueryInput 
              onSearch={analyzeLocations}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}
      
      {currentView === 'results' && (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentView('search')}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  SiteSelect AI
                </h1>
              </div>
              
              <Button 
                variant="outline"
                onClick={() => setCurrentView('search')}
              >
                New Search
              </Button>
            </div>
          </header>
          
          <div className="flex-1 py-8 max-w-6xl mx-auto px-6">
            <MapView 
              city={currentCity}
              results={searchResults}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
