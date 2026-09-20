import { Severity } from '../types/index.js';

export interface RuleDefinition {
  id: string;
  name: string;
  category: 'security' | 'logic' | 'performance';
  defaultSeverity: Severity;
  description: string;
  cwe?: string;
  owasp?: string;
}

export const RULE_REGISTRY: Record<string, RuleDefinition> = {
  // Security Sentinel Rules
  'SEC-001': {
    id: 'SEC-001',
    name: 'Hardcoded Secrets & Credentials',
    category: 'security',
    defaultSeverity: 'CRITICAL',
    description: 'Plaintext secret, API token, private key, or password embedded in source code.',
    cwe: 'CWE-798',
    owasp: 'A07:2021-Identification and Authentication Failures',
  },
  'SEC-002': {
    id: 'SEC-002',
    name: 'SQL / NoSQL Injection',
    category: 'security',
    defaultSeverity: 'CRITICAL',
    description: 'Unsanitized user input concatenated into database query without parameterized statements.',
    cwe: 'CWE-89',
    owasp: 'A03:2021-Injection',
  },
  'SEC-003': {
    id: 'SEC-003',
    name: 'Command / OS Injection',
    category: 'security',
    defaultSeverity: 'CRITICAL',
    description: 'Unvalidated user input passed directly to shell execution functions (e.g. child_process.exec, popen).',
    cwe: 'CWE-78',
    owasp: 'A03:2021-Injection',
  },
  'SEC-004': {
    id: 'SEC-004',
    name: 'Cross-Site Scripting (XSS)',
    category: 'security',
    defaultSeverity: 'CRITICAL',
    description: 'Unescaped user input rendered in web document or dangerouslySetInnerHTML.',
    cwe: 'CWE-79',
    owasp: 'A03:2021-Injection',
  },
  'SEC-005': {
    id: 'SEC-005',
    name: 'Broken Access Control & IDOR',
    category: 'security',
    defaultSeverity: 'CRITICAL',
    description: 'Missing authorization or ownership check before accessing or modifying resources.',
    cwe: 'CWE-639',
    owasp: 'A01:2021-Broken Access Control',
  },
  'SEC-006': {
    id: 'SEC-006',
    name: 'Server-Side Request Forgery (SSRF)',
    category: 'security',
    defaultSeverity: 'WARNING',
    description: 'Fetching user-supplied URLs without allowlist validation or internal IP blocking.',
    cwe: 'CWE-918',
    owasp: 'A10:2021-Server-Side Request Forgery',
  },
  'SEC-007': {
    id: 'SEC-007',
    name: 'Path Traversal',
    category: 'security',
    defaultSeverity: 'CRITICAL',
    description: 'Unsanitized file path permitting access outside intended directory.',
    cwe: 'CWE-22',
    owasp: 'A01:2021-Broken Access Control',
  },

  // Logic Hound Rules
  'LOGIC-001': {
    id: 'LOGIC-001',
    name: 'Unhandled Promise Rejection',
    category: 'logic',
    defaultSeverity: 'WARNING',
    description: 'Asynchronous promise executed without await or catch handler.',
    cwe: 'CWE-391',
  },
  'LOGIC-002': {
    id: 'LOGIC-002',
    name: 'Race Condition / Unsafe Concurrency',
    category: 'logic',
    defaultSeverity: 'WARNING',
    description: 'Non-atomic read-modify-write on shared mutable state.',
    cwe: 'CWE-362',
  },
  'LOGIC-003': {
    id: 'LOGIC-003',
    name: 'Null / Undefined Dereference Hazard',
    category: 'logic',
    defaultSeverity: 'WARNING',
    description: 'Accessing property of potentially null or undefined object without optional chaining or checks.',
    cwe: 'CWE-476',
  },
  'LOGIC-004': {
    id: 'LOGIC-004',
    name: 'Off-By-One Boundary Error',
    category: 'logic',
    defaultSeverity: 'WARNING',
    description: 'Loop termination or array boundary condition off by one index.',
    cwe: 'CWE-193',
  },
  'LOGIC-005': {
    id: 'LOGIC-005',
    name: 'Swallowed Error / Empty Catch',
    category: 'logic',
    defaultSeverity: 'WARNING',
    description: 'Exception caught without logging, rethrowing, or error recovery.',
    cwe: 'CWE-391',
  },

  // Performance & Architecture Critic Rules
  'PERF-001': {
    id: 'PERF-001',
    name: 'N+1 Database Query in Loop',
    category: 'performance',
    defaultSeverity: 'WARNING',
    description: 'Repeated database query or remote API call invoked inside a loop instead of batching.',
    cwe: 'CWE-400',
  },
  'PERF-002': {
    id: 'PERF-002',
    name: 'Memory Leak / Unbounded Resource',
    category: 'performance',
    defaultSeverity: 'WARNING',
    description: 'Event listener, subscription, or cache retained without cleanup or eviction policy.',
    cwe: 'CWE-772',
  },
  'PERF-003': {
    id: 'PERF-003',
    name: 'Algorithmic Complexity Bottleneck',
    category: 'performance',
    defaultSeverity: 'SUGGESTION',
    description: 'Accidental quadratic O(n^2) nested loop where constant-time lookup is viable.',
    cwe: 'CWE-400',
  },
  'PERF-004': {
    id: 'PERF-004',
    name: 'Breaking API Contract Change',
    category: 'performance',
    defaultSeverity: 'CRITICAL',
    description: 'Modifying or removing required API parameters or return fields without versioning.',
  },
};

export function lookupRule(ruleIdOrName: string): RuleDefinition | undefined {
  if (RULE_REGISTRY[ruleIdOrName]) {
    return RULE_REGISTRY[ruleIdOrName];
  }

  // Search by normalized prefix or rule name
  const upper = ruleIdOrName.toUpperCase();
  for (const [key, def] of Object.entries(RULE_REGISTRY)) {
    if (upper.includes(key) || upper.includes(def.name.toUpperCase())) {
      return def;
    }
  }

  return undefined;
}
