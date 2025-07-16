import { Configuration } from "@azure/msal-browser";

// MSAL Configuration
// This configuration is for your multi-tenant application's client-side interaction with Azure AD.
// The 'clientId' is specific to your application registration in Azure AD.
// The 'authority' uses '/common' to allow users from any Azure AD tenant to sign in.
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "YOUR_AZURE_CLIENT_ID", // Application (client) ID from your Azure AD app registration
    authority: "https://login.microsoftonline.com/common", // Use /common for multi-tenant applications
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || "http://localhost:5173", // Your app's redirect URI
  },
  cache: {
    cacheLocation: "sessionStorage", // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set to true if you want to store authentication state in cookies
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case 0: // LogLevel.Error
            console.error(message);
            return;
          case 1: // LogLevel.Warning
            console.warn(message);
            return;
          case 2: // LogLevel.Info
            console.info(message);
            return;
          case 3: // LogLevel.Verbose
            console.debug(message);
            return;
        }
      },
      piiLoggingEnabled: false,
    },
  },
};

// Scopes you would like to request (e.g., 'User.Read' for Microsoft Graph)
export const loginRequest = {
  scopes: ["User.Read"], // Default scopes
};
