import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html import escape
from pathlib import Path

API_KEY_ENV = "RECROOMPRIMARYKEY"
PROJECTS_FILE = Path(__file__).with_name("projects.json")
IMAGE_BASE_URL = "https://img.rec.net/"
COMING_SOON_IMAGE = "comingSoon.jpg"
PROJECT_ROUTES_DIR = Path(__file__).with_name("project")


def format_description_html(value: str) -> str:
    text = escape(value or "")
    return text.replace("\\n", "<br>").replace("\n", "<br>")


def update_daily_visit_history(project: dict, visit_count: int) -> list[dict]:
    today = datetime.now(timezone.utc).date().isoformat()
    history = project.get("visitHistory")

    if isinstance(history, list):
        normalized = [
            item
            for item in history
            if isinstance(item, dict) and "date" in item and "visitCount" in item
        ]
    else:
        normalized = []

    if normalized and normalized[-1].get("date") == today:
        normalized[-1]["visitCount"] = int(visit_count)
        return normalized

    normalized.append({"date": today, "visitCount": int(visit_count)})
    return normalized


def get_data(room_id: int) -> dict:

    """
    EXAMPLE RESPONSE

    ```
    {
        "RoomId": 8947998229867728285,
        "Name": "DBS-Breakthrough",
        "Description": "< SHATTER THE LIMIT >\\n\\nFight it out as your favorite characters in ^DBS-Breakthrough, a DB Super themed fighting game with an expansive roster of Characters, built with care around, and for, immersive and highly explosive battles entirely available in VR! ",
        "ImageName": "6qvk1h5ikurn8pbam0ouyfqv1.jpg",
        "WarningMask": 44,
        "CustomWarning": "Please report instances of inventory rollbacking with either an in-game comment or a post in our official Discord. ||| discord.gg/teamzenkai",
        "CreatorAccountId": 1147376,
        "PublishState": 0,
        "SupportsLevelVoting": false,
        "IsRRO": false,
        "IsRecRoomApproved": false,
        "ExcludeFromLists": false,
        "ExcludeFromSearch": false,
        "SupportsScreens": true,
        "SupportsWalkVR": true,
        "SupportsTeleportVR": false,
        "SupportsVRLow": true,
        "SupportsQuest2": true,
        "SupportsMobile": true,
        "SupportsJuniors": true,
        "MinLevel": 0,
        "AgeRating": 1,
        "CreatedAt": "2023-09-04T06:44:55.5258104Z",
        "PublishedAt": "2026-01-01T23:15:01.6833604Z",
        "BecameRRStudioRoomAt": null,
        "Stats": {
            "CheerCount": 5197,
            "FavoriteCount": 4412,
            "VisitorCount": 59915,
            "VisitCount": 140916
        },
        "IsDorm": false,
        "IsPlacePlay": false,
        "MaxPlayers": 1,
        "UgcSubVersion": 255,
        "MinUgcSubVersion": 233,
        "BoostCount": 108
    }
    ```
    """

    url = f"https://apim.rec.net/public/rooms/{room_id}"

    headers = {
        'Cache-Control': 'no-cache',
        'Api-Version': 'v1',
        'Accept': 'application/json',
    }
    api_key = os.getenv(API_KEY_ENV)
    if api_key:
        headers['Ocp-Apim-Subscription-Key'] = api_key

    request = urllib.request.Request(url, headers=headers, method='GET')

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as error:
        message = error.read().decode(errors='replace')
        raise RuntimeError(f"HTTP {error.code} for room {room_id}: {message}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Network error for room {room_id}: {error.reason}") from error


def enrich_project(project: dict) -> dict:
    room_id = project.get("id")
    if room_id is None:
        return project

    if int(room_id) == -1:
        project["comingSoon"] = True
        image_name = project.get("imageName") or ""
        project["imageName"] = image_name
        project["imageUrl"] = f"{IMAGE_BASE_URL}{image_name}" if image_name else COMING_SOON_IMAGE
        project.pop("statsPath", None)
        project.pop("visitHistory", None)
        project["stats"] = {
            "cheerCount": 0,
            "favoriteCount": 0,
            "visitCount": 0,
            "visitorCount": 0,
        }
        return project

    room_data = get_data(int(room_id))
    stats = room_data.get("Stats") or {}
    image_name = room_data.get("ImageName")

    project["comingSoon"] = False
    project["title"] = room_data.get("Name") or project.get("title")
    project["description"] = room_data.get("Description") or project.get("description")
    project["imageName"] = image_name
    project["imageUrl"] = f"{IMAGE_BASE_URL}{image_name}" if image_name else ""
    project["statsPath"] = f"/project/{int(room_id)}/stats"
    project["stats"] = {
        "cheerCount": stats.get("CheerCount", 0),
        "favoriteCount": stats.get("FavoriteCount", 0),
        "visitCount": stats.get("VisitCount", 0),
        "visitorCount": stats.get("VisitorCount", 0),
    }
    project["visitHistory"] = update_daily_visit_history(project, int(project["stats"]["visitCount"]))
    return project


def write_project_stats_pages(projects: dict) -> None:
    PROJECT_ROUTES_DIR.mkdir(parents=True, exist_ok=True)

    for project in projects.values():
        room_id = project.get("id")
        if room_id is None or int(room_id) == -1:
            continue

        stats = project.get("stats") or {}
        title = project.get("title") or "Project"
        description = project.get("description") or ""
        visit_history = project.get("visitHistory") if isinstance(project.get("visitHistory"), list) else []

        points = [
            {
                "date": str(item.get("date")),
                "visitCount": int(item.get("visitCount", 0)),
            }
            for item in visit_history
            if isinstance(item, dict) and item.get("date") is not None
        ]
        points.sort(key=lambda item: item["date"])
        if not points:
            points = [{"date": "Today", "visitCount": int(stats.get("visitCount", 0))}]

        labels = [point["date"] for point in points]
        values = [point["visitCount"] for point in points]
        first_value = values[0] if values else 0
        last_value = values[-1] if values else 0
        total_growth = max(0, last_value - first_value)
        average_growth = round(total_growth / max(len(values) - 1, 1))

        safe_title = escape(title)
        safe_description = format_description_html(description)

        route_dir = PROJECT_ROUTES_DIR / str(room_id) / "stats"
        route_dir.mkdir(parents=True, exist_ok=True)

        html = f"""<!doctype html>
<html lang=\"en\" data-bs-theme=\"dark\">
<head>
    <meta charset=\"utf-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
    <title>Nova • {safe_title} Stats</title>
    <link rel=\"icon\" type=\"image/svg+xml\" href=\"../../../assets/favicon.svg\">
    <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">
    <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>
    <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap\" rel=\"stylesheet\">
    <link href=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css\" rel=\"stylesheet\" integrity=\"sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH\" crossorigin=\"anonymous\">
    <link href=\"https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css\" rel=\"stylesheet\">
    <link href=\"../../../assets/css/site.css\" rel=\"stylesheet\">
</head>
<body>
    <nav class=\"navbar navbar-expand-lg sticky-top\">
        <div class=\"container py-2\">
            <a class=\"navbar-brand fw-bold\" href=\"/home/\">Nova</a>
            <div class=\"ms-auto d-flex gap-2\">
                <a href=\"/projects.html\" class=\"btn btn-outline-light btn-sm\"><i class=\"bi bi-grid-1x2 me-2\"></i>All Projects</a>
                <a href=\"/home/\" class=\"btn btn-outline-light btn-sm\"><i class=\"bi bi-arrow-left me-2\"></i>Home</a>
            </div>
        </div>
    </nav>

    <main class="py-3">
        <div class="container py-2">
            <div class=\"glass-card\">
                <h1 class="fw-bold mb-2">{safe_title}</h1>
                <p class="text-secondary mb-4">{safe_description}</p>
                <div class=\"row g-3\">
                    <div class=\"col-12 col-md-3\"><div class=\"totals-item\"><p class=\"totals-number mb-1\">{int(stats.get('visitCount', 0)):,}</p><small class=\"text-secondary\">Visits</small></div></div>
                    <div class=\"col-12 col-md-3\"><div class=\"totals-item\"><p class=\"totals-number mb-1\">{int(stats.get('visitorCount', 0)):,}</p><small class=\"text-secondary\">Unique Players</small></div></div>
                    <div class=\"col-12 col-md-3\"><div class=\"totals-item\"><p class=\"totals-number mb-1\">{int(stats.get('favoriteCount', 0)):,}</p><small class=\"text-secondary\">Favorites</small></div></div>
                    <div class=\"col-12 col-md-3\"><div class=\"totals-item\"><p class=\"totals-number mb-1\">{int(stats.get('cheerCount', 0)):,}</p><small class=\"text-secondary\">Cheers</small></div></div>
                </div>
                <div class="row g-3 mt-2 mb-4">
                    <div class="col-12 col-md-6"><div class="totals-item"><p class="totals-number mb-1">{total_growth:,}</p><small class="text-secondary">Total Growth</small></div></div>
                    <div class="col-12 col-md-6"><div class="totals-item"><p class="totals-number mb-1">{average_growth:,}</p><small class="text-secondary">Avg Daily Growth</small></div></div>
                </div>
                <div style="position:relative;min-height:320px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.1);border-radius:.9rem;padding:.75rem;">
                    <canvas id="visitsChart" height="120"></canvas>
                </div>
            </div>
        </div>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
    <script>
        const labels = {json.dumps(labels)};
        const data = {json.dumps(values)};

        new window.Chart(document.getElementById("visitsChart"), {{
            type: "line",
            data: {{
                labels,
                datasets: [{{
                    label: "Visits",
                    data,
                    borderColor: "rgba(34, 211, 238, 0.95)",
                    backgroundColor: "rgba(34, 211, 238, 0.18)",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                }}],
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{ legend: {{ display: false }} }},
                scales: {{
                    x: {{
                        ticks: {{ color: "rgba(233, 237, 245, 0.7)" }},
                        grid: {{ color: "rgba(255,255,255,0.08)" }},
                    }},
                    y: {{
                        beginAtZero: true,
                        ticks: {{ color: "rgba(233, 237, 245, 0.7)" }},
                        grid: {{ color: "rgba(255,255,255,0.08)" }},
                    }},
                }},
            }},
        }});
    </script>
</body>
</html>
"""

        (route_dir / "index.html").write_text(html, encoding="utf-8")


def update_projects() -> dict:
    raw = json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))
    projects = {
        key: value
        for key, value in raw.items()
        if isinstance(value, dict) and "id" in value
    }

    for key, project in projects.items():
        try:
            projects[key] = enrich_project(project)
        except RuntimeError as error:
            print(f"Skipped {key}: {error}")

    PROJECTS_FILE.write_text(json.dumps(projects, indent=4), encoding="utf-8")
    write_project_stats_pages(projects)
    return projects


def main() -> int:
    updated_projects = update_projects()
    print(f"Updated {len(updated_projects)} project entries in {PROJECTS_FILE.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())