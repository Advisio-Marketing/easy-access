const { BrowserWindow, app } = require("electron");
const fs = require("fs");
const path = require("path");
const { URLSearchParams } = require("url");

class GoogleAuthManager {
  constructor() {
    this.credentials = null;
    this.loadCredentials();
  }

  loadCredentials() {
    try {
      // V development módu hledáme v parent directory
      // V produkci (asar archive) hledáme v root
      let credentialsPath;

      if (process.env.NODE_ENV === "development" || !app.isPackaged) {
        credentialsPath = path.join(__dirname, "../credentials.json");
      } else {
        // V produkci je credentials.json v root asar archivu
        credentialsPath = path.join(__dirname, "../credentials.json");
      }

      console.log("Looking for credentials at:", credentialsPath);

      const credentialsFile = fs.readFileSync(credentialsPath, "utf8");
      this.credentials = JSON.parse(credentialsFile).installed;
      console.log("Google credentials loaded successfully");
    } catch (error) {
      console.error("Failed to load Google credentials:", error);
      console.error("Attempted path:", credentialsPath);
      this.credentials = null;
    }
  }

  async authenticate() {
    if (!this.credentials) {
      throw new Error("Google credentials not loaded");
    }

    return new Promise((resolve, reject) => {
      let resolved = false; // Flag to prevent multiple resolves

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
        prompt: "consent",
      });

      const authUrl = `${this.credentials.auth_uri}?${authParams.toString()}`;

      authWindow.loadURL(authUrl);

      // Lepší způsob zachytávání redirect URL
      authWindow.webContents.on("will-navigate", (event, navigationUrl) => {
        if (!resolved)
          this.handleRedirect(
            navigationUrl,
            authWindow,
            resolve,
            reject,
            () => (resolved = true)
          );
      });

      authWindow.webContents.on("will-redirect", (event, redirectUrl) => {
        if (!resolved)
          this.handleRedirect(
            redirectUrl,
            authWindow,
            resolve,
            reject,
            () => (resolved = true)
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
              () => (resolved = true)
            );
        }
      );

      // Přidáme také kontrolu URL při načítání stránky
      authWindow.webContents.on("did-navigate", (event, navigationUrl) => {
        if (!resolved)
          this.handleRedirect(
            navigationUrl,
            authWindow,
            resolve,
            reject,
            () => (resolved = true)
          );
      });

      authWindow.on("closed", () => {
        if (!resolved) {
          resolved = true;
          reject(new Error("Authentication window was closed"));
        }
      });
    });
  }

  handleRedirect(url, authWindow, resolve, reject, markResolved) {
    console.log("handleRedirect called with URL:", url);

    try {
      const urlObj = new URL(url);
      console.log(
        "URL parsed - origin:",
        urlObj.origin,
        "search:",
        urlObj.search
      );

      if (urlObj.origin === "http://localhost") {
        const code = urlObj.searchParams.get("code");
        const error = urlObj.searchParams.get("error");

        console.log(
          "Localhost redirect detected - code:",
          !!code,
          "error:",
          error
        );

        markResolved(); // Mark as resolved before closing window
        authWindow.close();

        if (error) {
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (code) {
          console.log("Authorization code received, exchanging for tokens...");
          this.exchangeCodeForTokens(code)
            .then((tokens) => resolve(tokens))
            .catch((err) => reject(err));
        } else {
          reject(new Error("No authorization code received"));
        }
      }
    } catch (err) {
      console.error("Error in handleRedirect:", err);
    }
  }

  async exchangeCodeForTokens(code) {
    const { net } = require("electron");

    const tokenParams = new URLSearchParams({
      client_id: this.credentials.client_id,
      client_secret: this.credentials.client_secret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: this.credentials.redirect_uris[0],
    });

    return new Promise((resolve, reject) => {
      const request = net.request({
        method: "POST",
        url: this.credentials.token_uri,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      request.on("response", (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk.toString();
        });

        response.on("end", () => {
          try {
            const tokens = JSON.parse(body);
            if (tokens.access_token) {
              this.getUserInfo(tokens.access_token)
                .then((userInfo) => resolve({ tokens, userInfo }))
                .catch((err) => reject(err));
            } else {
              reject(new Error("No access token received"));
            }
          } catch (error) {
            reject(new Error("Failed to parse token response"));
          }
        });
      });

      request.on("error", (error) => {
        reject(error);
      });

      request.write(tokenParams.toString());
      request.end();
    });
  }

  async getUserInfo(accessToken) {
    const { net } = require("electron");

    return new Promise((resolve, reject) => {
      const request = net.request({
        method: "GET",
        url: "https://www.googleapis.com/oauth2/v2/userinfo",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      request.on("response", (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk.toString();
        });

        response.on("end", () => {
          try {
            const userInfo = JSON.parse(body);
            resolve(userInfo);
          } catch (error) {
            reject(new Error("Failed to parse user info response"));
          }
        });
      });

      request.on("error", (error) => {
        reject(error);
      });

      request.end();
    });
  }
}

module.exports = GoogleAuthManager;
