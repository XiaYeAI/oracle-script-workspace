import * as path from "path";

export type ScriptBindingNode =
  | { kind: "message"; label: string }
  | { kind: "field"; label: string; description: string; icon?: string }
  | { kind: "action"; label: string; command: string; icon: string };

export function createScriptBindingNodes(
  fileName: string | undefined,
  connectionName: string | undefined,
  hasUncommittedChanges: boolean
): ScriptBindingNode[] {
  if (!fileName) {
    return [{ kind: "message", label: "Open a .sql file to see its workspace." }];
  }

  return [
    { kind: "field", label: "File", description: path.basename(fileName), icon: "file-code" },
    {
      kind: "field",
      label: "Connection",
      description: connectionName ?? "Not bound",
      icon: "database"
    },
    {
      kind: "field",
      label: "Transaction",
      description: connectionName && hasUncommittedChanges ? "uncommitted" : "clean",
      icon: hasUncommittedChanges ? "warning" : "check"
    },
    { kind: "action", label: "Switch Connection", command: "oracleWorkspace.switchConnection", icon: "plug" },
    { kind: "action", label: "Run Current", command: "oracleWorkspace.runCurrentOrSelected", icon: "play" },
    { kind: "action", label: "Run Script", command: "oracleWorkspace.runScript", icon: "run-all" },
    { kind: "action", label: "Commit", command: "oracleWorkspace.commit", icon: "check-all" },
    { kind: "action", label: "Rollback", command: "oracleWorkspace.rollback", icon: "discard" }
  ];
}
