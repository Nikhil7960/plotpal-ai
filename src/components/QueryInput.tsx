import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, MapPin, Building2, Loader2 } from "lucide-react";

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

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <Card className="glass-card border-0 animate-scale-up">
        <CardHeader className="text-center pb-8">
          <CardTitle className="text-3xl font-bold flex items-center justify-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary to-primary-glow rounded-xl">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <span className="text-gradient">View City Map</span>
          </CardTitle>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Enter any city name to view its location on an interactive map with satellite imagery.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-8 p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="city" className="text-base font-semibold flex items-center gap-3 text-foreground">
                <div className="p-1.5 bg-accent/10 rounded-lg">
                  <MapPin className="w-5 h-5 text-accent" />
                </div>
                Enter City Name
              </Label>
              <Input
                id="city"
                placeholder="e.g., New York, London, Tokyo, Mumbai..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-14 text-lg border-2 focus:border-accent transition-colors duration-300"
                required
              />
            </div>

            <Button 
              type="submit" 
              variant="gradient" 
              size="lg" 
              className="w-full h-16 text-lg font-bold tracking-wide btn-glow group"
              disabled={!city.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Loading Map...
                </>
              ) : (
                <>
                  <Search className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
                  View City Map
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default QueryInput;