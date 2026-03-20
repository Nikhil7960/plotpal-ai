"""
Prepare Mumbai pipeline results for upload to Google Drive / Colab.
Run this locally before starting the Colab notebook.

Creates a clean dataset package at output/finetune-data/ containing:
- images/ (all cell PNGs)
- conversations.json (all training conversations)
- metadata.json (dataset stats)

Upload the entire finetune-data/ folder to Google Drive.
"""

import json
import os
import random
import shutil
from pathlib import Path

RESULTS_DIR = "output/results"
IMAGES_DIR = "output/images"
OUTPUT_DIR = "output/finetune-data"

BUILDING_TYPES = [
    "cafe", "mall", "park", "residential", "office",
    "hospital", "school", "gym", "restaurant", "hotel", "retail"
]

SYSTEM_PROMPT = "You are an expert urban planner analyzing satellite imagery to identify vacant or underutilized spaces suitable for infrastructure development."

ANALYSIS_PROMPTS = [
    "Analyze this satellite image and identify any vacant or underutilized spaces. For each space found, recommend which infrastructure types from [cafe, mall, park, residential, office, hospital, school, gym, restaurant, hotel, retail] would be most suitable. Return your analysis as JSON.",
    "Look at this satellite/aerial image carefully. Find 2-4 vacant, abandoned, or underutilized areas. For each, suggest what type of building or facility would best serve the community. Respond in JSON format.",
    "As an urban planning expert, examine this satellite view. Identify empty lots, abandoned structures, or underused land. Recommend suitable infrastructure from: cafe, mall, park, residential, office, hospital, school, gym, restaurant, hotel, retail. Output JSON only.",
    "Study this aerial/satellite image of an urban area. Detect vacant spaces and recommend appropriate development types based on surrounding context, lot size, and neighborhood needs. Return structured JSON.",
    "Analyze this satellite image for potential development sites. Identify underutilized spaces and suggest which of these infrastructure types would be most appropriate: cafe, mall, park, residential, office, hospital, school, gym, restaurant, hotel, retail. Provide JSON output.",
]


def convert_result(result: dict) -> list[dict]:
    """Convert a single cell result to training conversations."""
    cell_id = result["cellId"]
    center = result["center"]
    filtered = result.get("filteredResult", result.get("pipelineResult", {}))
    spaces = filtered.get("vacantSpaces", [])
    conversations = []

    # Conversation 1: Full analysis
    prompt = random.choice(ANALYSIS_PROMPTS)
    prompt_ctx = f"Cell Center: {center['lat']:.6f}, {center['lng']:.6f}\nCell Size: 500m × 500m\n\n{prompt}"

    conversations.append({
        "image": f"{cell_id}.png",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt_ctx},
            {"role": "assistant", "content": json.dumps(filtered, indent=2)}
        ]
    })

    # Conversation 2: VQA count + types
    if spaces:
        all_types = list(set(t for s in spaces for t in s.get("recommendedTypes", [])))
        vqa_a = f"I can identify {len(spaces)} vacant or underutilized spaces. "
        vqa_a += f"Recommended infrastructure types: {', '.join(all_types)}. "
        vqa_a += filtered.get("analysis", "")

        conversations.append({
            "image": f"{cell_id}.png",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "How many vacant or underutilized spaces can you identify? What infrastructure would you recommend?"},
                {"role": "assistant", "content": vqa_a}
            ]
        })

    # Conversation 3: Per-space detail (max 2)
    for space in spaces[:2]:
        detail_q = f"Describe the vacant space near {space['coordinates']['lat']:.4f}, {space['coordinates']['lng']:.4f}."
        detail_a = f"Location: {space['location']}\n\n{space['description']}\n"
        detail_a += f"Suitability: {space['suitability']}/100\n"
        detail_a += f"Recommended: {', '.join(space.get('recommendedTypes', []))}\n"
        detail_a += f"Reasons: {'; '.join(space.get('reasons', []))}"

        conversations.append({
            "image": f"{cell_id}.png",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": detail_q},
                {"role": "assistant", "content": detail_a}
            ]
        })

    return conversations


def main():
    os.makedirs(f"{OUTPUT_DIR}/images", exist_ok=True)

    result_files = sorted(f for f in os.listdir(RESULTS_DIR) if f.endswith(".json"))
    print(f"Found {len(result_files)} result files")

    all_conversations = []
    copied_images = 0

    for fname in result_files:
        with open(os.path.join(RESULTS_DIR, fname)) as f:
            result = json.load(f)

        cell_id = result["cellId"]
        img_src = os.path.join(IMAGES_DIR, f"{cell_id}.png")

        if not os.path.exists(img_src):
            continue

        # Copy image
        shutil.copy2(img_src, f"{OUTPUT_DIR}/images/{cell_id}.png")
        copied_images += 1

        # Convert to conversations
        convs = convert_result(result)
        all_conversations.extend(convs)

    # Save conversations
    with open(f"{OUTPUT_DIR}/conversations.json", "w") as f:
        json.dump(all_conversations, f, indent=2)

    # Save metadata
    metadata = {
        "total_cells": len(result_files),
        "images_copied": copied_images,
        "total_conversations": len(all_conversations),
        "conversation_types": {
            "full_analysis": len(result_files),
            "vqa_count": sum(1 for c in all_conversations if "How many" in c["messages"][1]["content"]),
            "per_space_detail": sum(1 for c in all_conversations if "Describe the vacant" in c["messages"][1]["content"]),
        },
        "building_types": BUILDING_TYPES,
    }
    with open(f"{OUTPUT_DIR}/metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nDataset prepared at {OUTPUT_DIR}/")
    print(f"  Images: {copied_images}")
    print(f"  Conversations: {len(all_conversations)}")
    print(f"  Types: {json.dumps(metadata['conversation_types'], indent=4)}")
    print(f"\nUpload {OUTPUT_DIR}/ to Google Drive, then run the Colab notebook.")


if __name__ == "__main__":
    main()
