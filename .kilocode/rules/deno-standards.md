# Deno Standards for TSera

## Deno v2 Requirements

TSera embraces **Deno v2** as the foundational runtime environment, requiring strict adherence to
ESM-only module architecture. This ensures modern JavaScript patterns and eliminates legacy
compatibility layers.

### Version Enforcement Philosophy

- **Consistency**: Maintain uniform Deno versions across all environments to prevent runtime
  discrepancies
- **Automation**: Integrate version validation into CI/CD pipelines for early detection of version
  conflicts
- **Native Management**: Leverage Deno's built-in version management tools for reliable updates
- **Minimum Standards**: Enforce baseline version requirements to ensure access to modern features

### ESM-Only Architecture Principles

- **Modern Standards**: Exclusively use ES6 import/export syntax throughout the entire codebase
- **Purity**: Avoid CommonJS modules and `require()` calls to maintain architectural consistency
- **Native Resolution**: Utilize Deno's native module resolution capabilities for optimal
  performance
- **Future-Proofing**: Design code to work with evolving JavaScript module standards

## Dependency Management Philosophy

### CLI Dependency Principles

- **Minimalism**: Maintain the smallest possible dependency surface for the CLI tool itself
- **Ecosystem Preference**: Prioritize JSR packages over npm when equivalents are available
- **Standard Library First**: Use Deno's standard library as the primary source for utilities
- **Quality over Quantity**: Select dependencies based on stability, security, and long-term
  compatibility

### Generated Project Dependency Principles

- **Functional Completeness**: Generated projects may include broader dependency sets for full
  application functionality
- **Separation of Concerns**: Clearly distinguish between CLI and generated project dependencies
- **Template-Driven**: Use template requirements to drive dependency inclusion decisions
- **Compatibility Management**: Ensure version compatibility through the CLI generation process

### Dependency Separation Strategy

- **Clear Boundaries**: Maintain distinct separation between CLI and generated project dependencies
- **Template Autonomy**: Allow templates to define their own dependency requirements
- **Conflict Resolution**: Validate and resolve dependency conflicts during the generation process
- **Optional Inclusion**: Use module flags to control optional dependency inclusion

## Permission and Security Philosophy

### Permission Management Principles

- **Least Privilege**: Apply the principle of least privilege to all operations
- **Necessity**: Request only the permissions absolutely required for each functionality
- **Boundary Enforcement**: Limit file system access to within project directories
- **Network Restriction**: Restrict network access to explicitly required operations only

### Security Boundaries

- **File System Control**: Enforce strict access controls within project directories
- **Input Validation**: Validate all user inputs before processing
- **Path Security**: Sanitize file paths to prevent directory traversal attacks
- **Command Safety**: Avoid execution of external commands without proper validation

### Generated Project Security

- **Minimal Permissions**: Generated applications should use only the permissions they require
- **Documentation**: Framework-specific permissions must be documented and justified
- **Database Security**: Limit database access to specific paths and operations
- **Development Tools**: Development tools may require broader permissions with clear documentation

## Configuration Philosophy

### Configuration Structure Principles

- **Centralization**: Centralize configuration in standardized configuration files
- **Dependency Resolution**: Use appropriate mechanisms for dependency resolution
- **Consistency**: Maintain consistent formatting and linting rules across projects
- **Environment Separation**: Separate development from production configurations

### Compiler Configuration Standards

- **Strict Mode**: Enforce strict TypeScript mode across all projects
- **Code Quality**: Use consistent formatting and linting rules
- **Framework Support**: Configure appropriate handling for frontend frameworks
- **Type Safety**: Enable comprehensive type checking with appropriate library definitions

### Task Definition Principles

- **Reusability**: Define reusable development tasks in configuration
- **Categorization**: Separate development, testing, and build tasks logically
- **Permission Awareness**: Include permission requirements in task definitions
- **Consistency**: Maintain consistency between CLI and generated project tasks

## Import Organization Principles

### Import Order Philosophy

- **Logical Organization**: Organize imports logically with external dependencies first
- **Module Separation**: Separate internal modules from relative imports
- **Performance Optimization**: Use type-only imports when possible to improve performance
- **Consistency**: Maintain consistent import patterns across the entire codebase

### Import Alias Strategy

- **Simplification**: Use import aliases to simplify module resolution
- **Configuration-Based**: Define aliases in configuration rather than separate files
- **Readability**: Create meaningful aliases that improve code readability
- **Consistency**: Maintain consistent aliasing between CLI and generated projects

### Module Resolution Approach

- **Native Capabilities**: Leverage Deno's native module resolution capabilities
- **Ecosystem Preference**: Prefer JSR packages for well-maintained libraries
- **Fallback Strategy**: Use alternative package managers only when primary options are unavailable
- **Explicit Specifications**: Ensure all dependencies have clear version requirements

## Runtime Behavior Standards

### Error Handling Philosophy

- **Native Types**: Use Deno-appropriate error types when available
- **Actionable Messages**: Provide clear, actionable error messages that guide users
- **Automation Support**: Exit with appropriate codes to enable automation
- **Fail Fast**: Avoid silent failures or swallowed exceptions

### File System Operations

- **Standard Library**: Use Deno's standard library for file operations
- **Atomic Operations**: Prefer atomic operations to prevent data corruption
- **Resource Management**: Implement proper cleanup of temporary resources
- **Graceful Handling**: Handle file system errors with informative messages

### Asynchronous Patterns

- **Modern Syntax**: Use top-level await where appropriate for initialization
- **Readability**: Prefer async/await patterns over Promise chains
- **Error Handling**: Implement proper error handling for asynchronous operations
- **Resource Management**: Use file watching capabilities with appropriate cleanup

## Testing Philosophy

### Test Structure Principles

- **Native Framework**: Use Deno's built-in testing framework for all tests
- **Logical Organization**: Organize tests in meaningful directory structures
- **Complexity Management**: Use test steps to break down complex scenarios
- **Proper Lifecycle**: Implement appropriate setup and teardown procedures

### Test Permission Management

- **Documentation**: Document required permissions for each test suite
- **Validation**: Use permission checking APIs to validate test environments
- **Isolation**: Mock external dependencies in unit tests to isolate functionality
- **Minimal Requirements**: Design integration tests with minimal permission needs

## Performance Philosophy

### Startup Optimization

- **Lazy Loading**: Minimize initial import overhead through lazy loading strategies
- **Efficient Operations**: Check file existence before reading to avoid unnecessary operations
- **Caching**: Cache expensive operations with appropriate invalidation strategies
- **Module Structure**: Structure code to enable efficient module resolution

### Memory Management

- **Streaming**: Avoid loading large files entirely into memory when possible
- **Resource Efficiency**: Use streaming approaches for file processing when appropriate
- **Cleanup**: Implement proper resource cleanup in all code paths
- **Monitoring**: Monitor memory usage in long-running processes

## Compatibility Philosophy

### Platform Support Strategy

- **Cross-Platform**: Ensure compatibility across Windows, macOS, and Linux
- **Standard Library**: Use Deno's standard library for platform-agnostic operations
- **Graceful Handling**: Handle platform-specific differences appropriately
- **Regular Testing**: Test across all supported platforms consistently

### Environment Compatibility

- **Universal Design**: Design core functionality to work across different Deno environments
- **Conditional Logic**: Use appropriate mechanisms for environment-specific code
- **Clear Documentation**: Document compatibility limitations transparently
- **Separation**: Separate environment-specific from generic functionality

## Development Workflow Philosophy

### Local Development Practices

- **Task-Based Workflows**: Use task-based development workflows for consistency
- **Quality Gates**: Implement code quality checks before commits
- **Testing Separation**: Separate unit testing from end-to-end testing
- **Environment Consistency**: Maintain consistent development environments

### Cache Management Strategy

- **Reproducibility**: Use dependency lock files for reproducible builds
- **Version Control**: Commit lock files to version control for team consistency
- **Invalidation**: Implement cache invalidation strategies for development
- **Selective Clearing**: Clear cache only when necessary for problem resolution

### Environment Variable Management

- **Clear Documentation**: Document required environment variables comprehensively
- **Sensible Defaults**: Provide reasonable defaults for optional variables
- **Startup Validation**: Validate environment variables on application startup
- **Automation Support**: Use non-interactive modes in automated environments
