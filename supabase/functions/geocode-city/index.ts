import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city } = await req.json()
    
    if (!city) {
      return new Response(
        JSON.stringify({ error: 'City name is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    console.log(`Geocoding city: ${city}`)

    // First, check if city exists in our database
    const { data: existingCity, error: cityError } = await supabase
      .from('cities')
      .select('*')
      .ilike('name', city)
      .single()

    if (existingCity && !cityError) {
      console.log(`Found city in database: ${existingCity.name}`)
      return new Response(
        JSON.stringify({ 
          city: existingCity,
          source: 'database'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // If not in database, use OpenWeatherMap Geocoding API
    const openWeatherApiKey = Deno.env.get('OPENWEATHER_API_KEY')
    
    if (!openWeatherApiKey) {
      throw new Error('OpenWeatherMap API key not configured')
    }
    
    const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)},IN&limit=1&appid=${openWeatherApiKey}`
    
    console.log(`Geocoding via OpenWeatherMap: ${geocodeUrl.replace(openWeatherApiKey, '***')}`)
    
    const geocodeResponse = await fetch(geocodeUrl)

    if (!geocodeResponse.ok) {
      throw new Error('Geocoding service unavailable')
    }

    const geocodeData = await geocodeResponse.json()
    
    if (!geocodeData || geocodeData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'City not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const result = geocodeData[0]
    
    const newCity = {
      name: result.name || city,
      state: result.state || null,
      country: result.country || 'India',
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon)
    }

    // Save new city to database
    const { data: savedCity, error: saveError } = await supabase
      .from('cities')
      .insert(newCity)
      .select()
      .single()

    if (saveError) {
      console.error('Error saving city:', saveError)
      // Return the geocoded data even if we couldn't save it
      return new Response(
        JSON.stringify({ 
          city: { ...newCity, id: 'temp' },
          source: 'geocoded'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Successfully geocoded and saved city: ${savedCity.name}`)

    return new Response(
      JSON.stringify({ 
        city: savedCity,
        source: 'geocoded'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in geocode-city function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})