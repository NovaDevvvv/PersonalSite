import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from getEarnings import getEarnings

API_KEY_ENV = "RECROOMPRIMARYKEY"
PROJECTS_FILE = Path(__file__).with_name("projects.json")
IMAGE_BASE_URL = "https://img.rec.net/"
COMING_SOON_IMAGE = "comingSoon.jpg"


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


def extract_room_token_candidates(project_key: str, project: dict) -> list[str]:
    candidates: list[str] = []

    explicit_token = (project.get("roomToken") or "").strip()
    if explicit_token:
        candidates.append(explicit_token)

    room_id = project.get("id")
    if room_id is not None:
        room_id_token = str(room_id).strip()
        if room_id_token and room_id_token != "-1":
            candidates.append(room_id_token)

    title_token = (project.get("title") or "").strip()
    if title_token:
        candidates.append(title_token)

    if project_key:
        key_token = project_key.strip()
        if key_token:
            candidates.append(key_token)

    link = (project.get("link") or "").strip()
    if link:
        path_parts = [part for part in urlparse(link).path.split("/") if part]
        if len(path_parts) >= 2 and path_parts[0].lower() == "room":
            candidates.append(path_parts[1])

    unique_candidates: list[str] = []
    seen = set()
    for candidate in candidates:
        normalized = candidate.casefold()
        if normalized in seen:
            continue
        seen.add(normalized)
        unique_candidates.append(candidate)

    return unique_candidates


def get_tokens_earned(project_key: str, project: dict) -> int:
    earnings_token = os.getenv("RECROOMACCESSTOKEN") or os.getenv("RecRoomAccessToken")
    if not earnings_token:
        return int((project.get("stats") or {}).get("tokenEarned") or 0)

    room_tokens = extract_room_token_candidates(project_key, project)
    if not room_tokens:
        return int((project.get("stats") or {}).get("tokenEarned") or 0)

    for room_token in room_tokens:
        try:
            return getEarnings(room_token)
        except RuntimeError as error:
            print(f"Token stats unavailable for {project_key} ({room_token}): {error}")
        except ValueError as error:
            print(f"Token stats invalid for {project_key} ({room_token}): {error}")

    return int((project.get("stats") or {}).get("tokenEarned") or 0)


def enrich_project(project_key: str, project: dict) -> dict:
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
            "tokenEarned": 0,
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
    tokens_earned = get_tokens_earned(project_key, project)
    project["stats"] = {
        "cheerCount": stats.get("CheerCount", 0),
        "favoriteCount": stats.get("FavoriteCount", 0),
        "visitCount": stats.get("VisitCount", 0),
        "visitorCount": stats.get("VisitorCount", 0),
        "tokenEarned": tokens_earned,
    }
    return project


def update_projects() -> dict:
    raw = json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))
    projects = {
        key: value
        for key, value in raw.items()
        if isinstance(value, dict) and "id" in value
    }

    for key, project in projects.items():
        try:
            projects[key] = enrich_project(key, project)
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