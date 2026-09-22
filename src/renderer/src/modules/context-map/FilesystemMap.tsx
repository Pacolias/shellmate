import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import es from '@shared/i18n/es.json';
import type { DirectoryEntry } from '@shared/types/filesystem';
import { ComingSoon } from '../../components/ComingSoon';
import { useHelpLevel } from '../../app-state/HelpLevelContext';
import styles from './FilesystemMap.module.css';

interface NodeState {
  entries: DirectoryEntry[];
  loading: boolean;
  error: string | null;
  expanded: boolean;
}

type NodesState = Record<string, NodeState>;

type Action =
  | { type: 'start-loading'; path: string }
  | { type: 'loaded'; path: string; entries: DirectoryEntry[]; error: string | null }
  | { type: 'toggle'; path: string }
  | { type: 'ensure-expanded'; path: string };

function nodesReducer(state: NodesState, action: Action): NodesState {
  switch (action.type) {
    case 'start-loading':
      return {
        ...state,
        [action.path]: { entries: state[action.path]?.entries ?? [], loading: true, error: null, expanded: true },
      };
    case 'loaded':
      return { ...state, [action.path]: { entries: action.entries, loading: false, error: action.error, expanded: true } };
    case 'toggle': {
      const existing = state[action.path];
      if (!existing) return state;
      return { ...state, [action.path]: { ...existing, expanded: !existing.expanded } };
    }
    case 'ensure-expanded': {
      const existing = state[action.path];
      if (!existing || existing.expanded) return state;
      return { ...state, [action.path]: { ...existing, expanded: true } };
    }
    default:
      return state;
  }
}

function ancestorsOf(cwd: string): string[] {
  const segments = cwd.split('/').filter(Boolean);
  const ancestors = ['/'];
  let current = '';
  for (const segment of segments) {
    current += `/${segment}`;
    ancestors.push(current);
  }
  return ancestors;
}

export function FilesystemMap() {
  const { level } = useHelpLevel();
  const [cwd, setCwd] = useState<string | null>(null);
  const [nodes, dispatch] = useReducer(nodesReducer, {});
  const fetchingRef = useRef(new Set<string>());

  const loadDirectory = useCallback(async (path: string) => {
    if (fetchingRef.current.has(path)) return;
    fetchingRef.current.add(path);
    dispatch({ type: 'start-loading', path });
    const result = await window.shellmate.filesystem.listDirectory(path);
    fetchingRef.current.delete(path);
    dispatch({ type: 'loaded', path, entries: result.entries, error: result.error });
  }, []);

  const toggle = useCallback(
    (path: string, isLoaded: boolean) => {
      if (!isLoaded) {
        void loadDirectory(path);
        return;
      }
      dispatch({ type: 'toggle', path });
    },
    [loadDirectory],
  );

  useEffect(() => {
    return window.shellmate.shell.onEvent((event) => {
      if (event.type === 'cwd-changed') setCwd(event.cwd);
    });
  }, []);

  // Whenever the shell's cwd changes, make sure every directory on the way
  // there is loaded and expanded — "you are here" should never require the
  // user to manually click through the path first.
  useEffect(() => {
    if (!cwd) return;
    for (const ancestorPath of ancestorsOf(cwd)) {
      dispatch({ type: 'ensure-expanded', path: ancestorPath });
      if (!nodes[ancestorPath] && !fetchingRef.current.has(ancestorPath)) {
        void loadDirectory(ancestorPath);
      }
    }
    // Deliberately only re-runs when cwd changes, not on every `nodes`
    // update — `fetchingRef` already prevents duplicate in-flight loads.
  }, [cwd, loadDirectory]);

  if (level === 'low') {
    return <ComingSoon title={es.context.map.title} description={es.context.map.hiddenAtLowHelp} />;
  }

  return (
    <section className={styles.panel} aria-label={es.context.map.title}>
      <h2 className={styles.heading}>{es.context.map.title}</h2>
      <div className={styles.tree}>
        {!cwd ? (
          <p className={styles.emptyState}>{es.context.map.emptyState}</p>
        ) : (
          <DirectoryNode path="/" name="/" depth={0} cwd={cwd} nodes={nodes} onToggle={toggle} />
        )}
      </div>
    </section>
  );
}

interface DirectoryNodeProps {
  path: string;
  name: string;
  depth: number;
  cwd: string;
  nodes: NodesState;
  onToggle: (path: string, isLoaded: boolean) => void;
}

function DirectoryNode({ path, name, depth, cwd, nodes, onToggle }: DirectoryNodeProps) {
  const state = nodes[path];
  const isLoaded = !!state && !state.loading;
  const isExpanded = state?.expanded ?? false;
  const isCurrent = path === cwd;

  return (
    <div>
      <button
        type="button"
        className={styles.row}
        style={{ paddingLeft: depth * 14 }}
        onClick={() => onToggle(path, isLoaded)}
        data-current={isCurrent || undefined}
      >
        <span className={styles.disclosure} aria-hidden="true">
          {isExpanded ? '▾' : '▸'}
        </span>
        <span className={styles.name}>{name}</span>
        {isCurrent && (
          <span className={styles.pin} title={es.context.map.youAreHere} aria-label={es.context.map.youAreHere}>
            📍
          </span>
        )}
      </button>
      {isExpanded && state && (
        <div>
          {state.loading && <p className={styles.loading}>…</p>}
          {state.error && <p className={styles.error}>{state.error}</p>}
          {!state.loading &&
            !state.error &&
            state.entries
              .filter((entry) => entry.isDirectory)
              .map((entry) => (
                <DirectoryNode
                  key={entry.path}
                  path={entry.path}
                  name={entry.name}
                  depth={depth + 1}
                  cwd={cwd}
                  nodes={nodes}
                  onToggle={onToggle}
                />
              ))}
        </div>
      )}
    </div>
  );
}
