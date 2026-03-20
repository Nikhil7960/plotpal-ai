# Fine-Tuning Small Vision Language Models (1-4B) - Comprehensive Research

## Table of Contents
1. [Framework Comparison](#1-framework-comparison)
2. [Unsloth VLM Fine-Tuning](#2-unsloth-vlm-fine-tuning)
3. [HuggingFace TRL SFTTrainer](#3-huggingface-trl-sfttrainer)
4. [LLaMA-Factory](#4-llama-factory)
5. [MS-Swift (ModelScope)](#5-ms-swift-modelscope)
6. [PaliGemma Fine-Tuning](#6-paligemma-fine-tuning)
7. [Dataset Formats & Conversion](#7-dataset-formats--conversion)
8. [Model Selection Guide](#8-model-selection-guide)
9. [LoRA/QLoRA Configuration](#9-loraqora-configuration)
10. [Memory Optimization](#10-memory-optimization)
11. [Satellite/Remote Sensing Domain Adaptation](#11-satelliteremote-sensing-domain-adaptation)
12. [Image Preprocessing & Tiling](#12-image-preprocessing--tiling)
13. [Evaluation Strategies](#13-evaluation-strategies)
14. [Working Colab Notebooks](#14-working-colab-notebooks)
15. [Complete Training Recipes](#15-complete-training-recipes)

---

## 1. Framework Comparison

| Framework | VLM Support | Ease of Use | GPU Efficiency | Custom Data | Best For |
|-----------|------------|-------------|----------------|-------------|----------|
| **Unsloth** | Excellent (Qwen2.5-VL, Gemma 3, Llama 3.2 Vision, Pixtral) | Very Easy | Best (2x faster, 60% less VRAM) | Easy conversion | Quick Colab experiments |
| **HF TRL** | Good (any HF VLM) | Moderate | Good | Flexible | Production pipelines |
| **LLaMA-Factory** | Good (ShareGPT format) | Easy (WebUI) | Good | ShareGPT JSON | No-code fine-tuning |
| **MS-Swift** | Excellent (300+ MLLMs) | Moderate | Good (DeepSpeed) | Multiple formats | Large-scale training |
| **PaliGemma native** | PaliGemma only | Moderate | Good | JSONL prefix/suffix | Task-specific (detect, segment, caption) |

---

## 2. Unsloth VLM Fine-Tuning

### Supported Models
- Qwen2.5-VL (7B) - Handwriting to LaTeX
- Qwen3-VL (2B, 4B, 8B, 32B)
- Gemma 3 (4B) - Vision
- Llama 3.2 Vision (11B) - Radiography
- Pixtral (12B) - General Q&A
- QvQ (72B)

### Complete Working Code (Gemma 3 4B Vision)

```python
# Installation (Google Colab)
%%capture
import os, re
if "COLAB_" not in "".join(os.environ.keys()):
    !pip install unsloth
else:
    import torch; v = re.match(r'[\d]{1,}\.[\d]{1,}', str(torch.__version__)).group(0)
    xformers = 'xformers==' + {'2.10':'0.0.34','2.9':'0.0.33.post1','2.8':'0.0.32.post2'}.get(v, "0.0.34")
    !pip install sentencepiece protobuf "datasets==4.3.0" "huggingface_hub>=0.34.0" hf_transfer
    !pip install --no-deps unsloth_zoo bitsandbytes accelerate {xformers} peft trl triton unsloth
!pip install transformers==4.56.2
!pip install --no-deps trl==0.22.2

# Model Loading
from unsloth import FastVisionModel
import torch

model, processor = FastVisionModel.from_pretrained(
    "unsloth/gemma-3-4b-pt",          # 4-bit quantized
    load_in_4bit=True,
    use_gradient_checkpointing="unsloth",
)

# LoRA Configuration
model = FastVisionModel.get_peft_model(
    model,
    finetune_vision_layers     = True,   # Fine-tune vision encoder
    finetune_language_layers   = True,   # Fine-tune language model
    finetune_attention_modules = True,   # Fine-tune attention
    finetune_mlp_modules       = True,   # Fine-tune MLP layers
    r = 16,                              # LoRA rank
    lora_alpha = 16,                     # LoRA alpha (usually = r)
    lora_dropout = 0,
    bias = "none",
    random_state = 3407,
    use_rslora = False,
    loftq_config = None,
    target_modules = "all-linear",       # Target all linear layers
)

# Dataset Format & Conversion
from datasets import load_dataset
dataset = load_dataset("unsloth/LaTeX_OCR", split="train")

instruction = "Write the LaTeX representation for this image."

def convert_to_conversation(sample):
    conversation = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": instruction},
                {"type": "image", "image": sample["image"]},
            ],
        },
        {
            "role": "assistant",
            "content": [{"type": "text", "text": sample["text"]}],
        },
    ]
    return {"messages": conversation}

converted_dataset = [convert_to_conversation(sample) for sample in dataset]

# Chat Template
from unsloth import get_chat_template
processor = get_chat_template(processor, "gemma-3")

# Training
from unsloth.trainer import UnslothVisionDataCollator
from trl import SFTTrainer, SFTConfig

FastVisionModel.for_training(model)

trainer = SFTTrainer(
    model=model,
    train_dataset=converted_dataset,
    processing_class=processor.tokenizer,
    data_collator=UnslothVisionDataCollator(model, processor),
    args=SFTConfig(
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        max_grad_norm=0.3,
        warmup_ratio=0.03,
        max_steps=30,                    # Increase for real training
        learning_rate=2e-4,
        logging_steps=1,
        save_strategy="steps",
        optim="adamw_torch_fused",
        weight_decay=0.001,
        lr_scheduler_type="cosine",
        seed=3407,
        output_dir="outputs",
        report_to="none",
        remove_unused_columns=False,
        dataset_text_field="",
        dataset_kwargs={"skip_prepare_dataset": True},
        max_length=2048,
    ),
)

trainer_stats = trainer.train()

# Inference
FastVisionModel.for_inference(model)
image = dataset[10]["image"]
messages = [
    {"role": "user", "content": [
        {"type": "image"},
        {"type": "text", "text": instruction}
    ]}
]
input_text = processor.apply_chat_template(messages, add_generation_prompt=True)
inputs = processor(image, input_text, add_special_tokens=False, return_tensors="pt").to("cuda")

from transformers import TextStreamer
text_streamer = TextStreamer(processor, skip_prompt=True)
_ = model.generate(**inputs, streamer=text_streamer, max_new_tokens=128,
                    use_cache=True, temperature=1.0, top_p=0.95, top_k=64)

# Save
model.save_pretrained("gemma_3_lora")
processor.save_pretrained("gemma_3_lora")
```

### Unsloth Data Collator Parameters
```python
UnslothVisionDataCollator(
    model, processor,
    max_seq_length=None,
    formatting_func=None,
    resize="min",              # "min", "max", or (width, height)
    ignore_index=-100,
    train_on_responses_only=False,
    instruction_part=None,     # For response-only training
    response_part=None,
    completion_only_loss=True,  # Ignores padding vision tokens
)
```

### Response-Only Training (Important for efficiency)
```python
UnslothVisionDataCollator(
    model, tokenizer,
    train_on_responses_only=True,
    instruction_part="<|start_header_id|>user<|end_header_id|>\n\n",
    response_part="<|start_header_id|>assistant<|end_header_id|>\n\n",
)
```

---

## 3. HuggingFace TRL SFTTrainer

### Complete Code (Qwen2-VL-7B with QLoRA)

```python
# Installation
!pip install -U -q trl bitsandbytes peft hf_xet tensorboard qwen-vl-utils

import torch
from transformers import AutoModelForVision2Seq, AutoProcessor, BitsAndBytesConfig
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig
from datasets import load_dataset
from qwen_vl_utils import process_vision_info

# QLoRA Config
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
)

# Load Model
model_id = "Qwen/Qwen2-VL-7B-Instruct"
model = AutoModelForVision2Seq.from_pretrained(
    model_id,
    device_map="auto",
    torch_dtype=torch.bfloat16,
    quantization_config=bnb_config,
)
processor = AutoProcessor.from_pretrained(model_id)

# LoRA Config
peft_config = LoraConfig(
    lora_alpha=16,
    lora_dropout=0.05,
    r=8,
    bias="none",
    target_modules=["q_proj", "v_proj"],
    task_type="CAUSAL_LM",
)

# Dataset Format
system_message = "You are an expert image analyst."

def format_data(sample):
    return {"messages": [
        {"role": "system", "content": [{"type": "text", "text": system_message}]},
        {"role": "user", "content": [
            {"type": "image", "image": sample["image"]},
            {"type": "text", "text": sample["question"]},
        ]},
        {"role": "assistant", "content": [{"type": "text", "text": sample["answer"]}]},
    ]}

dataset = [format_data(s) for s in load_dataset("your_dataset", split="train")]

# Collate Function (Critical for VLMs)
def collate_fn(examples):
    texts = [processor.apply_chat_template(ex["messages"], tokenize=False)
             for ex in examples]
    image_inputs = [process_vision_info(ex["messages"])[0] for ex in examples]
    batch = processor(text=texts, images=image_inputs, return_tensors="pt", padding=True)

    labels = batch["input_ids"].clone()
    labels[labels == processor.tokenizer.pad_token_id] = -100
    # Mask image tokens (Qwen2-VL specific)
    image_tokens = [151652, 151653, 151655]
    for token_id in image_tokens:
        labels[labels == token_id] = -100
    batch["labels"] = labels
    return batch

# Training Config
args = SFTConfig(
    output_dir="vlm-finetuned",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,
    gradient_checkpointing=True,
    optim="adamw_torch_fused",
    learning_rate=2e-4,
    bf16=True,
    tf32=True,
    max_grad_norm=0.3,
    warmup_ratio=0.03,
    lr_scheduler_type="constant",
    logging_steps=5,
    save_strategy="epoch",
    report_to="tensorboard",
    gradient_checkpointing_kwargs={"use_reentrant": False},
    dataset_text_field="",
    dataset_kwargs={"skip_prepare_dataset": True},
    remove_unused_columns=False,
)

# Train
trainer = SFTTrainer(
    model=model,
    args=args,
    train_dataset=dataset,
    data_collator=collate_fn,
    peft_config=peft_config,
    tokenizer=processor.tokenizer,
)
trainer.train()
trainer.save_model()
```

### Gemma 3 4B with TRL (Alternative)

```python
from transformers import AutoModelForImageTextToText, BitsAndBytesConfig

model_id = "google/gemma-3-4b-it"
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_storage=torch.bfloat16,
)

model = AutoModelForImageTextToText.from_pretrained(
    model_id,
    device_map="auto",
    torch_dtype=torch.bfloat16,
    attn_implementation="eager",     # Required for Gemma 3
    quantization_config=bnb_config,
)
processor = AutoProcessor.from_pretrained(model_id)
processor.tokenizer.padding_side = "right"

peft_config = LoraConfig(
    lora_alpha=16,
    lora_dropout=0.05,
    r=16,
    bias="none",
    target_modules="all-linear",
    task_type="CAUSAL_LM",
    modules_to_save=["lm_head", "embed_tokens"],
)
```

---

## 4. LLaMA-Factory

### Dataset Format (ShareGPT with images)

**data.json:**
```json
[
  {
    "conversations": [
      {
        "from": "human",
        "value": "<image>Describe what you see in this satellite image."
      },
      {
        "from": "gpt",
        "value": "This satellite image shows a residential area with dense housing..."
      }
    ],
    "images": [
      "/path/to/satellite_001.jpg"
    ]
  }
]
```

**dataset_info.json:**
```json
{
  "my_satellite_dataset": {
    "file_name": "data.json",
    "formatting": "sharegpt",
    "columns": {
      "messages": "conversations",
      "images": "images"
    }
  }
}
```

### Alpaca Format (Alternative)
```json
[
  {
    "instruction": "<image>What type of land use is shown?",
    "input": "",
    "output": "The image shows agricultural farmland with...",
    "images": ["/path/to/image.jpg"]
  }
]
```

**dataset_info.json for Alpaca:**
```json
{
  "my_dataset": {
    "file_name": "data.json",
    "columns": {
      "prompt": "instruction",
      "query": "input",
      "response": "output",
      "images": "images"
    }
  }
}
```

**Key Rule:** The number of `<image>` tags in text MUST match the number of image paths.

### Training Command
```bash
llamafactory-cli train \
  --model_name_or_path Qwen/Qwen2.5-VL-7B-Instruct \
  --dataset my_satellite_dataset \
  --finetuning_type lora \
  --lora_rank 16 \
  --lora_alpha 32 \
  --per_device_train_batch_size 1 \
  --gradient_accumulation_steps 8 \
  --learning_rate 2e-4 \
  --num_train_epochs 3 \
  --output_dir ./output
```

---

## 5. MS-Swift (ModelScope)

### Dataset Format (JSONL)

Each line in a `.jsonl` file:
```json
{"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "<image>Describe the image."}, {"role": "assistant", "content": "The image shows..."}], "images": ["/path/to/image.jpg"]}
```

### Supported Input Formats (Auto-converted)

**Messages format (standard):**
```json
{"messages": [{"role": "user", "content": "<image>What is this?"}, {"role": "assistant", "content": "A cat."}], "images": ["/path/img.jpg"]}
```

**ShareGPT format:**
```json
{"system": "You are helpful.", "conversation": [{"human": "<image>Describe.", "assistant": "It shows..."}], "images": ["/path/img.jpg"]}
```

**Query-Response format:**
```json
{"query": "<image>What is this?", "response": "A satellite image of farmland.", "images": ["/path/img.jpg"]}
```

### Grounding/Detection Format
```json
{
  "messages": [
    {"role": "user", "content": "<image>Detect objects."},
    {"role": "assistant", "content": "<ref-object><bbox> and <ref-object><bbox>"}
  ],
  "images": ["/image.jpg"],
  "objects": {
    "ref": ["building", "road"],
    "bbox": [[100, 200, 300, 400], [50, 100, 150, 250]],
    "bbox_type": "real",
    "image_id": [0, 0]
  }
}
```

### Training Command
```bash
CUDA_VISIBLE_DEVICES=0 \
NPROC_PER_NODE=1 \
MAX_PIXELS=1003520 \
swift sft \
  --model Qwen/Qwen2.5-VL-7B-Instruct \
  --tuner_type lora \
  --dataset /path/to/data.jsonl \
  --deepspeed zero2 \
  --max_length 16384
```

### Important Notes for Qwen2.5-VL
- Uses **absolute coordinates** for bounding boxes
- Images must have height and width as **multiples of 28**
- Scale coordinates accordingly after resizing

---

## 6. PaliGemma Fine-Tuning

### Dataset Format (JSONL - Unique to PaliGemma)

```json
{"image": "img_001.jpg", "prefix": "caption en", "suffix": "a satellite view of farmland with irrigation channels"}
{"image": "img_002.jpg", "prefix": "detect building ; road", "suffix": "<loc0234><loc0156><loc0567><loc0389> building ; <loc0100><loc0200><loc0300><loc0400> road"}
{"image": "img_003.jpg", "prefix": "segment building", "suffix": "<loc0234><loc0156><loc0567><loc0389><seg001><seg023>...<seg128> building"}
```

### Task Prefixes
- **Captioning:** `"caption en"` or `"caption"`
- **Detection:** `"detect class1 ; class2"`
- **Segmentation:** `"segment class1 ; class2"`
- **VQA:** `"answer en What type of land use is shown?"`

### Complete Training Code

```python
import torch
from peft import get_peft_model, LoraConfig
from transformers import PaliGemmaProcessor, PaliGemmaForConditionalGeneration, BitsAndBytesConfig, Trainer, TrainingArguments

MODEL_ID = "google/paligemma2-3b-pt-224"

processor = PaliGemmaProcessor.from_pretrained(MODEL_ID)

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_type=torch.bfloat16,
)

model = PaliGemmaForConditionalGeneration.from_pretrained(
    MODEL_ID, device_map="auto",
    quantization_config=bnb_config,
    torch_dtype=torch.bfloat16,
)

lora_config = LoraConfig(
    r=8,
    target_modules=["q_proj", "o_proj", "k_proj", "v_proj",
                    "gate_proj", "up_proj", "down_proj"],
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, lora_config)

# Dataset
import json, os
from PIL import Image
from torch.utils.data import Dataset

class JSONLDataset(Dataset):
    def __init__(self, jsonl_path, image_dir):
        self.image_dir = image_dir
        with open(jsonl_path) as f:
            self.entries = [json.loads(line) for line in f]

    def __len__(self):
        return len(self.entries)

    def __getitem__(self, idx):
        entry = self.entries[idx]
        image = Image.open(os.path.join(self.image_dir, entry['image'])).convert("RGB")
        return image, entry

def collate_fn(batch):
    images, labels = zip(*batch)
    prefixes = ["<image>" + label["prefix"] for label in labels]
    suffixes = [label["suffix"] for label in labels]
    inputs = processor(text=prefixes, images=images, return_tensors="pt",
                      suffix=suffixes, padding="longest").to(model.dtype).to(model.device)
    return inputs

args = TrainingArguments(
    num_train_epochs=3,
    per_device_train_batch_size=3,
    gradient_accumulation_steps=16,
    warmup_steps=2,
    learning_rate=5e-5,
    weight_decay=1e-6,
    adam_beta2=0.999,
    logging_steps=200,
    optim="paged_adamw_8bit",
    save_strategy="steps",
    save_steps=1000,
    output_dir="paligemma_finetuned",
    bf16=True,
    remove_unused_columns=False,
    dataloader_pin_memory=False,
)

trainer = Trainer(model=model, train_dataset=train_dataset,
                 data_collator=collate_fn, args=args)
trainer.train()
```

---

## 7. Dataset Formats & Conversion

### Universal Conversation Format (Works with Unsloth, TRL, MS-Swift)

```python
{
    "messages": [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Describe this satellite image."},
                {"type": "image", "image": <PIL.Image or path>}
            ]
        },
        {
            "role": "assistant",
            "content": [
                {"type": "text", "text": "This image shows agricultural land with..."}
            ]
        }
    ]
}
```

### Converting Classification Dataset to Instruction Format

```python
def convert_classification_to_vlm(image, label, label_names):
    """Convert image classification dataset to VLM instruction format."""
    templates = [
        f"What type of scene is shown in this satellite image? Answer: {label_names[label]}",
        f"Classify this aerial image. This is a {label_names[label]} area.",
        f"Identify the land use type. The image shows {label_names[label]}.",
    ]
    import random
    answer = random.choice(templates)

    return {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": "What type of scene or land use is shown in this satellite image?"}
                ]
            },
            {
                "role": "assistant",
                "content": [{"type": "text", "text": answer}]
            }
        ]
    }
```

### Converting VQA Dataset to Instruction Format

```python
def convert_vqa_to_vlm(image, question, answer):
    """Convert VQA dataset to VLM instruction format."""
    return {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": question}
                ]
            },
            {
                "role": "assistant",
                "content": [{"type": "text", "text": answer}]
            }
        ]
    }
```

### Converting Detection Dataset to Instruction Format

```python
def convert_detection_to_vlm(image, boxes, labels, label_names):
    """Convert object detection annotations to VLM instruction format."""
    descriptions = []
    for box, label in zip(boxes, labels):
        x1, y1, x2, y2 = box
        descriptions.append(f"{label_names[label]} at [{x1:.0f}, {y1:.0f}, {x2:.0f}, {y2:.0f}]")

    answer = "Objects detected:\n" + "\n".join(f"- {d}" for d in descriptions)

    return {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": "Detect and locate all objects in this image. Provide bounding box coordinates."}
                ]
            },
            {
                "role": "assistant",
                "content": [{"type": "text", "text": answer}]
            }
        ]
    }
```

### Converting Segmentation to Instruction Format

```python
def convert_segmentation_to_vlm(image, mask, class_names):
    """Convert segmentation mask to VLM description format."""
    import numpy as np
    unique_classes = np.unique(mask)
    class_areas = {}
    total_pixels = mask.size
    for cls_id in unique_classes:
        if cls_id == 0:  # skip background
            continue
        area_pct = (mask == cls_id).sum() / total_pixels * 100
        class_areas[class_names[cls_id]] = area_pct

    desc_parts = [f"{name}: {pct:.1f}% of image" for name, pct in
                  sorted(class_areas.items(), key=lambda x: -x[1])]
    answer = "Land cover analysis:\n" + "\n".join(f"- {d}" for d in desc_parts)

    return {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": "Analyze the land cover in this satellite image. What percentage of the image is covered by each type?"}
                ]
            },
            {
                "role": "assistant",
                "content": [{"type": "text", "text": answer}]
            }
        ]
    }
```

---

## 8. Model Selection Guide

### Small VLMs Ranked for Fine-Tuning (1-4B)

| Model | Size | VRAM (4-bit) | Resolution | Strengths | Best For |
|-------|------|-------------|------------|-----------|----------|
| **Qwen2.5-VL-3B** | 3B | ~4 GB | Dynamic | Strong OCR, document parsing | Structured extraction |
| **Gemma 3 4B** | 4B | ~3.4 GB | Up to 512px | Multilingual, clean arch | General vision tasks |
| **PaliGemma 2 3B** | 3B | ~4 GB | 224/448/896px | Best for specific tasks | Detection, segmentation, OCR |
| **Qwen3-VL-4B** | 4B | ~4.5 GB | Dynamic | Latest, 256K context | Advanced reasoning |
| **Qwen2-VL-2B** | 2B | ~2.5 GB | Dynamic | Smallest, fast | Lightweight deployment |

### Recommendations by Use Case

- **Satellite classification:** Gemma 3 4B or Qwen2.5-VL-3B (good accuracy-to-size ratio)
- **Object detection in imagery:** PaliGemma 2 3B (native detection prefix format)
- **Image captioning/description:** Qwen2.5-VL-3B or Gemma 3 4B
- **OCR/text extraction:** Qwen2.5-VL-3B (optimized for document tasks)
- **Tightest memory budget:** Qwen2-VL-2B

### Key Insight
Fine-tuned Qwen3-4B matches or exceeds GPT-OSS-120B on 7 of 8 benchmarks. Smaller models show the largest relative gains from fine-tuning.

---

## 9. LoRA/QLoRA Configuration

### Recommended Configurations by GPU

#### T4 (16GB) - Free Colab
```python
# Must use 4-bit quantization
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
)

lora_config = LoraConfig(
    r=8,                    # Lower rank for memory
    lora_alpha=16,          # 2x rank
    lora_dropout=0.05,
    bias="none",
    target_modules=["q_proj", "v_proj"],  # Minimal targets
    task_type="CAUSAL_LM",
)

# Training: batch_size=1, grad_accum=4-8, max_length=1024-2048
```

#### A100 (40GB)
```python
lora_config = LoraConfig(
    r=16,                   # Higher rank for better quality
    lora_alpha=32,          # 2x rank
    lora_dropout=0.05,
    bias="none",
    target_modules="all-linear",  # Target all layers
    task_type="CAUSAL_LM",
    modules_to_save=["lm_head", "embed_tokens"],
)

# Training: batch_size=4-8, grad_accum=4, max_length=2048-4096
```

### LoRA Hyperparameter Guidelines

| Parameter | Conservative | Balanced | Aggressive |
|-----------|-------------|----------|------------|
| **Rank (r)** | 4-8 | 16 | 32-64 |
| **Alpha** | 2x rank | 2x rank | 2x rank |
| **Dropout** | 0.1 | 0.05 | 0 |
| **Target modules** | q_proj, v_proj | q,k,v,o_proj | all-linear |
| **Learning rate** | 1e-4 | 2e-4 | 5e-4 |
| **Epochs** | 1-2 | 3 | 5-10 |

### Key Best Practices
- **lora_alpha = 2 * r** is the most common and effective setting
- **r=8** balances expressiveness and efficiency for most tasks
- **r=16** recommended when targeting all-linear modules
- **Rank too large (>64)** risks overfitting
- Start with r=8 on T4, scale up on A100
- **Always enable gradient checkpointing** for VLMs

---

## 10. Memory Optimization

### Technique Stack (Cumulative VRAM Savings)

| Technique | VRAM Reduction | Training Speed Impact |
|-----------|---------------|----------------------|
| **4-bit QLoRA** | ~75% (16GB → 4GB for model) | Slight slowdown |
| **Gradient checkpointing** | ~30-50% activations | 20-30% slower |
| **Gradient accumulation** | Simulate larger batch | No impact |
| **Mixed precision (bf16)** | ~50% compute memory | Faster |
| **Unsloth optimizations** | Additional 60% | 2x faster |
| **Adam 8-bit** | ~25% optimizer state | Minimal |

### QLoRA Setup (Essential for T4)
```python
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,                     # 4-bit base model
    bnb_4bit_use_double_quant=True,        # Double quantization
    bnb_4bit_quant_type="nf4",             # NormalFloat4
    bnb_4bit_compute_dtype=torch.bfloat16, # Compute in bf16
)
```

### Gradient Checkpointing
```python
# In SFTConfig:
gradient_checkpointing=True,
gradient_checkpointing_kwargs={"use_reentrant": False},  # Important!

# Or with Unsloth (more efficient):
use_gradient_checkpointing="unsloth"
```

### Memory Budget Calculator

| Model | Full (fp16) | QLoRA (4-bit) | + Grad Ckpt | Fits T4? |
|-------|------------|---------------|-------------|----------|
| Qwen2-VL-2B | ~5 GB | ~2.5 GB | ~2 GB | Yes |
| PaliGemma 3B | ~7 GB | ~4 GB | ~3 GB | Yes |
| Gemma 3 4B | ~9 GB | ~3.4 GB | ~3 GB | Yes |
| Qwen2.5-VL-7B | ~15 GB | ~6 GB | ~5 GB | Tight |
| Llama 3.2 11B | ~23 GB | ~8 GB | ~7 GB | No (use A100) |

---

## 11. Satellite/Remote Sensing Domain Adaptation

### Mistral's Satellite Fine-Tuning Results (Key Reference)
- **Model:** Pixtral-12B with LoRA
- **Dataset:** AID (Aerial Image Dataset) - 8,000 training, 2,000 test, 30 classes
- **Results:** Accuracy 0.56 → 0.91 (1.6x improvement)
- **Hallucination reduction:** 5% → 0.1%
- **Cost:** Under $10
- Source: https://mistral.ai/news/unlocking-potential-vision-language-models-satellite-imagery-fine-tuning

### Existing Remote Sensing VLM Datasets

| Dataset | Size | Tasks | Source |
|---------|------|-------|--------|
| **AID** | 10,000 images, 30 classes | Scene classification | Public |
| **GeoChat_Instruct** | 318K samples | Captioning, VQA, detection, grounding | LLaVA-based |
| **RSICap** | 2,585 images | Detailed captioning | Human-annotated |
| **RSIEval** | 100 captions + 936 VQA pairs | Evaluation | Human-annotated |
| **VRSBench** | Various | Visual reasoning for RS | GitHub |
| **DIOR-RSVG** | Object detection | Visual grounding | Academic |

### Domain Adaptation Strategy

1. **Start with a general VLM** (Qwen2.5-VL-3B or Gemma 3 4B)
2. **Create instruction-tuning data** from existing RS datasets:
   - Convert classification labels → "What type of area is this?" Q&A
   - Convert detection annotations → grounding descriptions
   - Convert segmentation masks → land cover analysis descriptions
   - Add domain-specific system prompts
3. **Fine-tune with LoRA** targeting vision + language layers
4. **Evaluate on held-out RS tasks**

### Satellite-Specific Training Tips
- Use **higher resolution** if possible (448px or 896px for PaliGemma)
- For Qwen2.5-VL: images must be multiples of 28px
- Include diverse prompts (classification, description, counting, comparison)
- Mix positive and negative examples
- Include spatial reasoning questions ("What is north/south of...")
- Consider multi-scale: include both zoomed-in and overview images

---

## 12. Image Preprocessing & Tiling

### Tiling Strategies for High-Resolution Satellite Images

```python
from PIL import Image
import math

def tile_image(image, tile_size=448, overlap=0.1):
    """Split a large satellite image into overlapping tiles."""
    w, h = image.size
    stride = int(tile_size * (1 - overlap))
    tiles = []

    for y in range(0, h - tile_size + 1, stride):
        for x in range(0, w - tile_size + 1, stride):
            tile = image.crop((x, y, x + tile_size, y + tile_size))
            tiles.append({
                "image": tile,
                "position": (x, y),
                "original_size": (w, h)
            })
    return tiles

def resize_for_vlm(image, target_size=448, method="contain"):
    """Resize image for VLM input, maintaining aspect ratio."""
    w, h = image.size

    if method == "contain":
        # Fit within target_size, pad if needed
        ratio = min(target_size / w, target_size / h)
        new_w, new_h = int(w * ratio), int(h * ratio)
        resized = image.resize((new_w, new_h), Image.LANCZOS)
        # Pad to square
        padded = Image.new("RGB", (target_size, target_size), (0, 0, 0))
        padded.paste(resized, ((target_size - new_w) // 2, (target_size - new_h) // 2))
        return padded

    elif method == "cover":
        # Cover target_size, crop excess
        ratio = max(target_size / w, target_size / h)
        new_w, new_h = int(w * ratio), int(h * ratio)
        resized = image.resize((new_w, new_h), Image.LANCZOS)
        left = (new_w - target_size) // 2
        top = (new_h - target_size) // 2
        return resized.crop((left, top, left + target_size, top + target_size))

    elif method == "stretch":
        return image.resize((target_size, target_size), Image.LANCZOS)

def make_qwen_compatible(image):
    """Ensure image dimensions are multiples of 28 (required by Qwen2.5-VL)."""
    w, h = image.size
    new_w = (w // 28) * 28
    new_h = (h // 28) * 28
    if new_w != w or new_h != h:
        image = image.resize((new_w, new_h), Image.LANCZOS)
    return image
```

### VLM Image Tiling (Monkey/InternVL approach)
- Split image into non-overlapping tiles (2x2, 3x3 grids)
- Each tile encoded separately by vision encoder
- Grid selected to best match image aspect ratio
- 256 tokens per tile: `tokens = (num_tiles * 256) + 2`
- Up to 6 tiles typically supported

### Recommended Image Sizes by Model
| Model | Native Resolution | Recommended Training Size |
|-------|------------------|--------------------------|
| PaliGemma 2 3B | 224, 448, 896 px | 448 px (balance quality/speed) |
| Gemma 3 4B | Up to 512 px | 512 px |
| Qwen2.5-VL | Dynamic (multiples of 28) | 336-672 px |
| Llama 3.2 Vision | Dynamic | 448-560 px |

### Key Guidelines
- **300-1000px** for optimal training speed and resource efficiency (Unsloth recommendation)
- Ensure **all images maintain uniform dimensions** within a dataset
- For satellite imagery: consider training at **448-512px** for T4, **896px** for A100
- Unsloth `resize="min"` auto-resizes to smallest image dimension in batch

---

## 13. Evaluation Strategies

### Metrics by Task

| Task | Primary Metrics | Secondary Metrics |
|------|----------------|-------------------|
| **Classification** | Accuracy, F1, Precision, Recall | Confusion matrix |
| **Captioning** | CIDEr, BLEU-4, METEOR, ROUGE-L | SPICE |
| **VQA** | VQA Accuracy, Exact Match | F1 (token-level) |
| **Detection** | mAP@0.5, mAP@0.5:0.95 | Per-class AP |
| **Grounding** | IoU, Accuracy@0.5 | Mean IoU |
| **General** | Hallucination rate | Human preference |

### Simple Evaluation Code

```python
def evaluate_classification(model, processor, test_dataset, label_names):
    """Evaluate VLM on classification task."""
    correct = 0
    total = 0
    predictions = []

    for sample in test_dataset:
        image = sample["image"]
        true_label = sample["label"]

        messages = [{"role": "user", "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": "Classify this satellite image into one of: " +
             ", ".join(label_names) + ". Answer with just the category name."}
        ]}]

        input_text = processor.apply_chat_template(messages, add_generation_prompt=True)
        inputs = processor(image, input_text, return_tensors="pt").to("cuda")
        output = model.generate(**inputs, max_new_tokens=32)
        pred_text = processor.decode(output[0], skip_special_tokens=True)

        # Simple matching
        pred_label = None
        for i, name in enumerate(label_names):
            if name.lower() in pred_text.lower():
                pred_label = i
                break

        predictions.append({"true": true_label, "pred": pred_label, "text": pred_text})
        if pred_label == true_label:
            correct += 1
        total += 1

    accuracy = correct / total
    return accuracy, predictions

def compute_captioning_metrics(predictions, references):
    """Compute BLEU and simple metrics for captioning."""
    from collections import Counter
    import math

    bleu_scores = []
    for pred, ref in zip(predictions, references):
        pred_tokens = pred.lower().split()
        ref_tokens = ref.lower().split()

        # BLEU-1
        pred_counter = Counter(pred_tokens)
        ref_counter = Counter(ref_tokens)
        clipped = sum((pred_counter & ref_counter).values())
        bleu1 = clipped / max(len(pred_tokens), 1)
        bleu_scores.append(bleu1)

    return {"mean_bleu1": sum(bleu_scores) / len(bleu_scores)}
```

### Using VLM-as-Judge (Advanced)
For more nuanced evaluation, use a larger VLM to judge responses:
- Compare predicted vs reference descriptions
- Score on accuracy, detail, hallucination
- Prometheus-Vision framework provides structured rubrics

---

## 14. Working Colab Notebooks

### Unsloth Official Notebooks (Free T4)

| Model | Task | Colab Link |
|-------|------|------------|
| Gemma 3 (4B) Vision | LaTeX OCR | [Colab](https://colab.research.google.com/github/unslothai/notebooks/blob/main/nb/Gemma3_(4B)-Vision.ipynb) |
| Qwen2.5-VL (7B) | Handwriting→LaTeX | [Colab](https://colab.research.google.com/github/unslothai/notebooks/blob/main/nb/Qwen2.5_VL_(7B)-Vision.ipynb) |
| Llama 3.2 (11B) Vision | Radiography | [Colab](https://colab.research.google.com/github/unslothai/notebooks/blob/main/nb/Llama3.2_(11B)-Vision.ipynb) |
| Qwen3-VL (8B) | Vision | [Colab](https://colab.research.google.com/github/unslothai/notebooks/blob/main/nb/Qwen3_VL_(8B)-Vision.ipynb) |
| Pixtral (12B) | General Q&A Vision | [Colab](https://colab.research.google.com/github/unslothai/notebooks/blob/main/nb/Pixtral_(12B)-Vision.ipynb) |

### Community Notebooks
- [Llama 3.2 Vision Radiography](https://colab.research.google.com/drive/1j0N4XTY1zXXy7mPAhOC1_gMYZ2F2EBlk) - Full radiography fine-tuning
- [PaliGemma Fine-tuning (smol-vision)](https://github.com/merveenoyan/smol-vision/blob/main/Fine_tune_PaliGemma.ipynb) - VQAv2
- [Phil Schmid TRL VLM](https://github.com/philschmid/deep-learning-pytorch-huggingface/blob/main/training/fine-tune-multimodal-llms-with-trl.ipynb) - Product descriptions

### HuggingFace TRL Official
- [Training VLM SFT Guide](https://huggingface.co/docs/trl/main/en/training_vlm_sft)
- [Fine-tuning VLM Cookbook](https://huggingface.co/learn/cookbook/en/fine_tuning_vlm_trl)
- [VLM Object Detection Grounding](https://huggingface.co/learn/cookbook/en/fine_tuning_vlm_object_detection_grounding)

---

## 15. Complete Training Recipes

### Recipe A: Satellite Classification with Unsloth (T4 Colab)

```python
# Using Gemma 3 4B (fits T4 with 4-bit)
from unsloth import FastVisionModel
import torch

model, processor = FastVisionModel.from_pretrained(
    "unsloth/gemma-3-4b-pt",
    load_in_4bit=True,
    use_gradient_checkpointing="unsloth",
)

model = FastVisionModel.get_peft_model(
    model,
    finetune_vision_layers=True,
    finetune_language_layers=True,
    finetune_attention_modules=True,
    finetune_mlp_modules=True,
    r=16, lora_alpha=16, lora_dropout=0,
    bias="none", target_modules="all-linear",
)

# Convert satellite classification data
CLASSES = ["farmland", "forest", "residential", "commercial", "industrial",
           "water", "barren", "wetland", "parking", "airport"]

def convert_satellite_sample(sample):
    import random
    prompts = [
        "What type of land use or terrain is shown in this satellite image?",
        "Classify the scene in this aerial photograph.",
        "Describe the primary land cover type visible in this image.",
    ]
    return {"messages": [
        {"role": "user", "content": [
            {"type": "image", "image": sample["image"]},
            {"type": "text", "text": random.choice(prompts)}
        ]},
        {"role": "assistant", "content": [
            {"type": "text", "text": f"This satellite image shows {CLASSES[sample['label']]}. "
             f"The area is characterized by typical {CLASSES[sample['label']]} features."}
        ]}
    ]}

from datasets import load_dataset
dataset = load_dataset("your_satellite_dataset", split="train")
converted = [convert_satellite_sample(s) for s in dataset]

# Train
from unsloth import get_chat_template
from unsloth.trainer import UnslothVisionDataCollator
from trl import SFTTrainer, SFTConfig

processor = get_chat_template(processor, "gemma-3")
FastVisionModel.for_training(model)

trainer = SFTTrainer(
    model=model,
    train_dataset=converted,
    processing_class=processor.tokenizer,
    data_collator=UnslothVisionDataCollator(model, processor),
    args=SFTConfig(
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,    # Effective batch = 8
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        num_train_epochs=3,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        max_grad_norm=0.3,
        weight_decay=0.01,
        optim="adamw_8bit",
        logging_steps=10,
        save_strategy="epoch",
        output_dir="satellite_vlm",
        remove_unused_columns=False,
        dataset_text_field="",
        dataset_kwargs={"skip_prepare_dataset": True},
        max_length=1024,
        report_to="none",
    ),
)
trainer.train()
```

### Recipe B: Satellite VQA with TRL (A100)

```python
import torch
from transformers import AutoModelForVision2Seq, AutoProcessor, BitsAndBytesConfig
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig

model_id = "Qwen/Qwen2.5-VL-3B-Instruct"

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
)

model = AutoModelForVision2Seq.from_pretrained(
    model_id, device_map="auto",
    torch_dtype=torch.bfloat16,
    quantization_config=bnb_config,
)
processor = AutoProcessor.from_pretrained(model_id)

peft_config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    bias="none", target_modules="all-linear",
    task_type="CAUSAL_LM",
)

# Satellite VQA data
system_msg = "You are an expert in satellite imagery analysis and remote sensing."

def format_satellite_vqa(sample):
    return {"messages": [
        {"role": "system", "content": [{"type": "text", "text": system_msg}]},
        {"role": "user", "content": [
            {"type": "image", "image": sample["image"]},
            {"type": "text", "text": sample["question"]}
        ]},
        {"role": "assistant", "content": [
            {"type": "text", "text": sample["answer"]}
        ]}
    ]}

# ... collate_fn as shown in Section 3 ...

args = SFTConfig(
    output_dir="satellite-vqa-qwen",
    num_train_epochs=5,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    gradient_checkpointing=True,
    gradient_checkpointing_kwargs={"use_reentrant": False},
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.05,
    bf16=True,
    optim="adamw_torch_fused",
    max_grad_norm=0.3,
    weight_decay=0.01,
    logging_steps=10,
    save_strategy="epoch",
    remove_unused_columns=False,
    dataset_text_field="",
    dataset_kwargs={"skip_prepare_dataset": True},
)

trainer = SFTTrainer(
    model=model, args=args,
    train_dataset=train_data,
    data_collator=collate_fn,
    peft_config=peft_config,
    tokenizer=processor.tokenizer,
)
trainer.train()
```

### Recipe C: Detection with PaliGemma (T4)

```python
# Create JSONL from detection annotations
import json

def coco_to_paligemma_jsonl(coco_annotations, output_path):
    """Convert COCO-format annotations to PaliGemma JSONL."""
    with open(output_path, 'w') as f:
        for ann in coco_annotations:
            # Normalize coordinates to PaliGemma loc tokens (0-1023)
            img_w, img_h = ann["width"], ann["height"]
            detections = []
            for obj in ann["objects"]:
                x1 = int(obj["bbox"][0] / img_w * 1023)
                y1 = int(obj["bbox"][1] / img_h * 1023)
                x2 = int((obj["bbox"][0] + obj["bbox"][2]) / img_w * 1023)
                y2 = int((obj["bbox"][1] + obj["bbox"][3]) / img_h * 1023)
                detections.append(
                    f"<loc{y1:04d}><loc{x1:04d}><loc{y2:04d}><loc{x2:04d}> {obj['category']}"
                )

            classes = sorted(set(obj["category"] for obj in ann["objects"]))
            line = {
                "image": ann["filename"],
                "prefix": "detect " + " ; ".join(classes),
                "suffix": " ; ".join(detections)
            }
            f.write(json.dumps(line) + "\n")
```

---

## Key Sources

### Official Documentation
- [Unsloth Vision Fine-tuning](https://unsloth.ai/docs/basics/vision-fine-tuning)
- [Unsloth LoRA Hyperparameters Guide](https://unsloth.ai/docs/get-started/fine-tuning-llms-guide/lora-hyperparameters-guide)
- [HuggingFace TRL SFTTrainer](https://huggingface.co/docs/trl/main/en/sft_trainer)
- [HuggingFace TRL VLM SFT Guide](https://huggingface.co/docs/trl/main/en/training_vlm_sft)
- [LLaMA-Factory Data Preparation](https://llamafactory.readthedocs.io/en/latest/getting_started/data_preparation.html)
- [MS-Swift Custom Dataset](https://swift.readthedocs.io/en/latest/Customization/Custom-dataset.html)
- [MS-Swift GitHub](https://github.com/modelscope/ms-swift)

### Tutorials & Blog Posts
- [Mistral: Fine-tuning VLMs on Satellite Imagery](https://mistral.ai/news/unlocking-potential-vision-language-models-satellite-imagery-fine-tuning)
- [Phil Schmid: Fine-Tune Multimodal with TRL](https://www.philschmid.de/fine-tune-multimodal-llms-with-trl)
- [Roboflow: Fine-tune PaliGemma 2](https://blog.roboflow.com/fine-tune-paligemma-2/)
- [Datature: Fine-tune Qwen2.5-VL](https://datature.io/blog/how-to-fine-tune-qwen2-5-vl)
- [Datature: PaliGemma VLM Primer](https://datature.io/blog/a-primer-on-fine-tuning-paligemma-and-vlms)
- [LearnOpenCV: VLM Evaluation Metrics](https://learnopencv.com/vlm-evaluation-metrics/)
- [Fine-Tuning VLM in 2025](https://heyyanshuman.com/posts/fine-tuning-vlm)

### Benchmarks & Comparisons
- [Clarifai: Gemma 3 vs MiniCPM vs Qwen 2.5 VL](https://www.clarifai.com/blog/benchmarking-best-open-source-vision-language-models)
- [HuggingFace: VLMs 2025](https://huggingface.co/blog/vlms-2025)
- [Best Open-Source Vision Models 2025](https://www.koyeb.com/blog/best-multimodal-vision-models-in-2025)

### Remote Sensing VLMs
- [GeoChat (CVPR 2024)](https://github.com/mbzuai-oryx/GeoChat)
- [RSGPT](https://www.sciencedirect.com/science/article/abs/pii/S0924271625001352)
- [Awesome Remote Sensing VLMs](https://github.com/lzw-lzw/awesome-remote-sensing-vision-language-models)
- [VRSBench](https://github.com/lx709/VRSBench)

### Academic Papers
- [Image Tiling for High-Resolution Reasoning](https://arxiv.org/abs/2512.11167)
- [Two-Stage Fine-Tuning VLMs for RS Object Detection](https://www.mdpi.com/2072-4292/18/2/266)
- [VLMs in Remote Sensing Survey](https://arxiv.org/html/2505.14361v1)
