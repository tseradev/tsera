# TSera Template Philosophy

## Template Philosophy

TSera templates are **dumb scaffolding templates** that project entity data into generated code.
Templates contain no business logic and serve only as structured placeholders for data insertion.
This philosophy ensures:

- **Predictability**: Templates behave consistently regardless of context
- **Maintainability**: No complex logic to debug or maintain
- **Security**: No code execution or injection vulnerabilities
- **Composability**: Simple building blocks that combine cleanly

### Core Design Principles

#### Separation of Concerns

Templates separate **structure** from **content**. The template defines the skeleton, while entity
data provides the flesh. This separation enables:

- **Single Responsibility**: Each template serves one specific purpose
- **Independence**: Templates can evolve independently of generation logic
- **Reusability**: Same template structure works across different contexts

#### Declarative over Imperative

Templates declare **what** should exist, not **how** to create it. This declarative approach
provides:

- **Clarity**: Template intent is immediately visible
- **Safety**: No side effects or unexpected behavior
- **Validation**: Easier to validate template structure

#### Context-Aware Generation

Templates adapt to **context** without embedded logic. Context drives template behavior through:

- **Variable Substitution**: Placeholders replaced with context values
- **Conditional Inclusion**: Structure varies based on context flags
- **Iterative Generation**: Repeated patterns expand from context collections

## Template Architecture

### Template Categories

#### Base Templates

Provide fundamental project structure that exists in every generated project:

- **Core Structure**: Essential directories and files
- **Configuration**: Project setup and build configuration
- **Entity Foundation**: Base entity definitions and utilities

#### Module Templates

Optional components that extend base functionality:

- **Framework Integration**: API and frontend framework adapters
- **Infrastructure**: Docker, CI/CD, and deployment configurations
- **Development Tools**: Testing, documentation, and development utilities

#### Composition Templates

Combine multiple templates into cohesive projects:

- **Project Assembly**: Coordinate base and module templates
- **Dependency Resolution**: Handle inter-template dependencies
- **Conflict Resolution**: Manage template integration conflicts

### Template Hierarchy

```
templates/
├── base/                    # Foundation (always included)
│   ├── structure/           # Directory and file scaffolding
│   ├── configuration/        # Project configuration templates
│   └── entities/           # Base entity patterns
└── modules/               # Optional extensions
    ├── frameworks/          # API and frontend frameworks
    ├── infrastructure/      # Docker, CI/CD, deployment
    └── tooling/           # Testing, documentation, dev tools
```

## Template Design Patterns

### Variable Substitution Patterns

#### Simple Placeholders

Basic variable insertion for dynamic content:

```
{{variableName}}                    # Simple substitution
{{entity.name}}                   # Nested object access
{{config.outputDirectory}}          # Configuration values
```

#### Conditional Patterns

Structure varies based on context conditions:

```
{{#if condition}}
  Content included when condition is true
{{/if}}

{{#if hasDatabase}}
  Database-specific configuration
{{/if}}
```

#### Iterative Patterns

Repeated structures from collections:

```
{{#each entities}}
  Entity: {{name}}
  Fields: {{#each fields}}{{name}} {{/each}}
{{/each}}
```

#### Nested Patterns

Combining multiple template constructs:

```
{{#each entities}}
  {{#if hasTable}}
    CREATE TABLE {{tableName}} (
      {{#each fields}}
        {{name}} {{type}}{{#if notLast}},{{/if}}
      {{/each}}
    );
  {{/if}}
{{/each}}
```

### Template Context Structure

#### Project Context

Top-level project information:

```typescript
interface ProjectContext {
  name: string; // Project name
  description: string; // Project description
  author: { // Author information
    name: string;
    email: string;
  };
  configuration: { // Project configuration
    database: DatabaseConfig;
    deployment: DeploymentConfig;
    modules: ModuleConfig;
  };
}
```

#### Entity Context

Entity-specific information:

```typescript
interface EntityContext {
  name: string; // Entity name
  tableName?: string; // Database table name
  fields: FieldContext[]; // Entity fields
  relations?: RelationContext[]; // Entity relationships
  metadata: { // Entity metadata
    description: string;
    tags: string[];
    examples: Record<string, unknown>;
  };
}
```

#### Field Context

Individual field information:

```typescript
interface FieldContext {
  name: string; // Field name
  type: string; // Field type
  validator: string; // Validation expression
  visibility: "public" | "internal" | "secret";
  immutable: boolean; // Immutability flag
  description: string; // Field description
  example?: unknown; // Example value
  database?: { // Database-specific metadata
    primary: boolean;
    unique: boolean;
    index: boolean;
    defaultNow: boolean;
  };
}
```

## Template Processing Philosophy

### Deterministic Processing

Template processing must be **deterministic**:

- **Same Input, Same Output**: Identical context produces identical results
- **Order Independence**: Processing order doesn't affect final output
- **Stateless**: No persistent state between template processing runs

### Atomic Operations

Template changes should be **atomic**:

- **All or Nothing**: Either complete successfully or fail entirely
- **Rollback Safety**: Failed processing leaves no partial artifacts
- **Consistency**: Generated artifacts maintain internal consistency

### Incremental Updates

Template processing supports **incremental changes**:

- **Change Detection**: Identify what changed since last generation
- **Selective Regeneration**: Only update affected artifacts
- **Dependency Tracking**: Understand template interdependencies

## Template Validation Principles

### Structural Validation

Templates must validate their **structure**:

- **Syntax Checking**: Verify template syntax is correct
- **Well-Formedness**: Ensure all blocks are properly closed
- **Reference Validation**: Check all variable references exist

### Semantic Validation

Templates must validate their **semantics**:

- **Type Consistency**: Ensure variable types match expectations
- **Logical Coherence**: Verify conditional logic makes sense
- **Context Compatibility**: Check template fits available context

### Runtime Validation

Templates must validate at **runtime**:

- **Context Presence**: Ensure required context values are available
- **Type Safety**: Validate context value types
- **Constraint Checking**: Verify context values meet constraints

## Template Security Principles

### Input Sanitization

All template inputs must be **sanitized**:

- **Path Validation**: Prevent directory traversal attacks
- **Content Filtering**: Remove potentially dangerous content
- **Length Limits**: Prevent resource exhaustion attacks

### Output Security

Generated output must be **secure**:

- **Code Injection Prevention**: No executable code in templates
- **Permission Preservation**: Maintain appropriate file permissions
- **Sensitive Data Protection**: Never expose secrets in templates

### Isolation

Template processing must be **isolated**:

- **Sandboxed Execution**: No access to external resources
- **Limited Scope**: Templates operate only on provided context
- **No Side Effects**: Templates cannot modify system state

## Template Evolution Strategy

### Backward Compatibility

Template evolution must maintain **compatibility**:

- **Versioned Templates**: Support multiple template versions
- **Migration Paths**: Clear upgrade paths between versions
- **Deprecation Warnings**: Alert users to deprecated features

### Extensibility

Template system must be **extensible**:

- **Plugin Architecture**: Support custom template processors
- **Custom Functions**: Allow user-defined template functions
- **Hook Points**: Provide extension points for custom behavior

### Performance

Template processing must be **performant**:

- **Caching**: Cache compiled templates and processed results
- **Lazy Loading**: Load templates only when needed
- **Parallel Processing**: Process independent templates concurrently

## Template Quality Standards

### Readability

Templates must be **readable**:

- **Clear Structure**: Logical organization of template content
- **Descriptive Names**: Meaningful variable and block names
- **Consistent Formatting**: Standardized indentation and spacing

### Maintainability

Templates must be **maintainable**:

- **Modular Design**: Small, focused template units
- **Documentation**: Clear comments and usage examples
- **Testing**: Comprehensive test coverage for template behavior

### Reliability

Templates must be **reliable**:

- **Error Handling**: Graceful failure with clear error messages
- **Edge Case Coverage**: Handle unusual but valid inputs
- **Consistent Behavior**: Predictable results across contexts

## Template Integration Patterns

### CLI Integration

Templates integrate with CLI through **standard interfaces**:

- **Discovery**: Automatic template discovery and registration
- **Validation**: Built-in template validation and error reporting
- **Generation**: Consistent generation API across all templates

### Engine Integration

Templates integrate with generation engine through **abstractions**:

- **Context Building**: Standardized context creation from entities
- **Processing**: Unified template processing pipeline
- **Output**: Consistent artifact generation and file management

### Configuration Integration

Templates integrate with configuration through **typed interfaces**:

- **Schema Definition**: Clear configuration schema requirements
- **Validation**: Automatic configuration validation
- **Defaults**: Sensible default values for optional configuration

## Template Testing Philosophy

### Unit Testing

Templates require **unit tests**:

- **Isolated Testing**: Test templates independently of integration
- **Mock Context**: Use controlled context for predictable results
- **Assertion Libraries**: Specialized assertions for template output

### Integration Testing

Templates require **integration tests**:

- **End-to-End Scenarios**: Test complete template generation workflows
- **Real Data**: Use realistic entity definitions for testing
- **Artifact Validation**: Verify generated artifacts are correct

### Regression Testing

Templates require **regression tests**:

- **Snapshot Testing**: Compare output against known good snapshots
- **Change Detection**: Alert on unintended output changes
- **Version Compatibility**: Ensure templates work across versions

## Template Documentation Standards

### Template Documentation

Each template must include **comprehensive documentation**:

- **Purpose**: Clear description of template function
- **Context**: Required context variables and their types
- **Examples**: Practical usage examples with expected output
- **Limitations**: Known constraints and edge cases

### API Documentation

Template system must provide **clear API documentation**:

- **Function Reference**: Complete function signature documentation
- **Type Definitions**: Detailed type information for all interfaces
- **Usage Patterns**: Common usage patterns and best practices
- **Troubleshooting**: Common issues and their solutions

## Template Best Practices Summary

### Design Principles

1. **Simplicity**: Keep templates as simple as possible
2. **Clarity**: Make template intent immediately obvious
3. **Consistency**: Use consistent patterns across all templates
4. **Modularity**: Design templates as composable units
5. **Safety**: Prioritize security and error handling

### Implementation Guidelines

1. **No Business Logic**: Templates contain structure, not logic
2. **Context-Driven**: All behavior comes from provided context
3. **Deterministic**: Same context always produces same output
4. **Validated**: Templates validate their inputs and structure
5. **Tested**: Comprehensive test coverage for all scenarios

### Quality Assurance

1. **Readability**: Templates should be self-documenting
2. **Maintainability**: Easy to modify and extend
3. **Performance**: Efficient processing for large projects
4. **Reliability**: Consistent behavior across environments
5. **Security**: No vulnerabilities or exposure risks
