# PlotPal AI - AI-Powered Vacant Space Detection

An intelligent web application that uses Google Maps and AI (OpenRouter vision + Groq filtering) to identify optimal vacant spaces for development projects.

## Features

- 🗺️ **Interactive Maps**: Explore cities with Google Maps satellite imagery
- 🤖 **AI Analysis**: Use AI to analyze map screenshots for vacant spaces
- 🏗️ **Building Type Selection**: Choose from cafes, malls, parks, residential, and more
- 📍 **Smart Recommendations**: Get suitability scores and detailed reasoning
- 🎯 **Location Insights**: Understand why a location is suitable for your project

## How It Works

1. **Enter Location**: Type in any city or address
2. **Select Building Type**: Choose what you want to build (optional for AI analysis)
3. **View Map**: Explore the area with satellite imagery
4. **AI Analysis**: Capture map screenshot and analyze with AI
5. **Get Recommendations**: View AI-identified vacant spaces with suitability scores

## Project Info

**URL**: https://lovable.dev/projects/9df934f7-1e01-4713-b0c0-7af8ff34146a

## Setup Instructions

### Prerequisites

- Node.js & npm - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Google Maps API Key
- OpenRouter API Key (for vision analysis)
- Groq API Key (optional, for improved filtering)

### Installation

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd plotpal-ai

# Step 3: Install dependencies
npm install

# Step 4: Set up environment variables
cp .env.example .env
# Edit .env file with your API keys

# Step 5: Start the development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Google Maps API Key (required for maps functionality)
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# OpenRouter API Key (required for vacant space analysis / vision)
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here

# Groq API Key (optional; for improved filtering of inappropriate locations)
VITE_GROQ_API_KEY=your_groq_api_key_here
```

#### Getting API Keys

1. **Google Maps API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the following APIs:
     - Maps JavaScript API
     - Geocoding API
   - Create credentials (API Key)
   - Restrict the key to your domain for security

2. **OpenRouter API Key**:
   - Visit [OpenRouter](https://openrouter.ai/)
   - Sign up and create an API key
   - Used for vision model (e.g. Nemotron Nano VL) to analyze map screenshots

3. **Groq API Key** (optional):
   - Visit [Groq Console](https://console.groq.com/)
   - Create an API key
   - Used for filtering out inappropriate locations (water bodies, etc.)

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/9df934f7-1e01-4713-b0c0-7af8ff34146a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Technologies Used

This project is built with:

- **Frontend**: Vite + React + TypeScript
- **UI Components**: shadcn/ui + Tailwind CSS
- **Maps**: Google Maps JavaScript API
- **AI**: OpenRouter (vision) + Groq (filtering)
- **Image Capture**: html2canvas
- **State Management**: React hooks

## Features in Detail

### Map Functionality
- Interactive Google Maps with satellite imagery
- Location search and geocoding
- Multiple map types (satellite, hybrid, street)
- Zoom and pan controls
- Street view integration

### AI Analysis
- Screenshot capture of map views
- AI image analysis (OpenRouter) and Groq filtering
- Building-type specific recommendations
- Suitability scoring (0-100%)
- Detailed reasoning for each recommendation

### Supported Building Types
- Cafes & Coffee shops
- Shopping Malls
- Parks & Recreation areas
- Residential Complexes
- Office Buildings
- Hospitals & Medical facilities
- Schools & Educational institutions
- Gyms & Fitness centers
- Restaurants
- Hotels
- Retail stores

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/9df934f7-1e01-4713-b0c0-7af8ff34146a) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
