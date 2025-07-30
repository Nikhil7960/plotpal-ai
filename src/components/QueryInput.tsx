import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, MapPin, Building2, Loader2 } from "lucide-react";

interface QueryInputProps {
  onSearch: (query: string, city: string, size: string) => void;
  isLoading: boolean;
}

const QueryInput = ({ onSearch, isLoading }: QueryInputProps) => {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [size, setSize] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && city.trim()) {
      onSearch(query.trim(), city.trim(), size.trim());
    }
  };

  const examples = [
    "I need a location for a cozy coffee shop with good foot traffic",
    "Looking for a spot to build a modern shopping mall with parking",
    "Want to open a tech startup office in a business district",
    "Need space for a large warehouse with truck access"
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Card className="shadow-xl border-0 bg-card/50 backdrop-blur-sm">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Describe Your Project
          </CardTitle>
          <p className="text-muted-foreground">
            Tell us what you want to build and where, and our AI will find the perfect locations
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* City Input */}
            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                City/Location
              </Label>
              <Input
                id="city"
                placeholder="e.g., New York, London, Tokyo..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-12"
                required
              />
            </div>

            {/* Project Description */}
            <div className="space-y-2">
              <Label htmlFor="project" className="text-sm font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Project Description
              </Label>
              <Textarea
                id="project"
                placeholder="Describe what you want to build, including any specific requirements..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-32 resize-none"
                required
              />
            </div>

            {/* Size Input (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="size" className="text-sm font-medium">
                Land Size (Optional)
              </Label>
              <Input
                id="size"
                placeholder="e.g., 5000 sq ft, 2 acres, 1000 sqm..."
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="h-12"
              />
            </div>

            <Button 
              type="submit" 
              variant="gradient" 
              size="lg" 
              className="w-full h-12"
              disabled={!query.trim() || !city.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing Locations...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Find Perfect Locations
                </>
              )}
            </Button>
          </form>

          {/* Examples */}
          <div className="pt-6 border-t border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Example queries:</h4>
            <div className="grid gap-2">
              {examples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(example)}
                  className="text-left text-sm p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-transparent hover:border-border"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QueryInput;