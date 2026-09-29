import * as Location from "expo-location";
import { ENV_SIGNALS_CACHE_TTL_MS } from "./config";

const SOUTHERN_HEMISPHERE_COUNTRY_CODES = new Set([
  "AR", "AU", "BO", "BR", "BW", "CL", "FK", "GF", "MG", "MZ", "NA", "NZ",
  "PY", "RE", "SH", "SR", "SZ", "TZ", "UY", "ZA", "ZW", "PF", "NC", "WF"
]);

export function isSouthernHemisphereHint(latitude, countryCode) {
  if (Number.isFinite(latitude)) {
    return latitude < 0;
  }
  return SOUTHERN_HEMISPHERE_COUNTRY_CODES.has(String(countryCode ?? "").toUpperCase());
}

export function seasonVibeLabel(monthIndex, southern) {
  const northernSeasons = ["Winter", "Winter", "Spring", "Spring", "Spring", "Summer", "Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter"];
  const southernSeasons = ["Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter", "Winter", "Winter", "Spring", "Spring", "Spring", "Summer"];
  const table = southern ? southernSeasons : northernSeasons;
  return table[((monthIndex % 12) + 12) % 12];
}

export function baselineTempCForLocalSeason(now, southern) {
  const month = now.getMonth();
  const hour = now.getHours();
  const season = seasonVibeLabel(month, southern);
  const seasonBaseline = { Winter: 9, Spring: 18, Summer: 28, Autumn: 20 }[season] ?? 18;
  const timeAdjustment = hour >= 14 && hour <= 18 ? 2 : hour < 6 ? -2 : 0;
  return seasonBaseline + timeAdjustment;
}

export function mapWmoWeatherCode(code) {
  const n = Number(code);
  if (n === 0) return { weather: "clear", label: "Clear" };
  if (n === 1) return { weather: "clear", label: "Mainly clear" };
  if (n === 2) return { weather: "clouds", label: "Partly cloudy" };
  if (n === 3) return { weather: "clouds", label: "Overcast" };
  if (n === 45 || n === 48) return { weather: "fog", label: "Fog" };
  if (n >= 51 && n <= 55) return { weather: "drizzle", label: "Drizzle" };
  if (n === 56 || n === 57) return { weather: "drizzle", label: "Freezing drizzle" };
  if (n >= 61 && n <= 65) return { weather: "rain", label: "Rain" };
  if (n === 66 || n === 67) return { weather: "rain", label: "Freezing rain" };
  if (n >= 71 && n <= 77) return { weather: "snow", label: "Snow" };
  if (n >= 80 && n <= 82) return { weather: "rain", label: "Rain showers" };
  if (n === 85 || n === 86) return { weather: "snow", label: "Snow showers" };
  if (n >= 95) return { weather: "thunderstorm", label: "Thunderstorm" };
  return { weather: "clouds", label: "Cloudy" };
}

export function weatherEmoji(weather) {
  const w = String(weather ?? "").toLowerCase();
  if (w.includes("thunderstorm")) return "⛈️";
  if (w.includes("rain") || w.includes("drizzle") || w.includes("shower")) return "🌧️";
  if (w.includes("snow")) return "❄️";
  if (w.includes("fog")) return "🌫️";
  if (w.includes("cloud")) return "☁️";
  return "☀️";
}

export function moodLabelFromLevel(level) {
  if (level <= 25) return "Mellow";
  if (level <= 45) return "Chill";
  if (level <= 65) return "Balanced";
  if (level <= 85) return "Upbeat";
  return "Hype";
}

export function nostalgiaLabelFromLevel(level) {
  if (level <= 5) return "Modern focus";
  if (level <= 33) return "Mostly modern";
  if (level <= 67) return "Balanced eras";
  if (level <= 95) return "Era-leaning";
  return "Pure era";
}

export function celsiusToFahrenheitRounded(tempC) {
  return Math.round((Number(tempC) || 0) * 9 / 5 + 32);
}

export function resolveTempDisplayFahrenheit(tempDisplayUnit, countryCode) {
  if (tempDisplayUnit === "fahrenheit") return true;
  if (tempDisplayUnit === "celsius") return false;
  return String(countryCode ?? "").toUpperCase() === "US";
}

export function formatOutdoorTempBadge(tempC, useFahrenheit) {
  if (!Number.isFinite(tempC)) {
    return "—";
  }
  return useFahrenheit ? `${celsiusToFahrenheitRounded(tempC)}°F` : `${Math.round(tempC)}°C`;
}

function computeFallbackEnvironmentSignals(countryCode) {
  const now = new Date();
  const southern = isSouthernHemisphereHint(null, countryCode);
  return {
    tempC: baselineTempCForLocalSeason(now, southern),
    weather: "clear",
    weatherLabel: "Clear (estimated)",
    seasonVibe: seasonVibeLabel(now.getMonth(), southern),
    environmentSource: "estimated"
  };
}

let cachedSignals = null;
let cachedAtMs = 0;
let cachedCountryCode = null;

export async function getEnvironmentSignals(countryCode) {
  const isFresh = cachedSignals && Date.now() - cachedAtMs < ENV_SIGNALS_CACHE_TTL_MS && cachedCountryCode === countryCode;
  if (isFresh) {
    return cachedSignals;
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Location permission not granted");
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low
    });
    const { latitude, longitude } = position.coords;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const response = await fetch(url);
    const payload = await response.json();

    const tempC = Number(payload?.current?.temperature_2m);
    const { weather, label } = mapWmoWeatherCode(payload?.current?.weather_code);
    const now = new Date();
    const southern = isSouthernHemisphereHint(latitude, countryCode);

    cachedSignals = {
      tempC: Number.isFinite(tempC) ? tempC : baselineTempCForLocalSeason(now, southern),
      weather,
      weatherLabel: label,
      seasonVibe: seasonVibeLabel(now.getMonth(), southern),
      environmentSource: "geolocation"
    };
  } catch {
    cachedSignals = computeFallbackEnvironmentSignals(countryCode);
  }

  cachedAtMs = Date.now();
  cachedCountryCode = countryCode;
  return cachedSignals;
}

export function buildUserContext({ countryCode, moodLevel, nostalgiaSlider, envSignals }) {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    countryCode: countryCode ?? null,
    weather: envSignals?.weather ?? "clear",
    seasonVibe: envSignals?.seasonVibe ?? null,
    gender: "unspecified",
    moodLevel: Number.isFinite(moodLevel) ? moodLevel : 50,
    nostalgiaSlider: Number.isFinite(nostalgiaSlider) ? nostalgiaSlider : 50,
    accountAgeYears: 0,
    tempC: Number.isFinite(envSignals?.tempC) ? envSignals.tempC : null,
    localHour: new Date().getHours()
  };
}
