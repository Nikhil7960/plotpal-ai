"""
PlotPal AI - VLM Fine-Tuning v3 (Qwen3-VL-2B + Unsloth)
========================================================
Run each snippet as a separate Colab cell. Requires T4 / L4 / A100 GPU runtime.

WHY v3:
- Switches base model to **Qwen3-VL-2B-Instruct** (sub-2B, latest Qwen, April 2025)
  - Same prompt/chat-template family as Qwen2.5-VL so production prompts work as-is
  - Strong benchmarks vs InternVL3-2B and SmolVLM2-2.2B at the same size
  - Unsloth-supported → 2x faster training, 60% less VRAM than vanilla TRL
- Trains on the v3 dataset produced by research/finetune/prepare_mumbai_dataset.py
  which encodes the **production** prompt format (location context + building type)
- Uses LoRA on all-linear modules for fast convergence on small data
- 90/10 train/eval split, best-checkpoint loading
- Exports LoRA adapters + optional GGUF for local inference
"""


# ============================================================================
# SNIPPET 1: Install Dependencies
# ============================================================================
import subprocess
import sys

cmds = [
    [
        sys.executable,
        "-m",
        "pip",
        "install",
        "--no-deps",
        "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git",
    ],
    [
        sys.executable,
        "-m",
        "pip",
        "install",
        "--no-deps",
        "unsloth_zoo @ git+https://github.com/unslothai/unsloth-zoo.git",
    ],
    [
        sys.executable,
        "-m",
        "pip",
        "install",
        "-q",
        "pillow",
        "datasets>=2.16",
        "accelerate",
        "bitsandbytes",
        "peft",
        "trl",
        "xformers",
        "transformers>=4.45",
    ],
]
for cmd in cmds:
    subprocess.check_call(cmd)
print("Dependencies installed.")


# ============================================================================
# SNIPPET 2: Imports & GPU Check
# ============================================================================
import gc
import json
import math
import os
import random
from io import BytesIO
from pathlib import Path

import requests
import torch
from PIL import Image

print(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NONE'}")
print(
    f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024 ** 3:.1f} GB"
)
assert torch.cuda.is_available(), "GPU required. Pick T4, L4, or A100."


# ============================================================================
# SNIPPET 3: Load Qwen3-VL-2B with Unsloth
# ============================================================================
from unsloth import FastVisionModel

# Sub-2B params, 4-bit quantized for memory. Drop-in replacement for production
# Qwen2.5-VL prompts because Qwen3-VL uses the same chat template family.
# Note: the correct Unsloth repo name uses "-unsloth-bnb-4bit" suffix.
MODEL_ID = "unsloth/Qwen3-VL-2B-Instruct-unsloth-bnb-4bit"

model, tokenizer = FastVisionModel.from_pretrained(
    MODEL_ID,
    load_in_4bit=True,
    use_gradient_checkpointing="unsloth",
)

model = FastVisionModel.get_peft_model(
    model,
    finetune_vision_layers=True,
    finetune_language_layers=True,
    finetune_attention_modules=True,
    finetune_mlp_modules=True,
    r=16,
    lora_alpha=16,
    lora_dropout=0.0,
    bias="none",
    random_state=3407,
    use_rslora=False,
    loftq_config=None,
    target_modules="all-linear",
)

model.print_trainable_parameters()
print("Qwen3-VL-2B loaded with LoRA adapters.")


# ============================================================================
# SNIPPET 4: Upload v3 Dataset
# ============================================================================
# The dataset comes from research/finetune/prepare_mumbai_dataset.py and lives
# in research/output/finetune-data/ . Zip that folder and upload it here.

from google.colab import files as colab_files

print("Upload your finetune-data.zip (from research/output/finetune-data/):")
uploaded = colab_files.upload()

import zipfile

for fname in uploaded:
    if fname.endswith(".zip"):
        with zipfile.ZipFile(fname) as zf:
            zf.extractall("/content/finetune-data")
        print(f"Extracted {fname}")
        break

# Detect actual paths (handle nested folders)
DATA_ROOT = Path("/content/finetune-data")
for candidate in [
    DATA_ROOT / "conversations.json",
    DATA_ROOT / "finetune-data" / "conversations.json",
]:
    if candidate.exists():
        DATA_ROOT = candidate.parent
        break

CONV_PATH = DATA_ROOT / "conversations.json"
META_PATH = DATA_ROOT / "metadata.json"
IMG_DIR = DATA_ROOT / "images"

assert CONV_PATH.exists(), f"conversations.json not found in {DATA_ROOT}"
assert IMG_DIR.exists(), f"images/ not found in {DATA_ROOT}"

with open(CONV_PATH) as f:
    raw_conversations = json.load(f)

if META_PATH.exists():
    with open(META_PATH) as f:
        meta = json.load(f)
    print(f"Schema version: {meta.get('schema_version', 'unknown')}")
    print(
        f"Building types in dataset: {meta.get('building_types', [])} "
        f"({len(meta.get('building_types', []))} total)"
    )

print(f"Loaded {len(raw_conversations)} conversations")
print(f"Images dir: {IMG_DIR} ({len(list(IMG_DIR.glob('*.png')))} images)")


# ============================================================================
# SNIPPET 5: Build Training Dataset
# ============================================================================
# The dataset prep script already encodes the production prompt format,
# so we DON'T need to augment prompts here — we want the model to learn the
# exact production prompt format, not random rephrasings.

def _flatten_content(content):
    """
    Normalize a message 'content' field to a plain string.
    Handles:
      - plain string (what prepare_mumbai_dataset.py writes)
      - list of content items [{type: text, text: ...}, ...] (legacy/Unsloth format)
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
        return "\n".join(parts)
    return str(content) if content is not None else ""


def build_dataset(conversations, img_dir):
    dataset = []
    skipped_no_image = 0
    skipped_bad_image = 0
    skipped_bad_messages = 0

    for conv in conversations:
        img_name = conv.get("image", "")
        img_path = img_dir / img_name
        if not img_path.exists():
            skipped_no_image += 1
            continue

        try:
            image = Image.open(img_path).convert("RGB")
        except Exception:
            skipped_bad_image += 1
            continue

        messages = conv.get("messages", [])
        if len(messages) < 3:
            skipped_bad_messages += 1
            continue

        system_text = _flatten_content(messages[0].get("content", ""))
        user_text = _flatten_content(messages[1].get("content", ""))
        assistant_text = _flatten_content(messages[2].get("content", ""))

        if not user_text or not assistant_text:
            skipped_bad_messages += 1
            continue

        sample = {
            "messages": [
                {
                    "role": "system",
                    "content": [{"type": "text", "text": system_text}],
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": image},
                        {"type": "text", "text": user_text},
                    ],
                },
                {
                    "role": "assistant",
                    "content": [{"type": "text", "text": assistant_text}],
                },
            ],
        }
        dataset.append(sample)

    total_skipped = skipped_no_image + skipped_bad_image + skipped_bad_messages
    print(f"Built {len(dataset)} samples (skipped {total_skipped} total)")
    print(f"  no_image={skipped_no_image} bad_image={skipped_bad_image} bad_messages={skipped_bad_messages}")
    return dataset


train_data = build_dataset(raw_conversations, IMG_DIR)

random.seed(42)
random.shuffle(train_data)
split_idx = int(len(train_data) * 0.9)
train_split = train_data[:split_idx]
eval_split = train_data[split_idx:]
print(f"Train: {len(train_split)} | Eval: {len(eval_split)}")


# ============================================================================
# SNIPPET 6: Configure Trainer
# ============================================================================
from trl import SFTConfig, SFTTrainer
from unsloth.trainer import UnslothVisionDataCollator

OUTPUT_DIR = "/content/plotpal-qwen3vl-2b-lora"

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    data_collator=UnslothVisionDataCollator(model, tokenizer),
    train_dataset=train_split,
    eval_dataset=eval_split,
    args=SFTConfig(
        output_dir=OUTPUT_DIR,
        num_train_epochs=3,
        per_device_train_batch_size=2,
        per_device_eval_batch_size=2,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        optim="adamw_8bit",
        weight_decay=0.01,
        max_grad_norm=1.0,
        max_seq_length=4096,  # production prompts include long context summaries
        bf16=True,
        fp16=False,
        logging_steps=5,
        eval_strategy="steps",
        eval_steps=50,
        save_strategy="steps",
        save_steps=100,
        save_total_limit=3,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        report_to="none",
        push_to_hub=False,
        seed=42,
        remove_unused_columns=False,
        dataset_text_field="",
        dataset_kwargs={"skip_prepare_dataset": True},
    ),
)

effective_batch = trainer.args.per_device_train_batch_size * trainer.args.gradient_accumulation_steps
print(f"Trainer ready. Effective batch size: {effective_batch}")
print(f"Approx total steps: {len(train_split) * 3 // effective_batch}")


# ============================================================================
# SNIPPET 7: Train
# ============================================================================
print("Starting training...")
stats = trainer.train()
print(f"\nTraining complete.")
print(f"  Total steps: {stats.global_step}")
print(f"  Train loss: {stats.training_loss:.4f}")

trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print(f"Model saved to {OUTPUT_DIR}")


# ============================================================================
# SNIPPET 8: Quick smoke test on eval split
# ============================================================================
FastVisionModel.for_inference(model)


def generate_response(image, system_text, user_text, max_new_tokens=1024):
    messages = [
        {"role": "system", "content": [{"type": "text", "text": system_text}]},
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": user_text},
            ],
        },
    ]
    input_text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer(image, input_text, add_special_tokens=False, return_tensors="pt").to("cuda")
    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.2,
            do_sample=True,
            use_cache=True,
        )
    generated_ids = out[:, inputs["input_ids"].shape[1] :]
    return tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]


print("=" * 60)
print("FINE-TUNED MODEL — eval split smoke test")
print("=" * 60)

for i, sample in enumerate(eval_split[:3]):
    sys_text = sample["messages"][0]["content"][0]["text"]
    user_msg = sample["messages"][1]["content"]
    image = next(p["image"] for p in user_msg if p.get("type") == "image")
    user_text = next(p["text"] for p in user_msg if p.get("type") == "text")

    print(f"\nTest {i + 1}: prompt[:80]= {user_text[:80]}...")
    response = generate_response(image, sys_text, user_text)
    print(f"Output[:400]:\n{response[:400]}")
    print("-" * 60)


# ============================================================================
# SNIPPET 9: Test against fresh Esri tiles (simulates production usage)
# ============================================================================
SYSTEM_PROMPT = (
    "You are an expert urban planner analyzing satellite imagery to identify "
    "vacant or underutilized spaces suitable for infrastructure development. "
    "You return strict JSON in the requested schema."
)


def fetch_esri_tile(lat: float, lng: float) -> Image.Image:
    delta = 0.005
    bbox = f"{lng - delta},{lat - delta},{lng + delta},{lat + delta}"
    url = (
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
        f"?bbox={bbox}&bboxSR=4326&imageSR=4326&size=800,800&format=png&f=image"
    )
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    return Image.open(BytesIO(resp.content)).convert("RGB")


def production_user_prompt(building_type: str, address: str, lat: float, lng: float) -> str:
    return (
        f"You are an expert urban planner analyzing satellite imagery to identify "
        f"vacant or underutilized spaces suitable for building a {building_type}.\n\n"
        f"Location: {address}\n"
        f"Map Center: {lat:.6f}, {lng:.6f}\n"
        f"Building Type: {building_type}\n\n"
        "== AREA CONTEXT (from OpenStreetMap) ==\n"
        f"Area: {address}\n"
        "Water bodies in area: NONE detected\n"
        "Forests/woods in area: NONE detected\n"
        "Approximate building density: dense urban\n\n"
        "== WHAT TO LOOK FOR ==\n"
        "Identify 2-4 vacant spaces suitable for development.\n\n"
        "Return ONLY valid JSON with vacantSpaces array, analysis string, and confidence."
    )


TEST_LOCATIONS = [
    ("Kharghar, Navi Mumbai", 19.043, 73.069, "retail"),
    ("Mumbai BKC", 19.0596, 72.8656, "office"),
    ("Thane West", 19.2183, 72.978, "hospital"),
]

print("\n" + "=" * 60)
print("FINE-TUNED MODEL — fresh Esri tile tests")
print("=" * 60)

for name, lat, lng, btype in TEST_LOCATIONS:
    try:
        image = fetch_esri_tile(lat, lng)
        prompt = production_user_prompt(btype, name, lat, lng)
        print(f"\n{name} | {btype}")
        result = generate_response(image, SYSTEM_PROMPT, prompt)
        print(f"  {result[:500]}")
    except Exception as e:
        print(f"  failed: {e}")


# ============================================================================
# SNIPPET 10: Export LoRA adapters
# ============================================================================
EXPORT_DIR = "/content/plotpal-qwen3vl-2b-lora-export"
model.save_pretrained(EXPORT_DIR)
tokenizer.save_pretrained(EXPORT_DIR)

import shutil

shutil.make_archive("/content/plotpal-qwen3vl-2b-lora-export", "zip", EXPORT_DIR)
print(f"LoRA adapters exported to /content/plotpal-qwen3vl-2b-lora-export.zip")

from google.colab import files as colab_files

colab_files.download("/content/plotpal-qwen3vl-2b-lora-export.zip")


# ============================================================================
# SNIPPET 11 (optional): Push to Hugging Face Hub
# ============================================================================
# from huggingface_hub import login
# login(token="hf_...")
# model.push_to_hub("your-username/plotpal-qwen3vl-2b-lora")
# tokenizer.push_to_hub("your-username/plotpal-qwen3vl-2b-lora")
