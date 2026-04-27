// Build-plan PDF export.
//
// Renders a cover page with deterministic site details, then snapshots the
// live plan DOM with html2canvas and paginates it into A4 portrait pages.
// AI-generated renders + the before image (if any) are appended on dedicated
// image pages so the export is self-contained.

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { BuildPlan } from "./types";
import type { BeforeImageStored, GeneratedImage } from "./planStore";

interface ExportArgs {
  plan: BuildPlan;
  element: HTMLElement;          // the plan content container
  planId: string;
  images?: GeneratedImage[];
  beforeImage?: BeforeImageStored;
  fileName?: string;
}

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 12;

function lakhToINR(lakh: number): string {
  // Display lakh values as ₹ X.X Cr / ₹ X L for readability.
  if (lakh >= 100) return `₹${(lakh / 100).toFixed(2)} Cr`;
  return `₹${lakh.toFixed(1)} L`;
}

function fmtArea(sqM: number): string {
  const sqft = Math.round(sqM * 10.7639);
  return `${Math.round(sqM).toLocaleString()} m² (${sqft.toLocaleString()} sq ft)`;
}

function drawCoverPage(pdf: jsPDF, plan: BuildPlan, planId: string) {
  const { plot, envelope, cost, timeline, preferences, infra, scenario } = plan;
  let y = MARGIN_MM + 4;

  // Title bar
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(0, 0, A4_W_MM, 28, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("Plotpal — Build Plan", MARGIN_MM, 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    `Plan ID ${planId} · ${new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })} · Scenario: ${scenario}`,
    MARGIN_MM,
    21,
  );

  // Body
  pdf.setTextColor(15, 23, 42);
  y = 38;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("Site details", MARGIN_MM, y);
  y += 6;

  const lines: Array<[string, string]> = [
    ["Address", plot.address || "—"],
    ["Coordinates", `${plot.lat.toFixed(5)}, ${plot.lng.toFixed(5)}`],
    ["Infra type", infra],
    ["Plot area", fmtArea(plot.areaSqM)],
    ["Zone", plot.isIslandCity ? "Island City" : "Suburbs"],
    ["Road width", `${plot.roadWidthM} m`],
  ];
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  for (const [k, v] of lines) {
    pdf.setTextColor(100, 116, 139);
    pdf.text(k, MARGIN_MM, y);
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(v), MARGIN_MM + 36, y, { maxWidth: A4_W_MM - MARGIN_MM * 2 - 36 });
    y += 6;
  }

  y += 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("Build envelope", MARGIN_MM, y);
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const envLines: Array<[string, string]> = [
    ["Recommended FSI", envelope.recommendedFSI.toFixed(2)],
    ["Max permissible FSI", envelope.maxPermissibleFSI.toFixed(2)],
    ["Buildable area", fmtArea(envelope.buildableAreaSqM)],
    ["Approx. floors", `${envelope.approxFloors} floors (~${envelope.heightEstimateM} m)`],
    [
      "Setbacks (F/S/R)",
      `${envelope.setbacks.front} / ${envelope.setbacks.side} / ${envelope.setbacks.rear} m`,
    ],
  ];
  for (const [k, v] of envLines) {
    pdf.setTextColor(100, 116, 139);
    pdf.text(k, MARGIN_MM, y);
    pdf.setTextColor(15, 23, 42);
    pdf.text(v, MARGIN_MM + 50, y);
    y += 6;
  }

  y += 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("Headline numbers", MARGIN_MM, y);
  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const lastPhase = [...timeline].sort(
    (a, b) => b.startMonth + b.durationMonths - (a.startMonth + a.durationMonths),
  )[0];
  const totalMonths = lastPhase ? lastPhase.startMonth + lastPhase.durationMonths : 0;
  const headline: Array<[string, string]> = [
    [
      "All-in cost (range)",
      `${lakhToINR(cost.total.low)} – ${lakhToINR(cost.total.high)}`,
    ],
    [
      "Cost / sq ft",
      `₹${Math.round(cost.perSqFt.low).toLocaleString()} – ₹${Math.round(cost.perSqFt.high).toLocaleString()}`,
    ],
    ["Estimated timeline", `${Math.round(totalMonths)} months end-to-end`],
    ["Ambition", preferences.ambition],
    ["Aesthetic", preferences.aesthetic],
  ];
  for (const [k, v] of headline) {
    pdf.setTextColor(100, 116, 139);
    pdf.text(k, MARGIN_MM, y);
    pdf.setTextColor(15, 23, 42);
    pdf.text(v, MARGIN_MM + 50, y);
    y += 6;
  }

  // Disclaimer footer
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    "Napkin math — not due diligence. Numbers are indicative bands derived from published Mumbai 2026",
    MARGIN_MM,
    A4_H_MM - 12,
  );
  pdf.text(
    "construction baselines and a simplified DCPR 2034 rule engine. Verify with a licensed architect and",
    MARGIN_MM,
    A4_H_MM - 8,
  );
  pdf.text("RERA-registered legal counsel before any commitment.", MARGIN_MM, A4_H_MM - 4);
}

async function appendCapturedElement(pdf: jsPDF, element: HTMLElement) {
  // Snapshot the live plan DOM.
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
  });

  const pageInnerW = A4_W_MM - MARGIN_MM * 2;
  const pageInnerH = A4_H_MM - MARGIN_MM * 2;

  // Pixels-per-mm so we can slice the canvas vertically into page-height chunks.
  const pxPerMm = canvas.width / pageInnerW;
  const sliceHeightPx = Math.floor(pageInnerH * pxPerMm);

  let cursorY = 0;
  while (cursorY < canvas.height) {
    const remaining = canvas.height - cursorY;
    const thisSlicePx = Math.min(sliceHeightPx, remaining);

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = thisSlicePx;
    const ctx = slice.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(
      canvas,
      0, cursorY, canvas.width, thisSlicePx,
      0, 0, canvas.width, thisSlicePx,
    );

    pdf.addPage();
    const sliceHeightMm = thisSlicePx / pxPerMm;
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.92),
      "JPEG",
      MARGIN_MM,
      MARGIN_MM,
      pageInnerW,
      sliceHeightMm,
      undefined,
      "FAST",
    );

    cursorY += thisSlicePx;
  }
}

async function loadImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 16, h: 9 });
    img.src = dataUrl;
  });
}

async function addImagePageAsync(
  pdf: jsPDF,
  dataUrl: string,
  title: string,
  caption?: string,
) {
  const { w, h } = await loadImageDimensions(dataUrl);
  pdf.addPage();
  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(title, MARGIN_MM, MARGIN_MM + 4);

  const availableW = A4_W_MM - MARGIN_MM * 2;
  const availableH = A4_H_MM - MARGIN_MM * 2 - 18;
  const ratio = w / h;

  let drawW = availableW;
  let drawH = drawW / ratio;
  if (drawH > availableH) {
    drawH = availableH;
    drawW = drawH * ratio;
  }
  const x = (A4_W_MM - drawW) / 2;
  const y = MARGIN_MM + 12;
  pdf.addImage(dataUrl, "JPEG", x, y, drawW, drawH, undefined, "FAST");

  if (caption) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(caption, MARGIN_MM, A4_H_MM - 8, {
      maxWidth: A4_W_MM - MARGIN_MM * 2,
    });
  }
}

function dataUrlFromBase64(base64: string, mime: string): string {
  return `data:${mime};base64,${base64}`;
}

export async function exportPlanToPDF(args: ExportArgs): Promise<void> {
  const { plan, element, planId, images, beforeImage, fileName } = args;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // 1) Cover page (deterministic site details)
  drawCoverPage(pdf, plan, planId);

  // 2) Captured plan DOM, sliced across pages
  await appendCapturedElement(pdf, element);

  // 3) Before-image (street view / satellite) on its own page
  if (beforeImage) {
    await addImagePageAsync(
      pdf,
      dataUrlFromBase64(beforeImage.base64, beforeImage.mime),
      "Site today",
      beforeImage.note ||
        `${beforeImage.source === "streetview" ? "Street View" : "Satellite"} reference of the plot.`,
    );
  }

  // 4) AI-generated renders, one per page
  if (images && images.length > 0) {
    for (let i = 0; i < images.length; i++) {
      const im = images[i];
      await addImagePageAsync(
        pdf,
        dataUrlFromBase64(im.base64, im.mime),
        `AI Render ${i + 1} — ${im.aesthetic}`,
        im.prompt,
      );
    }
  }

  const safeAddr = (plan.plot.address || "plan")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    .slice(0, 40);
  const name = fileName || `plotpal-${safeAddr}-${planId}.pdf`;
  pdf.save(name);
}
