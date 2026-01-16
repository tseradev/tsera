# TSera CLI Conventions

## CLI Architecture

CLI tools should follow **modular command structure** with clear separation of concerns. Each
command should be self-contained with its own logic, user interface components, and tests.

## Command Structure

### Command Organization Principles

Commands should be organized in hierarchical directories that reflect their functionality and
relationships. Each command should have dedicated space for:

- Core logic implementation
- User interface components
- Test suites
- Command-specific utilities

### Command Design Patterns

Commands should follow consistent structural patterns that promote:

- **Modularity**: Each command operates independently
- **Testability**: Clear separation allows for comprehensive testing
- **Maintainability**: Organized structure supports easy modifications
- **Extensibility**: Framework should support adding new commands

## Global Options

### Global Option Categories

All CLI commands should support standardized global options that provide consistent behavior across
the entire tool:

#### Machine-Readable Output

- **Purpose**: Enable structured output for automation and CI/CD integration
- **Format**: Stream-based structured data format for processing
- **Behavior**: All console output should be wrapped in structured format when enabled
- **Use Case**: Programmatic consumption, logging, and pipeline integration

#### Help and Documentation

- **Purpose**: Provide consistent help and usage information
- **Format**: Standardized help formatting across all commands
- **Behavior**: Display command-specific help with consistent structure and examples
- **Use Case**: User guidance, documentation generation, and discovery

#### Version Information

- **Purpose**: Display CLI version information
- **Format**: Consistent version string format
- **Behavior**: Exit after displaying version information
- **Use Case**: Compatibility checking, debugging, and support

### Global Option Design Principles

- **Consistency**: Same option names and behavior across all commands
- **Backward Compatibility**: Global options should not break existing workflows
- **Minimal Overhead**: Global options should not significantly impact performance
- **Clear Purpose**: Each global option should have a well-defined use case

## Command Implementation Patterns

### Error Handling Principles

- **Structured Error Handling**: Use consistent error handling patterns with proper classification
- **Error Classification**: Distinguish between user errors, system errors, and validation failures
- **Actionable Messages**: Provide clear, actionable error messages that guide users toward
  resolution
- **Error Context**: Include relevant context information without exposing sensitive data

### Exit Code Standards

- **Success (0)**: Command completed successfully
- **General Error (1)**: Runtime errors, file system issues, network failures, validation errors
- **Usage Error (2)**: Invalid arguments, missing required options, malformed input
- **Consistency**: Use same exit codes across all commands for automation reliability

### Progress Reporting Principles

- **Structured Progress**: Use consistent event-based progress reporting
- **Dual Format**: Support both human-readable and machine-readable output formats
- **Operation Tracking**: Track operation start, progress, completion, and failure states
- **Context Preservation**: Maintain operation context throughout progress reporting

## Command Categories

### Project Initialization Commands

**Purpose**: Scaffold new projects from templates with configurable module selection

**Design Principles**:

- **Template-Based**: Use template composition for project generation
- **Modular Selection**: Allow selective inclusion of framework modules
- **Non-Interactive Mode**: Support automated usage with sensible defaults
- **Conflict Resolution**: Handle existing projects gracefully with overwrite options
- **Directory Management**: Support both current and target directory initialization

### Development Commands

**Purpose**: Enable iterative development with automatic artifact generation

**Design Principles**:

- **Watch-Based**: Monitor file system changes for automatic regeneration
- **Incremental Updates**: Only regenerate affected artifacts
- **Plan-Apply Separation**: Separate change detection from artifact application
- **Multi-Module Support**: Handle both backend and frontend module coordination
- **Real-Time Feedback**: Provide immediate feedback on generation status

### Diagnostic Commands

**Purpose**: Analyze project coherence and provide corrective actions

**Design Principles**:

- **Comprehensive Analysis**: Check all aspects of project coherence
- **Issue Classification**: Categorize issues by severity and safety of automatic fixes
- **Selective Application**: Allow users to choose which fixes to apply
- **Validation Mode**: Support quick validation for CI/CD integration
- **Actionable Guidance**: Provide clear steps for manual resolution

### Maintenance Commands

**Purpose**: Manage CLI tooling and deployment configurations

**Design Principles**:

- **Multiple Update Channels**: Support stable, beta, and canary releases
- **Installation Flexibility**: Support both source and binary installation methods
- **Preview Capability**: Allow dry-run operations for safety
- **Provider Abstraction**: Support multiple deployment providers through unified interface
- **Configuration Synchronization**: Maintain consistency between local and remote configurations

### Subcommand Architecture

**Design Principles**:

- **Logical Grouping**: Group related functionality under parent commands
- **Consistent Interface**: Use similar option patterns across subcommands
- **Independent Operation**: Each subcommand should be independently usable
- **Shared Configuration**: Leverage common configuration patterns
- **Extensibility**: Design for easy addition of new subcommands

## User Interface Conventions

### Output Format Principles

- **Dual Format Support**: Support both human-readable and machine-readable output
- **Structured Logging**: Use consistent event-based logging for all operations
- **Status Indication**: Provide clear visual indicators for operation states
- **Context Preservation**: Maintain operation context throughout output streams
- **Error Formatting**: Format errors consistently with actionable guidance

### Interactive Input Patterns

- **Progressive Disclosure**: Request information in logical sequence
- **Validation**: Provide real-time validation for user input
- **Default Values**: Offer sensible defaults to reduce user burden
- **Confirmation**: Require confirmation for destructive operations
- **Help Integration**: Provide context-sensitive help during input

### Progress Communication

- **Event-Based Reporting**: Use structured events for progress tracking
- **Status States**: Clearly indicate running, completed, and failed states
- **Visual Indicators**: Use consistent icons or symbols for status representation
- **Contextual Messages**: Provide relevant context for each progress step
- **Error Integration**: Integrate error reporting into progress flow

## File System Operations

### Configuration Management Principles

- **Standardized Locations**: Use consistent paths for configuration files
- **Graceful Degradation**: Handle missing configuration files gracefully
- **Validation**: Validate configuration structure and content
- **Error Context**: Provide clear error messages for configuration issues
- **Default Fallbacks**: Use sensible defaults when configuration is absent

### File Operation Safety

- **Atomic Operations**: Use temporary files with atomic rename operations
- **Error Recovery**: Clean up temporary files on failure
- **Permission Handling**: Check and handle file system permissions appropriately
- **Path Validation**: Sanitize and validate file paths to prevent security issues
- **Backup Strategy**: Create backups before modifying important files

### File System Boundaries

- **Project Scoping**: Restrict operations to project directory boundaries
- **Permission Awareness**: Respect file system permissions and access rights
- **Resource Management**: Properly manage file handles and resources
- **Cross-Platform Compatibility**: Handle path differences across operating systems

## Testing Patterns

### Command Testing Principles

- **Isolation**: Each test should run in isolation with temporary directories
- **Cleanup**: Ensure proper cleanup of temporary resources
- **Verification**: Verify both file creation and content correctness
- **Edge Cases**: Test error conditions and edge cases
- **Integration**: Test command integration with file system and configuration

### Snapshot Testing Approach

- **Golden Files**: Use reference files for expected output comparison
- **Normalization**: Normalize platform-specific differences for comparison
- **Content Validation**: Verify generated content structure and semantics
- **Regression Prevention**: Detect unintended changes in generated output
- **Update Process**: Provide clear process for updating golden files when needed

### Test Organization

- **Co-location**: Place tests near code they test
- **Naming Consistency**: Use consistent naming patterns for test files
- **Test Categories**: Organize tests by functionality (unit, integration, e2e)
- **Mock Strategy**: Use consistent mocking patterns for external dependencies
- **Test Data**: Use standardized test data across test suites

## Help System Design

### Help Structure Principles

- **Hierarchical Organization**: Structure help content from general to specific
- **Consistent Formatting**: Use uniform formatting across all help content
- **Contextual Relevance**: Provide help specific to current command context
- **Practical Examples**: Include realistic usage examples for common scenarios
- **Progressive Disclosure**: Reveal complexity gradually from basic to advanced usage

### Help Content Categories

- **Command Overview**: Brief description of command purpose and scope
- **Usage Patterns**: Common usage patterns and command combinations
- **Option Documentation**: Clear description of all available options
- **Example Scenarios**: Practical examples for different use cases
- **Related Commands**: References to related commands for workflow guidance

### Help Accessibility

- **Multiple Formats**: Support both detailed and condensed help formats
- **Error Integration**: Provide contextual help when commands fail
- **Discovery**: Help users discover relevant commands and options
- **Navigation**: Enable easy navigation between related help topics
- **Consistency**: Maintain consistent help structure across all commands

## Performance Guidelines

### Startup Performance

- Minimize imports on command initialization
- Lazy load heavy dependencies when possible
- Use conditional imports for optional features
- Cache expensive operations

### Memory Usage

- Avoid loading large files into memory
- Use streams for file processing
- Clean up resources properly
- Monitor memory usage in long-running commands

### Error Recovery

- Provide clear error messages with actionable guidance
- Include suggestions for fixing common issues
- Use appropriate exit codes for automation
- Log errors for debugging without exposing sensitive data

## Command Integration Architecture

### Command Registration Principles

- **Centralized Router**: Use a centralized router for command registration and global option
  handling
- **Consistent Application**: Apply global options uniformly across all commands
- **Modular Loading**: Load commands dynamically to support extensibility
- **Dependency Injection**: Use dependency injection for shared services and configuration
- **Handler Abstraction**: Abstract command handlers to support testing and customization

### Extensibility Patterns

- **Plugin Architecture**: Design for easy addition of new commands and functionality
- **Interface Consistency**: Provide clear interfaces for command extensions
- **Discovery Mechanism**: Support automatic discovery of available commands
- **Configuration Integration**: Integrate plugin configuration with main configuration system
- **Backward Compatibility**: Ensure new extensions don't break existing functionality

### Command Composition

- **Reusable Components**: Create reusable UI and utility components
- **Shared Services**: Leverage common services across commands
- **Consistent Patterns**: Use consistent patterns for similar functionality
- **State Management**: Manage command state consistently across the CLI
- **Error Handling**: Provide unified error handling across all commands

## Security Considerations

### Input Validation

- Validate all user inputs before processing
- Sanitize file paths to prevent directory traversal
- Check permissions before file operations
- Never execute arbitrary commands

### Sensitive Data

- Never log passwords, tokens, or secrets
- Mask sensitive values in error messages
- Use secure prompts for sensitive input
- Clear sensitive data from memory when done

### File System Security

- Restrict operations to project directory
- Check file permissions before reading/writing
- Use atomic operations to prevent corruption
- Backup important files before modification

### Configuration Security

- Store configuration files in standardized, secure locations
- Manage secrets through dedicated secure directories
- Use environment-specific configurations for different deployment contexts
- Never expose secrets in logs or error messages
