from flask import Flask, request, jsonify, send_from_directory
import json
import random
import math
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
COUNTRIES_FILE = os.path.join(BASE_DIR, "countries_with_borders.json")
WORLD_GEOJSON_FILE = os.path.join(DATA_DIR, "world.geojson")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

CONTINENT_LEVELS = {
    "africa": {"Africa"},
    "asia": {"Asia"},
    "europe": {"Europe"},
    "americas": {"North America", "South America"},
}

GEOJSON_NAME_ALIASES = {
    "Czechia": "Czech Republic",
    "Republic of the Congo": "Congo",
    "Eswatini": "Swaziland",
    "United Republic of Tanzania": "Tanzania",
    "United States of America": "United States",
}

current_level = "global"
attempts = 0


def load_json(path):
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


BASE_COUNTRIES = load_json(COUNTRIES_FILE)
WORLD_GEOJSON = load_json(WORLD_GEOJSON_FILE)
LEVEL_KEYS = {"global", *CONTINENT_LEVELS.keys()}


def geojson_names(properties):
    return [
        properties.get("ADMIN"),
        properties.get("NAME"),
        properties.get("NAME_LONG"),
        properties.get("NAME_EN"),
        properties.get("GEOUNIT"),
    ]


def normalize_geojson_name(name):
    return GEOJSON_NAME_ALIASES.get(name, name)


def load_countries(level):
    if level == "global":
        return dict(BASE_COUNTRIES)

    continents = CONTINENT_LEVELS[level]
    selected = {}

    for feature in WORLD_GEOJSON.get("features", []):
        properties = feature.get("properties", {})
        if properties.get("CONTINENT") not in continents:
            continue

        for name in geojson_names(properties):
            country_name = normalize_geojson_name(name)
            if country_name in BASE_COUNTRIES:
                selected[country_name] = BASE_COUNTRIES[country_name]
                break

    return selected


COUNTRIES = load_countries(current_level)
SECRET_COUNTRY = "Syria"


def distance(lat1, lon1, lat2, lon2):
    return math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2)


def init_game():
    global SECRET_COUNTRY, attempts
    SECRET_COUNTRY = random.choice(list(COUNTRIES.keys()))
    attempts = 0


def game_state():
    return {
        "level": current_level,
        "countries": sorted(BASE_COUNTRIES.keys()),
        "levels": sorted(LEVEL_KEYS),
        "unlimited_attempts": True,
    }


@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/set_level", methods=["POST"])
def set_level():
    global COUNTRIES, current_level
    data = request.get_json() or {}
    level = data.get("level", "global")

    if level not in LEVEL_KEYS:
        return jsonify({"error": "Invalid level"}), 400

    current_level = level
    COUNTRIES = load_countries(current_level)
    init_game()
    return jsonify(game_state())


@app.route("/countries")
def countries():
    return jsonify(game_state())


@app.route("/guess", methods=["POST"])
def guess():
    global attempts
    data = request.get_json() or {}
    country = data.get("country", "").strip()

    if country not in BASE_COUNTRIES:
        return jsonify({"error": "Country not found"}), 404

    attempts += 1

    guessed_country = BASE_COUNTRIES[country]
    secret_country = COUNTRIES[SECRET_COUNTRY]

    dist = distance(
        guessed_country["lat"],
        guessed_country["lon"],
        secret_country["lat"],
        secret_country["lon"],
    )
    is_border = country in secret_country.get("borders", [])

    return jsonify({
        "correct": country == SECRET_COUNTRY,
        "distance": round(dist, 2),
        "is_border": is_border,
        "attempts": attempts,
        "guessed_country": {
            "name": country,
            "lat": guessed_country["lat"],
            "lon": guessed_country["lon"],
        },
    })


@app.route("/data/<path:filename>")
def data_files(filename):
    return send_from_directory(DATA_DIR, filename)


@app.route("/reset", methods=["POST"])
def reset():
    init_game()
    state = game_state()
    state["status"] = "ok"
    return jsonify(state)


if __name__ == "__main__":
    init_game()
    app.run(debug=True)


