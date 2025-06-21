// Animal sounds and noises for interaction
export const ANIMAL_TRANSLATIONS = {
  chicken: [
    "Cluck cluck!",
    "Bawk bawk bawk!",
    "Cluck cluck cluck!",
    "*happy chicken noises*",
    "Bawk! Bawk!",
    "Cluck!",
    "*pecks at the ground*",
    "Bawk bawk!",
    "*flaps wings*",
    "Cluck cluck bawk!"
  ],

  pig: [
    "Oink oink!",
    "Snort snort!",
    "Oink!",
    "*happy pig grunts*",
    "Oink oink oink!",
    "*rolls in mud*",
    "Snort!",
    "*pig squealing*",
    "Oink snort!",
    "*contented pig noises*"
  ],

  sheep: [
    "Baa baa!",
    "Baa!",
    "Baa baa baa!",
    "*gentle bleating*",
    "Baaa!",
    "*woolly sheep sounds*",
    "Baa baa!",
    "*peaceful grazing*",
    "Baa!",
    "*soft sheep noises*"
  ]
};

// Get random animal sound
export function getAnimalSound(animalType: string): string {
  const sounds = ANIMAL_TRANSLATIONS[animalType as keyof typeof ANIMAL_TRANSLATIONS];
  if (!sounds || sounds.length === 0) {
    return "*animal noises*";
  }
  return sounds[Math.floor(Math.random() * sounds.length)]!;
}