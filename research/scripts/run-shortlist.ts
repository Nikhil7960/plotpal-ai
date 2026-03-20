/**
 * Shortlist ~500 urban-focused cells from the full grid.
 */
import { shortlistAndSave } from '../grid/shortlist-urban.js';

const targetCount = parseInt(process.argv[2] || '500', 10);
console.log(`=== Shortlisting top ${targetCount} urban cells ===\n`);
shortlistAndSave(targetCount);
