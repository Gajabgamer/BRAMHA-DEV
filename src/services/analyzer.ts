import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { AnalysisResult, Anomaly } from '../types';

export function detectLanguage(code: string, filename?: string): string {
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'js' || ext === 'ts' || ext === 'jsx' || ext === 'tsx') return 'JavaScript';
    if (ext === 'py') return 'Python';
    if (ext === 'java') return 'Java';
    if (ext === 'cpp' || ext === 'hpp' || ext === 'cc' || ext === 'c') return 'C++';
  }

  const scores = {
    JavaScript: 0,
    Python: 0,
    Java: 0,
    'C++': 0
  };

  // JavaScript heuristics
  if (/\bfunction\b/.test(code)) scores.JavaScript += 2;
  if (/\bconst\b|\blet\b|\bvar\b/.test(code)) scores.JavaScript += 2;
  if (/\bconsole\.log\b/.test(code)) scores.JavaScript += 2;
  if (/\b=>\b/.test(code)) scores.JavaScript += 2;
  if (/\bimport\b.*\bfrom\b/.test(code)) scores.JavaScript += 1;

  // Python heuristics
  if (/\bdef\b\s+\w+\(.*\):/.test(code)) scores.Python += 3;
  if (/\bimport\b\s+\w+/.test(code)) scores.Python += 1;
  if (/\bprint\(.*\)/.test(code)) scores.Python += 2;
  if (/: \n\s+/.test(code)) scores.Python += 2; // Indentation pattern

  // Java heuristics
  if (/\bpublic\s+class\b/.test(code)) scores.Java += 3;
  if (/\bpublic\s+static\s+void\s+main\b/.test(code)) scores.Java += 3;
  if (/\bSystem\.out\.println\b/.test(code)) scores.Java += 2;
  if (/\bimport\s+java\..*;/.test(code)) scores.Java += 1;

  // C++ heuristics
  if (/#include\s+<.*>/.test(code)) scores['C++'] += 3;
  if (/\bstd::\b/.test(code)) scores['C++'] += 2;
  if (/\bcout\b\s+<</.test(code)) scores['C++'] += 2;
  if (/\bint\s+main\(.*\)/.test(code)) scores['C++'] += 3;

  let bestLang = 'Unknown';
  let maxScore = 0;

  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestLang = lang;
    }
  }

  // Threshold for detection
  return maxScore >= 2 ? bestLang : 'Unknown';
}

export function generateProjectName(code: string, language: string): string {
  const now = new Date();
  const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  // Heuristic: Try to find a function name
  let functionName = '';
  if (language === 'JavaScript') {
    const match = code.match(/function\s+([a-zA-Z0-9_]+)/) || code.match(/const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/);
    if (match) functionName = match[1];
  } else if (language === 'Python') {
    const match = code.match(/def\s+([a-zA-Z0-9_]+)/);
    if (match) functionName = match[1];
  } else if (language === 'Java') {
    const match = code.match(/class\s+([a-zA-Z0-9_]+)/);
    if (match) functionName = match[1];
  }

  if (functionName) {
    return `${functionName} Analysis - ${timestamp}`;
  }

  return `${language} Analysis - ${timestamp}`;
}

function analyzeJavaScript(code: string): { issues: Anomaly[], breakdown: any, confidence: number, warning?: string } {
  const issues: Anomaly[] = [];
  const breakdown = { security: 0, complexity: 0, maintainability: 0 };
  let confidence = 95;

  try {
    const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    
    const globalVars = new Set(['console', 'window', 'document', 'process', 'require', 'module', 'exports', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch', 'Promise', 'Error', 'JSON', 'Math', 'Object', 'Array', 'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'Symbol', 'global', 'Buffer', '__dirname', '__filename']);
    const definedVars = new Map<string, { line: number, node: any }>();
    const usedVars = new Set<string>();

    walk.ancestor(ast, {
      VariableDeclarator(node: any) {
        if (node.id.type === 'Identifier') definedVars.set(node.id.name, { line: node.loc.start.line, node });
      },
      FunctionDeclaration(node: any) {
        if (node.id) definedVars.set(node.id.name, { line: node.loc.start.line, node });
        node.params.forEach((param: any) => {
          if (param.type === 'Identifier') definedVars.set(param.name, { line: node.loc.start.line, node });
        });
        
        const funcLines = node.loc.end.line - node.loc.start.line + 1;
        if (funcLines > 60) {
          issues.push({
            id: `js-long-func-${node.start}`,
            title: "Excessive Function Complexity",
            explanation: `This function spans ${funcLines} lines, which significantly exceeds the recommended limit.`,
            impact: "Large functions are difficult to test, maintain, and understand, increasing the risk of regression bugs.",
            suggestion: "Decompose this function into smaller, modular sub-functions with single responsibilities.",
            fix: "// Refactor: Split this function into smaller sub-functions\n// Example: function part1() { ... } function part2() { ... }",
            severity: 'Medium',
            category: 'Maintainability',
            line: node.loc.start.line
          });
          breakdown.maintainability += 15;
        }
      },
      Identifier(node: any, state: any, ancestors: any[]) {
        if (!ancestors || ancestors.length < 2) return;
        const parent = ancestors[ancestors.length - 2];
        const isUsage = !(
          (parent.type === 'VariableDeclarator' && parent.id === node) ||
          (parent.type === 'FunctionDeclaration' && parent.id === node) ||
          (parent.type === 'FunctionDeclaration' && parent.params.includes(node)) ||
          (parent.type === 'ArrowFunctionExpression' && parent.params.includes(node)) ||
          (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
          (parent.type === 'Property' && parent.key === node && !parent.computed) ||
          (parent.type === 'ClassDeclaration' && parent.id === node) ||
          (parent.type === 'MethodDefinition' && parent.key === node)
        );
        if (isUsage) {
          usedVars.add(node.name);
        }
      },
      CallExpression(node: any) {
        // eval check
        if (node.callee.type === 'Identifier' && node.callee.name === 'eval') {
          issues.push({
            id: `js-eval-${node.start}`,
            title: "Critical Security Risk: eval()",
            explanation: "The 'eval()' function executes arbitrary strings as code, bypassing standard security boundaries.",
            impact: "Enables Cross-Site Scripting (XSS) and injection attacks, allowing attackers to execute malicious code in your environment.",
            suggestion: "Replace 'eval()' with safer alternatives like 'JSON.parse()' or direct object property access.",
            fix: "JSON.parse(data); // Replace eval(data) with safe parsing",
            severity: 'High',
            category: 'Security',
            line: node.loc.start.line
          });
          breakdown.security += 50;
        }
        
        // console.log check
        if (node.callee.type === 'MemberExpression' && 
            node.callee.object.type === 'Identifier' && node.callee.object.name === 'console' &&
            node.callee.property.type === 'Identifier' && node.callee.property.name === 'log') {
          issues.push({
            id: `js-console-log-${node.start}`,
            title: "Production Debugging Leak",
            explanation: "Found 'console.log' statement which is often left over from debugging sessions.",
            impact: "Can leak sensitive internal state or performance data to the browser console in production.",
            suggestion: "Remove debug logs or use a dedicated logging library with environment-based filtering.",
            fix: "", // Suggest removal
            severity: 'Low',
            category: 'Maintainability',
            line: node.loc.start.line
          });
          breakdown.maintainability += 5;
        }

        // Async/Await check
        if (node.callee.type === 'MemberExpression' && node.callee.property.name === 'then') {
          issues.push({
            id: `js-promise-then-${node.start}`,
            title: "Legacy Promise Handling",
            explanation: "Detected usage of '.then()' instead of modern 'async/await' syntax.",
            impact: "Leads to 'callback hell' and makes error handling significantly more complex and error-prone.",
            suggestion: "Refactor this logic to use 'async/await' with 'try/catch' blocks for cleaner, more readable code.",
            fix: "const result = await someAsyncFunction();",
            severity: 'Low',
            category: 'Maintainability',
            line: node.loc.start.line
          });
          breakdown.maintainability += 5;
        }
      },
      IfStatement(node: any) {
        // Always true/false check (very basic)
        if (node.test.type === 'Literal') {
          const val = node.test.value;
          issues.push({
            id: `js-const-if-${node.start}`,
            title: "Constant Conditional Expression",
            explanation: `The 'if' condition is always ${val ? 'true' : 'false'}.`,
            impact: "Indicates dead code or logic that was likely intended to be dynamic but is currently hardcoded.",
            suggestion: "Remove the constant condition or replace it with a dynamic variable.",
            severity: 'Medium',
            category: 'Logic',
            line: node.loc.start.line
          });
          breakdown.complexity += 10;
        }

        // Deep nesting check
        let depth = 0;
        let curr = node;
        while (curr.alternate && curr.alternate.type === 'IfStatement') {
          depth++;
          curr = curr.alternate;
        }
        if (depth > 3) {
          issues.push({
            id: `js-deep-nesting-${node.start}`,
            title: "Deep Conditional Nesting",
            explanation: `Detected a conditional chain with ${depth + 1} levels of nesting.`,
            impact: "Creates 'arrow code' which is cognitively taxing to follow and prone to logic errors.",
            suggestion: "Use guard clauses (early returns) or switch statements to flatten the logic.",
            severity: 'Medium',
            category: 'Complexity',
            line: node.loc.start.line
          });
          breakdown.complexity += 20;
        }
      },
      WhileStatement(node: any) {
        if (node.test.type === 'Literal' && node.test.value === true) {
          issues.push({
            id: `js-infinite-loop-${node.start}`,
            title: "Infinite Loop Risk",
            explanation: "A 'while(true)' loop was detected without a clear, static exit condition.",
            impact: "Causes the program to hang or freeze, consuming 100% CPU and leading to a Denial of Service (DoS).",
            suggestion: "Ensure there is a guaranteed 'break' or 'return' statement within the loop body.",
            fix: "while (condition) { ... } // Replace true with a valid condition",
            severity: 'High',
            category: 'Logic',
            line: node.loc.start.line
          });
          breakdown.complexity += 40;
        }
      },
      TryStatement(node: any) {
        if (!node.handler || (node.handler.body.body.length === 0)) {
          issues.push({
            id: `js-empty-catch-${node.start}`,
            title: "Silenced Exception Handling",
            explanation: "An empty catch block was detected, which silently swallows all errors.",
            impact: "Critical failures will occur without any logging or notification, making debugging nearly impossible.",
            suggestion: "Implement proper error logging (e.g., console.error) or re-throw the error if it cannot be handled.",
            fix: "catch (error) { console.error(error); }",
            severity: 'High',
            category: 'Maintainability',
            line: node.loc.start.line
          });
          breakdown.maintainability += 20;
        }
      },
      Literal(node: any) {
        // Simple hardcoded secret check in literals
        if (typeof node.value === 'string') {
          const secretRegex = /(?:api[_-]?key|password|secret|token|auth|credential)\s*[:=]\s*["']([A-Za-z0-9-_]{16,})["']/gi;
          if (secretRegex.test(node.value)) {
            issues.push({
              id: `js-secret-${node.start}`,
              title: "Hardcoded Secret Detected",
              explanation: "A string literal matching common API key or credential patterns was found.",
              impact: "Secrets in source code can be compromised, leading to unauthorized access to external services.",
              suggestion: "Move sensitive credentials to environment variables or a secure secret manager.",
              fix: "process.env.API_KEY; // Use environment variables",
              severity: 'High',
              category: 'Security',
              line: node.loc.start.line
            });
            breakdown.security += 50;
          }
        }
      }
    });

    // Check for unused variables - Grouping them
    const unusedVars: string[] = [];
    let firstLine = 0;
    definedVars.forEach((info, name) => {
      if (!usedVars.has(name) && !globalVars.has(name)) {
        unusedVars.push(name);
        if (firstLine === 0) firstLine = info.line;
      }
    });

    if (unusedVars.length > 0) {
      if (unusedVars.length > 2) {
        issues.push({
          id: `js-unused-multiple`,
          title: "Multiple Unused Variables",
          explanation: `Detected ${unusedVars.length} unused variables: ${unusedVars.join(', ')}.`,
          impact: "Unused variables increase memory footprint and can indicate incomplete logic or dead code.",
          suggestion: "Remove the declarations of these variables if they are no longer needed.",
          fix: "// Remove unused variables: " + unusedVars.join(', '),
          severity: 'Low',
          category: 'Maintainability',
          line: firstLine
        });
      } else {
        unusedVars.forEach(name => {
          issues.push({
            id: `js-unused-${name}`,
            title: "Unused Variable Detected",
            explanation: `The variable '${name}' is declared but never referenced in the code.`,
            impact: "Unused variables increase memory footprint and can indicate incomplete logic or dead code.",
            suggestion: `Remove the declaration of '${name}' if it's no longer needed.`,
            fix: "", // Suggest removal
            severity: 'Low',
            category: 'Maintainability',
            line: definedVars.get(name)?.line
          });
        });
      }
      breakdown.maintainability += unusedVars.length * 2;
    }

  } catch (err) {
    return analyzeFallback(code, "JavaScript parsing failed due to syntax errors. Falling back to pattern-based heuristics.");
  }

  return { issues, breakdown, confidence };
}

function analyzePython(code: string): { issues: Anomaly[], breakdown: any, confidence: number } {
  const issues: Anomaly[] = [];
  const breakdown = { security: 0, complexity: 0, maintainability: 0 };
  const confidence = 75;

  const lines = code.split('\n');
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    
    if (line.includes('eval(') || line.includes('exec(')) {
      issues.push({
        id: `py-eval-${idx}`,
        title: "Unsafe Code Execution",
        explanation: "Detected usage of 'eval()' or 'exec()', which can execute arbitrary strings as Python code.",
        impact: "Allows attackers to execute malicious commands on the server if input is not strictly controlled.",
        suggestion: "Use 'ast.literal_eval()' for safe evaluation of literal structures.",
        severity: 'High',
        category: 'Security',
        line: lineNum
      });
      breakdown.security += 40;
    }

    if (line.includes('def ') && line.includes('=[]')) {
      issues.push({
        id: `py-mutable-default-${idx}`,
        title: "Mutable Default Argument",
        explanation: "Using a mutable object (like a list) as a default argument in Python.",
        impact: "The default value is shared across all calls, leading to unexpected behavior and shared state bugs.",
        suggestion: "Use 'None' as the default value and initialize the list inside the function.",
        severity: 'Medium',
        category: 'Logic',
        line: lineNum
      });
      breakdown.maintainability += 10;
    }
  });

  if (code.includes('try:') && !code.includes('except')) {
    issues.push({
      id: `py-missing-except`,
      title: "Incomplete Exception Handling",
      explanation: "A 'try' block was found without a corresponding 'except' block.",
      impact: "The code will fail to compile or crash at runtime when an error occurs.",
      suggestion: "Add an 'except' block to handle specific exceptions.",
      severity: 'High',
      category: 'Logic'
    });
    breakdown.maintainability += 20;
  }

  return { issues, breakdown, confidence };
}

function analyzeJava(code: string): { issues: Anomaly[], breakdown: any, confidence: number } {
  const issues: Anomaly[] = [];
  const breakdown = { security: 0, complexity: 0, maintainability: 0 };
  const confidence = 75;

  if (code.includes('catch') && (code.includes('{}') || code.includes('{ }'))) {
    issues.push({
      id: `java-empty-catch`,
      title: "Swallowed Exception",
      explanation: "An empty catch block in Java hides potential runtime failures.",
      impact: "Application state may become corrupted without any indication of what went wrong.",
      suggestion: "Log the exception using a logger or print the stack trace at minimum.",
      severity: 'High',
      category: 'Maintainability'
    });
    breakdown.security += 30;
  }

  if (code.includes('System.out.println')) {
    issues.push({
      id: `java-sysout`,
      title: "Production Logging Violation",
      explanation: "Using 'System.out.println' for logging instead of a proper logging framework.",
      impact: "Hard to manage log levels and can impact performance in high-throughput applications.",
      suggestion: "Use a logging library like SLF4J or Log4j.",
      severity: 'Low',
      category: 'Maintainability'
    });
    breakdown.maintainability += 5;
  }

  return { issues, breakdown, confidence };
}

function analyzeCpp(code: string): { issues: Anomaly[], breakdown: any, confidence: number } {
  const issues: Anomaly[] = [];
  const breakdown = { security: 0, complexity: 0, maintainability: 0 };
  const confidence = 75;

  if (code.includes('malloc(') || code.includes('free(')) {
    issues.push({
      id: `cpp-manual-mem`,
      title: "Unsafe Memory Management",
      explanation: "Manual memory management using 'malloc' and 'free' is discouraged in modern C++.",
      impact: "Increases the risk of memory leaks, double-free errors, and buffer overflows.",
      suggestion: "Use RAII patterns and smart pointers like 'std::unique_ptr' or 'std::shared_ptr'.",
      severity: 'High',
      category: 'Security'
    });
    breakdown.security += 40;
  }

  if (code.includes('goto ')) {
    issues.push({
      id: `cpp-goto`,
      title: "Spaghetti Code Pattern",
      explanation: "Usage of 'goto' statement detected.",
      impact: "Makes control flow extremely difficult to follow, leading to 'spaghetti code' that is hard to maintain.",
      suggestion: "Replace 'goto' with structured control flow like loops or function calls.",
      severity: 'Medium',
      category: 'Maintainability'
    });
    breakdown.maintainability += 15;
  }

  return { issues, breakdown, confidence };
}

function analyzeFallback(code: string, warning?: string): { issues: Anomaly[], breakdown: any, confidence: number, warning?: string } {
  const issues: Anomaly[] = [];
  const breakdown = { security: 0, complexity: 0, maintainability: 0 };
  const confidence = 40;

  if (code.includes('eval(')) {
    issues.push({
      id: `fallback-eval`,
      title: "Potential Dynamic Execution",
      explanation: "Detected 'eval' pattern which suggests dynamic code execution.",
      impact: "High risk of code injection if input is not properly sanitized.",
      suggestion: "Review the usage of dynamic execution and replace with static logic where possible.",
      severity: 'High',
      category: 'Security'
    });
    breakdown.security += 35;
  }

  const secretRegex = /(?:api[_-]?key|password|secret|token|auth|credential)\s*[:=]\s*["']([A-Za-z0-9-_]{16,})["']/gi;
  if (secretRegex.test(code)) {
    issues.push({
      id: `fallback-secret`,
      title: "Exposed Sensitive Data",
      explanation: "Found patterns matching hardcoded API keys or credentials.",
      impact: "Sensitive data can be leaked if the source code is exposed or shared.",
      suggestion: "Use environment variables or a secure vault to store secrets.",
      severity: 'High',
      category: 'Security'
    });
    breakdown.security += 50;
  }

  return { 
    issues, 
    breakdown, 
    confidence, 
    warning: warning || "Limited analysis capabilities for this language. Results are based on heuristic patterns." 
  };
}

export function analyzeCodeLocally(code: string, filename?: string, manualLanguage?: string): AnalysisResult {
  const detectedLanguage = detectLanguage(code, filename);
  const language = manualLanguage || detectedLanguage;
  
  // Debug logs
  console.log(`[Analyzer] Detected: ${detectedLanguage}, Manual: ${manualLanguage || 'None'}, Using: ${language}`);

  let analysis: { issues: Anomaly[], breakdown: any, confidence: number, warning?: string };

  try {
    switch (language) {
      case 'JavaScript':
        analysis = analyzeJavaScript(code);
        break;
      case 'Python':
        analysis = analyzePython(code);
        break;
      case 'Java':
        analysis = analyzeJava(code);
        break;
      case 'C++':
        analysis = analyzeCpp(code);
        break;
      default:
        analysis = analyzeFallback(code);
    }
  } catch (err) {
    console.error(`[Analyzer] Error in ${language} analyzer:`, err);
    analysis = analyzeFallback(code, "Internal analyzer error. Falling back to heuristic patterns.");
  }

  const { issues = [], breakdown = { security: 0, complexity: 0, maintainability: 0 }, confidence = 40, warning } = analysis;

  // Global validation: Deduplicate
  const uniqueIssues = Array.from(new Map(issues.map(a => [a.id, a])).values());

  // Deterministic Risk Score Calculation
  let risk_score = 0;
  let highCount = 0;
  let hasMedium = false;
  let hasLow = false;

  uniqueIssues.forEach(a => {
    if (a.severity === 'High') {
      risk_score += 20;
      highCount++;
    } else if (a.severity === 'Medium') {
      risk_score += 10;
      hasMedium = true;
    } else if (a.severity === 'Low') {
      risk_score += 5;
      hasLow = true;
    }
  });

  // Multiplier for multiple critical issues (15-25% -> using 20%)
  if (highCount >= 2) {
    risk_score *= 1.2;
    console.log(`[Analyzer] Multiplier applied for ${highCount} high issues`);
  }

  // Cap score under 40 if only Low issues
  if (hasLow && !hasMedium && highCount === 0) {
    risk_score = Math.min(risk_score, 39);
  }

  // Normalize and clamp
  risk_score = Math.max(0, Math.min(Math.round(risk_score), 100));

  // Health Validation Layer
  if (isNaN(risk_score) || !Array.isArray(uniqueIssues)) {
    return {
      risk_score: 0,
      riskLevel: 'Low',
      issues: [],
      summary: "Analysis failed due to a system error. Please try again.",
      language: 'Unknown',
      confidence_score: 0,
      warning: "System health check failed.",
      breakdown: { security: 0, complexity: 0, maintainability: 0 },
      metadata: { linesAnalyzed: 0, complexityLevel: 'Low' }
    };
  }

  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
  if (risk_score > 70) riskLevel = 'High';
  else if (risk_score > 30) riskLevel = 'Medium';

  const complexityLevel = breakdown.complexity > 50 ? 'High' : breakdown.complexity > 20 ? 'Moderate' : 'Low';

  return {
    risk_score,
    riskLevel,
    issues: uniqueIssues,
    summary: uniqueIssues.length > 0 
      ? `BugPredictor identified ${uniqueIssues.length} potential issues in your ${language} code. The primary risk factor is ${uniqueIssues[0].category}.`
      : `Your ${language} code follows best practices. No significant bugs or security risks were detected.`,
    language,
    confidence_score: confidence,
    projectName: generateProjectName(code, language),
    warning,
    breakdown,
    metadata: {
      linesAnalyzed: code.split('\n').length,
      complexityLevel
    }
  };
}
