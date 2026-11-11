(() => {
  "use strict";

  const archive = window.CBL_TEAM_ARCHIVE;
  const panel = document.querySelector("#archive-panel");
  const seasons = [...document.querySelectorAll("[data-season]")];
  const tabs = [...document.querySelectorAll("[data-view]")];
  const dialog = document.querySelector("#photo-dialog");
  const photoTitle = document.querySelector("#photo-title");
  const photoImage = document.querySelector("#photo-image");
  const scheduleLinks = [...document.querySelectorAll("[data-schedule-return]")];
  const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const medals = [
    { label: "冠軍", kind: "gold" },
    { label: "亞軍", kind: "silver" },
    { label: "季軍", kind: "bronze" }
  ];
  const expandIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3m-8 0H5a2 2 0 0 1-2-2v-3"/></svg>';
  const latestSeason = Object.keys(archive.seasons).at(-1);
  let season;
  let view;
  let opener;

  function teamCell(id) {
    const team = archive.teams[id];
    return `<span class="team-cell"><img src="${esc(team.logo)}" alt="" width="54" height="36" loading="lazy"><span>${esc(team.name)}</span></span>`;
  }

  function awardsMarkup(data) {
    const top = data.postseason.slice(0, 3);
    const layout = data.photos ? "photos" : "crests";
    const summary = data.photos ? `<ol class="podium-summary" aria-label="季後賽前三名">${top.map((entry, index) => {
      const medal = medals[index];
      return `<li class="award--${medal.kind}"><span>${medal.label}</span><strong>${esc(archive.teams[entry.team].name)}</strong></li>`;
    }).join("")}</ol>` : "";
    return `${summary}<div class="award-gallery award-gallery--${layout}">${top.map((entry, index) => {
      const team = archive.teams[entry.team];
      const medal = medals[index];
      const photo = data.photos?.[entry.team];
      const caption = `${data.label}季後賽${medal.label} ${team.name}`;
      return `<figure class="award award--${medal.kind}${photo ? "" : " award--without-photo"}">
        <figcaption class="award-caption"><span class="medal-label">${medal.label}</span><h3>${esc(team.name)}</h3>${photo
          ? `<img class="caption-crest" src="${esc(team.logo)}" alt="" width="54" height="36"><button type="button" class="photo-expand" data-open-photo aria-label="放大${esc(caption)}合照" title="放大合照">${expandIcon}</button>`
          : ""}</figcaption>
        ${photo
          ? `<img class="award-image" data-open-photo src="${esc(photo.src)}" alt="${esc(caption)}合照" width="${photo.width}" height="${photo.height}" decoding="async"${index === 0 ? "" : ' loading="lazy"'}>`
          : `<div class="crest-display"><img src="${esc(team.logo)}" alt="" width="138" height="92"></div>`}
      </figure>`;
    }).join("")}</div>`;
  }

  function finalRanksMarkup(data) {
    const others = data.postseason.slice(3);
    return `<section class="rank-section" aria-labelledby="other-ranks">
      <div class="section-title"><h2 id="other-ranks">季後賽其餘名次</h2></div>
      <table class="rank-table"><caption>${data.label}季後賽第 4 至第 ${data.postseason.length} 名</caption>
        <thead><tr><th scope="col" class="rank-number">名次</th><th scope="col">球隊</th></tr></thead>
        <tbody>${others.map((entry) => `<tr><th scope="row" class="rank-number">${entry.rank}</th><td>${teamCell(entry.team)}</td></tr>`).join("")}</tbody>
      </table>
    </section>`;
  }

  function standingsMarkup(data) {
    return `<div class="section-title"><h2>${data.label}例行賽</h2><span>最終排名</span></div>
      <table class="rank-table"><caption>${data.label}例行賽正式排名</caption>
        <thead><tr><th scope="col" class="rank-number">名次</th><th scope="col">球隊</th><th scope="col" class="rank-stat">勝 / 和 / 敗</th><th scope="col" class="rank-stat">積分</th></tr></thead>
        <tbody>${data.regular.map((entry) => `<tr><th scope="row" class="rank-number">${entry.rank}</th><td>${teamCell(entry.team)}</td><td class="rank-stat">${entry.wins} / ${entry.draws} / ${entry.losses}</td><td class="rank-stat points">${entry.points}</td></tr>`).join("")}</tbody>
      </table>`;
  }

  function render() {
    const data = archive.seasons[season];
    document.title = `${data.label}${view === "postseason" ? "季後賽成果" : "例行賽排名"}｜CBL 歷屆球隊戰績`;
    for (const button of seasons) button.setAttribute("aria-pressed", String(button.dataset.season === season));
    for (const button of tabs) {
      const active = button.dataset.view === view;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      if (active) panel.setAttribute("aria-labelledby", button.id);
    }
    panel.innerHTML = (view === "postseason"
      ? `<div class="section-title"><h2>${data.label}季後賽</h2><span>最終名次</span></div>${awardsMarkup(data)}${finalRanksMarkup(data)}`
      : standingsMarkup(data)) +
      `<section class="exchange" aria-labelledby="exchange-title">
        <h2 id="exchange-title">交流隊伍</h2>
        <ul class="exchange-list">${data.exchange.map((id) => `<li>${teamCell(id)}</li>`).join("")}</ul>
      </section>`;
  }

  function selectionURL(nextSeason, nextView) {
    const url = new URL(location.href);
    url.searchParams.set("season", nextSeason);
    url.searchParams.set("view", nextView);
    return url;
  }

  function readLocation() {
    const params = new URLSearchParams(location.search);
    const selectedSeason = params.get("season");
    const selectedView = params.get("view");
    season = Object.hasOwn(archive.seasons, selectedSeason) ? selectedSeason : latestSeason;
    view = selectedView === "regular" ? "regular" : "postseason";
    if (selectedSeason !== season || selectedView !== view) {
      history.replaceState(null, "", selectionURL(season, view));
    }
    const fallback = new URL("賽程戰績表.html", location.href);
    let destination = fallback;
    try {
      const candidate = new URL(params.get("return") || fallback.href, location.href);
      if (candidate.origin === fallback.origin && candidate.pathname === fallback.pathname && !candidate.username && !candidate.password) {
        destination = candidate;
      }
    } catch {
      destination = fallback;
    }
    for (const link of scheduleLinks) link.href = destination.href;
    if (dialog.open) dialog.close();
    render();
  }

  function navigate(nextSeason, nextView) {
    if (nextSeason === season && nextView === view) return;
    history.pushState(null, "", selectionURL(nextSeason, nextView));
    readLocation();
  }

  for (const button of seasons) button.addEventListener("click", () => {
    navigate(button.dataset.season, view);
  });
  for (const button of tabs) {
    button.addEventListener("click", () => {
      navigate(season, button.dataset.view);
    });
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1) : tabs.find((item) => item !== button);
      next.click();
      next.focus();
    });
  }
  panel.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-open-photo]");
    if (!trigger) return;
    const award = trigger.closest(".award");
    const image = award.querySelector(".award-image");
    opener = award.querySelector(".photo-expand");
    photoTitle.textContent = image.alt;
    photoImage.src = image.src;
    photoImage.alt = image.alt;
    dialog.showModal();
  });
  dialog.addEventListener("close", () => opener?.focus());
  window.addEventListener("popstate", readLocation);
  readLocation();
})();
