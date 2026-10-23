(() => {
  const state = {
    airports: [],
    dep: null,
    arr: null,
  };

  const els = {
    depQ: document.getElementById("dep-q"),
    arrQ: document.getElementById("arr-q"),
    depSuggest: document.getElementById("dep-suggest"),
    arrSuggest: document.getElementById("arr-suggest"),
    depPicked: document.getElementById("dep-picked"),
    arrPicked: document.getElementById("arr-picked"),
    depDate: document.getElementById("dep-date"),
    arrDate: document.getElementById("arr-date"),
    depTime: document.getElementById("dep-time"),
    arrTime: document.getElementById("arr-time"),
    depLocal: document.getElementById("dep-local"),
    arrLocal: document.getElementById("arr-local"),
    dayOffset: document.getElementById("day-offset"),
    result: document.getElementById("result"),
    meta: document.getElementById("meta"),
    depRowHead: document.getElementById("dep-row-head"),
    arrRowHead: document.getElementById("arr-row-head"),
    depBar: document.getElementById("dep-bar"),
    arrBar: document.getElementById("arr-bar"),
    depTicks: document.getElementById("dep-ticks"),
    arrTicks: document.getElementById("arr-ticks"),
    status: document.getElementById("status"),
  };

  let renderTimer = null;
  let suggestTimer = null;

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function todayISOInTZ(timeZone) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(new Date())
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function setDefaultDates() {
    const iso = todayISOInTZ(Intl.DateTimeFormat().resolvedOptions().timeZone);
    els.depDate.value = iso;
    els.arrDate.value = iso;
  }

  function formatAirport(a) {
    return `${a.iata}  ${a.city || a.name}${a.country ? ", " + a.country : ""}`;
  }

  function setPicked(side, airport) {
    state[side] = airport;
    const picked = side === "dep" ? els.depPicked : els.arrPicked;
    const q = side === "dep" ? els.depQ : els.arrQ;
    if (!airport) {
      picked.textContent = "—";
      picked.classList.remove("ok");
      return;
    }
    q.value = airport.iata;
    picked.textContent = `${airport.name}\n${airport.tz}`;
    picked.classList.add("ok");
  }

  function searchAirports(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const exact = [];
    const starts = [];
    const contains = [];
    for (const a of state.airports) {
      const iata = a.iata.toLowerCase();
      const city = (a.city || "").toLowerCase();
      const name = (a.name || "").toLowerCase();
      const country = (a.country || "").toLowerCase();
      const blob = `${iata} ${city} ${name} ${country}`;
      if (iata === q) exact.push(a);
      else if (iata.startsWith(q) || city.startsWith(q)) starts.push(a);
      else if (blob.includes(q)) contains.push(a);
      if (exact.length + starts.length + contains.length > 40) break;
    }
    return [...exact, ...starts, ...contains].slice(0, 12);
  }

  function bindSuggest(input, listEl, side) {
    input.addEventListener("input", () => {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(() => {
        const hits = searchAirports(input.value);
        listEl.innerHTML = "";
        if (!hits.length) {
          listEl.hidden = true;
          if (state[side] && input.value.trim().toUpperCase() !== state[side].iata) {
            setPicked(side, null);
            scheduleRender();
          }
          return;
        }
        for (const a of hits) {
          const li = document.createElement("li");
          li.innerHTML = `<span class="code">${a.iata}</span> ${escapeHtml(a.city || a.name)} <span class="code">${escapeHtml(a.country || "")}</span>`;
          li.addEventListener("mousedown", (e) => {
            e.preventDefault();
            setPicked(side, a);
            listEl.hidden = true;
            scheduleRender();
          });
          listEl.appendChild(li);
        }
        listEl.hidden = false;
      }, 80);
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        listEl.hidden = true;
      }, 150);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = listEl.querySelector("li");
        if (first && !listEl.hidden) {
          e.preventDefault();
          first.dispatchEvent(new Event("mousedown"));
        }
      }
      if (e.key === "Escape") listEl.hidden = true;
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  /** Local wall time in `timeZone` → UTC Date */
  function zonedTimeToUtc(dateStr, timeStr, timeZone) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = timeStr.split(":").map(Number);
    const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0);
    let t = utcGuess;
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
          .formatToParts(new Date(t))
          .filter((p) => p.type !== "literal")
          .map((p) => [p.type, p.value])
      );
      let hour = Number(parts.hour);
      if (hour === 24) hour = 0;
      const asUTC = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        hour,
        Number(parts.minute),
        Number(parts.second)
      );
      const wanted = Date.UTC(y, m - 1, d, hh, mm, 0);
      t = t + (wanted - asUTC);
    }
    return new Date(t);
  }

  function ymdInZone(date, timeZone) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(date)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function hmInZone(date, timeZone) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .formatToParts(date)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value])
    );
    let h = parts.hour;
    if (h === "24") h = "00";
    return `${h}:${parts.minute}`;
  }

  function calendarDayNumber(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  }

  function formatDuration(ms) {
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${pad(m)}m`;
  }

  function dayOffsetLabel(n) {
    if (n === 0) return "same calendar day";
    if (n === 1) return "+1 day";
    if (n === -1) return "−1 day";
    return (n > 0 ? `+${n}` : `${n}`) + " days";
  }

  /** Approximate sunrise/sunset (UTC) for a civil date at lat/lon. NOAA-style. */
  function solarEventsUtc(lat, lon, ymd) {
    const [Y, M, D] = ymd.split("-").map(Number);
    const rad = Math.PI / 180;
    const dayOfYear = Math.floor(
      (Date.UTC(Y, M - 1, D) - Date.UTC(Y, 0, 0)) / 86400000
    );
    const gamma =
      (2 * Math.PI) / 365 * (dayOfYear - 1 + (12 - lon / 15) / 24);
    const eqTime =
      229.18 *
      (0.000075 +
        0.001868 * Math.cos(gamma) -
        0.032077 * Math.sin(gamma) -
        0.014615 * Math.cos(2 * gamma) -
        0.040849 * Math.sin(2 * gamma));
    const decl =
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma);
    const latR = lat * rad;
    const cosHA =
      (Math.cos(90.833 * rad) / (Math.cos(latR) * Math.cos(decl))) -
      Math.tan(latR) * Math.tan(decl);
    if (cosHA >= 1) {
      return { sunrise: null, sunset: null, polar: "night" };
    }
    if (cosHA <= -1) {
      return { sunrise: null, sunset: null, polar: "day" };
    }
    const ha = (Math.acos(cosHA) * 180) / Math.PI;
    const noonMin = 720 - 4 * lon - eqTime;
    const riseMin = noonMin - ha * 4;
    const setMin = noonMin + ha * 4;
    const base = Date.UTC(Y, M - 1, D);
    return {
      sunrise: new Date(base + riseMin * 60000),
      sunset: new Date(base + setMin * 60000),
      polar: null,
    };
  }

  function eachYmd(startYmd, endYmd) {
    const out = [];
    let cur = startYmd;
    while (cur <= endYmd) {
      out.push(cur);
      cur = addDaysYmd(cur, 1);
    }
    return out;
  }

  function sunDaysLocal(lat, lon, startYmd, endYmd) {
    const days = [];
    for (const date of eachYmd(startYmd, endYmd)) {
      const s = solarEventsUtc(lat, lon, date);
      if (s.polar === "day") {
        const start = new Date(date + "T00:00:00Z");
        days.push({
          date,
          sunrise: start,
          sunset: new Date(start.getTime() + 86400000),
        });
      } else if (s.polar === "night") {
        continue;
      } else {
        days.push({ date, sunrise: s.sunrise, sunset: s.sunset });
      }
    }
    return days;
  }

  async function fetchSun(lat, lon, timeZone, startYmd, endYmd) {
    try {
      const url =
        "https://api.open-meteo.com/v1/forecast?" +
        new URLSearchParams({
          latitude: String(lat),
          longitude: String(lon),
          daily: "sunrise,sunset",
          timezone: timeZone,
          start_date: startYmd,
          end_date: endYmd,
        });
      const res = await fetch(url);
      if (!res.ok) throw new Error("sun lookup failed");
      const data = await res.json();
      const days = [];
      const times = data.daily?.time || [];
      for (let i = 0; i < times.length; i++) {
        const rise = data.daily.sunrise?.[i];
        const set = data.daily.sunset?.[i];
        if (!rise || !set) continue;
        days.push({
          date: times[i],
          sunrise: new Date(rise),
          sunset: new Date(set),
        });
      }
      if (days.length) return days;
    } catch (_) {
      /* fall through */
    }
    return sunDaysLocal(lat, lon, startYmd, endYmd);
  }

  function isDayAt(t, sunDays) {
    for (const d of sunDays) {
      if (t >= d.sunrise && t < d.sunset) return true;
    }
    return false;
  }

  function buildSegments(start, end, sunDays) {
    const events = [start.getTime(), end.getTime()];
    for (const d of sunDays) {
      for (const edge of [d.sunrise, d.sunset]) {
        const x = edge.getTime();
        if (x > start.getTime() && x < end.getTime()) events.push(x);
      }
    }
    events.sort((a, b) => a - b);
    const segs = [];
    for (let i = 0; i < events.length - 1; i++) {
      const a = events[i];
      const b = events[i + 1];
      if (b <= a) continue;
      const mid = new Date((a + b) / 2);
      segs.push({
        start: a,
        end: b,
        day: isDayAt(mid, sunDays),
      });
    }
    return segs;
  }

  function renderBar(barEl, segs, start, end) {
    barEl.innerHTML = "";
    const total = end.getTime() - start.getTime();
    for (const s of segs) {
      const div = document.createElement("div");
      div.className = "seg " + (s.day ? "day" : "night");
      div.style.width = ((s.end - s.start) / total) * 100 + "%";
      div.title = s.day ? "day" : "night";
      barEl.appendChild(div);
    }
  }

  function renderTicks(tickEl, start, end, timeZone) {
    tickEl.innerHTML = "";
    const n = 5;
    for (let i = 0; i < n; i++) {
      const t = new Date(start.getTime() + ((end - start) * i) / (n - 1));
      const span = document.createElement("span");
      span.textContent = hmInZone(t, timeZone);
      tickEl.appendChild(span);
    }
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      render().catch((err) => {
        els.status.textContent = err.message || String(err);
        els.status.classList.add("err");
        els.result.hidden = true;
      });
    }, 120);
  }

  async function render() {
    els.status.classList.remove("err");
    const dep = state.dep;
    const arr = state.arr;
    const depDate = els.depDate.value;
    const arrDate = els.arrDate.value;
    const depTime = els.depTime.value;
    const arrTime = els.arrTime.value;

    if (!dep || !arr || !depDate || !arrDate || !depTime || !arrTime) {
      els.result.hidden = true;
      els.dayOffset.hidden = true;
      els.depLocal.textContent = "";
      els.arrLocal.textContent = "";
      els.status.textContent = "select airports and times";
      return;
    }

    const depUtc = zonedTimeToUtc(depDate, depTime, dep.tz);
    const arrUtc = zonedTimeToUtc(arrDate, arrTime, arr.tz);

    els.depLocal.textContent = `${depDate} ${depTime} ${dep.tz.split("/").pop()}`;
    els.arrLocal.textContent = `${arrDate} ${arrTime} ${arr.tz.split("/").pop()}`;

    const offsetDays =
      calendarDayNumber(arrDate) - calendarDayNumber(depDate);
    els.dayOffset.hidden = false;
    els.dayOffset.textContent = dayOffsetLabel(offsetDays);

    if (!(arrUtc > depUtc)) {
      els.result.hidden = true;
      els.status.textContent = "arrival must be after departure (check +1 day)";
      els.status.classList.add("err");
      return;
    }

    els.status.textContent = "loading sun times…";

    const padDays = 1;
    const depStart = addDaysYmd(ymdInZone(depUtc, dep.tz), -padDays);
    const depEnd = addDaysYmd(ymdInZone(arrUtc, dep.tz), padDays);
    const arrStart = addDaysYmd(ymdInZone(depUtc, arr.tz), -padDays);
    const arrEnd = addDaysYmd(ymdInZone(arrUtc, arr.tz), padDays);

    const [depSun, arrSun] = await Promise.all([
      fetchSun(dep.lat, dep.lon, dep.tz, depStart, depEnd),
      fetchSun(arr.lat, arr.lon, arr.tz, arrStart, arrEnd),
    ]);

    const depSegs = buildSegments(depUtc, arrUtc, depSun);
    const arrSegs = buildSegments(depUtc, arrUtc, arrSun);

    els.meta.textContent = `${dep.iata} → ${arr.iata} · ${formatDuration(arrUtc - depUtc)} block`;
    els.depRowHead.textContent = `${dep.iata}  local`;
    els.arrRowHead.textContent = `${arr.iata}  local`;

    renderBar(els.depBar, depSegs, depUtc, arrUtc);
    renderBar(els.arrBar, arrSegs, depUtc, arrUtc);
    renderTicks(els.depTicks, depUtc, arrUtc, dep.tz);
    renderTicks(els.arrTicks, depUtc, arrUtc, arr.tz);

    els.result.hidden = false;
    els.status.textContent = "";
  }

  function addDaysYmd(ymd, n) {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  }

  function wire() {
    bindSuggest(els.depQ, els.depSuggest, "dep");
    bindSuggest(els.arrQ, els.arrSuggest, "arr");
    for (const el of [els.depDate, els.arrDate, els.depTime, els.arrTime]) {
      el.addEventListener("change", scheduleRender);
      el.addEventListener("input", scheduleRender);
    }

    els.depDate.addEventListener("change", () => {
      if (!els.arrDate.dataset.manual) {
        els.arrDate.value = els.depDate.value;
        maybeBumpArrivalDay();
      }
    });
    els.arrDate.addEventListener("input", () => {
      els.arrDate.dataset.manual = "1";
    });
    els.arrTime.addEventListener("change", maybeBumpArrivalDay);
    els.depTime.addEventListener("change", maybeBumpArrivalDay);
  }

  /** If arrive local is still before depart in absolute time, step arrival date forward. */
  function maybeBumpArrivalDay() {
    if (!state.dep || !state.arr) return;
    if (!els.depDate.value || !els.arrDate.value || !els.depTime.value || !els.arrTime.value) {
      return;
    }
    try {
      let guard = 0;
      while (guard < 3) {
        const depUtc = zonedTimeToUtc(els.depDate.value, els.depTime.value, state.dep.tz);
        const arrUtc = zonedTimeToUtc(els.arrDate.value, els.arrTime.value, state.arr.tz);
        if (arrUtc > depUtc) break;
        els.arrDate.value = addDaysYmd(els.arrDate.value, 1);
        guard += 1;
      }
    } catch (_) {
      /* ignore */
    }
  }

  async function init() {
    setDefaultDates();
    wire();
    els.status.textContent = "loading airports…";
    const res = await fetch("airports.json");
    if (!res.ok) throw new Error("could not load airports.json");
    state.airports = await res.json();
    els.status.textContent = "select airports and times";
  }

  init().catch((err) => {
    els.status.textContent = err.message || String(err);
    els.status.classList.add("err");
  });
})();
