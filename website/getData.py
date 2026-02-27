import json
import os
import urllib.error
import urllib.request
from pathlib import Path

API_KEY_ENV = "RECROOMPRIMARYKEY"
PROJECTS_FILE = Path(__file__).with_name("projects.json")
IMAGE_BASE_URL = "https://img.rec.net/"
COMING_SOON_IMAGE = "comingSoon.jpg"
PROJECT_ROUTES_DIR = Path(__file__).with_name("project")


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
    project["stats"] = {
        "cheerCount": stats.get("CheerCount", 0),
        "favoriteCount": stats.get("FavoriteCount", 0),
        "visitCount": stats.get("VisitCount", 0),
        "visitorCount": stats.get("VisitorCount", 0),
    }
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

        route_dir = PROJECT_ROUTES_DIR / str(room_id) / "stats"
        route_dir.mkdir(parents=True, exist_ok=True)

        html = f"""<!doctype html>
<html lang=\"en\" data-bs-theme=\"dark\">
<head>
    <meta charset=\"utf-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
    <title>Nova • {title} Stats</title>
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

    <main class=\"py-5\">
        <section class=\"container py-4\">
            <div class=\"glass-card\">
                <h1 class=\"fw-bold mb-2\">{title}</h1>
                <p class=\"text-secondary mb-4\">{description}</p>
                <div class=\"row g-3\">
                    <div class=\"col-12 col-md-3\"><div class=\"totals-item\"><p class=\"totals-number mb-1\">{int(stats.get('visitCount', 0)):,}</p><small class=\"text-secondary\">Visits</small></div></div>
                    <div class=\"col-12 col-md-3\"><div class=\"totals-item\"><p class=\"totals-number mb-1\">{int(stats.get('visitorCount', 0)):,}</p><small class=\"text-secondary\">Unique Players</small></div></div>
                    <div class=\"col-12 col-md-3\"><div class=\"totals-item\"><p class=\"totals-number mb-1\">{int(stats.get('favoriteCount', 0)):,}</p><small class=\"text-secondary\">Favorites</small></div></div>
                    <div class=\"col-12 col-md-3\"><div class=\"totals-item\"><p class=\"totals-number mb-1\">{int(stats.get('cheerCount', 0)):,}</p><small class=\"text-secondary\">Cheers</small></div></div>
                </div>
            </div>
        </section>
    </main>
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