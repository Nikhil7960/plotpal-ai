import fs from 'fs';
import path from 'path';
import { stringify } from 'csv-stringify/sync';
import { PATHS } from '../config.js';
import { MetricsSummary, CellResult } from '../types.js';

/**
 * Export full report as JSON.
 */
export function exportJSON(
  summary: MetricsSummary,
  results: CellResult[]
): void {
  const reportsDir = PATHS.reports;
  fs.mkdirSync(reportsDir, { recursive: true });

  fs.writeFileSync(
    path.join(reportsDir, 'full-report.json'),
    JSON.stringify({ summary, cellCount: results.length }, null, 2)
  );
  console.log('Exported: full-report.json');
}

/**
 * Export results as flat CSV — one row per cell.
 */
export function exportCSV(results: CellResult[]): void {
  const reportsDir = PATHS.reports;
  fs.mkdirSync(reportsDir, { recursive: true });

  const rows = results.map((r) => ({
    cellId: r.cellId,
    lat: r.center.lat,
    lng: r.center.lng,
    spacesFound: r.filteredResult.vacantSpaces.length,
    confidence: r.filteredResult.confidence,
    avgSuitability:
      r.filteredResult.vacantSpaces.length > 0
        ? (
            r.filteredResult.vacantSpaces.reduce((a, s) => a + s.suitability, 0) /
            r.filteredResult.vacantSpaces.length
          ).toFixed(1)
        : '0',
    buildingType: r.buildingType,
    analysis: r.filteredResult.analysis,
    timestamp: r.timestamp,
    durationMs: r.durationMs,
  }));

  const csv = stringify(rows, { header: true });
  fs.writeFileSync(path.join(reportsDir, 'results.csv'), csv);
  console.log('Exported: results.csv');
}

/**
 * Export summary tables as LaTeX.
 */
export function exportLaTeX(summary: MetricsSummary): void {
  const reportsDir = PATHS.reports;
  fs.mkdirSync(reportsDir, { recursive: true });

  const lines: string[] = [];

  // Quality metrics table
  lines.push('% Overall Quality Metrics');
  lines.push('\\begin{table}[h]');
  lines.push('\\centering');
  lines.push('\\caption{Pipeline Quality Metrics}');
  lines.push('\\begin{tabular}{lc}');
  lines.push('\\toprule');
  lines.push('\\textbf{Metric} & \\textbf{Value} \\\\');
  lines.push('\\midrule');
  lines.push(`Overall Quality Score & ${summary.overallQualityScore.toFixed(2)} \\\\`);
  lines.push(`Vacancy Detection Rate & ${(summary.vacancyDetectionRate * 100).toFixed(1)}\\% \\\\`);
  lines.push(`Avg Suitability & ${summary.avgSuitability.toFixed(1)} \\\\`);
  lines.push(`Avg Confidence & ${summary.avgConfidence.toFixed(1)} \\\\`);
  lines.push(`Repetition Consistency & ${summary.repetitionConsistency.toFixed(3)} \\\\`);
  lines.push(`Position Bias Rate & ${(summary.positionBiasRate * 100).toFixed(1)}\\% \\\\`);
  lines.push(`Cohen's Kappa & ${summary.cohensKappa.toFixed(3)} \\\\`);
  lines.push(`Spatial Coherence & ${summary.spatialCoherence.toFixed(3)} \\\\`);
  lines.push('\\bottomrule');
  lines.push('\\end{tabular}');
  lines.push('\\end{table}');
  lines.push('');

  // Per-dimension table
  lines.push('% Per-Dimension Scores');
  lines.push('\\begin{table}[h]');
  lines.push('\\centering');
  lines.push('\\caption{Per-Dimension Mean Scores (1--5)}');
  lines.push('\\begin{tabular}{lc}');
  lines.push('\\toprule');
  lines.push('\\textbf{Dimension} & \\textbf{Mean Score} \\\\');
  lines.push('\\midrule');
  for (const [dim, score] of Object.entries(summary.perDimensionMeans)) {
    const label = dim.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    lines.push(`${label} & ${score.toFixed(2)} \\\\`);
  }
  lines.push('\\bottomrule');
  lines.push('\\end{tabular}');
  lines.push('\\end{table}');
  lines.push('');

  // Per-type frequency table
  lines.push('% Infrastructure Type Frequency');
  lines.push('\\begin{table}[h]');
  lines.push('\\centering');
  lines.push('\\caption{Infrastructure Type Recommendation Frequency}');
  lines.push('\\begin{tabular}{lc}');
  lines.push('\\toprule');
  lines.push('\\textbf{Type} & \\textbf{Count} \\\\');
  lines.push('\\midrule');
  const sorted = Object.entries(summary.perTypeFrequency).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sorted) {
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    lines.push(`${label} & ${count} \\\\`);
  }
  lines.push('\\bottomrule');
  lines.push('\\end{tabular}');
  lines.push('\\end{table}');
  lines.push('');

  // Per-region table
  lines.push('% Per-Region Breakdown');
  lines.push('\\begin{table}[h]');
  lines.push('\\centering');
  lines.push('\\caption{Quality Scores by Mumbai Region}');
  lines.push('\\begin{tabular}{lcc}');
  lines.push('\\toprule');
  lines.push('\\textbf{Region} & \\textbf{Cells} & \\textbf{Avg Score} \\\\');
  lines.push('\\midrule');
  for (const [region, data] of Object.entries(summary.perRegionBreakdown)) {
    lines.push(`${region} & ${data.cellCount} & ${data.avgScore.toFixed(2)} \\\\`);
  }
  lines.push('\\bottomrule');
  lines.push('\\end{tabular}');
  lines.push('\\end{table}');

  fs.writeFileSync(path.join(reportsDir, 'tables.tex'), lines.join('\n'));
  console.log('Exported: tables.tex');
}
