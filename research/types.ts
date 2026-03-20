// ── Grid ──

export interface GridCell {
  id: string;              // "cell_42_17"
  row: number;
  col: number;
  center: { lat: number; lng: number };
  bounds: {
    latMin: number;
    latMax: number;
    lngMin: number;
    lngMax: number;
  };
  isLand: boolean;
}

// ── Pipeline ──

export interface VacantSpace {
  location: string;
  coordinates: { lat: number; lng: number };
  suitability: number;
  reasons: string[];
  considerations: string[];
  description: string;
}

export interface VacantSpaceResearch extends VacantSpace {
  recommendedTypes: string[];
}

export interface AnalysisResult {
  vacantSpaces: VacantSpaceResearch[];
  analysis: string;
  confidence: number;
}

export interface CellResult {
  cellId: string;
  center: { lat: number; lng: number };
  imageFile: string;
  pipelineResult: AnalysisResult;
  filteredResult: AnalysisResult;
  timestamp: string;
  durationMs: number;
}

// ── Evaluation ──

export interface DimensionScore {
  score: number;          // 1-5
  justification: string;
}

export interface PointwiseScore {
  cellId: string;
  relevance: DimensionScore;
  feasibility: DimensionScore;
  reasoning_quality: DimensionScore;
  geographic_accuracy: DimensionScore;
  completeness: DimensionScore;
  overall_score: number;
  notes: string;
}

export interface PairwiseComparison {
  cellA: string;
  cellB: string;
  spatialCoherence: number;    // 0-1
  justification: string;
}

export interface ConsistencyResult {
  cellId: string;
  originalSpaces: number;
  rerunSpaces: number;
  overlapCount: number;
  repetitionConsistency: number; // 0-1
}

export interface PositionBiasResult {
  cellId: string;
  originalScores: Record<string, number>;
  reversedScores: Record<string, number>;
  maxDiff: number;
  biased: boolean;
}

// ── Metrics ──

export interface MetricsSummary {
  totalCells: number;
  landCells: number;
  processedCells: number;
  vacancyDetectionRate: number;
  avgSuitability: number;
  avgConfidence: number;
  perDimensionMeans: Record<string, number>;
  overallQualityScore: number;
  repetitionConsistency: number;
  positionBiasRate: number;
  cohensKappa: number;
  spatialCoherence: number;
  perTypeFrequency: Record<string, number>;
  perRegionBreakdown: Record<string, {
    cellCount: number;
    avgScore: number;
  }>;
}

// ── Checkpoint ──

export interface CheckpointData {
  completedCells: string[];
  lastUpdated: string;
}
