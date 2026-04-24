"""
Prepare Mumbai pipeline results for fine-tuning a small VLM.

This script reads cell results produced by the *latest* research pipeline
(one JSON per cell × buildingType) and converts them into training conversations
that exactly match the production prompt format used in
src/services/qwenVL.ts so the fine-tuned model can be a drop-in replacement.

Each conversation includes:
  - System prompt (matches production)
  - User prompt with location context summary + building type (matches production)
  - Assistant response with the production JSON schema

Three conversation types are generated per (cell, buildingType):
  1. Full analysis  → JSON output
  2. VQA count     → free-text count + summary
  3. Per-space detail → free-text description of one identified space

Run from research/ directory:
    python finetune/prepare_mumbai_dataset.py

Output:
    output/finetune-data/
        images/*.png
        conversations.json
        metadata.json
"""

from __future__ import annotations

import json
import os
import random
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
RESEARCH_DIR = SCRIPT_DIR.parent
RESULTS_DIR = RESEARCH_DIR / "output" / "results"
IMAGES_DIR = RESEARCH_DIR / "output" / "images"
OUTPUT_DIR = RESEARCH_DIR / "output" / "finetune-data"

# Must match research/config.ts and src/services/qwenVL.ts exactly
BUILDING_TYPES = [
    "cafe",
    "mall",
    "park",
    "residential",
    "office",
    "hospital",
    "school",
    "gym",
    "restaurant",
    "hotel",
    "retail",
]

BUILDING_DESCRIPTIONS: dict[str, str] = {
    "cafe": "a coffee shop or cafe with seating area, kitchen facilities, and customer parking",
    "mall": "a large shopping mall with multiple stores, parking facilities, food courts",
    "park": "a public park with green spaces, walking paths, recreational facilities",
    "residential": "a residential complex with apartments or houses, parking, and amenities",
    "office": "an office building for businesses with workspace and parking facilities",
    "hospital": "a medical facility with emergency services and medical equipment areas",
    "school": "an educational institution with classrooms and sports facilities",
    "gym": "a fitness center with exercise equipment and parking facilities",
    "restaurant": "a restaurant with dining area, kitchen, and customer parking",
    "hotel": "a hotel with guest rooms, lobby, restaurant, and parking",
    "retail": "a retail store with customer area, storage, and parking",
}

# Single canonical system prompt — kept short so it doesn't dominate the context
SYSTEM_PROMPT = (
    "You are an expert urban planner analyzing satellite imagery to identify "
    "vacant or underutilized spaces suitable for infrastructure development. "
    "You return strict JSON in the requested schema."
)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CellRow:
    """One (cell, buildingType) row from the research pipeline."""

    cell_id: str
    image_file: str  # filename only, not full path
    building_type: str
    center: dict[str, float]
    location_context_summary: str
    location_address: str
    filtered_result: dict[str, Any]


# ---------------------------------------------------------------------------
# Prompt builders — must mirror src/services/qwenVL.ts exactly
# ---------------------------------------------------------------------------


def build_analysis_prompt(row: CellRow) -> str:
    """Construct the user prompt that the model should learn to map to JSON."""
    building_description = BUILDING_DESCRIPTIONS.get(row.building_type, row.building_type)
    ground_truth = f"\n== AREA CONTEXT (from OpenStreetMap) ==\n{row.location_context_summary}\n"

    return (
        f"You are an expert urban planner analyzing satellite imagery to identify "
        f"vacant or underutilized spaces suitable for building {building_description}.\n\n"
        f"Location: {row.location_address}\n"
        f"Map Center: {row.center['lat']:.6f}, {row.center['lng']:.6f}\n"
        f"Building Type: {row.building_type}\n"
        f"{ground_truth}\n"
        "== WHAT TO LOOK FOR ==\n"
        "Identify 2-4 spaces in the satellite image that appear suitable for development:\n"
        "1. Empty/cleared lots with no structures (bare earth, gravel, unused land)\n"
        "2. Large underutilized parking areas or open concrete areas\n"
        "3. Abandoned, derelict, or clearly unused buildings/compounds\n"
        "4. Underutilized industrial or commercial parcels\n"
        "5. Gaps between developed areas that appear vacant\n\n"
        "== WHAT TO AVOID ==\n"
        "Do NOT suggest locations that are:\n"
        "- Directly inside a visible water body (river, lake, ocean)\n"
        "- Inside a military installation\n"
        "- On top of existing occupied residential buildings or apartment complexes\n\n"
        "== IMPORTANT ==\n"
        "- Coordinates MUST be within the visible satellite image area (close to the map center)\n"
        "- Existing buildings with people living in them are NOT vacant — look for genuinely empty land\n"
        "- Urban areas often have small vacant plots between buildings — these ARE valid suggestions\n"
        "- If you can see open/bare land in the image, suggest it even if the area is densely developed nearby\n\n"
        "Return ONLY valid JSON in this EXACT format:\n"
        "{\n"
        '  "vacantSpaces": [\n'
        "    {\n"
        '      "location": "Descriptive location using visible landmarks and streets",\n'
        '      "coordinates": { "lat": <latitude>, "lng": <longitude> },\n'
        '      "suitability": <0-100>,\n'
        '      "reasons": ["Reason 1", "Reason 2", "Reason 3"],\n'
        '      "considerations": ["Challenge 1", "Challenge 2"],\n'
        '      "description": "2-3 sentence description of the space"\n'
        "    }\n"
        "  ],\n"
        f'  "analysis": "Overall area assessment for {row.building_type} development",\n'
        '  "confidence": <0-100>\n'
        "}"
    )


def build_count_question(row: CellRow) -> str:
    return (
        f"Looking at this satellite image of {row.location_address}, "
        f"how many vacant or underutilized spaces are suitable for a {row.building_type}? "
        f"Briefly describe the area."
    )


def build_count_answer(row: CellRow) -> str:
    spaces = row.filtered_result.get("vacantSpaces", [])
    analysis = row.filtered_result.get("analysis", "")
    if not spaces:
        return (
            f"I cannot identify any clearly vacant spaces suitable for a {row.building_type} "
            f"in this view. {analysis}"
        ).strip()
    return (
        f"I can identify {len(spaces)} vacant or underutilized space(s) suitable for a "
        f"{row.building_type} in this view. {analysis}"
    ).strip()


def build_detail_question(space: dict[str, Any]) -> str:
    coords = space.get("coordinates", {})
    lat = coords.get("lat", 0.0)
    lng = coords.get("lng", 0.0)
    return f"Describe the vacant space near {lat:.4f}, {lng:.4f} and assess its development potential."


def build_detail_answer(space: dict[str, Any]) -> str:
    parts = [
        f"Location: {space.get('location', 'Unnamed plot')}",
        "",
        space.get("description", "Vacant space identified in the satellite image."),
        "",
        f"Suitability: {space.get('suitability', 0)}/100",
    ]
    reasons = space.get("reasons", [])
    if reasons:
        parts.append("Reasons:")
        parts.extend(f"- {r}" for r in reasons)
    considerations = space.get("considerations", [])
    if considerations:
        parts.append("Considerations:")
        parts.extend(f"- {c}" for c in considerations)
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Conversion
# ---------------------------------------------------------------------------


def _pick_building_type(spaces: list[dict[str, Any]]) -> str:
    """
    Pick the most common recommendedType across all spaces in an old-format file.
    Falls back to 'retail' if nothing recommended.
    """
    counts: dict[str, int] = {}
    for space in spaces:
        for t in space.get("recommendedTypes", []) or []:
            if t in BUILDING_TYPES:
                counts[t] = counts.get(t, 0) + 1
    if not counts:
        return "retail"
    return max(counts.items(), key=lambda kv: kv[1])[0]


def _strip_recommended_types(spaces: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop the deprecated recommendedTypes field from each space."""
    cleaned: list[dict[str, Any]] = []
    for s in spaces:
        copy = {k: v for k, v in s.items() if k != "recommendedTypes"}
        cleaned.append(copy)
    return cleaned


def _migrate_old_format(data: dict[str, Any]) -> dict[str, Any] | None:
    """
    Convert an old-format result file into a new-format row dict.

    Old format:  cellId, center, pipelineResult, filteredResult (with recommendedTypes)
    New format:  + buildingType, + locationContext, - recommendedTypes

    Old data has no Overpass context, so we synthesize a minimal summary.
    """
    if "cellId" not in data or "center" not in data:
        return None
    filtered = data.get("filteredResult") or data.get("pipelineResult") or {}
    spaces = filtered.get("vacantSpaces", []) or []

    building_type = _pick_building_type(spaces)
    center = data["center"]

    synth_address = f"Mumbai area near {center['lat']:.4f}, {center['lng']:.4f}"
    synth_summary = (
        f"Area: {synth_address}\n"
        "Water bodies in area: NONE detected\n"
        "Forests/woods in area: NONE detected\n"
        "Approximate building density: urban"
    )

    return {
        "cellId": data["cellId"],
        "center": center,
        "buildingType": building_type,
        "locationContext": {
            "address": synth_address,
            "summary": synth_summary,
            "waterBodyCount": 0,
            "forestCount": 0,
            "buildingCount": 0,
        },
        "filteredResult": {
            "vacantSpaces": _strip_recommended_types(spaces),
            "analysis": filtered.get("analysis", ""),
            "confidence": filtered.get("confidence", 0),
        },
    }


def load_cell_rows(allow_legacy: bool = True) -> list[CellRow]:
    """
    Read every result JSON from output/results/ into structured rows.

    If a file is in the old schema (no buildingType), it is transparently
    migrated with _migrate_old_format() so existing pipeline runs stay usable.
    Set allow_legacy=False to skip legacy files instead.
    """
    if not RESULTS_DIR.exists():
        raise FileNotFoundError(
            f"{RESULTS_DIR} does not exist. Run the research pipeline first."
        )

    rows: list[CellRow] = []
    legacy_count = 0
    new_count = 0
    skipped = 0

    for fname in sorted(os.listdir(RESULTS_DIR)):
        if not fname.endswith(".json"):
            continue
        path = RESULTS_DIR / fname
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError):
            skipped += 1
            continue

        if not data.get("buildingType"):
            if not allow_legacy:
                skipped += 1
                continue
            migrated = _migrate_old_format(data)
            if migrated is None:
                skipped += 1
                continue
            data = migrated
            legacy_count += 1
        else:
            new_count += 1

        cell_id = data["cellId"]
        center = data["center"]
        building_type = data["buildingType"]
        location_context = data.get("locationContext", {}) or {}
        location_summary = location_context.get("summary", "")
        location_address = location_context.get(
            "address", f"{center['lat']:.4f}, {center['lng']:.4f}"
        )
        filtered = data.get("filteredResult", {}) or {}

        rows.append(
            CellRow(
                cell_id=cell_id,
                image_file=f"{cell_id}.png",
                building_type=building_type,
                center=center,
                location_context_summary=location_summary,
                location_address=location_address,
                filtered_result=filtered,
            )
        )

    print(
        f"Loaded rows: new={new_count}, migrated_legacy={legacy_count}, skipped={skipped}"
    )
    return rows


def row_to_conversations(row: CellRow) -> list[dict[str, Any]]:
    """Convert one row to up to three training conversations."""
    conversations: list[dict[str, Any]] = []

    # 1. Full analysis (JSON output) — the primary training signal
    user_prompt = build_analysis_prompt(row)
    assistant_json = json.dumps(row.filtered_result, indent=2, ensure_ascii=False)
    conversations.append(
        {
            "image": row.image_file,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": assistant_json},
            ],
        }
    )

    # 2. VQA count + brief description
    conversations.append(
        {
            "image": row.image_file,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_count_question(row)},
                {"role": "assistant", "content": build_count_answer(row)},
            ],
        }
    )

    # 3. Per-space detail (max 1 to keep dataset balanced)
    spaces = row.filtered_result.get("vacantSpaces", []) or []
    if spaces:
        space = spaces[0]
        conversations.append(
            {
                "image": row.image_file,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": build_detail_question(space)},
                    {"role": "assistant", "content": build_detail_answer(space)},
                ],
            }
        )

    return conversations


def main() -> None:
    random.seed(42)

    rows = load_cell_rows()
    if not rows:
        print(
            "No new-format result files found. "
            "Re-run the research pipeline so each cell has a buildingType field."
        )
        return

    print(f"Loaded {len(rows)} (cell, buildingType) rows from {RESULTS_DIR}")

    # Make sure all referenced images exist
    available_images = {p.name for p in IMAGES_DIR.glob("*.png")}
    valid_rows = [r for r in rows if r.image_file in available_images]
    if len(valid_rows) < len(rows):
        print(
            f"  Skipped {len(rows) - len(valid_rows)} rows without corresponding image"
        )

    # Build conversations
    all_conversations: list[dict[str, Any]] = []
    for row in valid_rows:
        all_conversations.extend(row_to_conversations(row))

    print(f"Built {len(all_conversations)} conversations")

    # Copy images
    out_images_dir = OUTPUT_DIR / "images"
    out_images_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for row in valid_rows:
        src = IMAGES_DIR / row.image_file
        dst = out_images_dir / row.image_file
        if not dst.exists():
            shutil.copy2(src, dst)
        copied += 1
    print(f"Copied {len(set(r.image_file for r in valid_rows))} unique images to {out_images_dir}")

    # Save conversations.json
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    conv_path = OUTPUT_DIR / "conversations.json"
    with open(conv_path, "w", encoding="utf-8") as f:
        json.dump(all_conversations, f, indent=2, ensure_ascii=False)

    # Save metadata
    types_seen = sorted(set(r.building_type for r in valid_rows))
    type_counts = {t: sum(1 for r in valid_rows if r.building_type == t) for t in types_seen}
    spaces_per_type = {
        t: sum(
            len(r.filtered_result.get("vacantSpaces", []))
            for r in valid_rows
            if r.building_type == t
        )
        for t in types_seen
    }

    metadata = {
        "schema_version": "v3-production-aligned",
        "system_prompt": SYSTEM_PROMPT,
        "total_rows": len(valid_rows),
        "total_conversations": len(all_conversations),
        "building_types": types_seen,
        "rows_per_building_type": type_counts,
        "spaces_per_building_type": spaces_per_type,
        "conversation_types": {
            "full_analysis": len(valid_rows),
            "vqa_count": len(valid_rows),
            "per_space_detail": sum(
                1
                for r in valid_rows
                if r.filtered_result.get("vacantSpaces")
            ),
        },
    }
    with open(OUTPUT_DIR / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f"\nDataset prepared at {OUTPUT_DIR}/")
    print(f"  Rows:          {metadata['total_rows']}")
    print(f"  Conversations: {metadata['total_conversations']}")
    print(f"  Building types: {len(types_seen)}")
    print(f"  Conversation breakdown: {json.dumps(metadata['conversation_types'], indent=4)}")
    print(
        "\nNext step: zip output/finetune-data/ and upload to the Colab notebook "
        "(research/finetune/colab_finetune_v3.py)."
    )


if __name__ == "__main__":
    main()
