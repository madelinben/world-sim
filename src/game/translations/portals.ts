// Portal discovery quotes and messages for interaction
// Famous quotes from popular games when discovering portals
export const PORTAL_DISCOVERY_QUOTES = [
  // Zelda References
  "It's dangerous to go alone! Take this portal!",
  "You've found something truly special!",
  "A secret to everybody: This portal leads home!",
  "Hey! Listen! This portal will take you back!",
  "You got the Portal! This mystical gateway leads to safety!",

  // Skyrim References
  "By the gods, there's a portal here!",
  "I used to be an adventurer like you, then I found this portal.",
  "The portal calls to you...",
  "What manner of power is this?",
  "FUS RO DAH! ...Wait, that's a portal.",

  // D&D/Fantasy References
  "You have discovered an ancient portal!",
  "The arcane energies swirl before you...",
  "This portal radiates powerful magic!",
  "A gateway between worlds has been revealed!",
  "The very air shimmers with planar energy!",

  // Mario References
  "Wahoo! You found a warp zone!",
  "It's-a me, Portal!",
  "Mamma mia! A magical doorway!",
  "Let's-a go! Portal time!",
  "Here we go! Another portal adventure!",

  // Minecraft References
  "You have entered a portal dimension!",
  "Achievement unlocked: Portal Master!",
  "This portal leads to the Overworld!",
  "Congratulations! You've discovered a nether portal!",
  "Portal technology activated!",

  // Dark Souls References
  "Praise the Sun! A bonfire portal appears!",
  "You discovered Portal",
  "Portal Discovered Ahead",
  "Amazing Portal!",
  "Try Portal",

  // Half-Life References
  "The portal is open, and it's beautiful!",
  "Warning: Portal Storm detected!",
  "Initiating portal sequence...",
  "Portal technology confirmed!",
  "Anomalous readings detected... Portal found!",

  // Generic Fantasy
  "The portal shimmers with ancient magic...",
  "A gateway to adventure awaits!",
  "What is this? You have found something!",
  "The portal pulses with ancient magic...",
  "Your journey has led you to this moment!",
  "What lies beyond? Only one way to find out!",
  "The portal beckons you forward...",
  "You have discovered a passage to another realm!",

  // Humorous/Modern
  "Congratulations! You've found the exit!",
  "Plot twist: This portal leads to the surface!",
  "Error 404: Princess not found. Portal found instead!",
  "You win! Press F to continue your adventure!",
  "Achievement Unlocked: Portal Discoverer!",
  "Loading... surface world in 3... 2... 1...",
  "Fast travel unlocked: Surface World",
  "You have found the ultimate cheat code: escape!",
  "Breaking news: Local adventurer discovers way out!",
  "Spoiler alert: This portal leads to freedom!"
];

// Get random portal discovery quote
export function getPortalDiscoveryQuote(): string {
  const quotes = PORTAL_DISCOVERY_QUOTES;
  if (!quotes || quotes.length === 0) {
    return "You have discovered a mystical portal!";
  }
  return quotes[Math.floor(Math.random() * quotes.length)]!;
}