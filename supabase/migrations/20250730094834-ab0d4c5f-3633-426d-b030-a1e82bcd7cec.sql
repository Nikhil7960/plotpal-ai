-- Create cities table
CREATE TABLE public.cities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT,
  country TEXT DEFAULT 'India',
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create plots/properties table
CREATE TABLE public.plots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id),
  title TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  area_sqft INTEGER,
  price_per_sqft DECIMAL(10, 2),
  total_price DECIMAL(15, 2),
  plot_type TEXT CHECK (plot_type IN ('residential', 'commercial', 'industrial', 'agricultural')),
  zoning TEXT,
  availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'sold', 'reserved')),
  suitable_for TEXT[], -- Array of suitable business types
  amenities TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (since this is location data)
CREATE POLICY "Cities are publicly readable" 
ON public.cities 
FOR SELECT 
USING (true);

CREATE POLICY "Plots are publicly readable" 
ON public.plots 
FOR SELECT 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_cities_name ON public.cities(name);
CREATE INDEX idx_plots_city_id ON public.plots(city_id);
CREATE INDEX idx_plots_location ON public.plots(latitude, longitude);
CREATE INDEX idx_plots_type ON public.plots(plot_type);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_cities_updated_at
BEFORE UPDATE ON public.cities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plots_updated_at
BEFORE UPDATE ON public.plots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data for Thane and other cities
INSERT INTO public.cities (name, state, country, latitude, longitude) VALUES
('Thane', 'Maharashtra', 'India', 19.2183, 72.9781),
('Mumbai', 'Maharashtra', 'India', 19.0760, 72.8777),
('Pune', 'Maharashtra', 'India', 18.5204, 73.8567),
('Nashik', 'Maharashtra', 'India', 19.9975, 73.7898),
('Nagpur', 'Maharashtra', 'India', 21.1458, 79.0882);

-- Insert sample plots for Thane
INSERT INTO public.plots (city_id, title, address, latitude, longitude, area_sqft, price_per_sqft, total_price, plot_type, zoning, suitable_for, amenities) 
SELECT 
  c.id,
  'Commercial Plot in Thane West',
  'Plot No. 15, Sector 7, Thane West',
  19.2250, 72.9700,
  2500, 12000.00, 30000000.00,
  'commercial', 'Commercial',
  ARRAY['retail', 'office', 'restaurant'],
  ARRAY['parking', 'water supply', 'electricity']
FROM public.cities c WHERE c.name = 'Thane';

INSERT INTO public.plots (city_id, title, address, latitude, longitude, area_sqft, price_per_sqft, total_price, plot_type, zoning, suitable_for, amenities) 
SELECT 
  c.id,
  'Residential Plot in Thane East',
  'Plot No. 8, Kharadi Road, Thane East',
  19.2100, 72.9850,
  1800, 8500.00, 15300000.00,
  'residential', 'Residential',
  ARRAY['housing', 'apartment'],
  ARRAY['garden space', 'water supply', 'electricity', 'sewerage']
FROM public.cities c WHERE c.name = 'Thane';

INSERT INTO public.plots (city_id, title, address, latitude, longitude, area_sqft, price_per_sqft, total_price, plot_type, zoning, suitable_for, amenities) 
SELECT 
  c.id,
  'Industrial Plot in Thane',
  'Plot No. 45, MIDC Thane',
  19.2000, 72.9900,
  5000, 6000.00, 30000000.00,
  'industrial', 'Industrial',
  ARRAY['manufacturing', 'warehouse', 'logistics'],
  ARRAY['heavy power supply', 'road access', 'drainage']
FROM public.cities c WHERE c.name = 'Thane';