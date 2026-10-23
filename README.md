# flight sleep

Static page: day/night at origin vs destination so you can pick when to sleep on the plane.

## Use

1. Search departing + arriving airports (IATA, city, or name)
2. Enter local departure and arrival date/time
3. Read the dual timeline — light = day, dark = night (same flight, each row in that airport’s local clock)

If arrival local time is earlier than departure on the same calendar date, arrival date auto-bumps **+1**. The badge under arrive shows `+1 day` / `+2 days` from the departure calendar date.

Sleep while the destination row is night if you want to land synced to local time.

## GitHub Pages

1. Push this repo to GitHub
2. Settings → Pages → Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)` → Save
4. Open `https://<user>.github.io/<repo>/`

No build step. `index.html` is the app.

## Data

- Airports: [mwgg/Airports](https://github.com/mwgg/Airports) (IATA-only subset in `airports.json`)
- Sunrise & sunset: [Open-Meteo](https://open-meteo.com/) when the flight dates are in range; otherwise a local solar estimate
