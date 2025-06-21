// Trader greetings and merchant sayings for interaction
export const TRADER_TRANSLATIONS = {
  axeman_trader: [
    "Sharp axes for sale!",
    "Need something chopped?",
    "Quality woodcutting tools!",
    "Best axes in the land!",
    "Timber! Fresh timber!",
    "Chop chop, good deals!",
    "Axes sharpened while you wait!",
    "Wood you like to buy something?",
    "Splitting good prices!",
    "Axe me about our deals!"
  ],

  swordsman_trader: [
    "Fine blades for warriors!",
    "Swords of the highest quality!",
    "Sharp steel, fair prices!",
    "A blade for every hero!",
    "Cut above the rest!",
    "Forged with honor!",
    "Steel yourself for adventure!",
    "Blade runner's paradise!",
    "Sharp deals, sharper swords!",
    "The point is quality!"
  ],

  spearman_trader: [
    "Long reach, fair prices!",
    "Spears and polearms!",
    "Keep your enemies at bay!",
    "Point taken, point sold!",
    "Reach for the stars!",
    "Spear-it of adventure!",
    "Long weapons, long journeys!",
    "Pierce the competition!",
    "Pointed in the right direction!",
    "Spear me the details!"
  ],

  farmer_trader: [
    "Fresh from the farm!",
    "Organic and wholesome!",
    "Seeds, tools, and more!",
    "Grown with care!",
    "Farm to table quality!",
    "Harvest the best deals!",
    "Sow good, reap good!",
    "Fields of opportunity!",
    "Down to earth prices!",
    "Crop top quality!"
  ]
};

// Get random trader greeting
export function getTraderGreeting(traderType: string): string {
  const greetings = TRADER_TRANSLATIONS[traderType as keyof typeof TRADER_TRANSLATIONS];
  if (!greetings || greetings.length === 0) {
    return "Welcome, traveler!";
  }
  return greetings[Math.floor(Math.random() * greetings.length)]!;
}