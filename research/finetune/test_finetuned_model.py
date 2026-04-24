"""
Test the fine-tuned PlotPal VLM end-to-end against multiple cities.

Mirrors the standalone test-pipeline.mjs JS harness so we can compare:
  - Production Gemini pipeline  (test-pipeline.mjs)
  - Fine-tuned local Qwen3-VL-2B (this script)

Usage (local with adapters downloaded from Colab):

    python research/finetune/test_finetuned_model.py \\
        --adapter ./plotpal-qwen3vl-2b-lora \\
        --location kharghar

The script runs three stages, mirroring production:

    1. Fetch a real Esri satellite image for the location.
    2. Fetch Overpass land use context + reverse-geocoded address.
    3. Build the production user prompt with the context summary baked in.
    4. Generate with the fine-tuned model.
    5. Parse JSON, validate the schema, and print verbose per-stage output.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Test locations (kept in sync with test-pipeline.mjs)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TestLocation:
    name: str
    lat: float
    lng: float
    building_type: str


TEST_LOCATIONS: list[TestLocation] = [
    TestLocation("Kharghar, Navi Mumbai", 19.043, 73.069, "retail"),
    TestLocation("Mumbai BKC", 19.0596, 72.8656, "office"),
    TestLocation("Thane West", 19.2183, 72.978, "hospital"),
    TestLocation("Phoenix AZ outskirts", 33.6, -112.27, "retail"),
    TestLocation("Amazon Rainforest (negative test)", -3.4653, -62.2159, "retail"),
]


# ---------------------------------------------------------------------------
# Esri satellite fetch
# ---------------------------------------------------------------------------


def fetch_satellite_image(lat: float, lng: float, size: int = 800):
    from PIL import Image

    delta = 0.005
    bbox = f"{lng - delta},{lat - delta},{lng + delta},{lat + delta}"
    url = (
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
        f"?bbox={bbox}&bboxSR=4326&imageSR=4326&size={size},{size}&format=png&f=image"
    )
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    return Image.open(BytesIO(resp.content)).convert("RGB")


# ---------------------------------------------------------------------------
# Overpass land use context
# ---------------------------------------------------------------------------

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]


def overpass_query(query: str) -> dict[str, Any]:
    last_err: Exception | None = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            resp = requests.post(
                endpoint,
                data={"data": query},
                timeout=30,
            )
            if resp.status_code != 200:
                last_err = RuntimeError(f"{endpoint}: HTTP {resp.status_code}")
                continue
            text = resp.text.strip()
            if not text.startswith("{"):
                last_err = RuntimeError(f"{endpoint}: non-JSON response")
                continue
            return json.loads(text)
        except Exception as exc:
            last_err = exc
    raise RuntimeError(f"All Overpass endpoints failed: {last_err}")


def fetch_land_use(lat: float, lng: float, radius: int = 800) -> dict[str, Any]:
    query = f"""
[out:json][timeout:25];
(
  way["natural"="water"](around:{radius},{lat},{lng});
  way["landuse"~"forest|military|cemetery|residential|commercial|industrial|retail|construction|farmland"](around:{radius},{lat},{lng});
  way["building"](around:{radius},{lat},{lng});
);
out tags center;
"""
    data = overpass_query(query)
    elements = data.get("elements", [])

    water_bodies: list[str] = []
    forests: list[str] = []
    military: list[str] = []
    landuses: list[str] = []
    building_count = 0

    for el in elements:
        tags = el.get("tags", {}) or {}
        name = tags.get("name") or tags.get("waterway") or tags.get("natural") or tags.get("landuse") or "Unnamed"
        if tags.get("building"):
            building_count += 1
            continue
        if tags.get("natural") == "water" or tags.get("waterway"):
            water_bodies.append(name)
        elif tags.get("natural") == "wood" or tags.get("landuse") == "forest":
            forests.append(name)
        elif tags.get("landuse") == "military":
            military.append(name)
        elif tags.get("landuse"):
            landuses.append(tags["landuse"])

    def dedupe(items: list[str]) -> list[str]:
        seen: list[str] = []
        for item in items:
            if item not in seen:
                seen.append(item)
        return seen

    return {
        "water_bodies": dedupe(water_bodies),
        "forests": dedupe(forests),
        "military": dedupe(military),
        "landuses": dedupe(landuses),
        "building_count": building_count,
    }


def reverse_geocode(lat: float, lng: float) -> str:
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"format": "json", "lat": lat, "lon": lng, "zoom": 14},
            headers={"User-Agent": "PlotPal-AI/1.0"},
            timeout=15,
        )
        if resp.status_code != 200:
            return f"{lat:.4f}, {lng:.4f}"
        return resp.json().get("display_name", f"{lat:.4f}, {lng:.4f}")
    except Exception:
        return f"{lat:.4f}, {lng:.4f}"


def build_context_summary(land_use: dict[str, Any], address: str) -> str:
    lines = [f"Area: {address}"]
    if land_use["water_bodies"]:
        lines.append(f"Water bodies in area: {', '.join(land_use['water_bodies'][:5])}")
    else:
        lines.append("Water bodies in area: NONE detected")
    if land_use["forests"]:
        lines.append(f"Forests/woods in area: {', '.join(land_use['forests'][:5])}")
    else:
        lines.append("Forests/woods in area: NONE detected")
    if land_use["landuses"]:
        lines.append(f"Land use types present: {', '.join(land_use['landuses'][:8])}")
    lines.append(
        f"Approximate building density: {land_use['building_count']} buildings within search radius"
    )
    blockers: list[str] = []
    if land_use["water_bodies"]:
        blockers.extend(land_use["water_bodies"][:3])
    if land_use["military"]:
        blockers.extend(land_use["military"][:2])
    if blockers:
        lines.append(f"\nAvoid suggesting locations directly inside these: {', '.join(blockers)}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Production prompt construction (must match qwenVL.ts exactly)
# ---------------------------------------------------------------------------

BUILDING_DESCRIPTIONS = {
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

SYSTEM_PROMPT = (
    "You are an expert urban planner analyzing satellite imagery to identify "
    "vacant or underutilized spaces suitable for infrastructure development. "
    "You return strict JSON in the requested schema."
)


def build_user_prompt(
    building_type: str,
    address: str,
    lat: float,
    lng: float,
    context_summary: str,
) -> str:
    description = BUILDING_DESCRIPTIONS.get(building_type, building_type)
    return (
        f"You are an expert urban planner analyzing satellite imagery to identify "
        f"vacant or underutilized spaces suitable for building {description}.\n\n"
        f"Location: {address}\n"
        f"Map Center: {lat:.6f}, {lng:.6f}\n"
        f"Building Type: {building_type}\n\n"
        f"== AREA CONTEXT (from OpenStreetMap) ==\n{context_summary}\n\n"
        "== WHAT TO LOOK FOR ==\n"
        "Identify 2-4 spaces in the satellite image that appear suitable for development.\n\n"
        "== WHAT TO AVOID ==\n"
        "Do NOT suggest locations directly inside water, military zones, or occupied residences.\n\n"
        "Return ONLY valid JSON with vacantSpaces array, analysis string, and confidence."
    )


# ---------------------------------------------------------------------------
# Model loading + generation
# ---------------------------------------------------------------------------


def load_model(adapter_path: str, base_model: str = "Qwen/Qwen3-VL-2B-Instruct"):
    """Load Qwen3-VL-2B with the LoRA adapter applied."""
    try:
        from unsloth import FastVisionModel
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "Unsloth not installed. Run: pip install unsloth"
        ) from exc

    print(f"Loading base model {base_model} (4-bit)...")
    model, tokenizer = FastVisionModel.from_pretrained(
        base_model,
        load_in_4bit=True,
    )

    if adapter_path:
        print(f"Loading LoRA adapter from {adapter_path}...")
        from peft import PeftModel

        model = PeftModel.from_pretrained(model, adapter_path)

    FastVisionModel.for_inference(model)
    return model, tokenizer


def generate(model, tokenizer, image, system_text: str, user_text: str, max_tokens: int = 1024) -> str:
    import torch

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
    input_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(image, input_text, add_special_tokens=False, return_tensors="pt").to("cuda")
    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=0.2,
            do_sample=True,
            use_cache=True,
        )
    generated_ids = out[:, inputs["input_ids"].shape[1] :]
    return tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def parse_and_validate(text: str) -> dict[str, Any]:
    """Extract first JSON object and verify the production schema."""
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return {"_error": "no JSON in output", "_raw": text[:200]}

    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        return {"_error": f"json decode failed: {exc}", "_raw": match.group(0)[:200]}

    issues: list[str] = []
    if "vacantSpaces" not in data or not isinstance(data["vacantSpaces"], list):
        issues.append("missing/invalid vacantSpaces array")
    else:
        for i, space in enumerate(data["vacantSpaces"]):
            if not isinstance(space, dict):
                issues.append(f"space[{i}] not a dict")
                continue
            for required in ("location", "coordinates", "suitability", "reasons", "considerations", "description"):
                if required not in space:
                    issues.append(f"space[{i}] missing {required}")
            coords = space.get("coordinates", {})
            if not isinstance(coords, dict) or "lat" not in coords or "lng" not in coords:
                issues.append(f"space[{i}] invalid coordinates")

    data["_schema_issues"] = issues
    return data


# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------


def run_test(model, tokenizer, location: TestLocation) -> dict[str, Any]:
    print(f"\n{'=' * 60}")
    print(f"TEST: {location.name}")
    print(f"Coordinates: {location.lat}, {location.lng}")
    print(f"Building: {location.building_type}")
    print(f"{'=' * 60}\n")

    print("[1] Fetching Esri satellite image...")
    image = fetch_satellite_image(location.lat, location.lng)
    print(f"    Image size: {image.size}")

    print("\n[2] Fetching Overpass land use + reverse geocode...")
    land_use = fetch_land_use(location.lat, location.lng)
    address = reverse_geocode(location.lat, location.lng)
    summary = build_context_summary(land_use, address)
    print(f"    Address: {address}")
    print(f"    Water bodies: {len(land_use['water_bodies'])}")
    print(f"    Buildings: {land_use['building_count']}")
    print("    Summary sent to model:")
    for line in summary.split("\n"):
        print(f"      {line}")

    print("\n[3] Building production prompt...")
    user_prompt = build_user_prompt(
        location.building_type,
        address,
        location.lat,
        location.lng,
        summary,
    )

    print("\n[4] Generating with fine-tuned model...")
    raw_output = generate(model, tokenizer, image, SYSTEM_PROMPT, user_prompt)
    print(f"    Raw output length: {len(raw_output)} chars")
    print(f"    First 300 chars:\n      {raw_output[:300]}")

    print("\n[5] Parsing + validating JSON schema...")
    parsed = parse_and_validate(raw_output)
    if "_error" in parsed:
        print(f"    PARSE ERROR: {parsed['_error']}")
        print(f"    Raw: {parsed.get('_raw', '')}")
        return {"location": location.name, "ok": False, "error": parsed["_error"]}

    n_spaces = len(parsed.get("vacantSpaces", []))
    issues = parsed.pop("_schema_issues", [])
    print(f"    Parsed {n_spaces} vacant spaces")
    if issues:
        print(f"    Schema issues: {issues}")

    for i, space in enumerate(parsed.get("vacantSpaces", [])):
        coords = space.get("coordinates", {})
        print(
            f"      [{i + 1}] {space.get('location', '?')[:60]} @ "
            f"({coords.get('lat', '?')}, {coords.get('lng', '?')}) "
            f"suitability={space.get('suitability', '?')}"
        )

    return {
        "location": location.name,
        "ok": True,
        "n_spaces": n_spaces,
        "schema_issues": issues,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Test the fine-tuned PlotPal VLM end-to-end.")
    parser.add_argument("--adapter", required=True, help="Path to LoRA adapter directory.")
    parser.add_argument(
        "--base-model",
        default="Qwen/Qwen3-VL-2B-Instruct",
        help="HuggingFace base model id.",
    )
    parser.add_argument(
        "--location",
        default="",
        help="Substring filter (e.g. 'kharghar') to test only matching locations.",
    )
    args = parser.parse_args()

    locations = TEST_LOCATIONS
    if args.location:
        substr = args.location.lower()
        locations = [loc for loc in TEST_LOCATIONS if substr in loc.name.lower()]
        if not locations:
            print(f"No location matched '{args.location}'", file=sys.stderr)
            sys.exit(1)

    model, tokenizer = load_model(args.adapter, args.base_model)

    summary_rows: list[dict[str, Any]] = []
    for location in locations:
        try:
            summary_rows.append(run_test(model, tokenizer, location))
        except Exception as exc:  # pragma: no cover
            print(f"FAILED: {location.name}: {exc}")
            summary_rows.append({"location": location.name, "ok": False, "error": str(exc)})

    print("\n\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for row in summary_rows:
        if row["ok"]:
            issues = f" issues={len(row['schema_issues'])}" if row["schema_issues"] else ""
            print(f"  {row['location']}: spaces={row['n_spaces']}{issues}")
        else:
            print(f"  {row['location']}: FAILED ({row.get('error', '?')})")


if __name__ == "__main__":
    main()
