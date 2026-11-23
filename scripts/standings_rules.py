"""League ranking algorithm, shared with official results processing."""
from collections import defaultdict
from fractions import Fraction
GROUPS = ("黑洞組", "恆星組")

def calculate(teams, accepted):
    stats = {team: dict(team=team, group=group, played=0, wins=0, draws=0, losses=0,
                        points=0, scored=0, allowed=0, diff=0, ratio=None, ratio_highest=False, pct=None,
                        recent="—", updated=None, rank="未開賽") for team, group in teams.items()}
    history = defaultdict(list)
    for game, result in accepted:
        away, home = game["away"], game["home"]
        a, h = result["away_score"], result["home_score"]
        for team, scored, allowed, opponent in ((away, a, h, home), (home, h, a, away)):
            item = stats[team]
            item["played"] += 1
            item["scored"] += scored
            item["allowed"] += allowed
            outcome = "勝" if scored > allowed else "敗" if scored < allowed else "和"
            if outcome == "勝": item["wins"] += 1
            elif outcome == "敗": item["losses"] += 1
            else: item["draws"] += 1
            item["points"] += 2 if outcome == "勝" else 1 if outcome == "和" else 0
            item["updated"] = max(item["updated"], result["confirmed_at"]) if item["updated"] else result["confirmed_at"]
            history[team].append((game["day"], game["time"], game["slot"], game["id"], outcome, opponent))
    for team, item in stats.items():
        item["diff"] = item["scored"] - item["allowed"]
        if item["played"]:
            item["pct"] = item["wins"] / item["played"]
            item["recent"] = " ".join(row[4] for row in sorted(history[team], reverse=True)[:5])
        if item["allowed"]:
            item["ratio"] = (item["scored"] + item["allowed"]) / item["allowed"]
        elif item["played"]:
            item["ratio_highest"] = True

    def h2h(team, peers):
        return sum(2 if outcome == "勝" else 1 if outcome == "和" else 0
                   for *_, outcome, opponent in history[team] if opponent in peers)

    # Keep the full fraction for ranking; the graphic rounds only for display.
    def tie_key(item):
        quotient = Fraction(item["scored"] + item["allowed"], item["allowed"]) if item["allowed"] else Fraction(0)
        return (-item["h2h"], -int(item["ratio_highest"]), -quotient, item["allowed"], -item["scored"])

    ordered = {}
    for group in GROUPS:
        rows = [item for item in stats.values() if item["group"] == group]
        inactive = sorted((item for item in rows if not item["played"]), key=lambda x: x["team"])
        points_groups = defaultdict(list)
        for item in rows:
            if item["played"]:
                points_groups[item["points"]].append(item)
        output = []
        for points in sorted(points_groups, reverse=True):
            peers = points_groups[points]
            names = {item["team"] for item in peers}
            for item in peers:
                item["h2h"] = h2h(item["team"], names)
            peers.sort(key=lambda item: (*tie_key(item), item["team"]))
            unresolved = defaultdict(list)
            for item in peers:
                unresolved[tie_key(item)].append(item)
            for subset in unresolved.values():
                if len(subset) > 1:
                    for item in subset:
                        item["unresolved"] = True
            for index, item in enumerate(peers):
                if item.get("unresolved"):
                    item["rank"] = "待裁定"
                else:
                    item["rank"] = len(output) + index + 1
            output.extend(peers)
        output.extend(inactive)
        ordered[group] = output
    return ordered
