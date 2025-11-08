/**
 * Preact dependency loader - centralized version management.
 *
 * This module centralizes Preact imports and version management.
 * To update Preact, simply change the version number in the import statements below.
 *
 * Current version: 10.27.2
 *
 * @module
 */

// Re-export core Preact (change version here: npm:preact@VERSION)
export { h, Fragment } from "npm:preact@10.27.2";
export type { ComponentChildren, FunctionalComponent, VNode } from "npm:preact@10.27.2";

// Re-export hooks (change version here: npm:preact@VERSION/hooks)
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
} from "npm:preact@10.27.2/hooks";

