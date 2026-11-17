const LS_KRACHT = "progressie.kracht";
const LS_VOEDING = "progressie.voeding";
const LS_DOEL = "progressie.doel";
const LS_OEFENINGEN = "progressie.oefeningen";

const DOEL_LABEL = { cut: "Snijden (cutting)", maintain: "Onderhouden (maintaining)", bulk: "Bulken" };

let kraft = load(LS_KRACHT, []);
let voeding = load(LS_VOEDING, []);
let doel = loadRaw(LS_DOEL, "maintain");
if (!DOEL_LABEL[doel]) doel = "maintain";
let oefeningen = load(LS_OEFENINGEN, []);
let kSelectValue = null;
let vSelectValue = "kcal";
let editKrachtId = null;
let editVoedingId = null;

function loadRaw(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function load(key, fallback) {
  const parsed = loadRaw(key, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

function save() {
  localStorage.setItem(LS_KRACHT, JSON.stringify(kracht));
  localStorage.setItem(LS_VOEDING, JSON.stringify(voeding));
  localStorage.setItem(LS_DOEL, JSON.stringify(doel));
  localStorage.setItem(LS_OEFENINGEN, JSON.stringify(oefeningen));
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function dayMs(dstr) {
  return Date.parse(dstr + "T12:00:00");
}

function fmtDate(dstr) {
  const d = new Date(dayMs(dstr));
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" });
}

function e1rm(gewicht, reps) {
  return gewicht * (1 + reps / 30);
}

function trend(points) {
  if (points.length < 2) return null;
  const n = points.length;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const p of points) {
    const x = p.x;
    sx += x; sy += p.y; sxy += x * p.y; sxx += x * x;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const avgY = sy / n;
  const relSlope = avgY !== 0 ? slope / avgY : 0;
  const day = 24 * 3600 * 1000;
  const relPerDay = relSlope * day;
  let dir = "flat";
  if (relPerDay > 0.0005) dir = "up";
  else if (relPerDay < -0.0005) dir = "down";
  const firstFit = slope * points[0].x + intercept;
  const lastFit = slope * points[n - 1].x + intercept;
  let pct = null;
  if (firstFit !== 0) pct = ((lastFit - firstFit) / Math.abs(firstFit)) * 100;
  return { slope, intercept, dir, pct, firstFit, lastFit };
}

function verdict(dir, metric) {
  if (metric === "e1rm") return dir === "up" ? "goed" : dir === "flat" ? "neutraal" : "afwijkend";
  if (metric === "kcal" || metric === "gewicht") {
    if (doel === "cut") return dir === "down" ? "goed" : dir === "flat" ? "neutraal" : "afwijkend";
    if (doel === "bulk") return dir === "up" ? "goed" : dir === "flat" ? "neutraal" : "afwijkend";
    return dir === "flat" ? "goed" : "neutraal";
  }
  return null;
}

function verdictHtml(v) {
  if (v === "goed") return ' <span class="verdict goed">● op koers</span>';
  if (v === "afwijkend") return ' <span class="verdict afwijkend">● afwijkend van doel</span>';
  if (v === "neutraal") return ' <span class="verdict neutraal">● neutraal</span>';
  return "";
}

function trendBadge(el, t, unit, v) {
  if (!t) {
    el.className = "trend-badge flat";
    el.innerHTML = '<span class="arrow">…</span><span>Nog te weinig data voor een trend</span>';
    return;
  }
  const arrow = t.dir === "up" ? "▲" : t.dir === "down" ? "▼" : "▬";
  const label = t.dir === "up" ? "Stijgende lijn" : t.dir === "down" ? "Dalende lijn" : "Vlakke lijn";
  const pct = t.pct !== null ? ` (${t.pct >= 0 ? "+" : ""}${t.pct.toFixed(1)}% over de periode)` : "";
  el.className = "trend-badge " + t.dir;
  el.innerHTML = `<span class="arrow">${arrow}</span><span>${label}${pct}${unit ? " — " + unit : ""}${verdictHtml(v)}</span>`;
}

function drawChart(container, points, opts) {
  container.innerHTML = "";
  const W = Math.max(container.clientWidth || 600, 320);
  const H = 280;
  const padL = 48, padR = 16, padT = 16, padB = 34;
  const iw = W - padL - padR;
  const ih = H - padT - padB;

  if (!points.length) {
    container.innerHTML = '<p class="empty">Nog geen data — log eerst iets bovenaan.</p>';
    return;
  }

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (x1 === x0) { x0 -= 1; x1 += 1; }
  const yPad = (y1 - y0) * 0.15 || Math.abs(y1) * 0.1 || 1;
  y0 -= yPad; y1 += yPad;

  const X = x => padL + ((x - x0) / (x1 - x0)) * iw;
  const Y = y => padT + ih - ((y - y0) / (y1 - y0)) * ih;

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);

  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = y0 + ((y1 - y0) * i) / gridLines;
    const gy = Y(y);
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", padL); line.setAttribute("x2", W - padR);
    line.setAttribute("y1", gy); line.setAttribute("y2", gy);
    line.setAttribute("stroke", "#334155");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);
    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", padL - 8);
    label.setAttribute("y", gy + 4);
    label.setAttribute("text-anchor", "end");
    label.setAttribute("fill", "#94a3b8");
    label.setAttribute("font-size", "11");
    label.textContent = opts.fmtY ? opts.fmtY(y) : Math.round(y);
    svg.appendChild(label);
  }

  const xLabels = points.length <= 8 ? points : points.filter((_, i) => i % Math.ceil(points.length / 7) === 0);
  for (const p of xLabels) {
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", X(p.x));
    t.setAttribute("y", H - padB + 18);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", "#94a3b8");
    t.setAttribute("font-size", "11");
    t.textContent = p.label;
    svg.appendChild(t);
  }

  const t = trend(points);
  if (t && points.length >= 2) {
    const tl = document.createElementNS(NS, "line");
    tl.setAttribute("x1", X(points[0].x));
    tl.setAttribute("y1", Y(t.firstFit));
    tl.setAttribute("x2", X(points[points.length - 1].x));
    tl.setAttribute("y2", Y(t.lastFit));
    tl.setAttribute("stroke", t.dir === "up" ? "#22c55e" : t.dir === "down" ? "#ef4444" : "#94a3b8");
    tl.setAttribute("stroke-width", "2.5");
    tl.setAttribute("stroke-dasharray", "7 5");
    svg.appendChild(tl);
  }

  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", points.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.x)},${Y(p.y)}`).join(" "));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#38bdf8");
  path.setAttribute("stroke-width", "2.5");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);

  for (const p of points) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", X(p.x));
    c.setAttribute("cy", Y(p.y));
    c.setAttribute("r", "4");
    c.setAttribute("fill", "#38bdf8");
    c.setAttribute("stroke", "#0f172a");
    c.setAttribute("stroke-width", "2");
    const title = document.createElementNS(NS, "title");
    title.textContent = `${p.label}: ${opts.fmtY ? opts.fmtY(p.y) : p.y}`;
    c.appendChild(title);
    svg.appendChild(c);
  }

  container.appendChild(svg);
  return t;
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function initTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".tab-page").forEach(p =>
        p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab)
      );
      renderAll();
    });
  });
}

function initDoel() {
  const sel = document.getElementById("doel");
  sel.value = doel;
  sel.addEventListener("change", () => {
    doel = sel.value;
    save();
    renderAll();
    toast("Doel: " + DOEL_LABEL[doel]);
  });
}

function initKracht() {
  document.getElementById("k-datum").value = todayStr();
  const form = document.getElementById("form-kracht");
  const e1rmEl = document.getElementById("k-e1rm");

  const updateE1rm = () => {
    const w = parseFloat(document.getElementById("k-gewicht").value);
    const r = parseInt(document.getElementById("k-reps").value, 10);
    e1rmEl.textContent = w > 0 && r > 0 ? `e1RM ≈ ${e1rm(w, r).toFixed(1)} kg` : "";
  };
  ["k-gewicht", "k-reps"].forEach(id => document.getElementById(id).addEventListener("input", updateE1rm));

  document.getElementById("k-cancel").addEventListener("click", () => {
    resetKrachtForm();
    toast("Bewerken geannuleerd");
  });

  form.addEventListener("submit", ev => {
    ev.preventDefault();
    const entry = {
      id: editKrachtId || Date.now() + Math.random().toString(36).slice(2),
      oefening: document.getElementById("k-oefening").value.trim(),
      gewicht: parseFloat(document.getElementById("k-gewicht").value),
      reps: parseInt(document.getElementById("k-reps").value, 10),
      datum: document.getElementById("k-datum").value,
    };
    if (!entry.oefening || !entry.datum || !(entry.gewicht >= 0) || !(entry.reps >= 1)) return;
    if (editKrachtId) {
      const i = kracht.findIndex(x => x.id === editKrachtId);
      if (i >= 0) kraft[i] = entry;
      toast("Set bijgewerkt");
    } else {
      kraft.push(entry);
      toast("Set opgeslagen");
    }
    ensureExercise(entry.oefening);
    kSelectValue = entry.oefening;
    save();
    resetKrachtForm();
    renderKracht();
  });

  document.getElementById("k-select").addEventListener("change", ev => {
    kSelectValue = ev.target.value;
    renderKrachtChart();
  });
}

function startEditKracht(e) {
  editKrachtId = e.id;
  document.getElementById("k-oefening").value = e.oefening;
  document.getElementById("k-gewicht").value = e.gewicht;
  document.getElementById("k-reps").value = e.reps;
  document.getElementById("k-datum").value = e.datum;
  document.getElementById("k-submit").textContent = "Bijwerken";
  document.getElementById("k-cancel").hidden = false;
  document.getElementById("k-e1rm").textContent = `e1RM ≈ ${e1rm(e.gewicht, e.reps).toFixed(1)} kg`;
  document.getElementById("form-kracht").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetKrachtForm() {
  editKrachtId = null;
  document.getElementById("form-kracht").reset();
  document.getElementById("k-datum").value = todayStr();
  document.getElementById("k-submit").textContent = "Opslaan";
  document.getElementById("k-cancel").hidden = true;
  document.getElementById("k-e1rm").textContent = "";
}

function ensureExercise(name) {
  if (name && !oefeningen.some(o => o.toLowerCase() === name.toLowerCase())) {
    oefeningen.push(name);
    oefeningen.sort((a, b) => a.localeCompare(b, "nl"));
  }
}

function renderKracht() {
  const names = [...new Set([...oefeningen, ...kracht.map(e => e.oefening)])].sort((a, b) => a.localeCompare(b, "nl"));
  const list = document.getElementById("oefeningen-lijst");
  list.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">`).join("");

  const sel = document.getElementById("k-select");
  sel.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  if (names.length) {
    if (!kSelectValue || !names.includes(kSelectValue)) kSelectValue = names[names.length - 1];
    sel.value = kSelectValue;
  }

  renderKrachtChart();
  renderKrachtOverview();
  renderKrachtTable();
}

function kraftPoints(oefening) {
  return kracht
    .filter(e => e.oefening === oefening)
    .sort((a, b) => dayMs(a.datum) - dayMs(b.datum))
    .map(e => ({
      x: dayMs(e.datum),
      y: e1rm(e.gewicht, e.reps),
      label: fmtDate(e.datum),
    }));
}

function renderKrachtChart() {
  const points = kraftPoints(kSelectValue || "");
  const t = drawChart(document.getElementById("k-chart"), points, { fmtY: v => v.toFixed(0) });
  trendBadge(document.getElementById("k-trend-badge"), t, "e1RM in kg", t ? verdict(t.dir, "e1rm") : null);
}

function renderKrachtOverview() {
  const wrap = document.getElementById("k-overview");
  const names = [...new Set(kracht.map(e => e.oefening))].sort((a, b) => a.localeCompare(b, "nl"));
  if (!names.length) {
    wrap.innerHTML = '<p class="empty">Nog geen oefeningen gelogd.</p>';
    return;
  }
  wrap.innerHTML = "";
  for (const name of names) {
    const pts = kraftPoints(name);
    const t = trend(pts);
    const last = pts[pts.length - 1];
    const arrow = !t ? "…" : t.dir === "up" ? "▲" : t.dir === "down" ? "▼" : "▬";
    const pct = t && t.pct !== null ? `${t.pct >= 0 ? "+" : ""}${t.pct.toFixed(1)}%` : "—";
    const card = document.createElement("div");
    card.className = "overview-card";
    card.innerHTML = `
      <div class="name">${escapeHtml(name)}</div>
      <div class="meta">
        <span>laatste: ${last ? last.y.toFixed(1) + " kg e1RM (" + last.label + ")" : "—"}</span>
        <span class="trend ${t ? t.dir : "flat"}">${arrow} ${pct}</span>
      </div>`;
    card.addEventListener("click", () => {
      kSelectValue = name;
      document.getElementById("k-select").value = name;
      renderKrachtChart();
    });
    wrap.appendChild(card);
  }
}

function renderKrachtTable() {
  const tbody = document.querySelector("#k-table tbody");
  const rows = [...kracht].sort((a, b) => dayMs(b.datum) - dayMs(a.datum) || b.id - a.id);
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Nog geen sets gelogd.</td></tr>';
    return;
  }
  for (const e of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(e.datum)}</td>
      <td>${escapeHtml(e.oefening)}</td>
      <td class="num">${e.gewicht} kg</td>
      <td class="num">${e.reps}</td>
      <td class="num">${e1rm(e.gewicht, e.reps).toFixed(1)} kg</td>
      <td class="num">${(e.gewicht * e.reps).toFixed(0)} kg</td>
      <td>
        <button class="row-del edit" title="Bewerken">✎</button>
        <button class="row-del del" title="Verwijderen">✕</button>
      </td>`;
    tr.querySelector(".edit").addEventListener("click", () => startEditKracht(e));
    tr.querySelector(".del").addEventListener("click", () => {
      kraft = kracht.filter(x => x.id !== e.id);
      save();
      renderKracht();
      toast("Set verwijderd");
    });
    tbody.appendChild(tr);
  }
}

function initVoeding() {
  document.getElementById("v-datum").value = todayStr();
  const form = document.getElementById("form-voeding");

  document.getElementById("v-cancel").addEventListener("click", () => {
    resetVoedingForm();
    toast("Bewerken geannuleerd");
  });

  form.addEventListener("submit", ev => {
    ev.preventDefault();
    const num = id => {
      const v = document.getElementById(id).value;
      return v === "" ? null : parseFloat(v);
    };
    const entry = {
      id: editVoedingId || Date.now() + Math.random().toString(36).slice(2),
      datum: document.getElementById("v-datum").value,
      kcal: num("v-kcal"),
      eiwit: num("v-eiwit"),
      koolhydraten: num("v-koolhydraten"),
      vetten: num("v-vetten"),
      gewicht: num("v-gewicht"),
    };
    if (!entry.datum || entry.kcal === null) return;
    if (editVoedingId) {
      voeding = voeding.filter(d => d.id !== editVoedingId && d.datum !== entry.datum);
      toast("Dag bijgewerkt");
    } else {
      voeding = voeding.filter(d => d.datum !== entry.datum);
      toast("Dag opgeslagen");
    }
    voeding.push(entry);
    save();
    resetVoedingForm();
    renderVoeding();
  });

  document.getElementById("v-select").addEventListener("change", ev => {
    vSelectValue = ev.target.value;
    renderVoedingChart();
  });
}

function startEditVoeding(d) {
  editVoedingId = d.id;
  document.getElementById("v-datum").value = d.datum;
  document.getElementById("v-kcal").value = d.kcal ?? "";
  document.getElementById("v-eiwit").value = d.eiwit ?? "";
  document.getElementById("v-koolhydraten").value = d.koolhydraten ?? "";
  document.getElementById("v-vetten").value = d.vetten ?? "";
  document.getElementById("v-gewicht").value = d.gewicht ?? "";
  document.getElementById("v-submit").textContent = "Bijwerken";
  document.getElementById("v-cancel").hidden = false;
  document.getElementById("form-voeding").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetVoedingForm() {
  editVoedingId = null;
  document.getElementById("form-voeding").reset();
  document.getElementById("v-datum").value = todayStr();
  document.getElementById("v-submit").textContent = "Opslaan";
  document.getElementById("v-cancel").hidden = true;
}

const V_META = {
  kcal: { label: "kcal", fmt: v => Math.round(v) + " kcal" },
  eiwit: { label: "eiwit", fmt: v => Math.round(v) + " g" },
  koolhydraten: { label: "koolhydraten", fmt: v => Math.round(v) + " g" },
  vetten: { label: "vetten", fmt: v => Math.round(v) + " g" },
  gewicht: { label: "gewicht", fmt: v => v.toFixed(1) + " kg" },
};

function voedingPoints(field) {
  return voeding
    .filter(d => d[field] !== null && d[field] !== undefined)
    .sort((a, b) => dayMs(a.datum) - dayMs(b.datum))
    .map(d => ({ x: dayMs(d.datum), y: d[field], label: fmtDate(d.datum) }));
}

function renderVoeding() {
  renderVoedingChart();
  renderVoedingTable();
}

function renderVoedingChart() {
  const meta = V_META[vSelectValue] || V_META.kcal;
  const points = voedingPoints(vSelectValue);
  const t = drawChart(document.getElementById("v-chart"), points, { fmtY: meta.fmt });
  trendBadge(document.getElementById("v-trend-badge"), t, meta.label, t ? verdict(t.dir, vSelectValue) : null);
}

function renderVoedingTable() {
  const tbody = document.querySelector("#v-table tbody");
  const rows = [...voeding].sort((a, b) => dayMs(b.datum) - dayMs(a.datum));
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Nog geen dagen gelogd.</td></tr>';
    return;
  }
  for (const d of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(d.datum)}</td>
      <td class="num">${d.kcal ?? "—"}</td>
      <td class="num">${d.eiwit ?? "—"}</td>
      <td class="num">${d.koolhydraten ?? "—"}</td>
      <td class="num">${d.vetten ?? "—"}</td>
      <td class="num">${d.gewicht !== null && d.gewicht !== undefined ? d.gewicht + " kg" : "—"}</td>
      <td>
        <button class="row-del edit" title="Bewerken">✎</button>
        <button class="row-del del" title="Verwijderen">✕</button>
      </td>`;
    tr.querySelector(".edit").addEventListener("click", () => startEditVoeding(d));
    tr.querySelector(".del").addEventListener("click", () => {
      voeding = voeding.filter(x => x.id !== d.id);
      save();
      renderVoeding();
      toast("Dag verwijderd");
    });
    tbody.appendChild(tr);
  }
}

function initBeheer() {
  const input = document.getElementById("new-oefening");
  const add = () => {
    const name = input.value.trim();
    if (!name) return;
    if (oefeningen.some(o => o.toLowerCase() === name.toLowerCase())) {
      toast("Oefening bestaat al");
      return;
    }
    oefeningen.push(name);
    oefeningen.sort((a, b) => a.localeCompare(b, "nl"));
    save();
    input.value = "";
    renderBeheer();
    renderKracht();
    toast("Oefening toegevoegd");
  };
  document.getElementById("btn-add-oefening").addEventListener("click", add);
  input.addEventListener("keydown", ev => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      add();
    }
  });
}

function renderBeheer() {
  const wrap = document.getElementById("oefeningen-beheer");
  wrap.innerHTML = "";
  if (!oefeningen.length) {
    wrap.innerHTML = '<p class="empty">Nog geen oefeningen. Voeg hierboven je eerste oefening toe.</p>';
    return;
  }
  for (const name of oefeningen) {
    const count = kracht.filter(e => e.oefening === name).length;
    const row = document.createElement("div");
    row.className = "beheer-row";
    row.innerHTML = `
      <span class="beheer-name">${escapeHtml(name)}</span>
      <span class="beheer-count">${count} set${count === 1 ? "" : "s"}</span>
      <span class="beheer-actions">
        <button class="row-del edit" title="Hernoemen">✎</button>
        <button class="row-del del" title="Verwijderen">✕</button>
      </span>`;
    row.querySelector(".edit").addEventListener("click", () => startRename(row, name));
    row.querySelector(".del").addEventListener("click", () => {
      if (!confirm(`Oefening "${name}" en alle ${count} gelogde set(s) verwijderen?`)) return;
      oefeningen = oefeningen.filter(o => o !== name);
      kraft = kracht.filter(e => e.oefening !== name);
      if (kSelectValue === name) kSelectValue = null;
      save();
      renderAll();
      toast("Oefening verwijderd");
    });
    wrap.appendChild(row);
  }
}

function startRename(row, oldName) {
  const nameSpan = row.querySelector(".beheer-name");
  const actions = row.querySelector(".beheer-actions");
  const input = document.createElement("input");
  input.className = "rename-input";
  input.value = oldName;
  nameSpan.replaceWith(input);
  actions.innerHTML = "";
  const ok = document.createElement("button");
  ok.className = "row-del edit";
  ok.textContent = "✓";
  ok.title = "Naam opslaan";
  const cancel = document.createElement("button");
  cancel.className = "row-del del";
  cancel.textContent = "✕";
  cancel.title = "Annuleren";
  actions.append(ok, cancel);
  input.focus();
  input.select();
  const commit = () => {
    const newName = input.value.trim();
    if (!newName || newName === oldName) {
      renderBeheer();
      return;
    }
    if (oefeningen.some(o => o !== oldName && o.toLowerCase() === newName.toLowerCase())) {
      toast("Naam bestaat al");
      return;
    }
    oefeningen = oefeningen.map(o => (o === oldName ? newName : o));
    kraft = kraft.map(e => (e.oefening === oldName ? { ...e, oefening: newName } : e));
    if (kSelectValue === oldName) kSelectValue = newName;
    save();
    renderAll();
    toast("Oefening hernoemd");
  };
  ok.addEventListener("click", commit);
  cancel.addEventListener("click", () => renderBeheer());
  input.addEventListener("keydown", ev => {
    if (ev.key === "Enter") commit();
    if (ev.key === "Escape") renderBeheer();
  });
}

function initDataActions() {
  document.getElementById("btn-export").addEventListener("click", () => {
    const data = { kraft, voeding, doel, oefeningen, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "progressie-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Export gedownload");
  });

  document.getElementById("file-import").addEventListener("change", ev => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.kracht) || !Array.isArray(data.voeding)) throw new Error("bad");
        kraft = data.kracht;
        voeding = data.voeding;
        doel = DOEL_LABEL[data.doel] ? data.doel : "maintain";
        oefeningen = Array.isArray(data.oefeningen) ? data.oefeningen : [];
        document.getElementById("doel").value = doel;
        save();
        renderAll();
        toast("Import gelukt");
      } catch {
        toast("Ongeldig importbestand");
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  });

  document.getElementById("btn-wipe").addEventListener("click", () => {
    if (!confirm("Weet je zeker dat je ALLE data wilt wissen?")) return;
    kraft = [];
    voeding = [];
    oefeningen = [];
    doel = "maintain";
    document.getElementById("doel").value = doel;
    save();
    renderAll();
    toast("Alle data gewist");
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderAll() {
  renderKracht();
  renderVoeding();
  renderBeheer();
}

window.addEventListener("resize", () => {
  if (document.getElementById("tab-kracht").classList.contains("active")) renderKrachtChart();
  else renderVoedingChart();
});

initTabs();
initDoel();
initKracht();
initVoeding();
initBeheer();
initDataActions();
renderAll();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
