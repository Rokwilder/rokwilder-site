// Existing waitlist and feedback worker, plus POST /help for the Hunt Planner.
// /help emails support@rokwilder.com through the EMAIL binding and stores a backup row.
// Not deployed from this repo change.
const ORIGINS = ["https://rokwilder.com","https://www.rokwilder.com","http://rokwilder.com","http://www.rokwilder.com"];
const INTERESTS = ["full_pass","hotspot_pack","full_scouting","boots","draw_odds","maps","scouting"];
const HELP_TO = "support@rokwilder.com";
const HELP_FROM = "help@rokwilder.com";
function allowed(o){ return o && (ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)); }
function cors(o){ return allowed(o) ? {"Access-Control-Allow-Origin":o,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"} : {}; }
const TOPICS = ["find","maps","packages","other"];
const RL_PER_IP = 5, RL_WINDOW_MIN = 10, RL_GLOBAL_PER_HOUR = 300;
async function sha(t){ const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""); }
const clean = (v,n) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").trim().slice(0,n);
function json(b,s,h){ return new Response(JSON.stringify(b),{status:s,headers:{"Content-Type":"application/json",...h}}); }
function pageOf(raw){
  let page = clean(raw, 500);
  try {
    const pu = new URL(page);
    page = /(^|\.)rokwilder\.com$|^(localhost|127\.0\.0\.1)$/.test(pu.hostname) ? pu.href.slice(0,500) : null;
  } catch { page = null; }
  return page;
}
async function rateLimit(env, ipHash){
  const since = new Date(Date.now() - RL_WINDOW_MIN*60000).toISOString(), hour = new Date(Date.now() - 3600000).toISOString();
  const rl = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM feedback WHERE ip_hash=? AND created_at>?) AS mine, (SELECT COUNT(*) FROM feedback WHERE created_at>?) AS allc").bind(ipHash, since, hour).first();
  return rl.mine >= RL_PER_IP || rl.allc >= RL_GLOBAL_PER_HOUR;
}
function helpBody(name, email, question, hunts, page){
  const lines = [
    "Hunt Planner help request",
    "",
    "Name: " + (name || "(no name given)"),
    "Email: " + email
  ];
  if(page) lines.push("Page: " + page);
  lines.push("", "Question:", question, "", "Saved hunts:", hunts || "No saved hunts yet.");
  return lines.join("\n");
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url); const o = req.headers.get("Origin"); const h = cors(o);
    if (req.method === "OPTIONS") return new Response(null,{status: allowed(o)?204:403, headers:h});
    if (url.pathname === "/export" && req.method === "GET") {
      const k = req.headers.get("X-Admin-Key") || url.searchParams.get("key");
      if (!env.ADMIN_KEY || k !== env.ADMIN_KEY) return json({ok:false,error:"unauthorized"},401,{});
      const { results } = await env.DB.prepare("SELECT id,email,first_name,state,interests,created_at FROM signups ORDER BY created_at DESC").all();
      if (url.searchParams.get("format") === "json") return json({ok:true,count:results.length,signups:results},200,{});
      const esc = v => '"' + String(v ?? "").replace(/"/g,'""') + '"';
      const csv = ["id,email,first_name,state,interests,created_at", ...results.map(r => [r.id,r.email,r.first_name,r.state,r.interests,r.created_at].map(esc).join(","))].join("\n");
      return new Response(csv,{headers:{"Content-Type":"text/csv","Content-Disposition":"attachment; filename=rokwilder-waitlist.csv"}});
    }
    if (url.pathname === "/feedback/export" && req.method === "GET") {
      const k = req.headers.get("X-Admin-Key") || url.searchParams.get("key");
      if (!env.ADMIN_KEY || k !== env.ADMIN_KEY) return json({ok:false,error:"unauthorized"},401,{});
      const { results } = await env.DB.prepare("SELECT id,topic,message,email,page_url,context,created_at FROM feedback ORDER BY created_at DESC LIMIT 1000").all();
      if (url.searchParams.get("format") === "csv") {
        const esc = v => '"' + String(v ?? "").replace(/"/g,'""') + '"';
        const csv = ["id,topic,message,email,page_url,context,created_at", ...results.map(r => [r.id,r.topic,r.message,r.email,r.page_url,r.context,r.created_at].map(esc).join(","))].join("\n");
        return new Response(csv,{headers:{"Content-Type":"text/csv","Content-Disposition":"attachment; filename=rokwilder-feedback.csv"}});
      }
      return json({ok:true,count:results.length,feedback:results},200,{});
    }
    if (url.pathname === "/help" && req.method === "POST") {
      if (o && !allowed(o)) return json({ok:false,error:"origin not allowed"},403,{});
      if (Number(req.headers.get("Content-Length")||0) > 20000) return json({ok:false,error:"Message is too long."},413,h);
      const raw = await req.text(); if (raw.length > 20000) return json({ok:false,error:"Message is too long."},413,h);
      let d; try { d = JSON.parse(raw); } catch { return json({ok:false,error:"Bad request."},400,h); }
      if (!d || typeof d !== "object") return json({ok:false,error:"Bad request."},400,h);
      if (d.website) return json({ok:true},200,h);
      const name = clean(d.name, 80);
      const question = clean(d.question, 1200);
      const hunts = clean(d.hunts, 6000);
      if (question.length < 3) return json({ok:false,error:"Please write a short message."},400,h);
      const email = clean(d.email, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ok:false,error:"That email doesn't look right."},400,h);
      const page = pageOf(d.page_url);
      const ip = req.headers.get("CF-Connecting-IP") || "unknown";
      const ipHash = await sha((env.ADMIN_KEY || "") + "|" + ip);
      if (await rateLimit(env, ipHash)) return json({ok:false,error:"Thanks! We've got a lot of messages right now. Please try again in a few minutes."},429,h);
      const body = helpBody(name, email, question, hunts, page);
      await env.DB.prepare("INSERT INTO feedback (topic,message,email,page_url,context,ip_hash,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind("other", clean(body, 2000), email, page, "Hunt Planner", ipHash, new Date().toISOString()).run();
      if (!env.EMAIL || typeof env.EMAIL.send !== "function") return json({ok:false,error:"Email is not set up yet. Your note was saved. You can also email support@rokwilder.com."},503,h);
      try {
        await env.EMAIL.send({
          to: HELP_TO,
          from: { email: HELP_FROM, name: "Rokwilder" },
          replyTo: email,
          subject: "Hunt Planner help",
          text: body
        });
      } catch (e) {
        return json({ok:false,error:"The email did not send. Your note was saved. You can also email support@rokwilder.com."},502,h);
      }
      return json({ok:true},200,h);
    }
    if (url.pathname === "/feedback" && req.method === "POST") {
      if (o && !allowed(o)) return json({ok:false,error:"origin not allowed"},403,{});
      if (Number(req.headers.get("Content-Length")||0) > 10000) return json({ok:false,error:"Message is too long."},413,h);
      const raw = await req.text(); if (raw.length > 10000) return json({ok:false,error:"Message is too long."},413,h);
      let d; try { d = JSON.parse(raw); } catch { return json({ok:false,error:"Bad request."},400,h); }
      if (!d || typeof d !== "object") return json({ok:false,error:"Bad request."},400,h);
      if (d.website) return json({ok:true},200,h);
      const topic = TOPICS.includes(d.topic) ? d.topic : "other";
      const message = clean(d.message, 2000);
      if (message.length < 3) return json({ok:false,error:"Please write a short message."},400,h);
      let email = clean(d.email, 254).toLowerCase() || null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ok:false,error:"That email doesn't look right. Leave it blank if you don't want a reply."},400,h);
      const page = pageOf(d.page_url);
      const context = clean(d.context, 300) || null;
      const ip = req.headers.get("CF-Connecting-IP") || "unknown";
      const ipHash = await sha((env.ADMIN_KEY || "") + "|" + ip);
      if (await rateLimit(env, ipHash)) return json({ok:false,error:"Thanks! We've got a lot of messages right now. Please try again in a few minutes."},429,h);
      await env.DB.prepare("INSERT INTO feedback (topic,message,email,page_url,context,ip_hash,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(topic, message, email, page, context, ipHash, new Date().toISOString()).run();
      return json({ok:true},200,h);
    }
    if (url.pathname === "/signup" && req.method === "POST") {
      if (o && !allowed(o)) return json({ok:false,error:"origin not allowed"},403,{});
      let d; try { d = await req.json(); } catch { return json({ok:false,error:"Bad request."},400,h); }
      if (d.website) return json({ok:true},200,h);
      const email = String(d.email||"").trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ok:false,error:"Please enter a valid email address."},400,h);
      const first = String(d.first_name||"").trim().slice(0,60) || null;
      const state = String(d.state||"Colorado").trim().slice(0,40) || "Colorado";
      const ints = (Array.isArray(d.interests)?d.interests:[]).filter(i => INTERESTS.includes(i)).join(",");
      await env.DB.prepare("INSERT INTO signups (email,first_name,state,interests,created_at) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET first_name=COALESCE(excluded.first_name,first_name), state=excluded.state, interests=excluded.interests")
        .bind(email, first, state, ints, new Date().toISOString()).run();
      return json({ok:true},200,h);
    }
    return json({ok:false,error:"not found"},404,h);
  }
};
