/**
 * Preact dependency loader - centralized version management.
 *
 * This module centralizes Preact imports and version management.
 * The actual Preact package is imported via the import_map.json configuration (npm:preact).
 *
 * Current version: 10.27.2
 *
 * @module
 */

// Re-export core Preact (via import_map.json)
export { Fragment, h } from "preact";
export type { ComponentChildren, FunctionalComponent, VNode } from "preact";

// Re-export hooks (via import_map.json)
export {
  useCallback,
  useContext,
  useEffect,
  useErrorBoundary,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "preact/hooks";
