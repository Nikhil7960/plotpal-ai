import fs from 'fs';
import path from 'path';
import { PATHS } from '../config.js';
import { CheckpointData } from '../types.js';

const CHECKPOINT_FILE = path.join(PATHS.checkpoints, 'progress.json');

export function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { completedCells: [], lastUpdated: new Date().toISOString() };
}

export function saveCheckpoint(data: CheckpointData): void {
  fs.mkdirSync(path.dirname(CHECKPOINT_FILE), { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

export function markCellComplete(cellId: string): void {
  const data = loadCheckpoint();
  if (!data.completedCells.includes(cellId)) {
    data.completedCells.push(cellId);
  }
  data.lastUpdated = new Date().toISOString();
  saveCheckpoint(data);
}

export function isCellComplete(cellId: string): boolean {
  const data = loadCheckpoint();
  return data.completedCells.includes(cellId);
}
