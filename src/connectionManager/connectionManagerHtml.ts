import { ConnectionManagerState } from "./connectionManagerTypes";

export interface ConnectionManagerLabels {
  title: string;
  connections: string;
  add: string;
  edit: string;
  duplicate: string;
  delete: string;
  test: string;
  setCurrent: string;
  connectionsTab: string;
  tnsNamesTab: string;
  oracleClientTab: string;
  savedConnections: string;
  customOracle: string;
  tnsAlias: string;
  connectionName: string;
  username: string;
  password: string;
  rememberPassword: string;
  note: string;
  host: string;
  port: string;
  connectionIdentifier: string;
  serviceName: string;
  sid: string;
  save: string;
  cancel: string;
  tnsPaths: string;
  addPath: string;
  reloadAliases: string;
  aliases: string;
  parseErrors: string;
  sourceFile: string;
  validationNameRequired: string;
  validationUsernameRequired: string;
  validationHostRequired: string;
  validationPortRequired: string;
  validationServiceOrSidRequired: string;
  validationServiceNameRequired: string;
  validationSidRequired: string;
  validationAliasRequired: string;
  validationDuplicateName: string;
  tnsLoginTitle: string;
  alias: string;
  testLogin: string;
  saveLogin: string;
  saveAndSetCurrent: string;
  loginNamePreview: string;
  clientProfile: string;
  clientProfiles: string;
  profileName: string;
  clientMode: string;
  thinMode: string;
  thickMode: string;
  oracleClientLibraryDir: string;
  oracleClientConfigDir: string;
  browse: string;
  saveClient: string;
  saveClientProfiles: string;
  reloadRequired: string;
  clientSettingsSaved: string;
  clientProfilesSaved: string;
  optional: string;
}

const DEFAULT_LABELS: ConnectionManagerLabels = {
  title: "Connection Manager",
  connections: "Connections",
  add: "Add",
  edit: "Edit",
  duplicate: "Duplicate",
  delete: "Delete",
  test: "Test Connection",
  setCurrent: "Set Current",
  connectionsTab: "Connections",
  tnsNamesTab: "TNS Names",
  oracleClientTab: "Oracle Client",
  savedConnections: "Saved Connections",
  customOracle: "Custom Oracle",
  tnsAlias: "TNS Alias",
  connectionName: "Connection Name",
  username: "Username",
  password: "Password",
  rememberPassword: "Remember password",
  note: "Note",
  host: "Host",
  port: "Port",
  connectionIdentifier: "Connection Identifier",
  serviceName: "Service Name",
  sid: "SID",
  save: "Save",
  cancel: "Cancel",
  tnsPaths: "tnsnames.ora paths",
  addPath: "Add Path",
  reloadAliases: "Reload Aliases",
  aliases: "Aliases",
  parseErrors: "Parse Errors",
  sourceFile: "Source file",
  validationNameRequired: "Connection name is required.",
  validationUsernameRequired: "Username is required.",
  validationHostRequired: "Host is required.",
  validationPortRequired: "Port must be a positive integer.",
  validationServiceOrSidRequired: "Service Name or SID is required.",
  validationServiceNameRequired: "Service Name is required.",
  validationSidRequired: "SID is required.",
  validationAliasRequired: "TNS alias is required.",
  validationDuplicateName: "Connection name already exists.",
  tnsLoginTitle: "TNS Alias Login",
  alias: "Alias",
  testLogin: "Test Login",
  saveLogin: "Save Login",
  saveAndSetCurrent: "Save and Set Current Script",
  loginNamePreview: "Saved connection name",
  clientProfile: "Client profile",
  clientProfiles: "Client profiles",
  profileName: "Profile name",
  clientMode: "Client mode",
  thinMode: "Thin",
  thickMode: "Thick",
  oracleClientLibraryDir: "Oracle Client / Instant Client directory",
  oracleClientConfigDir: "Oracle Net configuration directory",
  browse: "Browse",
  saveClient: "Save Oracle Client Settings",
  saveClientProfiles: "Save Oracle Client Profiles",
  reloadRequired: "Reload VS Code after changing Oracle Client mode or directories.",
  clientSettingsSaved: "Oracle Client settings saved. Reload VS Code before testing changed client mode.",
  clientProfilesSaved: "Oracle Client profiles saved. Reload VS Code before switching between different profiles.",
  optional: "optional"
};

export function renderConnectionManagerHtml(
  state: ConnectionManagerState,
  labels: ConnectionManagerLabels = DEFAULT_LABELS
): string {
  const selected = state.connections.find((connection) => connection.name === state.selectedName);
  const initial = selected ?? {
    name: "",
    type: "custom",
    host: "",
    port: 1521,
    serviceName: "",
    sid: "",
    username: "",
    note: ""
  };
  const initialIdentifierType = initial.type === "custom" && initial.sid && !initial.serviceName ? "sid" : "serviceName";
  const initialClientProfileName = initial.clientProfileName ?? state.clientProfiles[0]?.name ?? "Default";
  const firstAlias = state.aliases[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { color: var(--vscode-foreground); font-family: var(--vscode-font-family); padding: 14px; }
    h1 { font-size: 18px; margin: 0 0 12px; }
    h2 { font-size: 13px; margin: 14px 0 8px; color: var(--vscode-descriptionForeground); text-transform: uppercase; }
    .tabs, .segments { display: flex; gap: 0; margin-bottom: 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    .tabs button, .segments button { background: transparent; color: var(--vscode-foreground); border: 0; border-bottom: 2px solid transparent; padding: 7px 10px; cursor: pointer; }
    .tabs button.active, .segments button.active { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border-bottom-color: var(--vscode-focusBorder); }
    .layout { display: grid; grid-template-columns: minmax(250px, 32%) 1fr; gap: 16px; }
    .list { border: 1px solid var(--vscode-panel-border); min-height: 128px; max-height: 380px; overflow: auto; }
    .row { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 7px 8px; border-bottom: 1px solid var(--vscode-panel-border); cursor: pointer; }
    .row.active { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
    .muted { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 5px 10px; cursor: pointer; }
    button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    button:disabled { opacity: .55; cursor: not-allowed; }
    form, .panel { border: 1px solid var(--vscode-panel-border); padding: 12px; }
    label { display: block; margin: 8px 0 4px; }
    input, select, textarea { width: 100%; box-sizing: border-box; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); padding: 5px; }
    textarea { min-height: 54px; resize: vertical; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .hidden { display: none; }
    .status { margin-top: 10px; min-height: 20px; white-space: pre-wrap; }
    .error { color: var(--vscode-errorForeground); }
    .ok { color: var(--vscode-testing-iconPassed); }
    code { color: var(--vscode-textPreformat-foreground); }
  </style>
</head>
<body>
  <h1>${escape(labels.title)}</h1>
  <nav class="tabs">
    <button type="button" id="tabConnections" class="active">${escape(labels.connectionsTab)}</button>
    <button type="button" id="tabTns">${escape(labels.tnsNamesTab)}</button>
    <button type="button" id="tabClient">${escape(labels.oracleClientTab)}</button>
  </nav>

  <section id="connectionsPage">
    <div class="layout">
      <aside>
        <h2>${escape(labels.savedConnections)}</h2>
        <div class="toolbar"><button id="new">${escape(labels.add)}</button></div>
        <div class="list" id="connections">
          ${state.connections.map((connection) => renderConnectionRow(connection, state.selectedName)).join("")}
        </div>
        <div class="toolbar">
          <button id="edit" class="secondary" ${selected ? "" : "disabled"}>${escape(labels.edit)}</button>
          <button id="duplicate" class="secondary" ${selected ? "" : "disabled"}>${escape(labels.duplicate)}</button>
          <button id="delete" class="secondary" ${selected ? "" : "disabled"}>${escape(labels.delete)}</button>
          <button id="setCurrent" class="secondary" ${selected ? "" : "disabled"}>${escape(labels.setCurrent)}</button>
        </div>
      </aside>
      <main>
        <form id="form">
          <div class="segments">
            <button type="button" id="typeCustom">${escape(labels.customOracle)}</button>
            <button type="button" id="typeTns">${escape(labels.tnsAlias)}</button>
          </div>
          <input type="hidden" id="originalName" value="${escapeAttr(selected?.name ?? "")}">
          <input type="hidden" id="mode" value="${escapeAttr(state.mode)}">
          <label>${escape(labels.connectionName)}</label>
          <input id="name" value="${escapeAttr(initial.name)}">
          <div class="grid">
            <div><label>${escape(labels.username)}</label><input id="username" value="${escapeAttr(initial.username)}"></div>
            <div><label>${escape(labels.password)}</label><input id="password" type="password" autocomplete="off"></div>
          </div>
          <label><input id="rememberPassword" type="checkbox"> ${escape(labels.rememberPassword)}</label>
          <label>${escape(labels.clientProfile)}</label>
          <select id="clientProfile">
            ${renderClientProfileOptions(state.clientProfiles, initialClientProfileName)}
          </select>
          <label>${escape(labels.note)}</label>
          <textarea id="note">${escape(initial.note ?? "")}</textarea>
          <section id="customFields">
            <div class="grid">
              <div><label>${escape(labels.host)}</label><input id="host" value="${escapeAttr(initial.type === "custom" ? initial.host : "")}"></div>
              <div><label>${escape(labels.port)}</label><input id="port" value="${escapeAttr(initial.type === "custom" ? String(initial.port) : "1521")}"></div>
            </div>
            <label>${escape(labels.connectionIdentifier)}</label>
            <div class="segments">
              <button type="button" id="identifierService">${escape(labels.serviceName)}</button>
              <button type="button" id="identifierSid">${escape(labels.sid)}</button>
            </div>
            <div id="serviceNameField"><input id="serviceName" value="${escapeAttr(initial.type === "custom" ? initial.serviceName ?? "" : "")}"></div>
            <div id="sidField"><input id="sid" value="${escapeAttr(initial.type === "custom" ? initial.sid ?? "" : "")}"></div>
          </section>
          <section id="tnsFields">
            <label>${escape(labels.tnsAlias)}</label>
            <select id="tnsAlias">
              <option value="${escapeAttr(initial.type === "tnsnames" ? initial.tnsAlias : "")}">${escape(initial.type === "tnsnames" ? initial.tnsAlias : "")}</option>
              ${state.aliases.map((item) => `<option value="${escapeAttr(item.alias)}">${escape(item.alias)} - ${escape(item.sourcePath)}</option>`).join("")}
            </select>
          </section>
          <div class="toolbar">
            <button type="button" id="test">${escape(labels.test)}</button>
            <button type="submit">${escape(labels.save)}</button>
            <button type="button" id="cancel" class="secondary">${escape(labels.cancel)}</button>
          </div>
        </form>
      </main>
    </div>
  </section>

  <section id="tnsPage" class="hidden">
    <div class="layout">
      <aside>
        <h2>${escape(labels.tnsPaths)}</h2>
        <div class="list">
          ${state.tnsnamesPaths.map((item) => `<div class="row"><span><code>${escape(item)}</code></span><button class="secondary remove-path" data-path="${escapeAttr(item)}">Remove</button></div>`).join("")}
        </div>
        <div class="toolbar">
          <button id="addPath" class="secondary">${escape(labels.addPath)}</button>
          <button id="reloadAliases" class="secondary">${escape(labels.reloadAliases)}</button>
        </div>
        <h2>${escape(labels.aliases)}</h2>
        <div class="list" id="aliases">
          ${state.aliases.map((item, index) => `<div class="row ${index === 0 ? "active" : ""}" data-alias="${escapeAttr(item.alias)}" data-source="${escapeAttr(item.sourcePath)}"><span>${escape(item.alias)}<div class="muted">${escape(item.sourcePath)}</div></span></div>`).join("")}
        </div>
        <h2>${escape(labels.parseErrors)}</h2>
        <div class="list">
          ${state.parseErrors.map((item) => `<div class="row"><span class="error">${escape(item.message)}<div class="muted">${escape(item.sourcePath)}</div></span></div>`).join("")}
        </div>
      </aside>
      <main>
        <div class="panel">
          <h2>${escape(labels.tnsLoginTitle)}</h2>
          <label>${escape(labels.alias)}</label>
          <input id="tnsLoginAlias" readonly value="${escapeAttr(firstAlias?.alias ?? "")}">
          <div class="muted">${escape(labels.sourceFile)}: <span id="tnsLoginSource">${escape(firstAlias?.sourcePath ?? "")}</span></div>
          <div class="grid">
            <div><label>${escape(labels.username)}</label><input id="tnsUsername"></div>
            <div><label>${escape(labels.password)}</label><input id="tnsPassword" type="password" autocomplete="off"></div>
          </div>
          <label><input id="tnsRememberPassword" type="checkbox"> ${escape(labels.rememberPassword)}</label>
          <label>${escape(labels.clientProfile)}</label>
          <select id="tnsClientProfile">
            ${renderClientProfileOptions(state.clientProfiles, state.clientProfiles[0]?.name ?? "Default")}
          </select>
          <div class="muted">${escape(labels.loginNamePreview)}: <code id="tnsLoginName"></code></div>
          <div class="toolbar">
            <button type="button" id="testTnsLogin">${escape(labels.testLogin)}</button>
            <button type="button" id="saveTnsLogin">${escape(labels.saveLogin)}</button>
            <button type="button" id="saveTnsAndSetCurrent">${escape(labels.saveAndSetCurrent)}</button>
          </div>
        </div>
      </main>
    </div>
  </section>

  <section id="clientPage" class="hidden">
    <div class="panel">
      <h2>${escape(labels.clientProfiles)}</h2>
      <div class="list">
        ${state.clientProfiles.map((profile) => `<div class="row"><span>${escape(profile.name)}<div class="muted">${escape(profile.mode)}${profile.libraryDir ? ` / ${escape(profile.libraryDir)}` : ""}</div></span></div>`).join("")}
      </div>
      <label>${escape(labels.profileName)}</label>
      <input id="clientProfileName" value="${escapeAttr(state.clientOptions.name ?? state.clientProfiles[0]?.name ?? "Default")}">
      <label>${escape(labels.clientMode)}</label>
      <div class="segments">
        <button type="button" id="clientThin">${escape(labels.thinMode)}</button>
        <button type="button" id="clientThick">${escape(labels.thickMode)}</button>
      </div>
      <label>${escape(labels.oracleClientLibraryDir)}</label>
      <div class="grid">
        <input id="clientLibraryDir" value="${escapeAttr(state.clientOptions.libraryDir ?? "")}">
        <button type="button" id="browseClientLibrary" class="secondary">${escape(labels.browse)}</button>
      </div>
      <label>${escape(labels.oracleClientConfigDir)} (${escape(labels.optional)})</label>
      <div class="grid">
        <input id="clientConfigDir" value="${escapeAttr(state.clientOptions.configDir ?? "")}">
        <button type="button" id="browseClientConfig" class="secondary">${escape(labels.browse)}</button>
      </div>
      <p class="muted">${escape(labels.reloadRequired)}</p>
      <div class="toolbar">
        <button type="button" id="saveClientOptions">${escape(labels.saveClientProfiles)}</button>
      </div>
    </div>
  </section>

  <div id="status" class="status"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const labels = ${JSON.stringify(labels)};
    const connections = ${JSON.stringify(state.connections)};
    const clientProfiles = ${JSON.stringify(state.clientProfiles)};
    let type = ${JSON.stringify(initial.type)};
    let identifierType = ${JSON.stringify(initialIdentifierType)};
    let clientMode = ${JSON.stringify(state.clientOptions.mode)};

    const $ = (id) => document.getElementById(id);
    function status(message, kind = "error") {
      $("status").className = "status " + kind;
      $("status").textContent = message;
    }
    function post(action, extra = {}) { vscode.postMessage({ action, ...extra }); }

    function showPage(page) {
      $("connectionsPage").classList.toggle("hidden", page !== "connections");
      $("tnsPage").classList.toggle("hidden", page !== "tns");
      $("clientPage").classList.toggle("hidden", page !== "client");
      $("tabConnections").classList.toggle("active", page === "connections");
      $("tabTns").classList.toggle("active", page === "tns");
      $("tabClient").classList.toggle("active", page === "client");
    }
    $("tabConnections").addEventListener("click", () => showPage("connections"));
    $("tabTns").addEventListener("click", () => showPage("tns"));
    $("tabClient").addEventListener("click", () => showPage("client"));

    function setType(next) {
      type = next;
      $("typeCustom").classList.toggle("active", type === "custom");
      $("typeTns").classList.toggle("active", type === "tnsnames");
      $("customFields").classList.toggle("hidden", type !== "custom");
      $("tnsFields").classList.toggle("hidden", type !== "tnsnames");
    }
    setType(type);
    function setIdentifierType(next) {
      identifierType = next;
      $("identifierService").classList.toggle("active", identifierType === "serviceName");
      $("identifierSid").classList.toggle("active", identifierType === "sid");
      $("serviceNameField").classList.toggle("hidden", identifierType !== "serviceName");
      $("sidField").classList.toggle("hidden", identifierType !== "sid");
    }
    setIdentifierType(identifierType);
    function setClientMode(next) {
      clientMode = next;
      $("clientThin").classList.toggle("active", clientMode === "thin");
      $("clientThick").classList.toggle("active", clientMode === "thick");
    }
    setClientMode(clientMode);

    function currentConnection() {
      const base = {
        name: $("name").value.trim(),
        type,
        username: $("username").value.trim(),
        clientProfileName: $("clientProfile").value.trim() || undefined,
        note: $("note").value.trim() || undefined
      };
      if (type === "custom") {
        return {
          ...base,
          type: "custom",
          host: $("host").value.trim(),
          port: Number($("port").value.trim()),
          serviceName: identifierType === "serviceName" ? $("serviceName").value.trim() || undefined : undefined,
          sid: identifierType === "sid" ? $("sid").value.trim() || undefined : undefined
        };
      }
      return { ...base, type: "tnsnames", tnsAlias: $("tnsAlias").value.trim() };
    }
    function validate(connection) {
      const original = $("originalName").value;
      if (!connection.name) return labels.validationNameRequired;
      if (!connection.username) return labels.validationUsernameRequired;
      if (connections.some((item) => item.name === connection.name && item.name !== original)) return labels.validationDuplicateName;
      if (connection.type === "custom") {
        if (!connection.host) return labels.validationHostRequired;
        if (!Number.isInteger(connection.port) || connection.port <= 0) return labels.validationPortRequired;
        if (identifierType === "serviceName" && !connection.serviceName) return labels.validationServiceNameRequired;
        if (identifierType === "sid" && !connection.sid) return labels.validationSidRequired;
        if (!connection.serviceName && !connection.sid) return labels.validationServiceOrSidRequired;
      }
      if (connection.type === "tnsnames" && !connection.tnsAlias) return labels.validationAliasRequired;
      return undefined;
    }
    function tnsLoginConnection() {
      const alias = $("tnsLoginAlias").value.trim();
      const username = $("tnsUsername").value.trim();
      return {
        name: alias && username ? alias + "@" + username : "",
        type: "tnsnames",
        tnsAlias: alias,
        username,
        clientProfileName: $("tnsClientProfile").value.trim() || undefined
      };
    }
    function updateTnsLoginName() {
      const connection = tnsLoginConnection();
      $("tnsLoginName").textContent = connection.name;
    }
    function validateTnsLogin(connection) {
      if (!connection.tnsAlias) return labels.validationAliasRequired;
      if (!connection.username) return labels.validationUsernameRequired;
      return undefined;
    }
    updateTnsLoginName();

    document.querySelectorAll("[data-connection]").forEach((row) => row.addEventListener("click", () => post("editConnection", { connectionName: row.dataset.connection })));
    document.querySelectorAll("[data-alias]").forEach((row) => row.addEventListener("click", () => {
      document.querySelectorAll("[data-alias]").forEach((item) => item.classList.remove("active"));
      row.classList.add("active");
      $("tnsLoginAlias").value = row.dataset.alias || "";
      $("tnsLoginSource").textContent = row.dataset.source || "";
      updateTnsLoginName();
    }));
    document.querySelectorAll(".remove-path").forEach((button) => button.addEventListener("click", () => post("removeTnsPath", { path: button.dataset.path })));
    $("typeCustom").addEventListener("click", () => setType("custom"));
    $("typeTns").addEventListener("click", () => setType("tnsnames"));
    $("identifierService").addEventListener("click", () => setIdentifierType("serviceName"));
    $("identifierSid").addEventListener("click", () => setIdentifierType("sid"));
    $("clientThin").addEventListener("click", () => setClientMode("thin"));
    $("clientThick").addEventListener("click", () => setClientMode("thick"));
    $("new").addEventListener("click", () => post("newConnection"));
    $("edit").addEventListener("click", () => post("editConnection", { connectionName: $("originalName").value }));
    $("duplicate").addEventListener("click", () => post("duplicateConnection", { connectionName: $("originalName").value }));
    $("delete").addEventListener("click", () => post("deleteConnection", { connectionName: $("originalName").value }));
    $("setCurrent").addEventListener("click", () => post("setCurrentScriptConnection", { connectionName: $("originalName").value }));
    $("addPath").addEventListener("click", () => post("addTnsPath"));
    $("reloadAliases").addEventListener("click", () => post("reloadAliases"));
    $("cancel").addEventListener("click", () => post("cancel"));
    $("tnsUsername").addEventListener("input", updateTnsLoginName);
    $("test").addEventListener("click", () => {
      const connection = currentConnection();
      const error = validate(connection);
      if (error) return status(error);
      post("testConnection", { connection, password: $("password").value });
    });
    $("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const connection = currentConnection();
      const error = validate(connection);
      if (error) return status(error);
      post("saveConnection", {
        connection,
        originalName: $("originalName").value || undefined,
        password: $("password").value || undefined,
        rememberPassword: $("rememberPassword").checked
      });
    });
    $("testTnsLogin").addEventListener("click", () => {
      const connection = tnsLoginConnection();
      const error = validateTnsLogin(connection);
      if (error) return status(error);
      post("testTnsLogin", { connection, password: $("tnsPassword").value });
    });
    $("saveTnsLogin").addEventListener("click", () => saveTnsLogin(false));
    $("saveTnsAndSetCurrent").addEventListener("click", () => saveTnsLogin(true));
    function saveTnsLogin(setCurrentScript) {
      const connection = tnsLoginConnection();
      const error = validateTnsLogin(connection);
      if (error) return status(error);
      post("saveTnsLogin", {
        connection,
        password: $("tnsPassword").value || undefined,
        rememberPassword: $("tnsRememberPassword").checked,
        setCurrentScript
      });
    }
    $("browseClientLibrary").addEventListener("click", () => post("pickOracleClientLibraryDir"));
    $("browseClientConfig").addEventListener("click", () => post("pickOracleClientConfigDir"));
    $("saveClientOptions").addEventListener("click", () => {
      const profile = {
        name: $("clientProfileName").value.trim() || "Default",
        mode: clientMode,
        libraryDir: $("clientLibraryDir").value.trim() || undefined,
        configDir: $("clientConfigDir").value.trim() || undefined
      };
      post("saveClientProfiles", {
        profiles: [
          ...clientProfiles.filter((item) => item.name !== profile.name),
          profile
        ]
      });
    });
    window.addEventListener("message", (event) => {
      if (event.data?.action === "status") status(event.data.message, event.data.kind || "ok");
      if (event.data?.action === "pickedOracleClientDirectory") {
        if (event.data.field === "libraryDir") $("clientLibraryDir").value = event.data.path || "";
        if (event.data.field === "configDir") $("clientConfigDir").value = event.data.path || "";
      }
    });
  </script>
</body>
</html>`;
}

function renderConnectionRow(connection: ConnectionManagerState["connections"][number], selectedName?: string): string {
  const details = connection.type === "custom"
    ? `${connection.type} / ${connection.username} / ${connection.host}:${connection.port}${connection.serviceName ? ` / service=${connection.serviceName}` : ""}${connection.sid ? ` / SID=${connection.sid}` : ""}${connection.clientProfileName ? ` / ${connection.clientProfileName}` : ""}`
    : `${connection.type} / ${connection.username} / ${connection.tnsAlias}${connection.clientProfileName ? ` / ${connection.clientProfileName}` : ""}`;
  return `<div class="row ${connection.name === selectedName ? "active" : ""}" data-connection="${escapeAttr(connection.name)}"><span>${escape(connection.name)}<div class="muted">${escape(details)}</div></span><span>${escape(connection.type)}</span></div>`;
}

function renderClientProfileOptions(
  profiles: ConnectionManagerState["clientProfiles"],
  selectedName: string
): string {
  return profiles
    .map((profile) => `<option value="${escapeAttr(profile.name)}" ${profile.name === selectedName ? "selected" : ""}>${escape(profile.name)} (${escape(profile.mode)})</option>`)
    .join("");
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escape(value);
}
