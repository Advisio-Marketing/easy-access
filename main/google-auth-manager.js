const { BrowserWindow, app, net } = require("electron");
const fs = require("fs");
const path = require("path");
const { URLSearchParams } = require("url");

// --- Cesta ke skrytému souboru pro uložení tokenu ---
const TOKEN_PATH = path.join(app.getPath("userData"), ".google_token.json");

class GoogleAuthManager {
  constructor() {
    this.credentials = null;
    this.tokens = null; // Zde budeme držet načtené tokeny
    this.loadCredentials();
    this.loadTokens(); // Načteme tokeny při startu a zkontrolujeme jejich stáří
  }

  loadCredentials() {
    try {
      let credentialsPath;
      if (process.env.NODE_ENV === "development" || !app.isPackaged) {
        credentialsPath = path.join(__dirname, "../credentials.json");
      } else {
        credentialsPath = path.join(__dirname, "../credentials.json");
      }
      const credentialsFile = fs.readFileSync(credentialsPath, "utf8");
      this.credentials = JSON.parse(credentialsFile).installed;
      console.log("Google credentials loaded successfully");
    } catch (error) {
      console.error("Failed to load Google credentials:", error);
      this.credentials = null;
    }
  }

  // --- UPRAVENÁ METODA: Načtení tokenů s kontrolou stáří ---
  loadTokens() {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        const tokenFile = fs.readFileSync(TOKEN_PATH, "utf8");
        const storedTokens = JSON.parse(tokenFile);

        // Zkontrolujeme, zda má token časové razítko
        if (storedTokens.saved_at) {
          const oneDayInMs = 24 * 60 * 60 * 1000;
          const tokenAge = Date.now() - storedTokens.saved_at;

          if (tokenAge > oneDayInMs) {
            // Token je starší než 24 hodin, smažeme ho
            console.log("Token is older than 24 hours. Deleting...");
            fs.unlinkSync(TOKEN_PATH);
            this.tokens = null;
            return; // Dál nepokračujeme, token je neplatný
          }
        }

        // Token je v pořádku, načteme ho
        this.tokens = storedTokens;
        console.log("Tokens loaded from storage.");
      } else {
        console.log("Token file does not exist.");
      }
    } catch (error) {
      console.error("Failed to load or validate tokens:", error);
      this.tokens = null;
    }
  }

  // --- UPRAVENÁ METODA: Uložení tokenů s časovým razítkem ---
  saveTokens(tokens) {
    try {
      const storableTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || this.tokens?.refresh_token,
        expiry_date: Date.now() + (tokens.expires_in || 3599) * 1000,
        scope: tokens.scope,
        saved_at: Date.now(), // Přidáme časové razítko uložení
      };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(storableTokens, null, 2));
      this.tokens = storableTokens;
      console.log("Tokens saved successfully with a timestamp.");
    } catch (error) {
      console.error("Failed to save tokens:", error);
    }
  }

  // --- HLAVNÍ METODA: Zkombinuje tiché obnovení a plnou autentizaci ---
  async getAuthenticatedClient() {
    if (this.tokens && this.tokens.refresh_token) {
      console.log("Attempting to refresh token silently...");
      try {
        const result = await this.refreshAccessToken();
        console.log("Token refreshed successfully.");
        return result;
      } catch (error) {
        console.warn(
          "Failed to refresh token, proceeding to full auth:",
          error.message
        );
      }
    }
    console.log("No valid refresh token, starting full authentication flow.");
    return this.authenticate();
  }

  // --- Tiché obnovení access tokenu ---
  async refreshAccessToken() {
    if (!this.credentials) throw new Error("Google credentials not loaded");
    if (!this.tokens?.refresh_token)
      throw new Error("No refresh token available.");
    const tokenParams = new URLSearchParams({
      client_id: this.credentials.client_id,
      client_secret: this.credentials.client_secret,
      refresh_token: this.tokens.refresh_token,
      grant_type: "refresh_token",
    });
    const response = await net.fetch(this.credentials.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });
    const newTokens = await response.json();
    if (!response.ok || newTokens.error) {
      throw new Error(newTokens.error_description || "Failed to refresh token");
    }
    this.saveTokens(newTokens);
    const userInfo = await this.getUserInfo(this.tokens.access_token);
    return { tokens: this.tokens, userInfo };
  }

  // --- Plná autentizace s oknem prohlížeče ---
  authenticate() {
    if (!this.credentials) {
      throw new Error("Google credentials not loaded");
    }
    return new Promise((resolve, reject) => {
      let resolved = false;
      const authWindow = new BrowserWindow({
        width: 500,
        height: 600,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      const scopes = ["profile", "email"];
      const authParams = new URLSearchParams({
        client_id: this.credentials.client_id,
        redirect_uri: this.credentials.redirect_uris[0],
        scope: scopes.join(" "),
        response_type: "code",
        access_type: "offline",
      });
      const authUrl = `${this.credentials.auth_uri}?${authParams.toString()}`;
      authWindow.loadURL(authUrl);
      const markResolved = () => (resolved = true);
      authWindow.webContents.on("will-navigate", (event, navigationUrl) => {
        if (!resolved)
          this.handleRedirect(
            navigationUrl,
            authWindow,
            resolve,
            reject,
            markResolved
          );
      });
      authWindow.webContents.on("will-redirect", (event, redirectUrl) => {
        if (!resolved)
          this.handleRedirect(
            redirectUrl,
            authWindow,
            resolve,
            reject,
            markResolved
          );
      });
      authWindow.webContents.on(
        "did-get-redirect-request",
        (event, oldUrl, newUrl) => {
          if (!resolved)
            this.handleRedirect(
              newUrl,
              authWindow,
              resolve,
              reject,
              markResolved
            );
        }
      );
      authWindow.webContents.on("did-navigate", (event, navigationUrl) => {
        if (!resolved)
          this.handleRedirect(
            navigationUrl,
            authWindow,
            resolve,
            reject,
            markResolved
          );
      });
      authWindow.on("closed", () => {
        if (!resolved) {
          markResolved();
          reject(new Error("Authentication window was closed"));
        }
      });
    });
  }

  // --- Zpracování přesměrování ---
  handleRedirect(url, authWindow, resolve, reject, markResolved) {
    try {
      const urlObj = new URL(url);
      if (urlObj.origin === "http://localhost") {
        markResolved();
        authWindow.close();
        const code = urlObj.searchParams.get("code");
        const error = urlObj.searchParams.get("error");
        if (error) {
          reject(new Error(`OAuth error: ${error}`));
          return;
        }
        if (code) {
          console.log("Authorization code received, exchanging for tokens...");
          this.exchangeCodeForTokens(code)
            .then(async (tokens) => {
              this.saveTokens(tokens);
              const userInfo = await this.getUserInfo(tokens.access_token);
              resolve({ tokens, userInfo });
            })
            .catch((err) => reject(err));
        } else {
          reject(new Error("No authorization code received"));
        }
      }
    } catch (err) {
      // Ignorujeme chyby
    }
  }

  // --- Výměna kódu za tokeny ---
  async exchangeCodeForTokens(code) {
    const tokenParams = new URLSearchParams({
      client_id: this.credentials.client_id,
      client_secret: this.credentials.client_secret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: this.credentials.redirect_uris[0],
    });
    const response = await net.fetch(this.credentials.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });
    const tokens = await response.json();
    if (!response.ok || tokens.error) {
      throw new Error(
        tokens.error_description || "Failed to exchange code for tokens"
      );
    }
    return tokens;
  }

  // --- Získání informací o uživateli ---
  async getUserInfo(accessToken) {
    const response = await net.fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const userInfo = await response.json();
    if (!response.ok || userInfo.error) {
      throw new Error(userInfo.error?.message || "Failed to get user info");
    }
    return userInfo;
  }

  // --- Metoda pro odhlášení ---
  async logout() {
    try {
      if (this.tokens && this.tokens.access_token) {
        const revokeParams = new URLSearchParams({
          token: this.tokens.access_token,
        });
        await net.fetch(
          `https://oauth2.googleapis.com/revoke?${revokeParams.toString()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          }
        );
        console.log("Token revoked on Google's side.");
      }
      if (fs.existsSync(TOKEN_PATH)) {
        fs.unlinkSync(TOKEN_PATH);
        console.log("Token file deleted successfully.");
      }
      this.tokens = null;
      return { success: true };
    } catch (error) {
      console.error("Error during logout:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = GoogleAuthManager;
