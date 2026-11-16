/* ===== Supabaseとのつなぎ込み =====
   ゲーム本体は claude.use("db" | "user" | "room") という共通の形でデータにアクセスします。
   ここでその中身をSupabase（データベース・匿名ログイン・Realtime）で用意します。
   接続情報がない、または通信できないときは、ゲームはひとりで遊べる形で動きます。 */
(function () {
  "use strict";
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return;

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "intern-rpg-auth" }
  });

  // 端末ごとの匿名ログイン（初回だけ作成し、以降は同じIDを使う）
  const ready = (async () => {
    const { data } = await sb.auth.getSession();
    if (data && data.session) return data.session;
    const r = await sb.auth.signInAnonymously();
    if (r.error) throw r.error;
    return r.data.session;
  })();

  /* ---------- ランキング（scoresテーブル） ---------- */
  const fromRow = (r) => ({ nick: r.nick, look: r.look, best: r.best, bestRank: r.best_rank, type: r.type, titles: r.titles, types: r.types, plays: r.plays });
  const toRow = (id, d) => ({
    id, nick: String(d.nick || "インターン").slice(0, 12), look: d.look || {}, best: Math.max(0, Math.round(d.best || 0)),
    best_rank: d.bestRank ? String(d.bestRank).slice(0, 2) : null, type: d.type ? String(d.type).slice(0, 12) : null,
    titles: Array.isArray(d.titles) ? d.titles : [], types: Array.isArray(d.types) ? d.types : [], plays: Math.max(0, Math.round(d.plays || 0)),
    updated_at: new Date().toISOString()
  });
  const db = {
    doc(path) {
      const id = String(path).split("/")[1];
      return {
        async get() {
          const { data, error } = await sb.from("scores").select("*").eq("id", id).maybeSingle();
          if (error) throw { code: "unavailable", message: error.message };
          return { exists: !!data, data: () => (data ? fromRow(data) : undefined) };
        },
        async set(d) {
          const { error } = await sb.from("scores").upsert(toRow(id, d));
          if (error) throw { code: error.code === "42501" ? "invalid_argument" : "unavailable", message: error.message };
        }
      };
    },
    collection() {
      const q = {
        _limit: 50,
        orderBy() { return q; },
        limit(n) { q._limit = n; return q; },
        onSnapshot(next, onError) {
          let stopped = false, timer = null;
          const load = async () => {
            const { data, error } = await sb.from("scores").select("*").gt("best", 0).order("best", { ascending: false }).limit(q._limit);
            if (stopped) return;
            if (error) { if (onError) onError({ code: "unavailable", message: error.message }); return; }
            next({ docs: data.map((r) => ({ id: r.id, exists: true, data: () => fromRow(r) })) });
          };
          const soon = () => { clearTimeout(timer); timer = setTimeout(load, 300); };
          load();
          const ch = sb.channel("scores-feed").on("postgres_changes", { event: "*", schema: "public", table: "scores" }, soon).subscribe();
          const iv = setInterval(load, 60000);
          return () => { stopped = true; clearInterval(iv); sb.removeChannel(ch); };
        }
      };
      return q;
    }
  };

  const user = {
    async id() { const s = await ready; return s.user.id; },
    async can() { return true; },
    isOwner() { return false; }
  };

  /* ---------- 同時プレイ（Realtimeのプレゼンスとブロードキャスト） ---------- */
  const peerId = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/-/g, "").slice(0, 16);
  const peerListeners = [], topicListeners = {};
  const ch = sb.channel("office-room", { config: { presence: { key: peerId }, broadcast: { self: false } } });
  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState();
    const peers = Object.entries(state).map(([key, metas]) => {
      const m = (metas && metas[metas.length - 1]) || {};
      const p = Object.assign({}, m); delete p.presence_ref;
      return { peer: key, by: null, isMe: key === peerId, sameTab: key === peerId, kind: "viewer", guest: false, presence: p, updatedAt: Date.now() };
    });
    peerListeners.forEach((f) => { try { f({ peers, joined: [], left: [], updated: [] }); } catch (e) { /* 無視 */ } });
  });
  ch.on("broadcast", { event: "news" }, ({ payload }) => {
    (topicListeners.news || []).forEach((f) => { try { f({ topic: "news", data: payload, isMe: false, sameTab: false, peer: "", by: null, kind: "viewer", guest: false }); } catch (e) { /* 無視 */ } });
  });
  let subscribed = false, pending = null, lastTrack = 0, trackTimer = null;
  function flush() {
    if (!subscribed || !pending) return;
    const wait = 200 - (Date.now() - lastTrack);
    if (wait > 0) { clearTimeout(trackTimer); trackTimer = setTimeout(flush, wait); return; }
    lastTrack = Date.now(); ch.track(pending).catch(() => {});
  }
  // ログインのあとに接続（ログインできなくてもオンライン表示は動かす）
  ready.catch(() => null).then(() => ch.subscribe((status) => { if (status === "SUBSCRIBED") { subscribed = true; flush(); } }));
  const room = {
    presence: async (p) => { pending = p; flush(); },
    onPeers: (cb) => { peerListeners.push(cb); return () => {}; },
    on: (topic, cb) => { (topicListeners[topic] = topicListeners[topic] || []).push(cb); return () => {}; },
    emit: async (topic, data) => { if (subscribed) await ch.send({ type: "broadcast", event: topic, payload: data }); }
  };

  window.claude = {
    async use(name) {
      if (name === "room") return room;
      if (name === "db" || name === "user") {
        try { await ready; } catch (e) { console.warn("匿名ログインに失敗しました", e); return null; }
        return name === "db" ? db : user;
      }
      return null;
    }
  };
})();
