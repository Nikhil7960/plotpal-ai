import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Loader2, Globe, Building2, Coffee, ShoppingBag, Trees, Home, Hospital, GraduationCap, Dumbbell, Utensils, Building } from "lucide-react";

interface QueryInputProps {
  onSearch: (city: string, buildingType?: string) => void;
  isLoading: boolean;
}

const BUILDING_TYPES = [
  { value: 'cafe', label: 'Cafe', icon: Coffee },
  { value: 'mall', label: 'Shopping Mall', icon: ShoppingBag },
  { value: 'park', label: 'Park', icon: Trees },
  { value: 'residential', label: 'Residential Complex', icon: Home },
  { value: 'office', label: 'Office Building', icon: Building2 },
  { value: 'hospital', label: 'Hospital', icon: Hospital },
  { value: 'school', label: 'School', icon: GraduationCap },
  { value: 'gym', label: 'Gym/Fitness Center', icon: Dumbbell },
  { value: 'restaurant', label: 'Restaurant', icon: Utensils },
  { value: 'hotel', label: 'Hotel', icon: Building },
  { value: 'retail', label: 'Retail Store', icon: ShoppingBag },
];

const QueryInput = ({ onSearch, isLoading }: QueryInputProps) => {
  const [city, setCity] = useState("");
  const [buildingType, setBuildingType] = useState("");
  const [analysisMode, setAnalysisMode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (city.trim()) {
      onSearch(city.trim(), buildingType || undefined);
    }
  };

  const exampleCities = ["New York", "London", "Tokyo", "Paris"];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Card>
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <Globe className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">
            Explore Cities & Find Development Sites
          </CardTitle>
          <CardDescription className="text-base">
            Enter a city name to explore with interactive maps. Optionally select a building type to analyze vacant spaces with AI.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-base font-medium">
                City Name
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="city"
                  placeholder="Enter a city name..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="pl-10 h-12 text-base"
                  required
                  disabled={isLoading}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Try searching for: {exampleCities.join(", ")}
              </p>
            </div>

            {/* Analysis Mode Toggle */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="analysis-mode"
                  checked={analysisMode}
                  onChange={(e) => {
                    setAnalysisMode(e.target.checked);
                    if (!e.target.checked) {
                      setBuildingType("");
                    }
                  }}
                  className="w-4 h-4 text-primary"
                />
                <Label htmlFor="analysis-mode" className="text-sm font-medium cursor-pointer">
                  Enable AI Vacant Space Analysis
                </Label>
              </div>
              
              {analysisMode && (
                <div className="space-y-2">
                  <Label htmlFor="building-type" className="text-sm font-medium">
                    What do you want to build? (Optional)
                  </Label>
                  <Select value={buildingType} onValueChange={setBuildingType}>
                    <SelectTrigger id="building-type">
                      <SelectValue placeholder="Select building type for AI analysis" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUILDING_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select this to analyze the map for suitable vacant spaces using AI
                  </p>
                </div>
              )}
            </div>

            <Button 
              type="submit" 
              size="lg" 
              className="w-full h-12 text-base font-medium"
              disabled={!city.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Loading Map...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  {analysisMode && buildingType ? 'Analyze Vacant Spaces' : 'View City Map'}
                </>
              )}
            </Button>
          </form>

          {/* Quick access buttons */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-3">Popular cities:</p>
            <div className="flex flex-wrap gap-2">
              {exampleCities.map((exampleCity) => (
                <Button
                  key={exampleCity}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCity(exampleCity);
                    onSearch(exampleCity, buildingType || undefined);
                  }}
                  disabled={isLoading}
                  className="text-xs"
                >
                  {exampleCity}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QueryInput;
