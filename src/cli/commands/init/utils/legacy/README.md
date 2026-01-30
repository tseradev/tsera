# Legacy Utilities

⚠️ **ARCHIVED - DO NOT USE**

This directory contains archived utilities that are no longer maintained or used in TSera.

## Files

### `fresh-generator.ts`

**Archived**: 2026-01-29 **Status**: Not used in production code **Replacement**:
`lume-generator.ts`

This module was used to generate Fresh 2.1.4 projects for TSera. It has been replaced by Lume as the
default frontend framework.

### Why It Was Archived

- Fresh required runtime initialization via `fresh init`
- Lume provides better static site generation
- Lume aligns with TSera's architecture and goals
- Simplified build and deployment process

## Future Consideration

This generator is kept for reference purposes only. It may be re-introduced in future as an optional
CLI flag if there is sufficient demand for Fresh support.

**DO NOT** import or use this file in new code. Use `lume-generator.ts` instead.

## See Also

- [`lume-generator.ts`](../lume-generator.ts) - Current frontend generator
- [`template-composer.ts`](../template-composer.ts) - Template composition system
- [Lume Documentation](https://lume.land/)
- [TSera Documentation](https://github.com/yourusername/tsera)
