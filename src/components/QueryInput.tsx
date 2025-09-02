import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, MapPin, Loader2, Globe } from "lucide-react";

interface QueryInputProps {
  onSearch: (city: string) => void;
  isLoading: boolean;
}

const QueryInput = ({ onSearch, isLoading }: QueryInputProps) => {
  const [city, setCity] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (city.trim()) {
      onSearch(city.trim());
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
            Enter a city name to explore with interactive maps and find development opportunities using AI.
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
                  View City Map
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
                    onSearch(exampleCity);
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
