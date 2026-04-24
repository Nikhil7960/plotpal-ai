"""
Standalone test harness for colab_finetune_v3.py SNIPPETS 4 and 5.

This script re-implements the non-GPU parts of the Colab notebook so we can
verify the code works before spending GPU time on Colab. It does NOT:
  - Install Unsloth / torch / bitsandbytes
  - Load the Qwen3-VL-2B model
  - Run training

It DOES:
  - Simulate Colab's upload by zipping a slice of finetune-data/
  - Extract the zip to a temp dir (like Colab does)
  - Run SNIPPET 4's path detection logic
  - Run SNIPPET 5's build_dataset logic
  - Validate the output structure matches what Unsloth expects
  - Report errors with line-level detail

Run from research/ directory:
    python finetune/test_colab_snippets.py
    python finetune/test_colab_snippets.py --limit 10   # test only 10 conversations
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
import traceback
import zipfile
from pathlib import Path
from typing import Any

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow not installed. Run: pip install pillow")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
RESEARCH_DIR = SCRIPT_DIR.parent
FINETUNE_DATA_DIR = RESEARCH_DIR / "output" / "finetune-data"


# ---------------------------------------------------------------------------
# Assertion helpers with nice output
# ---------------------------------------------------------------------------

PASS = 0
FAIL = 0


def check(name: str, condition: bool, detail: str = "") -> bool:
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [OK]  {name}")
        return True
    FAIL += 1
    print(f"  [FAIL] {name}")
    if detail:
        print(f"         {detail}")
    return False


def section(title: str) -> None:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


# ---------------------------------------------------------------------------
# Simulate Colab upload: zip finetune-data, copy to a temp dir, extract
# ---------------------------------------------------------------------------


def simulate_colab_upload(subset_limit: int | None) -> Path:
    """Zip a subset of finetune-data and extract it to simulate Colab upload."""
    section("[SNIPPET 4 — simulated upload] zipping + extracting")

    if not FINETUNE_DATA_DIR.exists():
        print(f"ERROR: {FINETUNE_DATA_DIR} does not exist. "
              f"Run prepare_mumbai_dataset.py first.")
        sys.exit(1)

    conv_src = FINETUNE_DATA_DIR / "conversations.json"
    images_src = FINETUNE_DATA_DIR / "images"
    meta_src = FINETUNE_DATA_DIR / "metadata.json"

    check("conversations.json exists in source", conv_src.exists())
    check("images/ exists in source", images_src.exists())
    check("metadata.json exists in source", meta_src.exists())

    with open(conv_src, encoding="utf-8") as f:
        all_conversations = json.load(f)
    print(f"  Source has {len(all_conversations)} conversations")

    # Optionally slice down for a fast test run
    if subset_limit is not None and subset_limit < len(all_conversations):
        all_conversations = all_conversations[:subset_limit]
        print(f"  Subset limited to {len(all_conversations)} conversations")

    # Figure out which images we actually need
    needed_images = {c["image"] for c in all_conversations if "image" in c}
    print(f"  Needed images: {len(needed_images)}")

    # Build the zip in a temp location
    tmp = Path(tempfile.mkdtemp(prefix="plotpal_colab_test_"))
    staging = tmp / "finetune-data"
    (staging / "images").mkdir(parents=True, exist_ok=True)

    with open(staging / "conversations.json", "w", encoding="utf-8") as f:
        json.dump(all_conversations, f, indent=2, ensure_ascii=False)
    if meta_src.exists():
        shutil.copy2(meta_src, staging / "metadata.json")

    copied_images = 0
    missing_images = 0
    for img_name in sorted(needed_images):
        src = images_src / img_name
        if not src.exists():
            missing_images += 1
            continue
        shutil.copy2(src, staging / "images" / img_name)
        copied_images += 1

    check("all referenced images copied",
          missing_images == 0,
          f"{missing_images} referenced but missing on disk")
    print(f"  Copied {copied_images} images to staging")

    zip_path = tmp / "finetune-data.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in staging.rglob("*"):
            if p.is_file():
                zf.write(p, arcname=p.relative_to(staging.parent))

    zip_mb = zip_path.stat().st_size / 1024**2
    print(f"  Created zip: {zip_path} ({zip_mb:.1f} MB)")
    check("zip file > 0 bytes", zip_path.stat().st_size > 0)

    # Extract like Colab does
    extract_dir = tmp / "content" / "finetune-data"
    extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(extract_dir)

    return extract_dir


# ---------------------------------------------------------------------------
# SNIPPET 4 — path detection logic (copy from colab_finetune_v3.py)
# ---------------------------------------------------------------------------


def snippet4_locate_data(data_root: Path) -> tuple[Path, Path, Path | None]:
    """Mirrors the path detection block in SNIPPET 4."""
    section("[SNIPPET 4] path detection")

    # Handle nested extraction (finetune-data/finetune-data/...)
    resolved_root = data_root
    for candidate in [
        data_root / "conversations.json",
        data_root / "finetune-data" / "conversations.json",
    ]:
        if candidate.exists():
            resolved_root = candidate.parent
            break

    conv_path = resolved_root / "conversations.json"
    img_dir = resolved_root / "images"
    meta_path = resolved_root / "metadata.json"

    print(f"  DATA_ROOT:  {resolved_root}")
    print(f"  CONV_PATH:  {conv_path}")
    print(f"  IMG_DIR:    {img_dir}")
    print(f"  META_PATH:  {meta_path}")

    check("conversations.json resolved", conv_path.exists())
    check("images/ dir resolved", img_dir.exists())

    if meta_path.exists():
        with open(meta_path) as f:
            meta = json.load(f)
        print(f"  Schema version: {meta.get('schema_version', 'unknown')}")
        print(
            f"  Building types: {meta.get('building_types', [])[:5]}"
            f"{'...' if len(meta.get('building_types', [])) > 5 else ''}"
        )
        check("metadata has schema_version field", "schema_version" in meta)

    with open(conv_path) as f:
        raw_conversations = json.load(f)
    check("loaded > 0 conversations", len(raw_conversations) > 0,
          f"got {len(raw_conversations)}")

    n_images = len(list(img_dir.glob("*.png")))
    print(f"  Loaded {len(raw_conversations)} conversations, {n_images} images")
    check("found PNG images", n_images > 0)

    return conv_path, img_dir, meta_path if meta_path.exists() else None


# ---------------------------------------------------------------------------
# SNIPPET 5 — build_dataset logic (copy from colab_finetune_v3.py)
# ---------------------------------------------------------------------------


def snippet5_build_dataset(conv_path: Path, img_dir: Path) -> list[dict[str, Any]]:
    """Mirrors SNIPPET 5's build_dataset function with extra logging."""
    section("[SNIPPET 5] build_dataset")

    with open(conv_path, encoding="utf-8") as f:
        conversations = json.load(f)

    dataset: list[dict[str, Any]] = []
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

        # Normalise content field — old data uses plain strings, new data uses
        # a list of dicts. The colab build_dataset expects plain strings at
        # this stage since it wraps them in the Unsloth format itself.
        def _flatten(content: Any) -> str:
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                parts = []
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        parts.append(item.get("text", ""))
                return "\n".join(parts)
            return str(content)

        system_text = _flatten(messages[0].get("content", ""))
        user_text = _flatten(messages[1].get("content", ""))
        assistant_text = _flatten(messages[2].get("content", ""))

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

    print(f"  Built {len(dataset)} samples")
    print(f"  Skipped (no image file):  {skipped_no_image}")
    print(f"  Skipped (bad image file): {skipped_bad_image}")
    print(f"  Skipped (bad messages):   {skipped_bad_messages}")

    check("built at least one sample", len(dataset) > 0)
    check(
        "no silent data loss",
        skipped_no_image + skipped_bad_image + skipped_bad_messages == 0,
        f"{skipped_no_image + skipped_bad_image + skipped_bad_messages} skipped",
    )
    return dataset


# ---------------------------------------------------------------------------
# Structural validation of the built dataset
# ---------------------------------------------------------------------------


def validate_dataset_structure(dataset: list[dict[str, Any]]) -> None:
    section("[validation] Unsloth/TRL conversation format")

    if not dataset:
        check("dataset non-empty", False)
        return

    sample = dataset[0]
    check("sample has 'messages' key", "messages" in sample)
    check("messages is a list", isinstance(sample.get("messages"), list))
    check("messages has 3 roles", len(sample.get("messages", [])) == 3)

    roles = [m.get("role") for m in sample["messages"]]
    check("roles are [system, user, assistant]",
          roles == ["system", "user", "assistant"],
          f"got {roles}")

    # Each content must be a list of dicts
    for i, m in enumerate(sample["messages"]):
        content = m.get("content")
        check(f"messages[{i}] content is a list",
              isinstance(content, list),
              f"type was {type(content).__name__}")
        for j, item in enumerate(content or []):
            check(
                f"messages[{i}].content[{j}] is a dict",
                isinstance(item, dict),
            )
            check(
                f"messages[{i}].content[{j}] has 'type' key",
                isinstance(item, dict) and "type" in item,
            )

    # User message should have an image
    user_content = sample["messages"][1]["content"]
    has_image = any(item.get("type") == "image" for item in user_content)
    has_text = any(item.get("type") == "text" for item in user_content)
    check("user content has image", has_image)
    check("user content has text", has_text)

    # The image must be a PIL Image object (what Unsloth expects)
    image_item = next(
        (item for item in user_content if item.get("type") == "image"), None
    )
    if image_item is not None:
        image_obj = image_item.get("image")
        check(
            "image is a PIL Image object",
            isinstance(image_obj, Image.Image),
            f"got {type(image_obj).__name__}",
        )
        if isinstance(image_obj, Image.Image):
            check("image mode is RGB", image_obj.mode == "RGB")
            print(f"  Image size: {image_obj.size}")

    # Assistant response should be JSON-parseable for "full_analysis" samples
    # (not all samples — VQA count/detail samples are free text)
    json_parsable = 0
    total = min(20, len(dataset))
    for i in range(total):
        assistant_text = dataset[i]["messages"][2]["content"][0]["text"]
        try:
            json.loads(assistant_text)
            json_parsable += 1
        except (json.JSONDecodeError, TypeError):
            pass
    print(f"  JSON-parseable assistant responses: {json_parsable}/{total}")
    check(
        "at least some samples have JSON assistant responses",
        json_parsable > 0,
        "no JSON training targets were found",
    )

    # Sample splitting (what SNIPPET 5 does at the end)
    import random
    random.seed(42)
    data_copy = list(dataset)
    random.shuffle(data_copy)
    split_idx = int(len(data_copy) * 0.9)
    train_split = data_copy[:split_idx]
    eval_split = data_copy[split_idx:]
    print(f"  90/10 split -> train={len(train_split)} eval={len(eval_split)}")
    check("train split non-empty", len(train_split) > 0)
    check("eval split non-empty", len(eval_split) > 0)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Test colab_finetune_v3.py snippets without GPU/Unsloth"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only use the first N conversations (for fast runs).",
    )
    args = parser.parse_args()

    try:
        data_root = simulate_colab_upload(args.limit)
        conv_path, img_dir, _ = snippet4_locate_data(data_root)
        dataset = snippet5_build_dataset(conv_path, img_dir)
        validate_dataset_structure(dataset)
    except Exception:
        traceback.print_exc()
        return 1

    section("SUMMARY")
    total = PASS + FAIL
    print(f"  PASSED: {PASS}/{total}")
    print(f"  FAILED: {FAIL}/{total}")
    if FAIL:
        print("\n  Some checks failed — inspect the output above.")
        return 1
    print("\n  All checks passed. The colab snippets should run cleanly on Colab.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
