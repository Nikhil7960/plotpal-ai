# Datasets for Fine-Tuning a Vision Language Model for Urban Vacant Land Detection

## Research Date: March 20, 2026

---

## 1. INSTRUCTION-TUNING DATASETS FOR GEOSPATIAL VLMs (Highest Priority)

These are the most directly useful for fine-tuning a VLM, as they already contain instruction-formatted image-text pairs for remote sensing.

### 1.1 GeoChat_Instruct
- **Source**: https://huggingface.co/datasets/MBZUAI/GeoChat_Instruct
- **Size**: 263 MB JSON, 318k instruction pairs
- **Format**: Multimodal instruction-following data (conversations, VQA, captioning, grounding)
- **Samples**: 318,000 instruction pairs
- **Satellite/Aerial**: Yes - sourced from LRBEN, NWPU_captions, DOTA, DIOR, FAIR1M
- **Tasks**: Referring expression detection, image/region captioning, scene classification, VQA, visually grounded conversations
- **Vacant Land Relevance**: Includes scene classification categories; can be extended with vacant land classes
- **License**: Research use (CVPR 2024 paper)
- **Model**: MBZUAI/geochat-7B available on Hugging Face (fine-tuned LLaVA-v1.5)
- **Notes**: First grounded VLM for remote sensing. Excellent starting point for further fine-tuning.

### 1.2 SkyEye-968k
- **Source**: https://huggingface.co/datasets/ZhanYang-nwpu/SkyEye-968k
- **Size**: 968k samples
- **Format**: Single-task image-text instruction + multi-task conversation instruction
- **Samples**: 968,000
- **Satellite/Aerial**: Yes - incorporates RSICD, RSITMD, UCM-Captions, Sydney-Captions, NWPU-Captions
- **Tasks**: Image captioning, VQA, visual grounding, scene classification
- **Vacant Land Relevance**: Covers diverse RS scene types including barren/open areas
- **License**: Research use (ISPRS 2025)
- **Notes**: Human-verified quality. Task-specific identifiers for different RS tasks.

### 1.3 FIT-RS (SkySenseGPT)
- **Source**: https://huggingface.co/datasets/ll-13/FIT-RS
- **Size**: 1,800,851 instruction samples (1,415k for training)
- **Format**: Fine-grained instruction tuning (VQA, text generation, relation reasoning, scene graph generation)
- **Samples**: ~1.8M
- **Satellite/Aerial**: Yes
- **Tasks**: VQA, captioning, relation reasoning, scene graph generation
- **Vacant Land Relevance**: Fine-grained object-level understanding useful for identifying vacant parcels
- **License**: CC-BY-NC-4.0
- **Notes**: Largest RS instruction-tuning dataset. Focuses on fine-grained semantic relationships.

### 1.4 MMRS-1M (EarthGPT)
- **Source**: https://github.com/wivizhang/EarthGPT
- **Size**: 1M+ image-text pairs from 34 RS datasets
- **Format**: Instruction tuning data (multi-sensor: optical, SAR, infrared)
- **Samples**: >1,000,000
- **Satellite/Aerial**: Yes - multi-sensor (optical, SAR, infrared)
- **Tasks**: Scene classification, captioning, VQA, visual grounding, object detection
- **Vacant Land Relevance**: Covers land use classification categories
- **License**: Research use
- **Notes**: Partially released as of 2024. Multi-sensor fusion capability is unique.

### 1.5 LHRS-Align + LHRS-Instruct
- **Source**: https://github.com/NJU-LHRS/LHRS-Bot
- **Size**: LHRS-Align: ~1.15M image-caption pairs; LHRS-Instruct: 15K complex instruction samples
- **Format**: Image-caption pairs (Align) + complex reasoning instructions (Instruct)
- **Samples**: ~1.15M (Align) + 15K (Instruct)
- **Satellite/Aerial**: Yes - globally sourced RS images with VGI metadata
- **Tasks**: Scene understanding, object location, visual reasoning
- **Vacant Land Relevance**: Uses OSM bounding boxes for objects; includes land use categories
- **License**: Research use (ECCV 2024)
- **Notes**: VGI-enhanced with OSM data. GPT-4 generated complex reasoning data.

---

## 2. REMOTE SENSING VQA DATASETS

### 2.1 RSVQA-LR (Low Resolution)
- **Source**: https://rsvqa.sylvainlobry.com/ (Zenodo download)
- **Size**: 77,232 QA pairs
- **Format**: Image/question/answer triplets
- **Samples**: 77,232 questions over 772 Sentinel-2 images (512x512 px)
- **Satellite/Aerial**: Yes - Sentinel-2 satellite imagery
- **Tasks**: VQA about land cover, object presence, spatial relations
- **Vacant Land Relevance**: Questions about land cover types derived from OSM
- **License**: Research use

### 2.2 RSVQA-HR (High Resolution)
- **Source**: https://rsvqa.sylvainlobry.com/ (Zenodo download)
- **Size**: 1,066,316 QA pairs
- **Format**: Image/question/answer triplets
- **Samples**: 1,066,316 questions over 10,659 aerial images (15.24cm resolution)
- **Satellite/Aerial**: Yes - USGS high-resolution orthoimagery
- **Tasks**: VQA about objects, counting, presence, comparison
- **Vacant Land Relevance**: Questions about land use and building presence
- **License**: Research use

### 2.3 RSVQAxBEN
- **Source**: https://rsvqa.sylvainlobry.com/ (Zenodo download)
- **Size**: 14M+ QA pairs
- **Format**: Image/question/answer triplets derived from BigEarthNet
- **Samples**: >14,000,000 QA triplets
- **Satellite/Aerial**: Yes - Sentinel-2 imagery
- **Tasks**: VQA focused on land cover classification
- **Vacant Land Relevance**: Land cover questions including barren/open categories from CORINE
- **License**: Research use (IGARSS 2021)
- **Notes**: Largest RS VQA dataset. Combines RSVQA methodology with BigEarthNet.

### 2.4 FloodNet VQA
- **Source**: https://github.com/BinaLab/FloodNet-VQA
- **Size**: ~11,000 QA pairs, 3,200 images
- **Format**: VQA + classification + semantic segmentation
- **Samples**: ~11,000 QA pairs
- **Satellite/Aerial**: Yes - UAV (DJI Mavic Pro) post-Hurricane Harvey
- **Tasks**: Damage assessment VQA, classification, segmentation
- **Vacant Land Relevance**: Post-disaster land assessment; debris/rubble detection relevant to vacant land
- **License**: Research use

### 2.5 Remote-Sensing-VQA (WaltonFuture)
- **Source**: https://huggingface.co/datasets/WaltonFuture/remote-sensing-VQA
- **Size**: 17,100 samples (16,100 train / 1,000 test)
- **Format**: Image + question + answer (classification VQA)
- **Samples**: 17,100
- **Satellite/Aerial**: Yes
- **Tasks**: Scene classification via VQA
- **Vacant Land Relevance**: Includes "bare land", "farmland", "meadow", "park" classes
- **License**: Not specified
- **Notes**: Ready-to-use Parquet format on HuggingFace. 40+ classes including bare land.

---

## 3. IMAGE CAPTIONING DATASETS FOR REMOTE SENSING

### 3.1 RSICD (Remote Sensing Image Captioning Dataset)
- **Source**: https://github.com/201528014227051/RSICD_optimal
- **Size**: 10,921 images, each with 5 captions
- **Format**: Image-caption pairs
- **Samples**: 10,921 images / 54,605 captions
- **Satellite/Aerial**: Yes - Google Earth, Baidu Map, MapABC, Tianditu
- **Image Size**: 224x224 pixels
- **Tasks**: Image captioning, image-text retrieval
- **Vacant Land Relevance**: Includes scenes like "bare land", "open space", "parking lot", "sparse residential"
- **License**: Research use
- **Notes**: Most widely used RS captioning dataset. Available on HuggingFace via CLIP-RSICD.

### 3.2 RSITMD (Remote Sensing Image-Text Match Dataset)
- **Source**: Subset of RSICD with richer captions
- **Size**: 4,743 images, 23,715 captions
- **Format**: Image-caption pairs with 1-5 keywords per image
- **Samples**: 4,743 images / 23,715 captions
- **Satellite/Aerial**: Yes
- **Tasks**: Cross-modal retrieval, captioning
- **Vacant Land Relevance**: Fine-grained object-level descriptions of land use
- **License**: Research use

---

## 4. SCENE CLASSIFICATION DATASETS

### 4.1 NWPU-RESISC45
- **Source**: Northwestern Polytechnical University (request-based)
- **Size**: 31,500 images
- **Format**: Classification labels (45 classes, 700 images each)
- **Samples**: 31,500
- **Satellite/Aerial**: Yes - Google Earth imagery
- **Image Size**: 256x256 pixels
- **Vacant Land Relevance**: Classes include "desert", "meadow", "sparse residential", "wetland", "ground track field" - relevant to open/vacant land
- **License**: Research use (request required)

### 4.2 UCMerced Land Use
- **Source**: http://weegee.vision.ucmerced.edu/datasets/landuse.html
- **Size**: 2,100 images
- **Format**: Classification labels (21 classes, 100 images each)
- **Samples**: 2,100
- **Satellite/Aerial**: Yes - USGS National Map Urban Area Imagery
- **Image Size**: 256x256 pixels (1 foot/pixel)
- **Vacant Land Relevance**: Classes: "chaparral", "sparse residential", "mobile home park" - partially relevant
- **License**: Public domain (USGS imagery)

### 4.3 AID (Aerial Image Dataset)
- **Source**: https://huggingface.co/datasets/blanchon/AID
- **Size**: 10,000 images
- **Format**: Classification labels (30 classes, 220-420 images each)
- **Samples**: 10,000
- **Satellite/Aerial**: Yes - Google Earth
- **Image Size**: 600x600 pixels
- **Vacant Land Relevance**: Classes include "bare land", "desert", "park", "meadow", "sparse residential"
- **License**: Research use
- **Notes**: Available on Hugging Face.

### 4.4 PatternNet
- **Source**: https://huggingface.co/datasets/blanchon/PatternNet
- **Size**: 30,400 images
- **Format**: Classification labels (38 classes, 800 images each)
- **Samples**: 30,400
- **Satellite/Aerial**: Yes - Google Earth / Google Maps API
- **Image Size**: 256x256 pixels
- **Vacant Land Relevance**: Limited direct relevance but includes "sparse residential", "christmas tree farm" (open land)
- **License**: Research use
- **Notes**: Available on Hugging Face.

### 4.5 EuroSAT
- **Source**: https://huggingface.co/datasets/blanchon/EuroSAT_RGB
- **Size**: 27,000 images
- **Format**: Classification labels (10 classes)
- **Samples**: 27,000
- **Satellite/Aerial**: Yes - Sentinel-2 (13 spectral bands available)
- **Image Size**: 64x64 pixels
- **Classes**: Annual Crop, Forest, Herbaceous Vegetation, Highway, Industrial, Pasture, Permanent Crop, Residential, River, SeaLake
- **Vacant Land Relevance**: "Herbaceous Vegetation" and "Pasture" can indicate open/undeveloped land
- **License**: Research use (MIT-like)
- **Notes**: Multiple versions on HuggingFace (RGB, MSI, MS).

### 4.6 fMoW (Functional Map of the World)
- **Source**: https://github.com/fMoW/dataset
- **Size**: ~1M+ images, RGB version ~200GB, full ~3.5TB
- **Format**: Classification with bounding boxes (63 categories), temporal sequences
- **Samples**: >1,000,000 images from 200+ countries
- **Satellite/Aerial**: Yes - DigitalGlobe/Maxar high-resolution satellite imagery
- **Vacant Land Relevance**: Categories include "construction_site", "debris_or_rubble", "impoverished_settlement", "crop_field", "park" - several relevant to vacant/undeveloped land
- **License**: Research use (IARPA-sponsored)
- **Notes**: Temporal sequences enable change detection for land abandonment.

### 4.7 SATIN (SATellite ImageNet)
- **Source**: https://huggingface.co/datasets/jonathan-roberts1/SATIN
- **Size**: Meta-dataset of 27 RS datasets
- **Format**: Classification (6 task types, 250+ class labels)
- **Samples**: Aggregation of 27 datasets
- **Satellite/Aerial**: Yes - globally distributed, multi-resolution
- **Tasks**: Land Cover, Land Use, Hierarchical Land Use, Complex Scenes, Rare Scenes, False Colour
- **Vacant Land Relevance**: 250+ classes span many land cover types including barren/vacant categories
- **License**: Varies by constituent dataset
- **Notes**: Excellent for zero-shot VLM evaluation on RS imagery.

---

## 5. SEMANTIC SEGMENTATION / LAND COVER DATASETS

### 5.1 LoveDA
- **Source**: https://github.com/Junjue-Wang/LoveDA | https://zenodo.org/records/5706578
- **Size**: 5,987 images, 166,768 annotated objects
- **Format**: Semantic segmentation masks (7 classes)
- **Samples**: 5,987 images
- **Satellite/Aerial**: Yes - high spatial resolution (0.3m GSD)
- **Classes**: Background, Building, Road, Water, **Barren**, Forest, Agriculture
- **Vacant Land Relevance**: **HIGH** - "Barren" class directly maps to vacant/undeveloped land. Urban + rural domains.
- **License**: Research use (NeurIPS 2021)
- **Notes**: Domain adaptation between urban and rural. "Barren" class is highly relevant.

### 5.2 DeepGlobe Land Cover Classification
- **Source**: https://www.kaggle.com/datasets/balraj98/deepglobe-land-cover-classification-dataset
- **Size**: 1,146 images (2448x2448 px each)
- **Format**: Semantic segmentation masks (7 classes)
- **Samples**: 1,146
- **Satellite/Aerial**: Yes - DigitalGlobe Vivid+ (50cm resolution)
- **Classes**: Urban Land, Agriculture Land, Rangeland, Forest Land, Water, **Barren Land**, Unknown
- **Vacant Land Relevance**: **HIGH** - "Barren Land" and "Rangeland" directly relevant to vacant land detection
- **License**: Research use (CVPR 2018 challenge)

### 5.3 BigEarthNet (v2.0)
- **Source**: https://bigearth.net/ | https://huggingface.co/datasets/GFM-Bench/BigEarthNet
- **Size**: 549,488 image pairs (Sentinel-1 + Sentinel-2)
- **Format**: Multi-label classification (19 or 43 classes, CORINE Land Cover)
- **Samples**: 549,488
- **Satellite/Aerial**: Yes - Sentinel-1 (SAR) + Sentinel-2 (optical)
- **Vacant Land Relevance**: CORINE labels include "bare rock", "sparsely vegetated areas", "burnt areas", "mineral extraction sites", "construction sites", "land principally occupied by agriculture with significant areas of natural vegetation"
- **License**: Community Data License Agreement - Permissive, Version 1.0
- **Notes**: One of the largest RS benchmarks. Multi-label enables nuanced land cover understanding.

### 5.4 SEN12MS
- **Source**: https://mediatum.ub.tum.de/1474000 | https://github.com/schmitt-muc/SEN12MS
- **Size**: 180,662 patch triplets
- **Format**: Multi-spectral imagery triplets (Sentinel-1 SAR + Sentinel-2 optical + MODIS land cover)
- **Samples**: 180,662
- **Satellite/Aerial**: Yes - Sentinel-1, Sentinel-2, MODIS
- **IGBP Classes**: 17 land cover classes including "barren or sparsely vegetated", "urban and built-up", "croplands", "grasslands"
- **Vacant Land Relevance**: "Barren or sparsely vegetated" IGBP class is directly relevant
- **License**: Research use
- **Notes**: All inhabited continents, all seasons. 10m GSD.

---

## 6. LARGE-SCALE VISION-LANGUAGE DATASETS

### 6.1 RS5M
- **Source**: https://huggingface.co/datasets/Zilun/RS5M | https://github.com/om-ai-lab/RS5M
- **Size**: 5 million image-text pairs
- **Format**: Image-caption pairs (filtered from public datasets + BLIP2-generated captions)
- **Samples**: 5,000,000
- **Satellite/Aerial**: Yes
- **Tasks**: Pre-training VLMs (CLIP-style)
- **Vacant Land Relevance**: Broad coverage of RS scenes including land use categories
- **License**: Research use (IEEE TGRS)
- **Notes**: Largest RS image-text dataset. Used to train GeoRSCLIP. Essential for pre-training.

### 6.2 SatlasPretrain
- **Source**: https://huggingface.co/allenai/satlas-pretrain
- **Size**: Hundreds of millions of labels
- **Format**: Multi-task (classification, segmentation, detection) with OpenStreetMap labels
- **Satellite/Aerial**: Yes - satellite + aerial
- **Tasks**: Foundation model pre-training
- **Vacant Land Relevance**: OSM-derived labels include diverse land use categories
- **License**: Apache 2.0
- **Notes**: Allen AI. Designed for pre-training foundation models.

---

## 7. DOMAIN-SPECIFIC: URBAN VACANT LAND DETECTION

### 7.1 Urban Vacant Land Dataset (Hangzhou)
- **Source**: https://github.com/SkydustZ/Large-scale-Automatic-Identification-of-Urban-Vacant-Land
- **Additional Source**: https://www.beijingcitylab.com/projects-1/56-urban-vacancies/
- **Size**: 3,096 training patches + 128 evaluation patches
- **Format**: Semantic segmentation (binary: vacant vs. non-vacant)
- **Samples**: ~3,224 patches
- **Satellite/Aerial**: Yes - high-resolution RS imagery (~1.6m resolution)
- **Classes**: 5 UVL categories: Bare Land (BL), Vegetated Wasteland (VW), Land Under Construction (LUD), Derelict Land with Garbage (LWG), Abandoned Mining Land (AM)
- **Vacant Land Relevance**: **HIGHEST** - specifically designed for urban vacant land detection
- **License**: Research use
- **Notes**: The most directly relevant dataset. Binary detection task. Multiple Chinese cities (Shenzhen, Beijing, Liuzhou).

### 7.2 SpaceNet 7 (Multi-Temporal Urban Development)
- **Source**: https://spacenet.ai/datasets/ | https://www.kaggle.com/datasets/amerii/spacenet-7-multitemporal-urban-development
- **Size**: ~40,000 km2 imagery, 11M+ building annotations
- **Format**: Building footprint polygons + temporal satellite mosaics
- **Samples**: 24 monthly images x 100+ geographies
- **Satellite/Aerial**: Yes - 4.0m resolution satellite mosaics
- **Vacant Land Relevance**: Temporal change detection can identify land becoming vacant or being developed. Absence of buildings = vacant land proxy.
- **License**: Open (AWS Public Dataset)
- **Notes**: Multi-temporal aspect is key for detecting land state changes.

---

## 8. FINE-TUNED MODELS ON HUGGING FACE (for reference/starting points)

| Model | Source | Description |
|-------|--------|-------------|
| **MBZUAI/geochat-7B** | https://huggingface.co/MBZUAI/geochat-7B | First grounded VLM for RS (LLaVA-1.5 based) |
| **flax-community/clip-rsicd-v2** | https://huggingface.co/flax-community/clip-rsicd-v2 | CLIP fine-tuned on RSICD |
| **hy1111/CLIP-RS** | https://huggingface.co/hy1111/CLIP-RS | CLIP model for RS |
| **joaodaniel/RS-M-CLIP** | https://huggingface.co/joaodaniel/RS-M-CLIP | Multilingual CLIP for RS |
| **allenai/satlas-pretrain** | https://huggingface.co/allenai/satlas-pretrain | Satlas foundation model |
| **RemoteCLIP** | https://github.com/ChenDelong1999/RemoteCLIP | Vision-language foundation model for RS |
| **GeoRSCLIP** | https://huggingface.co/datasets/Zilun/RS5M | CLIP fine-tuned on RS5M |

---

## 9. RECOMMENDED FINE-TUNING STRATEGY

### Phase 1: Pre-training / Domain Adaptation
Use **RS5M** (5M pairs) or **SatlasPretrain** to adapt a general VLM (e.g., Qwen-VL, LLaVA) to the remote sensing domain.

### Phase 2: Instruction Tuning
Use one or more of:
- **GeoChat_Instruct** (318k) - well-structured, CVPR 2024
- **SkyEye-968k** (968k) - larger, diverse tasks
- **FIT-RS** (1.8M) - largest, fine-grained understanding

### Phase 3: Task-Specific Fine-Tuning for Vacant Land
Combine and adapt:
- **Urban Vacant Land Dataset** (Hangzhou) - most directly relevant, needs VQA conversion
- **LoveDA** - "barren" class segmentation masks, convertible to VQA
- **DeepGlobe** - "barren land" class, high-resolution
- **RSVQA-HR** - land use questions at high resolution
- **WaltonFuture/remote-sensing-VQA** - includes "bare land" class

### Key Classes to Target Across Datasets
| Target Concept | Dataset Classes |
|----------------|----------------|
| Vacant land | "bare land", "barren", "barren land", "vacant" |
| Undeveloped | "rangeland", "sparse residential", "open space", "herbaceous vegetation" |
| Abandoned | "debris_or_rubble", "construction_site", "derelict land" |
| Transitional | "land under construction", "impoverished_settlement" |

---

## 10. SOURCES

- [GeoChat (CVPR 2024)](https://github.com/mbzuai-oryx/GeoChat)
- [SkyEyeGPT (ISPRS 2025)](https://github.com/ZhanYang-nwpu/SkyEyeGPT)
- [SkySenseGPT / FIT-RS](https://github.com/Luo-Z13/SkySenseGPT)
- [EarthGPT / MMRS-1M](https://github.com/wivizhang/EarthGPT)
- [LHRS-Bot](https://github.com/NJU-LHRS/LHRS-Bot)
- [RSVQA](https://rsvqa.sylvainlobry.com/)
- [RS5M / GeoRSCLIP](https://github.com/om-ai-lab/RS5M)
- [RemoteCLIP](https://github.com/ChenDelong1999/RemoteCLIP)
- [LoveDA (NeurIPS 2021)](https://github.com/Junjue-Wang/LoveDA)
- [BigEarthNet](https://bigearth.net/)
- [SpaceNet](https://spacenet.ai/datasets/)
- [Urban Vacant Land](https://github.com/SkydustZ/Large-scale-Automatic-Identification-of-Urban-Vacant-Land)
- [RSICD](https://github.com/201528014227051/RSICD_optimal)
- [fMoW](https://github.com/fMoW/dataset)
- [SATIN](https://huggingface.co/datasets/jonathan-roberts1/SATIN)
- [Awesome RS-MLLMs Survey](https://github.com/ZhanYang-nwpu/Awesome-Remote-Sensing-Multimodal-Large-Language-Model)
- [Awesome VLMs for Earth Observation](https://github.com/geoaigroup/awesome-vision-language-models-for-earth-observation)
