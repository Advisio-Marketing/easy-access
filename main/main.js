// --- Imports ---
const {
  app,
  shell,
  BaseWindow,
  WebContentsView,
  session,
  net,
  ipcMain,
  dialog,
} = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
let is;
try {
  ({ is } = require("@electron-toolkit/utils"));
} catch {
  is = { dev: !app.isPackaged };
}
let optimizer;
try {
  ({ optimizer } = require("@electron-toolkit/utils"));
} catch {
  optimizer = { watchWindowShortcuts: () => {} };
}
let electronApp;
try {
  ({ electronApp } = require("@electron-toolkit/utils"));
} catch {
  electronApp = { setAppUserModelId: () => {} };
}
// --------------

// --- Konfigurace Logování ---
try {
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = "info";
  log.transports.file.resolvePath = () =>
    path.join(app.getPath("userData"), "logs/main.log");
  log.info(`--- Easy Access Application starting (PID: ${process.pid}) ---`);
  log.info(`App Path: ${app.getAppPath()}`);
  log.info(`User Data Path: ${app.getPath("userData")}`);
  log.info(`Is Dev: ${is.dev}`);
} catch (e) {
  console.error("FATAL: Logging setup failed:", e);
}
// ---------------------------

// --- Globální Proměnné ---
let mainWindow = null;
let reactUiView = null;
let webViews = {}; // { accountId: { view: WebContentsView, session: Session, url: string, name: string } }
let activeWebViewId = null;
let accountList = null; // Seznam účtů, načte se až na vyžádání
let SIDEBAR_WIDTH = 250;
let TAB_BAR_HEIGHT = 40;
let isMainLayoutActive = false; // Začínáme s úvodní obrazovkou

// --- Statické Consent Cookies ---
const consentCookies = {
  ocm_consent: "1",
  didomi_token:
    "eyJ1c2VyX2lkIjoiMTk2MzQ4ZTktMDlhYi02YzUyLWI5ZTUtOWZlMWUxN2RjMWI4IiwiY3JlYXRlZCI6IjIwMjUtMDQtMTRUMTM6NDg6MDAuNTM4WiIsInVwZGF0ZWQiOiIyMDI1LTA0LTE0VDEzOjQ4OjIwLjE0OVoiLCJ2ZW5kb3JzIjp7ImVuYWJsZWQiOlsiZ29vZ2xlIiwidHdpdHRlciIsInNhbGVzZm9yY2UiLCJjOnNlbnRyeSIsImM6YmluZy1hZHMiLCJjOnlhaG9vLWFkLWV4Y2hhbmdlIiwiYzp5YWhvby1hbmFseXRpY3MiLCJjOnlvdXR1YmUiLCJjOmhvdGphciIsImM6eWFob28tYWQtbWFuYWdlci1wbHVzIiwiYzpmbGl4bWVkaWEiLCJjOnNhcyIsImM6Z29vZ2xlYW5hLTRUWG5KaWdSIiwiYzpoZXVyZWthIiwiYzpzdGFydHF1ZXN0LUM0NlZLWXFIIiwiYzp5b3R0bHktdzk5aUdkRzMiLCJjOm9uZXNpZ25hbC02RDJVcHJpZiIsImM6dHZub3Zhcy10YzZMMk1qSyIsImM6cHJlYmlkb3JnLUhpamlyWWRiIiwiYzptZWlyby1wUm5DYnlRNyIsImM6dGlrdG9rLWFpZ21KcGplIiwiYzpkaWRvbWkiXX0sInB1cnBvc2VzIjp7ImVuYWJsZWQiOlsiZ2VvbG9jYXRpb25fZGF0YSIsImRldmljZV9jaGFyYWN0ZXJpc3RpY3MiLCJjb252ZXJzaW9uLU55eWFxd3lWIl19LCJ2ZW5kb3JzX2xpIjp7ImVuYWJsZWQiOlsiZ29vZ2xlIiwiYzpoZXVyZWthIiwiYzpzdGFydHF1ZXN0LUM0NlZLWXFIIiwiYzp5b3R0bHktdzk5aUdkRzMiLCJjOm9uZXNpZ25hbC02RDJVcHJpZiJdfSwicHVycG9zZXNfbGkiOnsiZW5hYmxlZCI6WyJnZW9fbWFya2V0aW5nX3N0dWRpZXMiXX0sInZlcnNpb24iOjIsImFjIjoiQkVtQUVBRmtDSklBLkJFbUFFQUZrQ0pJQSJ9",
  "euconsent-v2":
    "CQP2yAAQP2yAAAHABBENBkFsAP_gAEPgAATIJ1QPgAFQAMAA0ACAAFQAMAAcABAACQAFoAMgAaAA6AB6AEUAI4ASQAmABQACoAFsAL4AZQA0QBsAG2AQYBCACIAEUAI4ATQAnQBPgCkAFaAMMAaQA5AB4gD9AIGAQiAjgCOgFIAKaAXyA_4EAAI1AR0AmkBSACpAFXQLLAswBbgC4QFzALzAYyBAUCBAEZgJsATqBOuA6ABUADgAIAASAAyABoAEcAJgAUAA0ACEAEQAI4ATQArQBhgDkAH6AQiAjgCOgH_AUgAqQBbgC5gF5gTYAnKBOsAA.f_wACHwAAAAA",
};

// -----------------------------

// --- API Funkce ---
async function fetchAccountList() {
  log.info("Attempting to fetch account list from API...");
  const requestUrl = "https://app.advisio.cz/api/system-list/heureka/"; // HTTPS
  const requestOptions = { method: "GET", url: requestUrl, timeout: 15000 };
  return new Promise((resolve, reject) => {
    const request = net.request(requestOptions);
    request.on("response", (response) => {
      log.info(`API Account List Status Code: ${response.statusCode}`);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return reject(
          new Error(
            `Account list fetch failed with status: ${response.statusCode}`
          )
        );
      }
      let body = "";
      response.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      response.on("end", () => {
        log.info("API account list response finished.");
        log.debug("Raw account list response body:", body);
        try {
          const jsonData = JSON.parse(body);
          if (Array.isArray(jsonData)) {
            log.info(
              `Successfully parsed ${jsonData.length} accounts from JSON.`
            );
            resolve(jsonData);
          } else {
            log.error(
              "Parsed account list response is not an array:",
              jsonData
            );
            reject(new Error("API did not return a valid account list array."));
          }
        } catch (e) {
          log.error("Failed to parse account list JSON:", e);
          reject(new Error(`Failed to parse account list JSON: ${e.message}`));
        }
      });
      response.on("error", (error) => {
        log.error(`API account list stream error: ${error.message}`);
        reject(error);
      });
    });
    request.on("error", (error) => {
      log.error(`API account list request error: ${error.message}`);
      reject(error);
    });
    log.info("Sending account list request (without custom headers)...");
    request.end();
  });
}

async function fetchAccountCookies(accountId) {
  log.info(`Attempting to fetch cookies for account ID: ${accountId}...`);
  const requestUrl = `https://app.advisio.cz/api/system-get/heureka/${accountId}/`; // HTTPS
  const requestOptions = { method: "GET", url: requestUrl, timeout: 15000 };
  return new Promise((resolve, reject) => {
    const request = net.request(requestOptions);
    request.on("response", (response) => {
      log.info(
        `API Cookies [${accountId}] Status Code: ${response.statusCode}`
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return reject(
          new Error(
            `Cookie fetch for ${accountId} failed with status: ${response.statusCode}`
          )
        );
      }
      let body = "";
      response.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      response.on("end", () => {
        log.info(`API cookies response for ${accountId} finished.`);
        log.debug(`Raw cookies response body [${accountId}]:`, body);
        try {
          const jsonData = JSON.parse(body);
          if (jsonData && typeof jsonData === "object") {
            log.info(`Successfully parsed cookies response for ${accountId}.`);
            resolve(jsonData);
          } else {
            log.warn(
              `API response for ${accountId} cookies was not a valid object.`
            );
            resolve(null);
          }
        } catch (e) {
          log.error(`Failed to parse cookies JSON for ${accountId}:`, e);
          reject(e);
        }
      });
      response.on("error", (error) => {
        log.error(
          `API cookies stream error for ${accountId}: ${error.message}`
        );
        reject(error);
      });
    });
    request.on("error", (error) => {
      log.error(`API cookies request error for ${accountId}: ${error.message}`);
      reject(error);
    });
    log.info(
      `Sending cookies request for ${accountId} (without custom headers)...`
    );
    request.end();
  });
}
// --- Konec API Funkcí ---

/** Aktualizuje rozložení okna */
function updateMainLayout() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const [windowWidth, windowHeight] = mainWindow.getContentSize();
    // React UI vždy zabírá celé okno
    if (reactUiView && !reactUiView.webContents.isDestroyed()) {
      reactUiView.setBounds({
        x: 0,
        y: 0,
        width: windowWidth,
        height: windowHeight,
      });
    }
    // Aktivní Web View (Content) se kreslí nad React UI vymezenou oblast
    Object.keys(webViews).forEach((id) => {
      const wvInfo = webViews[id];
      if (wvInfo?.view && !wvInfo.view.webContents.isDestroyed()) {
        const isActive = id === activeWebViewId && isMainLayoutActive;
        if (isActive) {
          // Nastavíme bounds jen pro aktivní view v hlavním layoutu
          wvInfo.view.setBounds({
            x: SIDEBAR_WIDTH,
            y: TAB_BAR_HEIGHT,
            width: windowWidth - SIDEBAR_WIDTH,
            height: windowHeight - TAB_BAR_HEIGHT,
          });
        }
      }
    });
  } catch (e) {
    log.error("Error updating main layout:", e);
  }
}

/** Vytvoří hlavní okno a načte React UI */
async function createWindow() {
  log.info("Creating BaseWindow for Easy Access...");
  if (optimizer?.watchWindowShortcuts) {
    app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });
  }

  mainWindow = new BaseWindow({
    width: 1200,
    minWidth: 600,
    height: 800,
    minHeight: 600,
    icon: path.join(
      __dirname,
      "./renderer/public/img/logos/easy-access-logo.ico"
    ),
    show: false,
    autoHideMenuBar: true,
    title: "Easy Access",
    backgroundColor: "#ffffff",
  });

  // Odstraněna původní logika ready-to-show,
  // místo toho bude okno zobrazeno, až se načte obsah React UI.
  mainWindow.on("resize", updateMainLayout);
  mainWindow.on("closed", () => {
    log.info("Main window closed.");
    webViews = {};
    activeWebViewId = null;
    mainWindow = null;
    reactUiView = null;
    isMainLayoutActive = false;
    accountList = null;
  });

  reactUiView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Správná cesta k preload.js
      sandbox: !is.dev,
      contextIsolation: true,
      nodeIntegration: false,
      // devTools: is.dev,
    },
  });
  mainWindow.contentView.addChildView(reactUiView);
  log.info("React UI WebContentsView added.");

  // Přidání posluchače did-finish-load pro zajištění zobrazení okna,
  // jakmile se načte obsah React UI.
  reactUiView.webContents.on("did-finish-load", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      log.info("Main window shown (after did-finish-load).");
      updateMainLayout();
    }
  });

  // --- Načtení React UI ---
  const viteDevServerUrl =
    process.env["ELECTRON_RENDERER_URL"] || "http://localhost:5173";
  const prodIndexPath = path.join(__dirname, "../dist/renderer/index.html");

  try {
    if (is.dev) {
      await reactUiView.webContents.loadURL(viteDevServerUrl);
    } else {
      await reactUiView.webContents.loadFile(prodIndexPath);
    }
    log.info("React UI finished loading attempt.");
  } catch (error) {
    log.error(
      `Failed to load React UI. Dev=${is.dev}. URL/Path: ${
        is.dev ? viteDevServerUrl : prodIndexPath
      } Error:`,
      error
    );
    try {
      await reactUiView.webContents.loadURL(
        `data:text/html;charset=utf-8,<h1>Chyba načítání UI</h1><p>Nepodařilo se načíst rozhraní aplikace.</p><pre>${error.message}</pre>`
      );
    } catch {}
  }
  // -------------------------

  // if (is.dev) {
  //   try {
  //     // Otevření DevTools pokud je aplikace v režimu vývoje
  //     reactUiView.webContents.openDevTools({ mode: "detach" });
  //   } catch (error) {
  //     log.error("Error opening React UI DevTools:", error);
  //   }
  // }
  log.info("createWindow function finished.");
} // End of createWindow

/** Zobrazí/Skryje WebViews podle activeWebViewId */
function showView(accountId) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  log.info(`Attempting to show view for ${accountId || "none"}`);
  let viewToShow = null;
  Object.keys(webViews).forEach((id) => {
    const wvInfo = webViews[id];
    const currentView = wvInfo?.view;
    if (currentView && !currentView.webContents.isDestroyed()) {
      if (id === accountId) {
        viewToShow = currentView;
        if (!mainWindow.contentView.children.includes(viewToShow)) {
          try {
            mainWindow.contentView.addChildView(viewToShow);
            log.info(`View for ${id} added.`);
          } catch (e) {
            log.error(`Error adding view ${id}:`, e);
            viewToShow = null;
          }
        }
      } else {
        if (mainWindow.contentView.children.includes(currentView)) {
          try {
            mainWindow.contentView.removeChildView(currentView);
            log.info(`View for ${id} removed.`);
          } catch (e) {
            log.warn(`Error removing view ${id}:`, e);
          }
        }
      }
    } else if (id !== accountId && wvInfo) {
      log.warn(`View for ${id} missing/destroyed, removing map entry.`);
      delete webViews[id];
    }
  });
  activeWebViewId = viewToShow ? accountId : null;
  updateMainLayout();
  if (activeWebViewId) {
    log.info(`View for ${activeWebViewId} is now active.`);
  } else {
    log.info("No view is active.");
  }
}

// --- IPC Handlery ---
ipcMain.handle("fetch-account-list", async () => {
  log.info("IPC: React UI requested account list fetch.");
  if (accountList !== null) {
    log.info("Returning cached account list.");
    return accountList;
  }
  try {
    const fetchedList = await fetchAccountList();
    accountList = fetchedList || [];
    return accountList;
  } catch (error) {
    log.error("IPC: Failed to fetch account list:", error);
    accountList = [];
    throw error;
  }
});

ipcMain.handle("show-main-layout", () => {
  log.info("IPC: React UI requested main layout.");
  if (!isMainLayoutActive) {
    isMainLayoutActive = true;
    updateMainLayout();
  }
  return { success: true };
});

ipcMain.handle("select-account", async (_event, accountInfo) => {
  const accountId = String(accountInfo.id);
  const accountName = accountInfo.name;
  const clientCountry = accountInfo?.client_country?.toUpperCase?.() || "CZ";

  log.info(
    `IPC: Request to open/select account ID: ${accountId} (${accountName}), country: ${clientCountry}`
  );

  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: "Main window closed." };
  }
  if (!isMainLayoutActive) {
    return { success: false, error: "Main layout not active yet." };
  }

  showView(null);

  if (
    webViews[accountId] &&
    !webViews[accountId].view.webContents.isDestroyed()
  ) {
    log.info(`View for ${accountId} exists, switching.`);
    showView(accountId);
    return { success: true, viewAlreadyExists: true, accountId };
  }

  log.info(`Creating new view for ${accountId}...`);
  if (reactUiView && !reactUiView.webContents.isDestroyed()) {
    reactUiView.webContents.send("tab-status-update", {
      accountId,
      status: "loading",
      name: accountName,
    });
  }

  try {
    const accountData = await fetchAccountCookies(accountId);
    const rrCookiesObject = accountData?.rr_cookies;

    // --- TLD a URL podle client_country ---
    const tldMap = {
      CZ: "cz",
      SK: "sk",
      HU: "hu",
      RO: "ro",
      PL: "pl",
    };
    const tld = tldMap[clientCountry] || "cz";
    const targetUrl = `https://www.heureka.${tld}`;
    const targetDomain = `.heureka.${tld}`;
    log.info(`Target URL set to: ${targetUrl}, Target Domain: ${targetDomain}`);
    // --------------------------------------

    const partition = `persist:${accountId}`;
    const newSession = session.fromPartition(partition);
    const newView = new WebContentsView({
      webPreferences: {
        session: newSession,
        sandbox: true,
        contextIsolation: false,
      },
    });

    const allCookiePromises = [];

    // --- Nastavení cookies z API ---
    if (rrCookiesObject && typeof rrCookiesObject === "object") {
      const cookieNames = Object.keys(rrCookiesObject);
      log.info(`Setting ${cookieNames.length} API cookies for ${accountId}`);
      cookieNames.forEach((name) => {
        const value = rrCookiesObject[name];
        const httpOnly =
          name === "SESSID_PHP" ||
          name === "__cf_bm" ||
          name.startsWith("hgSCI");
        const details = {
          url: targetUrl,
          name,
          value,
          domain: targetDomain,
          path: "/",
          secure: true,
          httpOnly,
        };
        allCookiePromises.push(
          newSession.cookies.set(details).catch((err) => {
            log.error(`[${accountId}] Err setting API cookie '${name}':`, err);
            return null;
          })
        );
      });
    } else {
      log.warn(`[${accountId}] No rr_cookies found in API response.`);
    }

    // --- Consent Cookies ---
    const consentCookieNames = Object.keys(consentCookies);
    log.info(`Setting ${consentCookieNames.length} Consent cookies`);
    consentCookieNames.forEach((name) => {
      const value = consentCookies[name];
      const details = {
        url: targetUrl,
        name,
        value,
        domain: targetDomain,
        path: "/",
        secure: true,
        httpOnly: false,
      };
      allCookiePromises.push(
        newSession.cookies.set(details).catch((err) => {
          log.error(
            `[${accountId}] Err setting Consent cookie '${name}':`,
            err
          );
          return null;
        })
      );
    });

    // --- Čekání na cookies ---
    const results = await Promise.all(allCookiePromises);
    log.info(
      `[${accountId}] Successfully set ${
        results.filter((r) => r !== null).length
      } cookies.`
    );

    // --- Uložení a načtení view ---
    webViews[accountId] = {
      view: newView,
      session: newSession,
      url: targetUrl,
      name: accountName,
    };
    showView(accountId);

    log.info(`Loading URL ${targetUrl} for ${accountId}...`);
    await newView.webContents.loadURL(targetUrl);
    log.info(`URL ${targetUrl} loaded for ${accountId}.`);

    if (reactUiView && !reactUiView.webContents.isDestroyed()) {
      reactUiView.webContents.send("tab-status-update", {
        accountId,
        status: "ready",
        name: accountName,
      });
    }

    return {
      success: true,
      viewAlreadyExists: false,
      accountId,
      name: accountName,
    };
  } catch (error) {
    log.error(`Failed during creation/loading for ${accountId}:`, error);
    if (reactUiView && !reactUiView.webContents.isDestroyed()) {
      reactUiView.webContents.send("tab-status-update", {
        accountId,
        status: "error",
        error: error.message,
      });
    }
    if (
      webViews[accountId]?.view &&
      !webViews[accountId].view.webContents.isDestroyed()
    ) {
      try {
        mainWindow.contentView.removeChildView(webViews[accountId].view);
      } catch {}
    }
    delete webViews[accountId];
    if (activeWebViewId === accountId) {
      showView(null);
    }
    return {
      success: false,
      error: error.message || "Unknown error during view creation.",
    };
  }
});
ipcMain.handle("switch-tab", (_event, accountId) => {
  log.info(`IPC: Request to switch active tab to: ${accountId}`);
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: "Main window closed." };
  }
  if (
    !webViews[accountId] ||
    webViews[accountId].view.webContents.isDestroyed()
  ) {
    log.error(
      `IPC: Cannot switch to non-existent/destroyed view: ${accountId}`
    );
    if (reactUiView && !reactUiView.webContents.isDestroyed()) {
      reactUiView.webContents.send("force-close-tab", accountId);
    }
    delete webViews[accountId];
    if (activeWebViewId === accountId) {
      activeWebViewId = null;
    }
    return { success: false, error: "View not found or destroyed." };
  }
  showView(accountId);
  return { success: true };
});

ipcMain.handle("reset-to-home", async () => {
  log.info("IPC: Reset to home requested — closing all WebViews.");
  Object.values(webViews).forEach(({ view }) => {
    if (mainWindow && view && !view.webContents.isDestroyed()) {
      try {
        mainWindow.contentView.removeChildView(view);
      } catch (e) {
        log.warn("Error removing view during reset-to-home:", e);
      }
    }
  });
  webViews = {};
  activeWebViewId = null;
  return { success: true };
});

ipcMain.handle("close-tab", async (_event, accountId) => {
  log.info(`IPC: Request to close tab: ${accountId}`);
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: "Main window closed." };
  }
  const viewInfo = webViews[accountId];
  if (viewInfo) {
    const viewToClose = viewInfo.view;
    const sessionToClear = viewInfo.session;
    log.info(`Closing tab and view for ${accountId}.`);
    if (viewToClose && !viewToClose.webContents.isDestroyed()) {
      try {
        mainWindow.contentView.removeChildView(viewToClose);
      } catch (e) {
        log.warn("Error removing view on close:", e);
      }
    }
    delete webViews[accountId];
    if (sessionToClear) {
      try {
        await sessionToClear.clearStorageData();
        await sessionToClear.clearCache();
        log.info(
          `Session storage/cache cleared for partition: ${sessionToClear.storagePath}`
        );
      } catch (error) {
        log.error(
          `Failed to clear session storage/cache for ${accountId}:`,
          error
        );
      }
    }
    if (activeWebViewId === accountId) {
      const openIds = Object.keys(webViews);
      const nextActiveId =
        openIds.length > 0 ? openIds[openIds.length - 1] : null;
      log.info(`Activating other tab after close: ${nextActiveId}`);
      showView(nextActiveId);
      if (reactUiView && !reactUiView.webContents.isDestroyed()) {
        reactUiView.webContents.send("activate-tab", nextActiveId);
      }
    }
    return { success: true };
  } else {
    log.warn(`IPC: Tried to close non-existent view: ${accountId}`);
    return { success: false, error: "Account view not found." };
  }
});
// -----------------------------

// --- Application Lifecycle & Auto Update ---
app.whenReady().then(async () => {
  log.info("App is ready.");
  // if(electronApp?.setAppUserModelId) electronApp.setAppUserModelId('com.electron.easyaccess');

  accountList = null; // Resetujeme při startu, načte se až na vyžádání

  log.info("Proceeding to create window...");
  createWindow().catch((error) => {
    log.error("Unhandled error during createWindow execution:", error);
  });

  log.info("Checking for updates after window creation...");
  // autoUpdater.checkForUpdatesAndNotify(); // Odkomentujte, až budete mít nastavený server

  app.on("activate", () => {
    if (mainWindow === null) {
      log.info("App activated, creating window...");
      createWindow().catch((error) => {
        log.error(
          "Unhandled error during createWindow execution on activate:",
          error
        );
      });
    }
  });
});

// --- AutoUpdater Event Listeners ---
autoUpdater.on("checking-for-update", () => {
  log.info("Checking for update...");
});
autoUpdater.on("update-available", (info) => {
  log.info("Update available.", info);
});
autoUpdater.on("update-not-available", (info) => {
  log.info("Update not available.", info);
});
autoUpdater.on("error", (err) => {
  log.error("Error in auto-updater. " + err);
});
autoUpdater.on("download-progress", (p) => {
  log.info(`Update Downloaded ${Math.round(p.percent)}%`);
});
autoUpdater.on("update-downloaded", (info) => {
  log.info("Update downloaded; prompting user.", info);
  dialog
    .showMessageBox({
      type: "info",
      buttons: ["Restartovat", "Později"],
      defaultId: 0,
      cancelId: 1,
      title: "Aktualizace Easy Access",
      message: "Nová verze je připravena.",
      detail: "Restartujte aplikaci pro instalaci aktualizace.",
    })
    .then(({ response }) => {
      if (response === 0) {
        log.info("User chose to restart.");
        autoUpdater.quitAndInstall();
      } else {
        log.info("User chose to install later.");
      }
    });
});
// ----------------------------------

// --- Ostatní Lifecycle Handlery ---
app.on("window-all-closed", () => {
  log.info("All windows closed.");
  if (process.platform !== "darwin") {
    log.info("Quitting app...");
    app.quit();
  }
});
process.on("unhandledRejection", (reason, promise) => {
  log.error("Unhandled Rejection at:", promise, "reason:", reason);
});
