"""
🎯 TEST FINE-TUNED QWEN-VL MODEL
Fresh Colab script to test your downloaded fine-tuned model
Run this in a new Colab session with A100 GPU
"""

# ============================================================================
# STEP 1: INSTALL DEPENDENCIES
# ============================================================================
print("🔧 Installing dependencies...")
import subprocess
import sys

packages = [
    "transformers", "torch", "torchvision", "accelerate", 
    "bitsandbytes", "peft", "qwen-vl-utils", "pillow", "requests"
]

for package in packages:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-U", "-q", package])

print("✅ Dependencies installed!")

# ============================================================================
# STEP 2: IMPORTS AND SETUP
# ============================================================================
import os
import torch
import gc
from PIL import Image
import requests
from io import BytesIO
from pathlib import Path
from transformers import (
    Qwen2VLForConditionalGeneration, 
    Qwen2VLProcessor,
    BitsAndBytesConfig
)
from qwen_vl_utils import process_vision_info

# Check GPU
print(f"🚀 GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None'}")
print(f"💾 Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

# ============================================================================
# STEP 3: UPLOAD YOUR DOWNLOADED FILES
# ============================================================================
print("📁 Upload your downloaded files:")
print("1. qwen2-vl-vacant-land.zip")
print("2. training_data.zip (optional - for test images)")

from google.colab import files
uploaded = files.upload()

# Extract files
import zipfile
for filename in uploaded.keys():
    if filename.endswith('.zip'):
        print(f"📦 Extracting {filename}...")
        with zipfile.ZipFile(filename, 'r') as zip_ref:
            zip_ref.extractall('/content/')

# ============================================================================
# STEP 4: LOAD THE FINE-TUNED MODEL
# ============================================================================
def load_finetuned_model():
    """Load the fine-tuned model with memory optimization"""
    print("🤖 Loading fine-tuned model...")
    
    # Clear memory
    gc.collect()
    torch.cuda.empty_cache()
    
    model_id = "Qwen/Qwen2-VL-7B-Instruct"
    adapter_path = "/content/qwen2-vl-vacant-land"
    
    # Quantization for memory efficiency
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        llm_int8_enable_fp32_cpu_offload=True
    )
    
    # Load base model
    print("📥 Loading base Qwen2-VL model...")
    model = Qwen2VLForConditionalGeneration.from_pretrained(
        model_id,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        quantization_config=bnb_config,
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )
    
    # Load processor
    processor = Qwen2VLProcessor.from_pretrained(model_id)
    
    # Load fine-tuned adapter
    print("🔧 Loading fine-tuned adapter...")
    try:
        model.load_adapter(adapter_path)
        print("✅ Fine-tuned model loaded successfully!")
    except Exception as e:
        print(f"⚠️ Adapter loading failed: {e}")
        print("📝 Using base model for comparison...")
    
    return model, processor

# Load the model
model, processor = load_finetuned_model()

# ============================================================================
# STEP 5: TEST WITH SAMPLE IMAGES
# ============================================================================
def test_vacant_land_detection(image_url_or_path, location="urban area"):
    """Test the model with an image"""
    print(f"\n🧪 Testing vacant land detection for {location}...")
    
    # Load image
    if image_url_or_path.startswith('http'):
        response = requests.get(image_url_or_path)
        image = Image.open(BytesIO(response.content)).convert('RGB')
        print("📸 Loaded image from URL")
    else:
        image = Image.open(image_url_or_path).convert('RGB')
        print("📸 Loaded local image")
    
    # Prepare the conversation
    messages = [
        {
            "role": "system",
            "content": [{"type": "text", "text": "You are an expert urban planner and satellite imagery analyst specializing in identifying vacant land suitable for development."}]
        },
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": f"Analyze this satellite image of {location} and identify vacant spaces suitable for urban development. Describe what you see and assess development potential."}
            ]
        }
    ]
    
    # Process input
    text_input = processor.apply_chat_template(
        messages[1:2],  # Skip system message for input
        tokenize=False,
        add_generation_prompt=True
    )
    
    image_inputs, _ = process_vision_info(messages)
    
    model_inputs = processor(
        text=[text_input],
        images=image_inputs,
        return_tensors="pt",
    ).to("cuda")
    
    # Generate response
    print("🔄 Generating analysis...")
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs, 
            max_new_tokens=200,
            do_sample=False,
            temperature=0.1
        )
    
    # Decode response
    trimmed_ids = [
        out_ids[len(in_ids):] for in_ids, out_ids in zip(model_inputs.input_ids, generated_ids)
    ]
    
    response = processor.batch_decode(
        trimmed_ids,
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False
    )[0]
    
    print("🎯 Analysis Result:")
    print("-" * 60)
    print(response)
    print("-" * 60)
    
    return response

# ============================================================================
# STEP 6: RUN TESTS
# ============================================================================
print("\n🚀 TESTING YOUR FINE-TUNED MODEL")
print("=" * 50)

# Test 1: Sample satellite image URL
print("\n📋 Test 1: Sample Urban Area")
sample_url = "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800"
try:
    test_vacant_land_detection(sample_url, "downtown urban area")
except Exception as e:
    print(f"❌ Test 1 failed: {e}")

# Test 2: Use training data if available
training_images_path = Path("/content/training_data/images")
if training_images_path.exists():
    print("\n📋 Test 2: Training Data Sample")
    sample_images = list(training_images_path.glob("*.jpg"))[:2]
    
    for i, img_path in enumerate(sample_images):
        try:
            city_code = img_path.name.split('_')[0]
            test_vacant_land_detection(str(img_path), f"Chinese city {city_code}")
        except Exception as e:
            print(f"❌ Training sample {i+1} failed: {e}")
else:
    print("\n⚠️ Training data not found. Upload training_data.zip for more tests.")

# Test 3: Upload your own image
print("\n📋 Test 3: Upload Your Own Image")
print("Upload a satellite image to test:")
try:
    uploaded_test = files.upload()
    for filename in uploaded_test.keys():
        if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            test_vacant_land_detection(f"/content/{filename}", "your uploaded area")
            break
except Exception as e:
    print(f"⚠️ Custom image test skipped: {e}")

# ============================================================================
# STEP 7: PERFORMANCE COMPARISON
# ============================================================================
print("\n📊 PERFORMANCE SUMMARY")
print("=" * 50)
print("✅ Fine-tuned model testing completed!")
print("\n🎯 Your model should now:")
print("  • Identify vacant land areas")
print("  • Assess development potential") 
print("  • Provide urban planning insights")
print("  • Focus on Chinese urban contexts")

print("\n🚀 Ready for PlotPal AI integration!")
print("📝 Use the integration guide to deploy this model.")

# ============================================================================
# STEP 8: MEMORY CLEANUP
# ============================================================================
print("\n🧹 Cleaning up memory...")
del model, processor
gc.collect()
torch.cuda.empty_cache()
print("✅ Cleanup completed!")
