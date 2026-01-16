# TSera Artifact Generation

## Generation Philosophy

Artifact generation maintains **coherence** between source definitions and all derived outputs.
Every generated artifact remains synchronized with its source and follows consistent patterns across
all output types. The system treats entity definitions as the single source of truth.

## Artifact Categories

### Core Artifacts

Essential artifacts generated for every entity:

1. **Validation Schemas** → Runtime data validation definitions
2. **Persistence Schemas** → Data storage and mapping definitions
3. **Interface Specifications** → API contracts and interface definitions
4. **Schema Evolution** → Incremental data structure changes
5. **Documentation** → Human-readable documentation per entity
6. **Validation Tests** → Automated validation tests for generated artifacts

### System State Artifacts

Artifacts tracking generation system state:

- **Generation State** → Content snapshots and hashes for change tracking
- **Dependency Graph** → Artifact relationships and dependency mapping
- **Workflow Metadata** → Process tracking and synchronization data

### Extensible Artifacts

Optional artifacts based on project needs:

- **Client Libraries** → Generated client libraries for interface consumption
- **Environment Configuration** → Environment-specific configuration files

## Generation Pipeline

### Watch → Plan → Apply Cycle

The generation process follows a three-phase cycle:

1. **Watch Phase**: Monitor entity and configuration file changes
2. **Plan Phase**: Compare current state with previous state to determine changes
3. **Apply Phase**: Generate artifacts based on the change plan

### Planning Phase Principles

- **Hash Calculation**: Compute content hashes with deterministic serialization
- **State Comparison**: Compare current hashes with stored state
- **Change Detection**: Classify changes as create, update, delete, or noop operations
- **Dependency Resolution**: Build dependency graphs with explicit relationships

### Application Phase Principles

- **Atomic Operations**: Use temporary files with atomic rename operations
- **Order Preservation**: Maintain stable ordering based on dependency resolution
- **Rollback Safety**: Clean up temporary files on failure
- **State Update**: Update tracking files after successful operations

## Artifact Generation Standards

### Schema Generation Standards

#### Schema Requirements

- **Completeness**: Include all entity fields with proper validation
- **Validation Integration**: Use field validators from entity definitions
- **Documentation**: Include field descriptions and metadata
- **Type Safety**: Export inferred TypeScript types
- **Visibility Control**: Generate separate schemas for different visibility levels
- **Input Validation**: Create specialized schemas for create/update operations

#### File Organization Standards

- **Location**: Centralized schema directory structure
- **Naming**: Consistent naming pattern with entity identification
- **Exports**: Structured exports with clear separation of concerns
- **Namespacing**: Organized type exports within logical namespaces

### Database Schema Standards

#### Database Mapping Requirements

- **Type Mapping**: Accurate mapping from entity types to database types
- **Constraint Handling**: Primary keys, unique constraints, and indexes
- **Default Values**: Proper handling of auto-generated and default fields
- **Relationship Support**: Foreign key relationships and references
- **Migration Safety**: Incremental changes with rollback support

#### File Organization Standards

- **Location**: Dedicated database schema directory
- **Naming**: Entity-based file naming with clear identification
- **Imports**: Proper import structure for ORM-specific types
- **Modularity**: Separate files for different database concerns

### API Specification Standards

#### API Generation Requirements

- **Entity-Based**: Generate specifications from entity definitions
- **Field Filtering**: Exclude internal and secret fields appropriately
- **Validation Rules**: Include validation constraints from entity schemas
- **Documentation**: Comprehensive descriptions and examples
- **Version Consistency**: Maintain consistent API versioning

#### File Organization Standards

- **Location**: Centralized API documentation directory
- **Format**: Structured format with stable serialization
- **Naming**: Consistent file naming across API specifications
- **Navigation**: Clear organization for multiple API versions

### Database Migration Standards

#### Migration Requirements

- **Incremental Changes**: Generate only necessary changes
- **Reversibility**: Include rollback capabilities when possible
- **Type Consistency**: Accurate type mapping between entities and SQL
- **Constraint Preservation**: Maintain database constraints and relationships
- **Ordering**: Chronological ordering for proper execution

#### File Organization Standards

- **Location**: Dedicated migration directory with chronological organization
- **Naming**: Timestamp-based naming with descriptive identifiers
- **Content**: Clear migration descriptions and rollback procedures
- **Dependencies**: Handle migration dependencies and ordering

### Documentation Generation Standards

#### Documentation Requirements

- **Entity Descriptions**: Functional overview from entity metadata
- **Field Classification**: Separate public, internal, and secret fields
- **Example Content**: Practical examples for different use cases
- **Cross-References**: Links between related entities and documentation
- **Accessibility**: Clear formatting for different consumption methods

#### File Organization Standards

- **Location**: Structured documentation directory
- **Naming**: Entity-based file naming
- **Format**: Consistent markup formatting
- **Navigation**: Logical organization for easy discovery

### Test Generation Standards

#### Test Requirements

- **Schema Validation**: Test generated schemas with comprehensive data
- **Public Interface Testing**: Validate public-facing schemas separately
- **Input Validation**: Test create/update input schemas
- **Security Testing**: Ensure secret fields are properly masked
- **Integration Testing**: Test integration between generated components

#### File Organization Standards

- **Location**: Co-located with corresponding entity files
- **Naming**: Consistent test file naming conventions
- **Structure**: Organized test sections for different concerns
- **Imports**: Clear import paths to generated artifacts

## File Writing Standards

### Safe Write Operations

#### Write Operation Principles

- **Atomicity**: Use temporary files with atomic rename operations
- **Change Detection**: Compare content before writing to avoid unnecessary operations
- **Content Handling**: Support multiple content types appropriately
- **Directory Management**: Auto-create parent directories as needed
- **Error Recovery**: Clean up temporary files on failure
- **Status Reporting**: Provide clear feedback on write operations

#### Implementation Guidelines

- **Temporary Files**: Use unique identifiers for temporary file names
- **Content Comparison**: Implement efficient content comparison algorithms
- **Path Handling**: Handle cross-platform path differences
- **Permission Management**: Check and handle file system permissions
- **Resource Cleanup**: Ensure proper cleanup of resources

## Configuration Management

### Generation Configuration Principles

#### Configuration Structure

- **Feature Toggles**: Enable/disable specific artifact generation
- **Output Control**: Configure output directories and naming
- **Path Configuration**: Define source paths for entity discovery
- **Database Settings**: Configure database-specific options
- **Deployment Settings**: Configure deployment-related options
- **Module Configuration**: Control optional module inclusion

#### Configuration Sources

- **Entity Definitions**: Primary source of truth from entity files
- **Project Configuration**: Settings from project configuration files
- **Command Line Options**: Runtime configuration from CLI arguments
- **Engine State**: Persistent state tracking for change detection

## Error Handling

### Generation Error Management

#### Error Classification

- **Validation Errors**: Entity definition and validation failures
- **File System Errors**: Permission, disk space, and I/O issues
- **Template Errors**: Missing or invalid template files
- **Dependency Errors**: Missing or incompatible dependencies
- **Configuration Errors**: Invalid or inconsistent configuration

#### Error Handling Principles

- **Clear Messaging**: Provide actionable error messages
- **Context Information**: Include relevant context for debugging
- **Recovery Strategies**: Implement appropriate error recovery mechanisms
- **Logging**: Log errors appropriately for troubleshooting
- **User Guidance**: Provide clear guidance for resolving issues

## Performance Optimization

### Incremental Generation Strategies

#### Optimization Principles

- **Hash Comparison**: Only regenerate artifacts when content changes
- **Dependency Tracking**: Skip regeneration of unchanged dependencies
- **Parallel Processing**: Generate independent artifacts concurrently
- **Caching**: Cache expensive operations and intermediate results
- **Selective Processing**: Process only changed components

#### Memory Management

- **Stream Processing**: Handle large files with streaming approaches
- **Resource Cleanup**: Properly manage file handles and resources
- **Garbage Collection**: Explicit cleanup of temporary data
- **Memory Monitoring**: Track memory usage during generation
- **Efficient Algorithms**: Use memory-efficient data structures

## Quality Assurance

### Consistency Validation

#### Validation Principles

- **Type Synchronization**: Ensure consistency between different type systems
- **API Consistency**: Verify API specifications match entity definitions
- **Database Consistency**: Ensure database schemas match entity fields
- **Documentation Synchronization**: Keep documentation aligned with code
- **Test Coverage**: Validate comprehensive test generation

#### Quality Standards

- **Schema Validation**: All generated schemas must pass validation
- **Type Safety**: Eliminate implicit any types in generated code
- **Format Consistency**: Maintain consistent formatting across artifacts
- **Naming Consistency**: Follow consistent naming conventions
- **Documentation Quality**: Ensure documentation is accurate and complete

## Integration Architecture

### System Integration Points

#### CLI Integration

- **Command Registration**: Register generation commands with CLI system
- **Option Parsing**: Parse and validate generation options
- **Progress Reporting**: Provide real-time feedback during generation
- **Error Handling**: Implement proper error codes and messages

#### Template System Integration

- **Template Discovery**: Locate and load templates from configured paths
- **Template Validation**: Validate template syntax and structure
- **Context Building**: Build template context from entity data
- **Output Generation**: Render templates with entity-specific data

#### File System Integration

- **Change Monitoring**: Monitor file system changes efficiently
- **Debouncing**: Prevent excessive regeneration operations
- **Change Detection**: Identify specific changes for targeted updates
- **Auto-Application**: Automatically apply detected changes

## Best Practices

### Generation Principles

1. **Idempotency**: Multiple runs with identical input produce identical output
2. **Incrementality**: Only regenerate artifacts that have changed
3. **Atomicity**: Never leave projects in inconsistent states
4. **Predictability**: Maintain consistent output format and structure
5. **Traceability**: Provide clear audit trails for generated changes

### Code Quality Standards

- **Type Safety**: Ensure all generated code is type-safe
- **Runtime Validation**: Include appropriate runtime validation
- **Comprehensive Documentation**: Generate complete and accurate documentation
- **Automated Testing**: Generate tests for all generated components
- **Performance Considerations**: Optimize generated code for performance

### User Experience Principles

- **Clear Feedback**: Provide informative progress indicators
- **Actionable Messages**: Deliver clear and actionable error messages
- **Performance**: Optimize generation speed for large projects
- **Flexibility**: Support customization through configuration
- **Reliability**: Ensure consistent and reliable generation

### Maintainability Guidelines

- **Modular Design**: Design generation components for modularity
- **Extensibility**: Support easy addition of new artifact types
- **Configuration**: Provide comprehensive configuration options
- **Debugging**: Include debugging capabilities for troubleshooting
- **Documentation**: Maintain clear documentation for generation processes
