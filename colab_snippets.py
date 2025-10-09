"""
🎯 COLAB SNIPPETS - Execute one by one for debugging
Copy-paste each snippet into separate Colab cells and run them individually
"""

# ============================================================================
# SNIPPET 1: INSTALL DEPENDENCIES (Run first)
# ============================================================================
print("🔧 Installing dependencies...")
import subprocess
import sys

packages = [
    "git+https://github.com/huggingface/trl.git",
    "bitsandbytes", "peft", "qwen-vl-utils",
    "geopandas", "rasterio", "folium", "pillow", "requests",
    "datasets", "transformers", "accelerate"
]

for package in packages:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-U", "-q", package])

print("✅ Dependencies installed!")

# ============================================================================
# SNIPPET 2: IMPORTS & GPU CHECK (Run second)
# ============================================================================
import os
import gc
import time
import torch
import numpy as np
import pandas as pd
import geopandas as gpd
from PIL import Image
import requests
from io import BytesIO
import zipfile
from pathlib import Path
from typing import List, Dict, Tuple, Optional

# Hugging Face imports
from datasets import Dataset
from transformers import (
    Qwen2VLForConditionalGeneration, 
    Qwen2VLProcessor,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model
from trl import SFTConfig, SFTTrainer
from qwen_vl_utils import process_vision_info

# Check GPU
print(f"🚀 GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None'}")
print(f"💾 Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

if not torch.cuda.is_available():
    print("❌ No GPU detected! Please use A100 GPU runtime.")
else:
    print("✅ GPU ready for training!")

# ============================================================================
# SNIPPET 3: UPLOAD & EXTRACT DATASET (Run third)
# ============================================================================
print("📁 Upload your Urban+Vacant+Land+of+36+Major+Chinese+Cities.zip file:")

from google.colab import files
uploaded = files.upload()

# Extract dataset
for filename in uploaded.keys():
    if filename.endswith('.zip'):
        print(f"📦 Extracting {filename}...")
        with zipfile.ZipFile(filename, 'r') as zip_ref:
            zip_ref.extractall('/content/')
        print("✅ Dataset extracted!")
        break

# ENHANCED DATASET STRUCTURE DETECTION
print("🔍 Searching for dataset files...")

# Function to find the actual dataset path
def find_dataset_path():
    search_paths = [
        "/content/DT43/Vacant lands of 36 major Chinese cities",
        "/content/DT43", 
        "/content/Vacant lands of 36 major Chinese cities",
        "/content"
    ]
    
    for search_path in search_paths:
        path = Path(search_path)
        print(f"🔍 Checking: {path}")
        
        if path.exists():
            # Look for .shp files recursively
            shp_files = list(path.rglob("*.shp"))
            if shp_files:
                print(f"📁 Found {len(shp_files)} .shp files in {path}")
                
                # Show first few files to understand structure
                print("📋 Sample files:")
                for f in shp_files[:10]:
                    print(f"   {f.relative_to(path)}")
                
                # Find VL files specifically
                vl_files = [f for f in shp_files if '_VL.shp' in f.name]
                if vl_files:
                    print(f"✅ Found {len(vl_files)} VL files!")
                    # Extract city codes
                    city_codes = [f.stem.replace('_VL', '') for f in vl_files]
                    print(f"🏙️ Available cities: {sorted(city_codes)[:10]}...")  # Show first 10
                    return path  # Return the parent directory, not the subdirectory
                else:
                    print("⚠️ No _VL.shp files found in this directory")
            else:
                print("⚠️ No .shp files found")
                # List what's actually in the directory
                if path.is_dir():
                    contents = list(path.iterdir())[:10]
                    print(f"📂 Directory contents: {[c.name for c in contents]}")
        else:
            print("❌ Path doesn't exist")
    
    return None

# Find the actual dataset path
actual_data_path = find_dataset_path()

if actual_data_path:
    print(f"\n✅ Dataset found at: {actual_data_path}")
    data_path = actual_data_path
else:
    print("\n❌ Could not locate dataset! Please check the zip extraction.")
    data_path = Path("/content/DT43")  # Fallback

# ============================================================================
# SNIPPET 4: DEFINE DATASET PROCESSOR CLASS (Run fourth)
# ============================================================================
class VacantLandProcessor:
    def __init__(self, data_path: str):
        self.data_path = Path(data_path)
        # Updated city mapping based on actual dataset
        self.cities = {
            'BJ': 'Beijing', 'SH': 'Shanghai', 'GZ': 'Guangzhou', 'SZ': 'Shenzhen',
            'CD': 'Chengdu', 'CQ': 'Chongqing', 'TJ': 'Tianjin', 'WH': 'Wuhan',
            'NJ': 'Nanjing', 'HZ': 'Hangzhou', 'CC': 'Changchun', 'CS': 'Changsha',
            'DL': 'Dalian', 'FZ': 'Fuzhou', 'HF': 'Hefei', 'HK': 'Haikou',
            'HR': 'Harbin', 'JN': 'Jinan', 'KM': 'Kunming', 'LZ': 'Lanzhou',
            'NN': 'Nanning', 'NC': 'Nanchang', 'QD': 'Qingdao', 'SJZ': 'Shijiazhuang',
            'SY': 'Shenyang', 'TY': 'Taiyuan', 'TS': 'Tangshan', 'WZ': 'Wenzhou',
            'XA': 'Xian', 'XM': 'Xiamen', 'XN': 'Xining', 'YC': 'Yinchuan',
            'ZZ': 'Zhengzhou', 'ZB': 'Zibo', 'ZS': 'Zhongshan', 'ZH': 'Zhuhai'
        }
    
    def load_city_data(self, city_code: str):
        """Load vacant land shapefile for a city"""
        try:
            # Try both structures: city_code/city_code_VL.shp and city_code_VL.shp
            vacant_path1 = self.data_path / city_code / f"{city_code}_VL.shp"  # In subdirectory
            vacant_path2 = self.data_path / f"{city_code}_VL.shp"  # In main directory
            
            if vacant_path1.exists():
                vacant_path = vacant_path1
            elif vacant_path2.exists():
                vacant_path = vacant_path2
            else:
                print(f"⚠️ {city_code}_VL.shp not found in {city_code}/ or main directory")
                return None
                
            vacant_gdf = gpd.read_file(vacant_path)
            
            # Convert to WGS84 if needed
            if vacant_gdf.crs != 'EPSG:4326':
                vacant_gdf = vacant_gdf.to_crs('EPSG:4326')
                
            print(f"✅ {city_code}: {len(vacant_gdf)} vacant areas loaded")
            return vacant_gdf
            
        except Exception as e:
            print(f"❌ Error loading {city_code}: {e}")
            return None
    
    def sample_vacant_areas(self, city_code: str, n_samples: int = 8):
        """Sample vacant areas from a city"""
        vacant_gdf = self.load_city_data(city_code)
        if vacant_gdf is None or len(vacant_gdf) == 0:
            return []
        
        # Sample random areas
        n_samples = min(n_samples, len(vacant_gdf))
        sampled = vacant_gdf.sample(n=n_samples, random_state=42)
        
        samples = []
        for idx, row in sampled.iterrows():
            try:
                centroid = row.geometry.centroid
                
                # Create bounding box (~500m x 500m)
                buffer_size = 0.0045  # degrees (~500m)
                bbox = [
                    centroid.x - buffer_size,  # west
                    centroid.y - buffer_size,  # south
                    centroid.x + buffer_size,  # east
                    centroid.y + buffer_size   # north
                ]
                
                samples.append({
                    'city_code': city_code,
                    'city_name': self.cities[city_code],
                    'bbox': bbox,
                    'area_sqm': row.geometry.area * 111000 * 111000,  # rough conversion
                    'centroid_lat': centroid.y,
                    'centroid_lon': centroid.x
                })
                
            except Exception as e:
                print(f"⚠️ Error processing area in {city_code}: {e}")
                continue
        
        return samples

print("✅ VacantLandProcessor class defined!")

# ============================================================================
# SNIPPET 5: TEST DATASET LOADING (Run fifth - for debugging)
# ============================================================================
# Test the processor with the actual found path
if 'data_path' in locals():
    processor = VacantLandProcessor(str(data_path))
    print(f"🔧 Processor initialized with path: {data_path}")
else:
    print("❌ No valid data path found!")
    processor = None

# Only test if processor was created successfully
if processor:
    # Test Changchun first (CC - visible in the image)
    print("\n🧪 Testing dataset loading with Changchun (CC)...")
    cc_samples = processor.sample_vacant_areas('CC', n_samples=3)
    
    # Also test Beijing
    print("\n🧪 Testing Beijing (BJ)...")
    bj_samples = processor.sample_vacant_areas('BJ', n_samples=3)
else:
    print("❌ Cannot test - processor not initialized")
    cc_samples = []
    bj_samples = []

# Check Changchun results
if cc_samples:
    print(f"✅ Successfully loaded {len(cc_samples)} samples from Changchun")
    print("📋 Sample data:")
    for i, sample in enumerate(cc_samples):
        print(f"  {i+1}. {sample['city_name']}: {sample['area_sqm']:.0f} sqm")
        print(f"     Coordinates: {sample['centroid_lat']:.4f}, {sample['centroid_lon']:.4f}")
else:
    print("❌ No Changchun samples loaded.")

# Check Beijing results
if bj_samples:
    print(f"✅ Successfully loaded {len(bj_samples)} samples from Beijing")
    print("📋 Sample data:")
    for i, sample in enumerate(bj_samples):
        print(f"  {i+1}. {sample['city_name']}: {sample['area_sqm']:.0f} sqm")
        print(f"     Coordinates: {sample['centroid_lat']:.4f}, {sample['centroid_lon']:.4f}")
else:
    print("❌ No Beijing samples loaded.")

# Use whichever worked for testing
test_samples = cc_samples if cc_samples else bj_samples

# Test other cities (including some from the visible list)
if processor:
    print("\n🌍 Testing other cities...")
    test_cities = ['SH', 'GZ', 'SZ', 'CD', 'TJ']  # Mix of common cities
    for city in test_cities:
        samples = processor.sample_vacant_areas(city, n_samples=1)
        if samples:
            print(f"✅ {city}: OK ({len(samples)} samples)")
        else:
            print(f"❌ {city}: Failed")
else:
    print("⚠️ Skipping city tests - processor not available")

# ============================================================================
# SNIPPET 6: DEFINE SATELLITE FETCHER CLASS (Run sixth)
# ============================================================================
class SatelliteFetcher:
    def __init__(self):
        self.tile_url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    
    def deg2num(self, lat_deg: float, lon_deg: float, zoom: int):
        """Convert lat/lon to tile coordinates"""
        import math
        lat_rad = math.radians(lat_deg)
        n = 2.0 ** zoom
        xtile = int((lon_deg + 180.0) / 360.0 * n)
        ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
        return (xtile, ytile)
    
    def fetch_image(self, bbox: List[float], zoom: int = 17):
        """Fetch satellite image for bounding box"""
        try:
            west, south, east, north = bbox
            center_lat = (south + north) / 2
            center_lon = (west + east) / 2
            
            # Get tile coordinates
            x, y = self.deg2num(center_lat, center_lon, zoom)
            url = self.tile_url.format(x=x, y=y, z=zoom)
            
            # Fetch image
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                image = Image.open(BytesIO(response.content))
                return image.convert('RGB')
            else:
                print(f"⚠️ Failed to fetch image: HTTP {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Error fetching image: {e}")
            return None

print("✅ SatelliteFetcher class defined!")

# ============================================================================
# SNIPPET 7: TEST IMAGE FETCHING (Run seventh - for debugging)
# ============================================================================
# Test satellite image fetching
fetcher = SatelliteFetcher()

print("🧪 Testing satellite image fetching...")
if test_samples:
    test_bbox = test_samples[0]['bbox']
    print(f"📍 Testing with bbox: {test_bbox}")
    
    test_image = fetcher.fetch_image(test_bbox)
    if test_image:
        print(f"✅ Image fetched successfully! Size: {test_image.size}")
        # Save test image to verify
        test_image.save("/content/test_satellite_image.jpg")
        print("💾 Test image saved as test_satellite_image.jpg")
    else:
        print("❌ Failed to fetch test image")
else:
    print("⚠️ No samples available for testing")

# ============================================================================
# SNIPPET 8: CREATE TRAINING DATASET (Run eighth)
# ============================================================================
def create_training_dataset():
    """Create complete training dataset"""
    print("🏗️ Creating training dataset...")
    
    # Use the actual found data path
    if 'data_path' in globals():
        processor = VacantLandProcessor(str(data_path))
    else:
        print("❌ No valid data path available!")
        return []
    fetcher = SatelliteFetcher()
    
    # Create output directory
    output_path = Path("/content/training_data")
    images_dir = output_path / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    
    dataset_samples = []
    
    # Process cities (start with fewer for testing)
    # Use cities that we know exist in the dataset
    cities_to_process = ['CC', 'BJ', 'SH', 'GZ']  # Start with 4 cities, CC first since we saw it
    
    for city_code in cities_to_process:
        print(f"\n🏙️ Processing {city_code} ({processor.cities.get(city_code, city_code)})...")
        
        # Get vacant land samples
        vacant_samples = processor.sample_vacant_areas(city_code, n_samples=6)  # Reduced for testing
        
        if not vacant_samples:
            print(f"⚠️ No samples found for {city_code}")
            continue
        
        for i, sample in enumerate(vacant_samples):
            try:
                print(f"  📸 Fetching image {i+1}/{len(vacant_samples)}...")
                
                # Fetch satellite image
                image = fetcher.fetch_image(sample['bbox'])
                
                if image is None:
                    print(f"  ⚠️ Failed to fetch image for {city_code}_{i}")
                    continue
                
                # Save positive sample (vacant land)
                pos_filename = f"{city_code}_{i:02d}_vacant.jpg"
                pos_path = images_dir / pos_filename
                image.save(pos_path, quality=90)
                
                pos_sample = {
                    'image_path': str(pos_path),
                    'city': sample['city_name'],
                    'city_code': city_code,
                    'has_vacant_land': True,
                    'query': f"Analyze this satellite image of {sample['city_name']} and identify vacant spaces suitable for urban development.",
                    'answer': f"I can identify vacant land in this satellite image from {sample['city_name']}. The area shows undeveloped space of approximately {sample['area_sqm']:.0f} square meters that appears suitable for development. The vacant land is characterized by open space without existing buildings or dense infrastructure."
                }
                dataset_samples.append(pos_sample)
                
                # Create negative sample (developed area)
                bbox_shifted = [b + 0.008 for b in sample['bbox']]  # Shift ~900m
                neg_image = fetcher.fetch_image(bbox_shifted)
                
                if neg_image:
                    neg_filename = f"{city_code}_{i:02d}_developed.jpg"
                    neg_path = images_dir / neg_filename
                    neg_image.save(neg_path, quality=90)
                    
                    neg_sample = {
                        'image_path': str(neg_path),
                        'city': sample['city_name'],
                        'city_code': city_code,
                        'has_vacant_land': False,
                        'query': f"Analyze this satellite image of {sample['city_name']} and identify vacant spaces suitable for urban development.",
                        'answer': f"In this satellite image from {sample['city_name']}, I can see developed urban area with existing buildings and infrastructure. There are no significant vacant spaces visible that would be suitable for new development."
                    }
                    dataset_samples.append(neg_sample)
                
                print(f"  ✅ Processed sample {i+1}")
                    
            except Exception as e:
                print(f"  ❌ Error processing {city_code}_{i}: {e}")
                continue
        
        print(f"✅ Completed {city_code}: {len([s for s in dataset_samples if s['city_code'] == city_code])} samples")
    
    print(f"\n📊 Dataset created: {len(dataset_samples)} total samples")
    
    # Save metadata
    df = pd.DataFrame(dataset_samples)
    df.to_csv(output_path / "dataset_metadata.csv", index=False)
    print(f"💾 Metadata saved to: {output_path / 'dataset_metadata.csv'}")
    
    return dataset_samples

# Run the dataset creation
print("🚀 Starting dataset creation...")
dataset_samples = create_training_dataset()

print(f"\n📈 Dataset Summary:")
print(f"  • Total samples: {len(dataset_samples)}")
print(f"  • Vacant land samples: {len([s for s in dataset_samples if s['has_vacant_land']])}")
print(f"  • Developed area samples: {len([s for s in dataset_samples if not s['has_vacant_land']])}")

# Show sample breakdown by city
city_counts = {}
for sample in dataset_samples:
    city = sample['city_code']
    city_counts[city] = city_counts.get(city, 0) + 1

print(f"\n🏙️ Samples by city:")
for city, count in city_counts.items():
    print(f"  • {city}: {count} samples")

# ============================================================================
# SNIPPET 9: FORMAT DATA FOR TRAINING (Run ninth)
# ============================================================================
def format_training_data(dataset_samples):
    """Format data for Qwen-VL training"""
    print("🔄 Formatting data for training...")
    
    system_message = """You are an expert urban planner and satellite imagery analyst specializing in identifying vacant land suitable for development. 
    Your task is to analyze satellite images and identify vacant spaces, undeveloped lots, and areas suitable for urban development.
    Focus on:
    1. Empty lots and undeveloped land
    2. Large parking areas that could be redeveloped
    3. Abandoned or underutilized industrial sites
    4. Areas with good accessibility and infrastructure
    Provide detailed analysis of development potential and suitability."""
    
    formatted_data = []
    
    for i, sample in enumerate(dataset_samples):
        try:
            # Check if image exists
            if not Path(sample['image_path']).exists():
                print(f"⚠️ Image not found: {sample['image_path']}")
                continue
            
            # Load image
            image = Image.open(sample['image_path'])
            
            # Format for training
            formatted_sample = {
                "images": [image],
                "messages": [
                    {
                        "role": "system",
                        "content": [{"type": "text", "text": system_message}]
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "image", "image": image},
                            {"type": "text", "text": sample['query']}
                        ]
                    },
                    {
                        "role": "assistant",
                        "content": [{"type": "text", "text": sample['answer']}]
                    }
                ]
            }
            
            formatted_data.append(formatted_sample)
            
            if (i + 1) % 10 == 0:
                print(f"  ✅ Formatted {i + 1}/{len(dataset_samples)} samples")
            
        except Exception as e:
            print(f"❌ Error formatting sample {i}: {e}")
            continue
    
    print(f"✅ Formatted {len(formatted_data)} samples for training")
    return formatted_data

# Format the data
formatted_dataset = format_training_data(dataset_samples)

if len(formatted_dataset) < 10:
    print("❌ Insufficient formatted samples for training. Need at least 10.")
else:
    print(f"✅ Ready for training with {len(formatted_dataset)} samples!")

# ============================================================================
# SNIPPET 10: SETUP MODEL FOR TRAINING (Run tenth)
# ============================================================================
def setup_model_for_training(formatted_dataset):
    """Setup model and training configuration"""
    print("🎯 Setting up model for training...")
    
    # Clear memory first
    gc.collect()
    torch.cuda.empty_cache()
    
    model_id = "Qwen/Qwen2-VL-7B-Instruct"
    output_dir = "/content/qwen2-vl-vacant-land"
    
    # Split dataset
    train_size = int(0.8 * len(formatted_dataset))
    train_dataset = formatted_dataset[:train_size]
    eval_dataset = formatted_dataset[train_size:]
    
    print(f"📚 Training samples: {len(train_dataset)}")
    print(f"📚 Evaluation samples: {len(eval_dataset)}")
    
    if len(train_dataset) < 8:
        print("❌ Not enough training samples! Need at least 8.")
        return None
    
    # Quantization config
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16
    )
    
    print("📥 Loading base model... (This may take a few minutes)")
    # Load model and processor
    model = Qwen2VLForConditionalGeneration.from_pretrained(
        model_id,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        quantization_config=bnb_config
    )
    processor = Qwen2VLProcessor.from_pretrained(model_id)
    print("✅ Base model loaded!")
    
    # LoRA configuration
    peft_config = LoraConfig(
        lora_alpha=16,
        lora_dropout=0.05,
        r=8,
        bias="none",
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
        task_type="CAUSAL_LM",
    )
    
    # Apply PEFT
    peft_model = get_peft_model(model, peft_config)
    print("🔧 LoRA adapters applied!")
    peft_model.print_trainable_parameters()
    
    # Training configuration
    training_args = SFTConfig(
        output_dir=output_dir,
        num_train_epochs=2,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=8,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        optim="adamw_torch_fused",
        learning_rate=5e-5,
        logging_steps=5,
        eval_steps=20,
        eval_strategy="steps",
        save_strategy="steps",
        save_steps=50,
        bf16=True,
        max_grad_norm=0.3,
        warmup_ratio=0.03,
        push_to_hub=False,
        report_to=None,
    )
    
    # Initialize trainer
    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        peft_config=peft_config,
        processing_class=processor,
    )
    
    print("✅ Trainer initialized and ready!")
    return trainer, eval_dataset

# Setup the model
trainer_result = setup_model_for_training(formatted_dataset)

if trainer_result:
    trainer, eval_dataset = trainer_result
    print("🚀 Ready to start training!")
    print("💡 Run the next snippet to start training...")
else:
    print("❌ Model setup failed!")

# ============================================================================
# SNIPPET 11: START TRAINING (Run eleventh - This takes 2-4 hours!)
# ============================================================================
if 'trainer' in locals():
    print("🚀 Starting training... This will take 2-4 hours!")
    print("📊 Monitor the progress below:")
    print("=" * 60)
    
    # Start training
    trainer.train()
    
    # Save model
    trainer.save_model("/content/qwen2-vl-vacant-land")
    print("💾 Model saved!")
    print("✅ Training completed!")
else:
    print("❌ Trainer not found. Run previous snippets first.")

# ============================================================================
# SNIPPET 12: TEST THE FINE-TUNED MODEL (Run twelfth - after training)
# ============================================================================
def test_finetuned_model():
    """Test the fine-tuned model"""
    print("🧪 Testing fine-tuned model...")
    
    # Clear memory
    gc.collect()
    torch.cuda.empty_cache()
    
    model_id = "Qwen/Qwen2-VL-7B-Instruct"
    model_path = "/content/qwen2-vl-vacant-land"
    
    # Load base model
    model = Qwen2VLForConditionalGeneration.from_pretrained(
        model_id,
        device_map="auto",
        torch_dtype=torch.bfloat16,
    )
    processor = Qwen2VLProcessor.from_pretrained(model_id)
    
    # Load fine-tuned adapter
    model.load_adapter(model_path)
    print("✅ Fine-tuned model loaded!")
    
    def generate_response(sample):
        try:
            # Prepare input
            text_input = processor.apply_chat_template(
                sample['messages'][1:2],  # Skip system message
                tokenize=False,
                add_generation_prompt=True
            )
            
            image_inputs, _ = process_vision_info(sample['messages'])
            
            model_inputs = processor(
                text=[text_input],
                images=image_inputs,
                return_tensors="pt",
            ).to("cuda")
            
            # Generate
            generated_ids = model.generate(**model_inputs, max_new_tokens=256)
            
            # Decode
            trimmed_ids = [
                out_ids[len(in_ids):] for in_ids, out_ids in zip(model_inputs.input_ids, generated_ids)
            ]
            
            output_text = processor.batch_decode(
                trimmed_ids,
                skip_special_tokens=True,
                clean_up_tokenization_spaces=False
            )
            
            return output_text[0]
            
        except Exception as e:
            return f"Error: {e}"
    
    # Test with a few samples
    if 'eval_dataset' in locals() and len(eval_dataset) > 0:
        test_samples = eval_dataset[:3]  # Test first 3 samples
        
        print("\n" + "="*80)
        print("🎯 FINE-TUNED MODEL TEST RESULTS")
        print("="*80)
        
        for i, sample in enumerate(test_samples):
            print(f"\n📋 Test {i+1}:")
            print(f"Query: {sample['messages'][1]['content'][1]['text'][:100]}...")
            print(f"\nExpected: {sample['messages'][2]['content'][0]['text'][:150]}...")
            
            generated = generate_response(sample)
            print(f"\nGenerated: {generated}")
            print("-" * 80)
        
        print("✅ Testing completed!")
    else:
        print("❌ No evaluation samples available for testing")

# Run the test (only if training is complete)
if os.path.exists("/content/qwen2-vl-vacant-land"):
    test_finetuned_model()
else:
    print("⚠️ Model not found. Complete training first.")

# ============================================================================
# SNIPPET 13: DOWNLOAD RESULTS (Run last)
# ============================================================================
def download_results():
    """Package and download the fine-tuned model"""
    print("📦 Preparing model for download...")
    
    import shutil
    from google.colab import files
    
    model_dir = "/content/qwen2-vl-vacant-land"
    
    if os.path.exists(model_dir):
        # Create zip file
        print("🗜️ Creating zip file...")
        shutil.make_archive("qwen2-vl-vacant-land", 'zip', model_dir)
        
        # Download
        print("📥 Starting download...")
        files.download("qwen2-vl-vacant-land.zip")
        print("✅ Model downloaded! (~2-3GB)")
        
        # Also download training data
        if os.path.exists("/content/training_data"):
            print("📦 Packaging training data...")
            shutil.make_archive("training_data", 'zip', "/content/training_data")
            files.download("training_data.zip")
            print("✅ Training data downloaded!")
        
        print("\n🎉 All files downloaded successfully!")
        print("📁 You now have:")
        print("   • qwen2-vl-vacant-land.zip (fine-tuned model)")
        print("   • training_data.zip (dataset and images)")
        
    else:
        print("❌ Model directory not found! Complete training first.")

# Download everything
download_results()

print("\n🎉 FINE-TUNING PIPELINE COMPLETED!")
print("🚀 Your custom Qwen-VL model is ready for PlotPal AI!")
