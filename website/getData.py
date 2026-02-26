import json
import os
import urllib.error
import urllib.request
from pathlib import Path

API_KEY_ENV = "RecRoomPrimaryKey"
PROJECTS_FILE = Path(__file__).with_name("projects.json")
IMAGE_BASE_URL = "https://img.rec.net/"


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

    room_data = get_data(int(room_id))
    stats = room_data.get("Stats") or {}
    image_name = room_data.get("ImageName")

    project["title"] = room_data.get("Name") or project.get("title")
    project["description"] = room_data.get("Description") or project.get("description")
    project["imageName"] = image_name
    project["imageUrl"] = f"{IMAGE_BASE_URL}{image_name}" if image_name else ""
    project["stats"] = {
        "cheerCount": stats.get("CheerCount", 0),
        "favoriteCount": stats.get("FavoriteCount", 0),
        "visitCount": stats.get("VisitCount", 0),
    }
    return project


def update_projects() -> dict:
    projects = json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))

    for key, project in projects.items():
        try:
            projects[key] = enrich_project(project)
        except RuntimeError as error:
            print(f"Skipped {key}: {error}")

    PROJECTS_FILE.write_text(json.dumps(projects, indent=4), encoding="utf-8")
    return projects


def main() -> int:
    updated_projects = update_projects()
    print(f"Updated {len(updated_projects)} project entries in {PROJECTS_FILE.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())