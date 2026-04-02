/**
 * Normalize common run-on patterns from LLM replies so line-based rendering reads clearly.
 */
export function prettifyAiText(s) {
  if (!s || typeof s !== 'string') return s
  let t = s.trim()

  // Section heading after end of sentence
  t = t.replace(/([.!?])\s*(##+\s)/g, '$1\n\n$2')
  // Space before ## mid-stream → break before heading
  t = t.replace(/([^\n#])\s+(##+\s)/g, '$1\n\n$2')
  // "## Title Body" / "## Key Points •" → break before next sentence or bullet
  t = t.replace(/^(##+\s+[^#\n]+?)\s+(?=[A-Z][a-z]|[•\-*])/gm, '$1\n\n')
  // Tight "• **" bullets
  t = t.replace(/\s•\s*\*\*/g, '\n• **')
  // Other • bullets not already on new line
  t = t.replace(/(\S)\s+•\s+(?=[^\n])/g, '$1\n• ')
  // Tight "- **" style
  t = t.replace(/([^\n])\s+-\s+\*\*/g, '$1\n- **')

  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}
