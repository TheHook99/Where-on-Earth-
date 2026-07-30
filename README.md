# Where on Earth

Where on Earth is an interactive country guessing game. The player chooses a geographic area, guesses countries, and uses map colors, distance clues, and border clues to find the hidden country.

## Description

The game shows a world map and colors each guessed country based on how close it is to the hidden country. A correct guess turns green, a border country turns black, and other guesses use a heat gradient from yellow for far guesses to red for close guesses. Players have unlimited tries and can click guessed countries on the map to see the country name, distance, and whether it borders the hidden country.

## Features

- Interactive world map with country outlines
- Geographic area selection: Global, Africa, Asia, Europe, and Americas
- Country autocomplete with up to 5 suggestions
- Unlimited guesses
- Timer and attempt counter
- Heat-gradient map feedback
- Black color for border countries
- Green color for the correct answer
- Clickable guessed countries with distance and border information
- Support for very small countries using map markers

## Tech Stack

- Python
- Flask
- HTML
- CSS
- JavaScript
- Leaflet.js
- GeoJSON map data

## Project Structure

```txt
backend/
  app.py
  countries_with_borders.json

data/
  world.geojson

frontend/
  index.html
  style.css
  script.js

requirements.txt
render.yaml
```

## Data Files

`backend/countries_with_borders.json` contains the game data, including country coordinates and border relationships.

`data/world.geojson` contains the geographic shapes used to draw and color countries on the map.

## Run Locally

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the Flask app:

```bash
python backend/app.py
```

Open the app in your browser:

```txt
http://127.0.0.1:5000
```

## Deploy

This project needs a Python backend, so it cannot run fully on GitHub Pages. GitHub Pages only hosts static frontend files.

Recommended deployment: Render.

Render build command:

```bash
pip install -r requirements.txt
```

Render start command:

```bash
gunicorn backend.app:app --bind 0.0.0.0:$PORT
```

The included `render.yaml` file contains this deployment configuration.

## Author

Built by Mahmoud as a geography guessing game project.
