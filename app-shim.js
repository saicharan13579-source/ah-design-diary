/* AH Head Office Design Team Diary — data layer for the free GitHub Pages + Supabase setup.
   Gives the page the small API it expects (db / user / downloads):
     • sign-in with a email + password sign-in for each person's Microsoft / Outlook email
     • every update stored in Supabase (Postgres) and protected by row-level security
     • live Hyderabad weather straight from Open-Meteo                                   */
(function(){
  "use strict";
  const CFG = window.AH_CONFIG || {};
  const viaLink = /type=(magiclink|recovery|signup)/.test(location.hash);
  const POLL_MS = 12000;
  const configured = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && !/YOUR-/.test(CFG.supabaseUrl + CFG.supabaseAnonKey));
  const sb = configured && window.supabase ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } }) : null;
  const meta = { fromCache:false, hasPendingWrites:false };
  const snapDoc = (id, data) => ({ id, exists: !!data, data: () => data || undefined, metadata: meta });
  const snapQuery = rows => { const docs = rows.map(r => snapDoc(r.id, r.data)); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta }; };
  const E = (code, message) => Object.assign(new Error(message), { code, message });
  const mapErr = e => E(e && (e.code === "42501" || /row-level security|permission/i.test(e.message || "")) ? "invalid_argument" : "unavailable", e && e.message || "Error");

  /* ---------- sign-in screen ---------- */
  let session = null;
  const css = `.ah-gate{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:16px;background:color-mix(in srgb,var(--paper,#E8EDF6) 55%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);font-family:var(--f-body,system-ui,sans-serif);color:var(--ink,#0F1728)}
  .ah-gate .box{width:min(420px,100%);padding:26px;border-radius:22px;background:var(--card,rgba(255,255,255,.7));border:1px solid var(--line,rgba(0,0,0,.1));box-shadow:inset 0 1px 0 var(--glass-edge,#fff),0 20px 60px -20px rgba(20,30,60,.35)}
  .ah-gate h2{font-family:var(--f-display,Impact,sans-serif);font-weight:800;text-transform:uppercase;font-size:30px;line-height:1;margin:6px 0 10px}
  .ah-gate p{margin:0 0 14px;color:var(--ink-2,#4A5568);font-size:14px}
  .ah-gate label{display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-2,#4A5568);margin:0 0 6px}
  .ah-gate input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:12px;border:1px solid var(--line,rgba(0,0,0,.15));background:var(--field,#fff);font:inherit;font-size:16px;color:inherit;margin-bottom:12px}
  .ah-gate button{width:100%;padding:12px;border:0;border-radius:999px;font:inherit;font-weight:600;cursor:pointer;color:#fff;background:var(--accent,#D2621A)}
  .ah-gate button:disabled{opacity:.6;cursor:wait}
  .ah-gate .msg{min-height:1.2em;margin-top:10px;font-size:13px}
  .ah-gate .link{background:none;color:var(--ink-2,#4A5568);text-decoration:underline;padding:6px;margin-top:6px;font-weight:400}`;
  function gate(){
    return new Promise(resolve => {
      const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
      const g = document.createElement("div"); g.className = "ah-gate"; g.setAttribute("role","dialog"); g.setAttribute("aria-modal","true");
      g.innerHTML = `<form class="box" novalidate>
        <p style="font-family:var(--f-mono,monospace);font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin:0">AH Head Office</p>
        <h2>Design Team Diary</h2>
        <p id="ah-step-t">Sign in once with your work email and password. You'll stay signed in on this computer.</p>
        <label for="ah-email">Work email</label><input id="ah-email" type="email" autocomplete="username" placeholder="name@company.com" required>
        <label for="ah-pass">Password</label><input id="ah-pass" type="password" autocomplete="current-password" placeholder="Your diary password" required>
        <button type="submit" id="ah-go">Sign in</button>
        <button type="button" class="link" id="ah-mode">First time here? Create your password</button>
        <button type="button" class="link" id="ah-forgot">Forgot password, or signed up by email link before? Email me a link</button>
        <div class="msg" id="ah-msg" role="status"></div></form>`;
      document.body.appendChild(g);
      const $ = s => g.querySelector(s), form = $("form"), msg = $("#ah-msg");
      let creating = false;
      const setMode = c => {
        creating = c; msg.textContent = "";
        $("#ah-go").textContent = c ? "Create password and sign in" : "Sign in";
        $("#ah-mode").textContent = c ? "Already have a password? Sign in" : "First time here? Create your password";
        $("#ah-pass").placeholder = c ? "Choose a password (8+ characters)" : "Your diary password";
        $("#ah-pass").autocomplete = c ? "new-password" : "current-password";
        $("#ah-step-t").textContent = c ? "First time: enter your work email and choose a password. Only team emails can do this." : "Sign in once with your work email and password. You'll stay signed in on this computer.";
      };
      $("#ah-mode").onclick = () => setMode(!creating);
      $("#ah-forgot").onclick = async () => {
        const email = $("#ah-email").value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ msg.textContent = "Type your work email first, then click this again."; return; }
        $("#ah-forgot").disabled = true;
        const { error } = await sb.auth.signInWithOtp({ email, options:{ shouldCreateUser:false, emailRedirectTo: location.origin + location.pathname } });
        $("#ah-forgot").disabled = false;
        msg.textContent = error ? (/rate/i.test(error.message) ? "Too many emails just now (Supabase allows 2 an hour). Try again later." : error.message)
          : `Link sent to ${email}. Open it on this computer; the diary will ask you to choose a new password.`;
      };
      form.addEventListener("submit", async ev => {
        ev.preventDefault(); msg.textContent = "";
        const email = $("#ah-email").value.trim().toLowerCase(), password = $("#ah-pass").value;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ msg.textContent = "Enter your work email address."; return; }
        if (password.length < (creating ? 8 : 1)){ msg.textContent = creating ? "Choose a password of at least 8 characters." : "Enter your password."; return; }
        $("#ah-go").disabled = true;
        let res = creating ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
        if (creating && !res.error && !res.data.session) res = await sb.auth.signInWithPassword({ email, password });
        $("#ah-go").disabled = false;
        const e = res.error;
        if (e){
          const m = e.message || "";
          msg.textContent = /already registered|already exists/i.test(m) ? "This email already has a password. Use Sign in instead."
            : /invalid login|invalid credentials/i.test(m) ? "Email or password is wrong. First time? Click \u201cCreate your password\u201d."
            : /database error|not on the team|saving new user/i.test(m) ? "This email isn't on the design team list. Ask Sai Charan to add it."
            : /weak|short|at least/i.test(m) ? "Choose a longer password (8+ characters)."
            : m;
          return;
        }
        session = res.data.session; g.remove(); resolve(session);
      });
      setTimeout(() => $("#ah-email").focus(), 50);
    });
  }
  let sessionP = null;
  function setPassword(){
    if (!document.getElementById("ah-gate-css")){ const st = document.createElement("style"); st.id = "ah-gate-css"; st.textContent = css; document.head.appendChild(st); }
    const g = document.createElement("div"); g.className = "ah-gate"; g.setAttribute("role","dialog"); g.setAttribute("aria-modal","true");
    g.innerHTML = `<form class="box" novalidate><h2>Choose your password</h2><p>You signed in with an email link. Choose a password so next time you can sign in without email.</p>
      <label for="ah-np">New password</label><input id="ah-np" type="password" autocomplete="new-password" placeholder="8+ characters">
      <button type="submit">Save password</button><button type="button" class="link" id="ah-skip">Not now</button><div class="msg" role="status"></div></form>`;
    document.body.appendChild(g);
    const f = g.querySelector("form"), m = g.querySelector(".msg");
    g.querySelector("#ah-skip").onclick = () => g.remove();
    f.addEventListener("submit", async ev => { ev.preventDefault();
      const password = g.querySelector("#ah-np").value;
      if (password.length < 8){ m.textContent = "At least 8 characters, please."; return; }
      const { error } = await sb.auth.updateUser({ password });
      if (error){ m.textContent = error.message; return; }
      m.textContent = "Saved. You're signed in."; setTimeout(() => g.remove(), 900);
    });
  }
  function ensureSession(){
    if (!sb) return Promise.resolve(null);
    if (!sessionP) sessionP = sb.auth.getSession().then(({ data }) => data.session || gate()).then(s => { session = s; if (viaLink && s) setPassword(); return s; });
    return sessionP;
  }
  const uid = () => session && session.user ? session.user.id : null;
  const email = () => session && session.user ? (session.user.email || "").toLowerCase() : "";
  const ownerEmail = (CFG.ownerEmail || "").toLowerCase();

  /* ---------- polling listeners ---------- */
  const listeners = new Set();
  const addListener = l => { listeners.add(l); l.run(); return () => listeners.delete(l); };
  const refreshAll = () => listeners.forEach(l => l.run());
  setInterval(() => { if (!document.hidden) refreshAll(); }, POLL_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshAll(); });

  /* ---------- live weather ---------- */
  const WMO = c => c === 0 ? ["clear","Clear"] : c <= 2 ? ["partly","Partly cloudy"] : c === 3 ? ["cloudy","Cloudy"] : (c === 45 || c === 48) ? ["fog","Fog"]
    : c >= 51 && c <= 57 ? ["drizzle","Drizzle"] : (c >= 61 && c <= 67) || (c >= 80 && c <= 82) ? ["rain", c >= 65 || c === 82 ? "Heavy rain" : "Rain"] : c >= 95 ? ["thunder","Thunderstorm"] : ["cloudy","Cloudy"];
  const DIRS = ["N","NE","E","SE","S","SW","W","NW"];
  let wx = null, wxAt = 0;
  async function weather(){
    if (wx && Date.now() - wxAt < 20*60e3) return wx;
    const j = await (await fetch("https://api.open-meteo.com/v1/forecast?latitude=17.4425&longitude=78.1918&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,precipitation,wind_speed_10m,wind_direction_10m,visibility&daily=sunrise,sunset&timezone=Asia%2FKolkata&forecast_days=1")).json(), c = j.current || {};
    let [condition, description] = WMO(c.weather_code);
    if ((condition === "clear" || condition === "partly") && c.visibility != null && c.visibility < 5000){ condition = "haze"; description = "Haze"; }
    wx = { condition, description, tempC: Math.round(c.temperature_2m), feelsC: Math.round(c.apparent_temperature), humidity: c.relative_humidity_2m, windKmh: Math.round(c.wind_speed_10m),
      windDir: DIRS[Math.round((c.wind_direction_10m || 0)/45) % 8], cloud: c.cloud_cover, precipMm: c.precipitation,
      sunrise: (j.daily && j.daily.sunrise && j.daily.sunrise[0] || "").slice(11,16), sunset: (j.daily && j.daily.sunset && j.daily.sunset[0] || "").slice(11,16), source:"Open-Meteo", observedAt: c.time };
    wxAt = Date.now(); return wx;
  }

  /* ---------- db ---------- */
  async function upsert(col, id, data){
    await ensureSession();
    if (col === "entries" && email() !== ownerEmail){ data = Object.assign({}, data, { by: uid() }); if (!data.uid) data.uid = uid(); }
    const { error } = await sb.from("docs").upsert({ col, id, data, date: typeof data.date === "string" ? data.date : "", updated_at: new Date().toISOString() });
    if (error) throw mapErr(error);
    refreshAll();
  }
  function docRef(path){
    const parts = path.split("/"), col = parts.slice(0,-1).join("/"), id = parts[parts.length-1];
    const ref = {
      id, path,
      async get(){
        if (path === "env/hyderabad") return snapDoc(id, await weather().catch(() => null));
        await ensureSession();
        const { data, error } = await sb.from("docs").select("data").eq("col", col).eq("id", id).maybeSingle();
        if (error) throw mapErr(error);
        return snapDoc(id, data && data.data);
      },
      set: data => upsert(col, id, data),
      async update(data){ const cur = await ref.get(); if (!cur.exists) throw E("invalid_argument","Missing document"); return upsert(col, id, Object.assign({}, cur.data(), data)); },
      async delete(){ await ensureSession(); const { error } = await sb.from("docs").delete().eq("col", col).eq("id", id); if (error) throw mapErr(error); refreshAll(); },
      onSnapshot(next, onErr){
        let last = "";
        return addListener({ run: async () => {
          try { const s = await ref.get(); const k = JSON.stringify(s.data() || null); if (k !== last){ last = k; next(s); } }
          catch(e){ if (onErr && e.code !== "unavailable") onErr(e); }
        }});
      },
      collection: sub => colRef(path + "/" + sub)
    };
    return ref;
  }
  function colRef(col, filters, lim){
    filters = filters || [];
    const q = {
      path: col,
      where: (f, op, v) => colRef(col, filters.concat([[f,op,v]]), lim),
      orderBy: () => q,
      limit: n => colRef(col, filters, n),
      doc: id => docRef(col + "/" + (id || (Date.now().toString(36) + Math.random().toString(36).slice(2,10)))),
      async add(data){ const r = q.doc(); await r.set(data); return r; },
      async get(){
        await ensureSession();
        let req = sb.from("docs").select("id,data").eq("col", col);
        filters.forEach(([f,op,v]) => { if (f === "date"){ if (op === ">=") req = req.gte("date", v); if (op === "<=") req = req.lte("date", v); } });
        req = req.limit(lim || 2000);
        const { data, error } = await req;
        if (error) throw mapErr(error);
        return snapQuery((data || []).filter(r => filters.every(([f,op,v]) => { const x = r.data && r.data[f]; return op === ">=" ? x >= v : op === "<=" ? x <= v : op === "==" ? x === v : true; })));
      },
      onSnapshot(next, onErr){
        let last = "";
        return addListener({ run: async () => {
          try { const s = await q.get(); const k = JSON.stringify(s.docs.map(d => [d.id, d.data()])); if (k !== last){ last = k; next(s); } }
          catch(e){ if (onErr && e.code !== "unavailable") onErr(e); }
        }});
      }
    };
    return q;
  }
  const db = { doc: docRef, collection: c => colRef(c) };

  /* ---------- user ---------- */
  const COLORS = ["#3866A6","#D2621A","#2D7D52","#8A4FA3","#A97F1E","#2A8585","#B0476A"];
  const colorFor = id => { let h = 0; for (const ch of String(id)) h = (h*31 + ch.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const user = {
    async id(){ await ensureSession(); return uid(); },
    async isOwner(){ await ensureSession(); return !!ownerEmail && email() === ownerEmail; },
    async canEdit(){ return user.isOwner(); },
    async can(name){ await ensureSession(); return name === "data.write" ? !!uid() : false; },
    async me(){ await ensureSession(); const o = await user.isOwner(); return { id: uid(), name: email().split("@")[0], email: email() || null, avatarUrl:"", color: colorFor(uid()), isOwner:o, canEdit:o }; },
    async name(){ return (await user.me()).name; },
    async email(){ await ensureSession(); return email() || null; },
    async profiles(ids){ await ensureSession(); const out = {}; [].concat(ids).forEach(i => { out[i] = { id:i, name: i === uid() ? email().split("@")[0] : "", avatarUrl:"", color: colorFor(i), email:null, isMe: i === uid(), guest:false }; }); return out; },
    async search(){ return []; }
  };
  const downloads = { async save({ filename, data }){ const blob = data instanceof Blob ? data : new Blob([data]); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return { status:"saved" }; } };

  window.ahSignOut = async () => { if (sb) await sb.auth.signOut(); location.reload(); };
  window.claude = { use: async name => {
    if (!sb) return null;
    await ensureSession();
    return name === "db" ? db : name === "user" ? user : name === "downloads" ? downloads : null;
  } };
})();
