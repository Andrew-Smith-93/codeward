import { AggregatedReport, Finding } from '../types/index.js';
import { lookupRule } from '../rules/index.js';

export function renderSarifReport(report: AggregatedReport): string {
  const sarifRules: Record<string, unknown>[] = [];
  const sarifResults: Record<string, unknown>[] = [];
  const seenRules = new Set<string>();

  for (const f of report.findings) {
    const ruleDef = lookupRule(f.rule);
    const ruleId = ruleDef?.id || f.rule;

    if (!seenRules.has(ruleId)) {
      seenRules.add(ruleId);
      sarifRules.push({
        id: ruleId,
        name: ruleDef?.name || ruleId,
        shortDescription: {
          text: ruleDef?.name || f.title,
        },
        fullDescription: {
          text: ruleDef?.description || f.description,
        },
        defaultConfiguration: {
          level: f.severity === 'CRITICAL' ? 'error' : f.severity === 'WARNING' ? 'warning' : 'note',
        },
        help: {
          text: `${ruleDef?.description || f.description}\n\nAgent: ${f.agent || 'analyzer'}${ruleDef?.cwe ? `\nCWE: ${ruleDef.cwe}` : ''}${ruleDef?.owasp ? `\nOWASP: ${ruleDef.owasp}` : ''}`,
        },
        properties: {
          tags: [
            ruleDef?.category || 'code-quality',
            ruleDef?.cwe,
            ruleDef?.owasp,
          ].filter(Boolean),
        },
      });
    }

    sarifResults.push({
      ruleId,
      level: f.severity === 'CRITICAL' ? 'error' : f.severity === 'WARNING' ? 'warning' : 'note',
      message: {
        text: `${f.title}\n\n${f.description}${f.suggestedFix ? `\n\nSuggested Fix:\n${f.suggestedFix}` : ''}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: f.file,
              uriBaseId: '%SRCROOT%',
            },
            region: {
              startLine: f.line,
              endLine: f.endLine || f.line,
              snippet: f.codeSnippet
                ? {
                    text: f.codeSnippet,
                  }
                : undefined,
            },
          },
        },
      ],
    });
  }

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Codeward',
            version: '1.0.0',
            informationUri: 'https://github.com/codeward-ai/codeward',
            rules: sarifRules,
          },
        },
        results: sarifResults,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
