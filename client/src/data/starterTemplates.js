export const starterTemplates = [
  {
    id: "python-payments",
    label: "Python Risky Service",
    language: "python",
    filename: "payment_guard.py",
    description: "Deep nesting, hardcoded secret, broad exceptions, and SQL risk.",
    code: `import os

API_TOKEN = "super-secret-token"

def process_payment(user_id, amount, retries=[], debug=False, metadata={}, audit_log=[]):
    result = {"status": "pending"}
    for attempt in range(3):
        try:
            if amount > 0:
                if user_id:
                    if debug:
                        print("debug", user_id)
                    query = f"SELECT * FROM users WHERE id = {user_id}"
                    cursor.execute(query)
                    retries.append(attempt)
                    if amount > 1000:
                        if metadata.get("priority"):
                            result["status"] = "manual-review"
                        else:
                            result["status"] = eval("amount > 500")
                    else:
                        result["status"] = "approved"
                else:
                    pass
            else:
                result["status"] = "invalid"
        except Exception:
            result["status"] = "error"
    return result
`,
  },
  {
    id: "python-ast-cleaner",
    label: "Python AST Utility",
    language: "python",
    filename: "ast_mapper.py",
    description: "A lower-risk sample for comparing analysis output.",
    code: `from dataclasses import dataclass


@dataclass
class NodeSummary:
    name: str
    kind: str


def summarize_nodes(nodes):
    summaries = []
    for node in nodes:
        summaries.append(NodeSummary(name=node.name, kind=node.kind))
    return summaries
`,
  },
  {
    id: "js-preview",
    label: "JavaScript Preview",
    language: "javascript",
    filename: "syncBuffer.js",
    description: "Preview-mode analysis for multi-language support.",
    code: `const token = "dev-token";

export function syncBuffer(data) {
  var result = [];
  const computed = eval(data.expression);
  result.push(computed);
  return result;
}
`,
  },
];
