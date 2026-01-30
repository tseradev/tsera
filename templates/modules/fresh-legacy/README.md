# Fresh Legacy Module

⚠️ **ARCHIVED - DO NOT USE**

This module has been archived and is no longer maintained. TSera now uses **Lume** as the default
frontend framework.

## Status

- **Archived**: 2026-01-29
- **Replacement**: Lume (see `templates/modules/lume/`)
- **Reason**: Lume provides better static site generation capabilities and aligns with TSera's
  architecture

## Files in This Directory

- `islands/` - Fresh interactive components (archived)
- `routes/` - Fresh route files (archived)
- `assets/` - Fresh static assets (archived)

## Future Consideration

This module is kept for reference purposes only. It may be re-introduced in the future as an
optional CLI flag if there is sufficient demand.

**DO NOT** use these files in new projects. Use Lume instead.

## Migration Guide

If you have an existing Fresh project and want to migrate to Lume:

1. Initialize a new TSera project with Lume: `tsera init my-app`
2. Copy your business logic from Fresh routes to Lume pages
3. Convert Fresh islands to Lume islands/components
4. Update your deployment configuration

## See Also

- [Lume Documentation](https://lume.land/)
- [TSera Documentation](https://github.com/yourusername/tsera)
