import { createPosterData } from "../lib/utils";

const rawMovies = [
  {
    id: "stellar-echo",
    title: "Stellar Echo",
    genre: "sci-fi",
    genreLabel: "Sci-Fi",
    duration: "2h 14m",
    price: 80,
    nightPrice: 20,
    nightEligible: true,
    quality: "4K + Dolby",
    badge: "Premium",
    synopsis:
      "A deep-space rescue mission bends time, loyalty, and memory when a missing crew starts sending signals from the future.",
    palette: ["#10192f", "#243b71", "#f5c518"]
  },
  {
    id: "red-circuit",
    title: "Red Circuit",
    genre: "action",
    genreLabel: "Action",
    duration: "2h 06m",
    price: 49,
    nightPrice: 20,
    nightEligible: true,
    quality: "Full HD",
    badge: "New",
    synopsis: "A suspended racer uncovers a citywide smuggling ring hidden inside the midnight street league.",
    palette: ["#22090f", "#661826", "#ff764a"]
  },
  {
    id: "monsoon-city",
    title: "Monsoon City",
    genre: "drama",
    genreLabel: "Drama",
    duration: "2h 22m",
    price: 39,
    nightPrice: 20,
    nightEligible: false,
    quality: "HD",
    badge: "",
    synopsis: "Three strangers chasing one last chance cross paths during a rain-soaked night in Mumbai.",
    palette: ["#0f1d2c", "#27516d", "#8fd3ff"]
  },
  {
    id: "glass-route",
    title: "Glass Route",
    genre: "thriller",
    genreLabel: "Thriller",
    duration: "1h 58m",
    price: 49,
    nightPrice: 20,
    nightEligible: true,
    quality: "Full HD",
    badge: "Hot",
    synopsis:
      "An investigative podcaster tracks a vanished bus route and discovers a conspiracy stitched across three states.",
    palette: ["#16171d", "#38404e", "#d7e4ff"]
  },
  {
    id: "paper-hearts",
    title: "Paper Hearts",
    genre: "romance",
    genreLabel: "Romance",
    duration: "2h 09m",
    price: 30,
    nightPrice: 20,
    nightEligible: false,
    quality: "HD",
    badge: "",
    synopsis:
      "A songwriter and a calligrapher rediscover each other through unsigned letters left inside second-hand books.",
    palette: ["#311620", "#89375f", "#ffd4e8"]
  },
  {
    id: "afterparty-protocol",
    title: "Afterparty Protocol",
    genre: "comedy",
    genreLabel: "Comedy",
    duration: "1h 52m",
    price: 30,
    nightPrice: 20,
    nightEligible: false,
    quality: "HD",
    badge: "",
    synopsis:
      "A startup launch spirals into chaos when the office AI starts approving everyone’s wildest expense claims.",
    palette: ["#112118", "#335f40", "#d3ff7b"]
  },
  {
    id: "black-dune-files",
    title: "Black Dune Files",
    genre: "thriller",
    genreLabel: "Thriller",
    duration: "2h 18m",
    price: 80,
    nightPrice: 20,
    nightEligible: true,
    quality: "4K + Dolby",
    badge: "Premium",
    synopsis: "Buried state archives point a young lawyer toward a desert case nobody has survived reopening.",
    palette: ["#1a1309", "#5a3511", "#f5c76a"]
  },
  {
    id: "velocity-house",
    title: "Velocity House",
    genre: "action",
    genreLabel: "Action",
    duration: "2h 11m",
    price: 39,
    nightPrice: 20,
    nightEligible: true,
    quality: "HD",
    badge: "New",
    synopsis:
      "A delivery rider stumbles into a smart building controlled by mercenaries and has one night to get everyone out.",
    palette: ["#09161f", "#1a5168", "#82f2ff"]
  }
];

export const genreOptions = [
  { value: "all", label: "All genres" },
  { value: "action", label: "Action" },
  { value: "thriller", label: "Thriller" },
  { value: "drama", label: "Drama" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "romance", label: "Romance" },
  { value: "comedy", label: "Comedy" }
];

export const movies = rawMovies.map((movie) => ({
  ...movie,
  poster: createPosterData(movie)
}));
