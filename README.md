# Oracle Script Workspace

Oracle Script Workspace is a lightweight VS Code extension for daily Oracle database development. It is designed around persistent `.sql` files instead of temporary worksheets.

## Current Status

This repository currently contains the first usable implementation slice: extension skeleton, configuration storage, keymap profile switching, SQL splitting, session abstractions, command workflow wiring, result panels, connection management UI, current-script workbench, object browsing, object-detail Webview, and a non-blocking subscription entry.

The editor commands now route through `WorkspaceConfigStore`, `SecretStore`, `OracleSessionManager`, and `ResultPanel`. Real database validation still needs a reachable Oracle test connection.

## Connection Manager

Open the Oracle Script Workspace connection panel and click **Add Connection** to use the unified Connection Manager. The form supports both custom Oracle connections and TNS alias connections in one place.

The Connection Manager supports:

- custom Oracle connection form;
- TNS login creation from parsed `tnsnames.ora` aliases;
- custom connections choose either **Service Name** or **SID**; only the selected identifier is saved;
- `tnsnames.ora` path management;
- alias preview and parse errors;
- Oracle Client profile management, with each saved connection referencing the profile it should use;
- **Test Connection**: opens and immediately closes a connection.
- **Edit Connection**: updates the saved connection definition.
- **Duplicate Connection**: creates a new connection from an existing one.
- **Delete Connection**: removes the definition and its saved password.

They can also be configured through VS Code settings:

```json
{
  "oracleWorkspace.connections": [
    {
      "name": "DEV_KGDB",
      "type": "custom",
      "host": "127.0.0.1",
      "port": 1521,
      "serviceName": "orclpdb1",
      "username": "kgdb",
      "clientProfileName": "Default"
    }
  ]
}
```

Passwords are stored with VS Code SecretStorage and must not be written to `.sql` files or workspace configuration.

## Oracle Client Profiles

node-oracledb runs in Thin mode by default. Thin mode does not require Oracle Client libraries, but it cannot connect to older Oracle Database server versions that are outside Thin mode support. If **Test Connection** reports `NJS-138`, open **Manage Connections > Oracle Client**, create or update a Thick profile, choose the Oracle Client library directory, and assign that profile to the connection.

Connections can reference different profiles:

```json
{
  "oracleWorkspace.clientProfiles": [
    {
      "name": "Default",
      "mode": "thin"
    },
    {
      "name": "Legacy 10g",
      "mode": "thick",
      "libraryDir": "C:/oracle/instantclient_19_22",
      "configDir": "C:/oracle/network/admin"
    }
  ]
}
```

`configDir` is optional. Use it only when the Oracle driver must load Oracle Net files such as `tnsnames.ora`, `sqlnet.ora`, wallets, or other network configuration from a directory. If you add `tnsnames.ora` paths in the **TNS Names** tab and only use parsed aliases from there, you often do not need a separate Oracle Net configuration directory.

Only one Oracle Client profile can be active inside one VS Code extension process. If you switch between connections that require different Thin/Thick modes or different Thick client directories, reload the VS Code window or use separate VS Code windows before testing the other profile.

Older settings such as `oracleWorkspace.clientMode`, `oracleWorkspace.oracleClientLibraryDir`, and `oracleWorkspace.oracleClientConfigDir` are still read as the fallback `Default` profile for compatibility.

## tnsnames.ora

Open **Manage Connections > TNS Names** and add one or more `tnsnames.ora` paths. The extension parses aliases automatically. You do not need to create or edit a connection for each alias.

When you select an alias, enter the Oracle username and password, then choose:

- **Test Login**: test without saving a login profile.
- **Save Login**: create a local login profile named `ALIAS@USERNAME`.
- **Save and Set Current Script**: save the login profile and bind the active SQL file to it.

The stored setting still only contains the paths:

```json
{
  "oracleWorkspace.tnsnamesPaths": [
    "D:/oracle/network/admin/tnsnames.ora"
  ]
}
```

Usernames are stored in local connection profiles. Passwords are stored separately in VS Code SecretStorage.

## Current Script Workbench

The Oracle Script Workspace activity bar includes a **Current Script** view. When a SQL file is active it shows:

- file name;
- bound connection name;
- Oracle username;
- connection source;
- transaction state;
- row limit;
- actions for switch connection, add connection, run current SQL, run script, explain plan, commit, and rollback.

## Script Connection Binding

SQL files are bound to connections by file name in `.vscode/oracle-workspace.json`:

```json
{
  "scriptConnections": {
    "查客户信息.sql": "DEV_KGDB"
  },
  "recentSchemas": {},
  "favoriteSchemas": {}
}
```

The SQL file itself stays clean, so sharing the script does not leak local connection choices.

## Keymap Profiles

Switch the active profile with `Oracle Script Workspace: Switch Keymap Profile`.

SQL Developer profile:

```text
Ctrl+Enter    Run current or selected SQL
F5            Run script
```

PL/SQL Developer profile:

```text
F8            Run current or selected SQL
F5            Explain plan
```

Commit and rollback are intentionally not bound to high-frequency shortcuts in the first version.

## Transactions

Oracle execution is designed around manual transactions:

- DML is executed with `autoCommit: false`.
- `Oracle Script Workspace: Commit` commits the active connection session.
- `Oracle Script Workspace: Rollback` rolls back the active connection session.
- The status bar shows `uncommitted` when a session has pending DML.

## Results

The result model supports:

- one result batch per command execution;
- one result item for a single query;
- multiple result items for multi-statement script execution;
- query rows, update counts, elapsed time, and errors.

The Webview renders result tabs and supports cell, row, CSV copy, and CSV export for query results. Fetch Next and Fetch All are shown when more rows are available; cursor pagination is reserved for a later backend enhancement.

## Object Tree and Details

The connection tree is registered under the Oracle Script Workspace activity bar. It supports:

- configured connection nodes;
- default schema nodes;
- object type groups;
- object nodes with an `Open Object Details` command;
- real metadata queries through the active Oracle session.

The object details Webview is a tabbed inspector. DDL/source tabs support copy and opening the content as a SQL document. The editor object-name resolver can detect selected object names and `SCHEMA.OBJECT_NAME` tokens, search matching Oracle objects, and open details for the selected match.

## Subscription Entry

`Oracle Script Workspace: Manage License` opens the current license panel. Version `0.0.1` keeps all features enabled and stores only placeholder license state in VS Code global state. Future Stripe, Paddle, or custom-license integration should replace `LicenseService` without changing the database workflow surface.

## Language

The extension follows the VS Code display language. English is the default fallback, and Simplified Chinese is provided through VS Code's official localization files:

- `package.nls.json`
- `package.nls.zh-cn.json`
- `l10n/bundle.l10n.json`
- `l10n/bundle.l10n.zh-cn.json`

## Contact

For issues, suggestions, or Oracle compatibility feedback, use GitHub Issues:

- https://github.com/XiaYeAI/oracle-script-workspace/issues

You can also contact the maintainer by email:

- guanyezhui@163.com

## Development

Install dependencies:

```powershell
npm install
```

Compile:

```powershell
npm run compile
```

Run tests:

```powershell
npm test
```

Package a VSIX:

```powershell
npm run package
```
