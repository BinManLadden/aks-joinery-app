(function () {
  "use strict";

  const CONFIG_KEY = "aks_joinery_cloud_config_v1";
  const STATE_KEY = "aks_joinery_cloud_state_v1";
  const TABLE = "aks_joinery_workspaces";
  // Supabase publishable keys are intended for browser apps; row-level security protects the data.
  const DEFAULT_CONFIG = {
    url: "https://gpcffrkysjjlduwdssdf.supabase.co",
    key: "sb_publishable_6ccoi3VulLVI3lWmjjy54Q_Io9hk7pN"
  };
  let client = null;
  let clientConfig = null;
  let user = null;
  let cloudRevision = null;
  let syncReady = false;
  let localDirty = false;
  let busy = false;
  let saveTimer = null;

  const urlInput = document.getElementById("cloudProjectUrl");
  const keyInput = document.getElementById("cloudPublishableKey");
  const emailInput = document.getElementById("cloudTeamEmail");
  const passwordInput = document.getElementById("cloudTeamPassword");
  const statusNode = document.getElementById("cloudSyncStatus");

  function setStatus(message, isError) {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.style.color = isError ? "#8b3029" : "";
  }

  function readSavedConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null"); }
    catch (_) { return null; }
  }

  function readSyncState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || "null"); }
    catch (_) { return null; }
  }

  function saveSyncState() {
    if (!user) return;
    localStorage.setItem(STATE_KEY, JSON.stringify({
      userId: user.id,
      revision: cloudRevision,
      ready: syncReady,
      pending: localDirty
    }));
  }

  function validatePublishableKey(key) {
    if (key.startsWith("sb_secret_") || key.includes("service_role")) {
      throw new Error("Do not use a secret or service-role key here. Use the project publishable key.");
    }
    if (key.startsWith("sb_publishable_")) return;
    if (key.split(".").length === 3) {
      try {
        const part = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(part + "=".repeat((4 - part.length % 4) % 4)));
        if (payload.role === "anon") return;
      } catch (_) {}
    }
    throw new Error("Use the Supabase publishable key from your project. Do not use a secret/service-role key.");
  }

  function getFormConfig() {
    const url = (urlInput.value || "").trim().replace(/\/+$/, "");
    const key = (keyInput.value || "").trim();
    if (!url || !key) throw new Error("Enter your Supabase Project URL and publishable key first.");
    let parsed;
    try { parsed = new URL(url); }
    catch (_) { throw new Error("The Project URL does not look right."); }
    if (parsed.protocol !== "https:") throw new Error("Use the secure HTTPS Project URL from Supabase.");
    validatePublishableKey(key);
    return { url: url, key: key };
  }

  function getSavedConfigOrThrow() {
    const config = readSavedConfig();
    if (!config || !config.url || !config.key) {
      throw new Error("Save your Supabase Project URL and publishable key first.");
    }
    return config;
  }

  async function getClient() {
    const config = getSavedConfigOrThrow();
    if (client && clientConfig && clientConfig.url === config.url && clientConfig.key === config.key) {
      return client;
    }
    const mod = await import("https://esm.sh/@supabase/supabase-js@2");
    client = mod.createClient(config.url, config.key, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
    clientConfig = config;
    client.auth.onAuthStateChange(function (_event, session) {
      setTimeout(function () { acceptSession(session ? session.user : null); }, 0);
    });
    const result = await client.auth.getSession();
    if (result.error) throw result.error;
    acceptSession(result.data.session ? result.data.session.user : null);
    return client;
  }

  function acceptSession(nextUser) {
    if (!nextUser) {
      user = null;
      cloudRevision = null;
      syncReady = false;
      localDirty = false;
      setStatus("Connection saved. Sign in with the shared team account to sync.");
      return;
    }
    if (user && user.id === nextUser.id) {
      user = nextUser;
      return;
    }
    user = nextUser;
    const state = readSyncState();
    if (state && state.userId === user.id && state.ready && Number.isFinite(Number(state.revision))) {
      cloudRevision = Number(state.revision);
      syncReady = true;
      localDirty = Boolean(state.pending);
      setStatus(localDirty
        ? "Signed in. This device has changes waiting to sync."
        : "Signed in and linked to the shared team data.");
      if (localDirty) setTimeout(autoSaveToCloud, 700);
    } else {
      cloudRevision = null;
      syncReady = false;
      localDirty = false;
      setStatus("Signed in. Choose Upload on the first device, or Download on another device.");
    }
  }

  async function requireSignedIn() {
    const c = await getClient();
    const result = await c.auth.getSession();
    if (result.error) throw result.error;
    if (!result.data.session) throw new Error("Sign in with the shared team account first.");
    acceptSession(result.data.session.user);
    return { client: c, user: result.data.session.user };
  }

  async function getCloudRow(c, activeUser) {
    const result = await c.from(TABLE)
      .select("data,revision,updated_at")
      .eq("user_id", activeUser.id)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  function applyCloudRow(row) {
    const incoming = row && row.data;
    if (!incoming || !Array.isArray(incoming.sites) || !Array.isArray(incoming.plots) ||
        !Array.isArray(incoming.priceLists) || !Array.isArray(incoming.orders)) {
      throw new Error("The cloud copy is not a valid AKS app backup.");
    }
    window.aksSetDb(incoming);
    cloudRevision = Number(row.revision);
    syncReady = true;
    localDirty = false;
    saveSyncState();
    setStatus("Shared data downloaded. This device will check for updates while it is open.");
  }

  async function saveCloudConnection() {
    try {
      const config = getFormConfig();
      const old = readSavedConfig();
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      if (!old || old.url !== config.url || old.key !== config.key) {
        client = null;
        clientConfig = null;
        user = null;
        cloudRevision = null;
        syncReady = false;
        localDirty = false;
      }
      setStatus("Cloud connection saved on this device. Sign in with the shared team account.");
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  async function createSharedTeamLogin() {
    try {
      const config = getFormConfig();
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      client = null;
      clientConfig = null;
      const c = await getClient();
      const email = (emailInput.value || "").trim();
      const password = passwordInput.value || "";
      if (!email || !password) throw new Error("Enter the team email and password.");
      const result = await c.auth.signUp({
        email: email,
        password: password,
        options: { emailRedirectTo: window.location.origin + window.location.pathname }
      });
      if (result.error) throw result.error;
      if (result.data.session && result.data.user) {
        acceptSession(result.data.user);
        setStatus("Team login created. Now upload this device's data to create the shared copy.");
      } else {
        setStatus("Check the team email inbox, confirm the account, then return here and sign in.");
      }
    } catch (err) {
      setStatus(err.message || "Could not create the team login.", true);
    }
  }

  async function signInSharedTeam() {
    try {
      const config = getFormConfig();
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      client = null;
      clientConfig = null;
      const c = await getClient();
      const email = (emailInput.value || "").trim();
      const password = passwordInput.value || "";
      if (!email || !password) throw new Error("Enter the team email and password.");
      const result = await c.auth.signInWithPassword({ email: email, password: password });
      if (result.error) throw result.error;
      acceptSession(result.data.user);
      setStatus("Signed in. Use Upload on the first device, or Download on another device.");
    } catch (err) {
      setStatus(err.message || "Could not sign in.", true);
    }
  }

  async function signOutSharedTeam() {
    try {
      const c = await getClient();
      const result = await c.auth.signOut();
      if (result.error) throw result.error;
      acceptSession(null);
      setStatus("Signed out. Your saved data remains on this device.");
    } catch (err) {
      setStatus(err.message || "Could not sign out.", true);
    }
  }

  async function uploadLocalToCloud() {
    if (busy) return;
    busy = true;
    try {
      const auth = await requireSignedIn();
      const row = await getCloudRow(auth.client, auth.user);
      const isOverwrite = Boolean(row);
      const prompt = isOverwrite
        ? "Replace the shared cloud data with this device's data? Everyone using the team account will see the replacement."
        : "Create the shared cloud copy using the data on this device?";
      if (!window.confirm(prompt)) return;
      const nextRevision = row ? Number(row.revision) + 1 : 1;
      const payload = {
        user_id: auth.user.id,
        data: window.aksGetDb(),
        revision: nextRevision,
        updated_at: new Date().toISOString()
      };
      let result;
      if (row) {
        result = await auth.client.from(TABLE).update({
          data: payload.data,
          revision: nextRevision,
          updated_at: payload.updated_at
        }).eq("user_id", auth.user.id).eq("revision", Number(row.revision))
          .select("revision,updated_at").maybeSingle();
      } else {
        result = await auth.client.from(TABLE).insert(payload).select("revision,updated_at").maybeSingle();
      }
      if (result.error) throw result.error;
      if (!result.data) {
        syncReady = false;
        localDirty = true;
        setStatus("Another device changed the cloud copy during upload. Download the latest copy or try Upload again.", true);
        return;
      }
      cloudRevision = Number(result.data.revision);
      syncReady = true;
      localDirty = false;
      saveSyncState();
      setStatus("This device is now syncing with the shared team copy.");
    } catch (err) {
      setStatus(err.message || "Could not upload the data.", true);
    } finally {
      busy = false;
    }
  }

  async function downloadCloudToLocal() {
    if (busy) return;
    busy = true;
    try {
      const auth = await requireSignedIn();
      const row = await getCloudRow(auth.client, auth.user);
      if (!row) {
        setStatus("There is no cloud copy yet. Use Upload on the first device to create it.");
        return;
      }
      if (!window.confirm("Replace the data on this device with the shared cloud copy? Export a backup first if you need to keep this device's current data.")) return;
      applyCloudRow(row);
    } catch (err) {
      setStatus(err.message || "Could not download the shared data.", true);
    } finally {
      busy = false;
    }
  }

  async function checkForCloudUpdates() {
    if (busy) return;
    busy = true;
    try {
      const auth = await requireSignedIn();
      const row = await getCloudRow(auth.client, auth.user);
      if (!row) {
        setStatus("No shared cloud copy exists yet. Use Upload on the first device.");
        return;
      }
      const remoteRevision = Number(row.revision);
      if (!syncReady || cloudRevision === null) {
        if (!window.confirm("A shared cloud copy exists. Download it and replace the data on this device? Choose Cancel to keep this device unchanged; use Upload only if you intend to replace the shared copy.")) return;
        applyCloudRow(row);
      } else if (remoteRevision > cloudRevision) {
        if (localDirty) {
          setStatus("There is a sync conflict. Download the shared copy to discard local changes, or use Upload to replace it with this device's data.", true);
          return;
        }
        applyCloudRow(row);
      } else if (localDirty) {
        busy = false;
        await autoSaveToCloud();
        return;
      } else {
        setStatus("This device is up to date with the shared copy.");
      }
    } catch (err) {
      setStatus(err.message || "Could not check for updates.", true);
    } finally {
      busy = false;
    }
  }

  async function autoSaveToCloud() {
    if (!user || !syncReady || !localDirty || busy) return;
    if (!navigator.onLine) {
      setStatus("Saved on this device. Cloud sync will retry when it is online.");
      return;
    }
    busy = true;
    try {
      const c = await getClient();
      const payload = {
        data: window.aksGetDb(),
        revision: cloudRevision + 1,
        updated_at: new Date().toISOString()
      };
      const result = await c.from(TABLE).update(payload)
        .eq("user_id", user.id).eq("revision", cloudRevision)
        .select("revision,updated_at").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        setStatus("Sync paused: another device changed the shared copy. Your edits remain on this device; choose Download or Upload after reviewing.", true);
        return;
      }
      cloudRevision = Number(result.data.revision);
      localDirty = false;
      saveSyncState();
      setStatus("Changes saved to the shared cloud.");
    } catch (err) {
      setStatus("Saved on this device, but not in the cloud yet. " + (err.message || ""), true);
    } finally {
      busy = false;
    }
  }

  async function pollCloud() {
    if (!user || !syncReady || busy || !navigator.onLine || document.visibilityState === "hidden") return;
    try {
      const c = await getClient();
      const row = await getCloudRow(c, user);
      if (!row) {
        setStatus("The shared cloud copy is missing. Use Upload to create it again.", true);
        return;
      }
      const remoteRevision = Number(row.revision);
      if (remoteRevision > cloudRevision) {
        if (localDirty) {
          setStatus("Another device has newer changes. Sync is paused until you choose Download or Upload.", true);
        } else {
          applyCloudRow(row);
        }
      }
    } catch (err) {
      setStatus("Cloud check failed. This device still has its local data.", true);
    }
  }

  function queueCloudSave() {
    if (!user || !syncReady) return;
    localDirty = true;
    saveSyncState();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(autoSaveToCloud, 1000);
    setStatus("Saving changes to the shared cloud…");
  }

  function initialize() {
    let config = readSavedConfig();
    if (!config || !config.url || !config.key) {
      config = DEFAULT_CONFIG;
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }
    if (config) {
      urlInput.value = config.url || "";
      keyInput.value = config.key || "";
      getClient().then(function () {
        if (!user) setStatus("Cloud connection saved on this device. Sign in with the shared team account.");
      }).catch(function () {
        setStatus("Cloud sync needs an internet connection and a valid Supabase setup.", true);
      });
    } else {
      setStatus("Set up the hosted database, then enter its Project URL and publishable key here.");
    }
    const state = readSyncState();
    if (state && state.pending && state.ready) {
      localDirty = true;
    }
  }

  window.saveCloudConnection = saveCloudConnection;
  window.createSharedTeamLogin = createSharedTeamLogin;
  window.signInSharedTeam = signInSharedTeam;
  window.signOutSharedTeam = signOutSharedTeam;
  window.uploadLocalToCloud = uploadLocalToCloud;
  window.downloadCloudToLocal = downloadCloudToLocal;
  window.checkForCloudUpdates = checkForCloudUpdates;
  window.aksQueueCloudSave = queueCloudSave;

  window.addEventListener("online", function () {
    if (localDirty && syncReady) autoSaveToCloud();
    else pollCloud();
  });
  window.addEventListener("focus", pollCloud);
  document.addEventListener("visibilitychange", pollCloud);
  setInterval(pollCloud, 15000);
  initialize();
})();
