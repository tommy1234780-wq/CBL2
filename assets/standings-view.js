(() => {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  window.CBL_STANDINGS_VIEW = (divisionId, rows) => {
    const division = window.CBL_SEASON3.divisions[divisionId];
    const source = window.CBL_SEASON3_RESULTS;
    const updated = source.standingsUpdatedAt;
    const date = updated ? updated.replaceAll("-", "/") : "尚無已確認賽果";
    const headingDate = updated ? updated.slice(5).replace("-", ".") : "—";
    return `<section class="division-stage" aria-labelledby="division-name"><header class="division-identity"><div class="division-cosmic-art" aria-hidden="true"></div><div class="identity-lockup"><img src="${esc(division.logo)}" alt="${esc(division.name)} LOGO" width="126" height="150"><div class="identity-copy"><span>${esc(division.englishName)}</span><h2 id="division-name">${esc(division.name)}</h2><p>${esc(division.tagline)}</p></div></div><div class="identity-date"><span>SEASON RECORD</span><strong>${headingDate}</strong><small>CBL SEASON 3</small></div></header><div class="record-heading"><div><strong>戰績截至 ${esc(date)}</strong></div><span>例行賽累積戰績</span></div><div class="division-table-wrap"><table class="division-table"><caption>${esc(division.name)}累積戰績，資料截至 ${esc(date)}</caption><colgroup><col class="rank-col"><col class="team-col"><col class="played-col"><col class="count-col"><col class="count-col"><col class="count-col"><col class="points-col"><col class="ratio-col"></colgroup><thead><tr><th scope="col">名次</th><th scope="col">球隊</th><th scope="col" class="played-col">已賽</th><th scope="col">勝</th><th scope="col">和</th><th scope="col">敗</th><th scope="col">積分</th><th scope="col">商分率</th></tr></thead><tbody>${rows.map(r => {
      const t = window.CBL_SEASON3.teams.find(t => t.id === r.teamId);
      if (!t) return "";
      const rank = r.rank === "待裁定" ? "待定" : r.rank ?? "—";
      const ratio = !r.played ? "—" : r.ratioHighest ? "最高" : Number(r.ratio).toFixed(3);
      return `<tr data-team="${esc(t.id)}" class="${r.played ? "played" : "inactive"}"><td class="rank-cell">${rank}</td><th scope="row"><a class="table-team" href="team_introduction.html?division=${esc(t.division)}#team-${esc(t.id)}"><img src="assets/teams/standings/${esc(t.id)}.webp" alt="" width="66" height="55"><span>${esc(t.shortName)}<small class="mobile-played">${r.played ? `已賽 ${r.played} 場` : "尚未出賽"}</small></span></a></th><td class="played-col">${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td class="points">${r.points}</td><td class="ratio">${ratio}</td></tr>`;
    }).join("")}</tbody></table></div><div class="record-footnote"><p>勝 2 分、和 1 分、敗 0 分；跨組交流賽計入各隊所屬組別。同積分先比對戰勝負，再比商分率。</p><details class="ranking-rules"><summary>排名與商分率計算方式</summary><div><p>積分 → 對戰勝負 → 商分率 → 總失分較少 → 總得分較多 → 聯盟會議公告。</p><p>商分率（得失分率）＝（總得分＋總失分）÷總失分。已出賽且零失分視為最高；同分隊均零失分，續比後項。</p><p>顯示至小數第三位，排序使用原始精度。未出賽不編名次；仍無法區分者顯示待定，依聯盟公告處理。</p></div></details></div></section>`;
  };
})();
