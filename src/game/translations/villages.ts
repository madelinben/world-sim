// Village descriptions and welcome messages for notice boards
export const VILLAGE_TRANSLATIONS = {
  welcomeMessages: [
    "Welcome to our peaceful village!",
    "Greetings, weary traveler!",
    "You have found sanctuary here.",
    "Rest your weary bones, friend.",
    "A warm welcome awaits you!",
    "May your journey be blessed!",
    "Safe travels brought you here.",
    "Find comfort in our humble home.",
    "The village gates are open to you.",
    "Peace and prosperity to all!"
  ],

  descriptions: [
    "Our village thrives through hard work and community spirit.",
    "Farmers tend the fields while merchants trade their wares.",
    "The well at our center provides life to all who dwell here.",
    "Generations have called this place home.",
    "Simple folk living simple lives in harmony.",
    "The windmill turns with the changing seasons.",
    "Markets bustle with activity from dawn to dusk.",
    "Children play safely in our protected streets.",
    "Travelers are always welcome at our hearth.",
    "The land provides, and we are grateful."
  ],

  closingMessages: [
    "May your stay be pleasant and your journey safe.",
    "Press any key to continue your adventure.",
    "The village wishes you well on your travels.",
    "Safe passage, brave adventurer!",
    "Until we meet again, farewell!",
    "The road ahead holds many wonders.",
    "Take our blessings with you.",
    "Adventure awaits beyond our borders.",
    "Return to us when you need rest.",
    "Go forth with courage and wisdom!"
  ]
};

// Generate random village notice text
export function generateVillageNotice(villageName: string): { title: string; text: string } {
  const welcome = VILLAGE_TRANSLATIONS.welcomeMessages[
    Math.floor(Math.random() * VILLAGE_TRANSLATIONS.welcomeMessages.length)
  ]!;

  const description = VILLAGE_TRANSLATIONS.descriptions[
    Math.floor(Math.random() * VILLAGE_TRANSLATIONS.descriptions.length)
  ]!;

  const closing = VILLAGE_TRANSLATIONS.closingMessages[
    Math.floor(Math.random() * VILLAGE_TRANSLATIONS.closingMessages.length)
  ]!;

  return {
    title: `${villageName} Notice Board`,
    text: `${welcome}\n\n${description}\n\n${closing}`
  };
}