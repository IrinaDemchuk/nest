# Convert — format rules

Internal representation is a JSON-compatible value (usually an array of objects).

| Pair | Rule |
|---|---|
| CSV → JSON | Header row required. Result is an array of objects. Empty file → `[]`. |
| JSON → CSV | Source must be an array of objects. Nested values are JSON-stringified. Object or scalar JSON → error. |
| XML → JSON | Attributes become `@attr`. Repeated tags become arrays. External entities are disabled. |
| JSON → XML | Wrapped in `<root>`. Arrays become repeated child elements. |
| YAML ↔ JSON | YAML 1.2 tree, same JSON-compatible value. |
| CSV ↔ XML / YAML | Via the same array-of-objects (or XML/YAML tree) rules above. |
| Encoding | UTF-8 only. BOM is stripped. |

Same source and target is rejected later in the HTTP layer (400).