import { useState } from "react";
import Hero from "@/components/Hero";
import QueryInput from "@/components/QueryInput";
import MapView from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LocationResult {
  id: string;
  address: string;
  coordinates: [number, number];
  score: number;
  justification: string;
  zoning: string;
  size: string;
  attributes: string[];
}

const Index = () => {
  const [currentView, setCurrentView] = useState<'hero' | 'search' | 'results'>('hero');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [currentCity, setCurrentCity] = useState('');
  const { toast } = useToast();

  // Mock AI analysis function - in real app this would call your backend
  const analyzeLocations = async (query: string, city: string, size: string) => {
    setIsLoading(true);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock results based on the query
      const mockResults: LocationResult[] = [
        {
          id: '1',
          address: `123 Business District, ${city}`,
          coordinates: [-74.006, 40.7128] as [number, number],
          score: 92,
          justification: `Excellent location with high foot traffic and prime commercial zoning. Perfect for ${query.toLowerCase().includes('coffee') ? 'a coffee shop' : 'your business'} with nearby parking and public transport.`,
          zoning: 'Commercial',
          size: size || '2,500 sq ft',
          attributes: ['High Foot Traffic', 'Parking Available', 'Public Transport', 'Commercial Zone']
        },
        {
          id: '2',
          address: `456 Main Street, ${city}`,
          coordinates: [-74.008, 40.7108] as [number, number],
          score: 87,
          justification: `Strong candidate with good visibility and accessibility. The mixed-use zoning provides flexibility for various business types with reasonable rental costs.`,
          zoning: 'Mixed-Use',
          size: size || '3,200 sq ft',
          attributes: ['Good Visibility', 'Mixed-Use', 'Affordable Rent', 'Corner Location']
        },
        {
          id: '3',
          address: `789 Development Ave, ${city}`,
          coordinates: [-74.004, 40.7148] as [number, number],
          score: 78,
          justification: `Emerging area with growth potential. While currently less established, the upcoming development projects make this a strategic long-term investment.`,
          zoning: 'Development',
          size: size || '4,000 sq ft',
          attributes: ['Growth Potential', 'New Development', 'Large Space', 'Investment Opportunity']
        }
      ];
      
      setSearchResults(mockResults);
      setCurrentCity(city);
      setCurrentView('results');
      
      toast({
        title: "Analysis Complete!",
        description: `Found ${mockResults.length} suitable locations in ${city}`,
      });
      
    } catch (error) {
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
