`packages/shared-types` is frozen after foundation.

Allowed changes:
- additive exports required for downstream package compilation
- bug fixes to incorrect existing contracts discovered during implementation

Disallowed changes without explicit coordination:
- breaking type changes
- contract reshapes for convenience in downstream packages
- moving or renaming exported entrypoints
