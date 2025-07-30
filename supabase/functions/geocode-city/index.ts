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

    // If not in database, use OpenStreetMap Nominatim API for geocoding
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1&countrycodes=in`
    
    console.log(`Geocoding via Nominatim: ${nominatimUrl}`)
    
    const geocodeResponse = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'SiteSelection-App'
      }
    })

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
    
    // Parse display name to extract state
    const displayParts = result.display_name.split(', ')
    const state = displayParts.length > 2 ? displayParts[displayParts.length - 3] : null

    const newCity = {
      name: result.name || city,
      state: state,
      country: 'India',
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