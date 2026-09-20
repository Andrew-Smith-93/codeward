import { AggregatedReport } from '../types/index.js';

export function renderJsonReport(report: AggregatedReport): string {
  return JSON.stringify(report, null, 2);
}
