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
    <div className="max-w-5xl mx-auto px-6 py-12">
      <Card className="glass-card border-0 animate-scale-up">
        <CardHeader className="text-center pb-8">
          <CardTitle className="text-3xl font-bold flex items-center justify-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-primary to-primary-glow rounded-xl">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <span className="text-gradient">Describe Your Vision</span>
          </CardTitle>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Share your project details and location preferences. Our AI will analyze millions of data points 
            to find your <span className="text-foreground font-semibold">perfect location</span>.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-8 p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* City Input */}
            <div className="space-y-3">
              <Label htmlFor="city" className="text-base font-semibold flex items-center gap-3 text-foreground">
                <div className="p-1.5 bg-accent/10 rounded-lg">
                  <MapPin className="w-5 h-5 text-accent" />
                </div>
                Target City or Region
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

            {/* Project Description */}
            <div className="space-y-3">
              <Label htmlFor="project" className="text-base font-semibold flex items-center gap-3 text-foreground">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                Project Description
              </Label>
              <Textarea
                id="project"
                placeholder="Describe your vision in detail: What type of business? Target audience? Special requirements? The more details, the better our AI can help..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-40 resize-none text-base border-2 focus:border-primary transition-colors duration-300"
                required
              />
            </div>

            {/* Size Input (Optional) */}
            <div className="space-y-3">
              <Label htmlFor="size" className="text-base font-semibold text-foreground">
                Land Size Preference (Optional)
              </Label>
              <Input
                id="size"
                placeholder="e.g., 5000 sq ft, 2 acres, 1000 sqm, flexible..."
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="h-14 text-lg border-2 focus:border-success transition-colors duration-300"
              />
            </div>

            <Button 
              type="submit" 
              variant="gradient" 
              size="lg" 
              className="w-full h-16 text-lg font-bold tracking-wide btn-glow group"
              disabled={!query.trim() || !city.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Analyzing Locations with AI...
                </>
              ) : (
                <>
                  <Search className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
                  Discover Perfect Locations
                </>
              )}
            </Button>
          </form>

          {/* Examples */}
          <div className="pt-8 border-t border-border/50">
            <h4 className="text-lg font-semibold text-foreground mb-4 text-center">Get inspired by these examples:</h4>
            <div className="grid gap-3">
              {examples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(example)}
                  className="group text-left text-base p-4 rounded-xl glass hover:glass-card transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
                >
                  <span className="text-primary font-medium">"</span>
                  <span className="text-foreground group-hover:text-primary transition-colors duration-200">{example}</span>
                  <span className="text-primary font-medium">"</span>
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