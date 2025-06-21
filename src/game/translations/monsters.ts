// Monster sounds, grunts, and famous quotes for interaction
export const MONSTER_TRANSLATIONS = {
  orc: [
    "Lok'tar!",
    "Zug zug!",
    "Dabu!",
    "Me not that kind of orc!",
    "Work work!",
    "*fierce orc growl*",
    "For the Horde!",
    "Blood and thunder!",
    "Strength and honor!",
    "*orc war cry*"
  ],

  goblin: [
    "Grr!",
    "Hehehe!",
    "*goblin cackle*",
    "Mine! Mine!",
    "Shiny things!",
    "Grraaahhh!",
    "*nasty goblin laugh*",
    "Me want gold!",
    "Sneaky sneaky!",
    "*goblin chittering*"
  ],

  skeleton: [
    "*bone rattling*",
    "*eerie silence*",
    "*skeletal clicking*",
    "...",
    "*haunting moan*",
    "*bones clacking*",
    "*ghostly whisper*",
    "*undead groaning*",
    "*spine-chilling rattle*",
    "*hollow echo*"
  ],

  archer_goblin: [
    "Take aim!",
    "*draws bow*",
    "Pew pew!",
    "Bullseye!",
    "*goblin snicker*",
    "Me good shot!",
    "Arrow time!",
    "*string twang*",
    "Haha! Miss me!",
    "*archer goblin cackle*"
  ],

  club_goblin: [
    "SMASH!",
    "*club thump*",
    "Me bash you!",
    "Big stick!",
    "*heavy breathing*",
    "BONK!",
    "Crush crush!",
    "*club dragging*",
    "Me strongest!",
    "*intimidating grunt*"
  ],

  farmer_goblin: [
    "Me grow things!",
    "*dirt under nails*",
    "Good harvest!",
    "Plants everywhere!",
    "*goblin farming song*",
    "Dig dig dig!",
    "Seeds and soil!",
    "*happy gardening*",
    "Green thumb!",
    "*peaceful goblin hum*"
  ],

  orc_shaman: [
    "Elements guide me!",
    "Storm, earth and fire!",
    "*mystical chanting*",
    "Spirits speak!",
    "Power of nature!",
    "*elemental magic*",
    "Ancient wisdom!",
    "*shamanic ritual*",
    "Earth Mother protect!",
    "*spiritual mumbling*"
  ],

  spear_goblin: [
    "Pointy stick!",
    "*spear thrust*",
    "Poke poke!",
    "Sharp end first!",
    "*spear twirling*",
    "Long reach!",
    "Stabby time!",
    "*weapon spinning*",
    "Me got range!",
    "*spear goblin laugh*"
  ],

  slime: [
    "*gloopy sounds*",
    "*squelch*",
    "*bloop bloop*",
    "*slime bubbling*",
    "*squishy noises*",
    "*gooey movement*",
    "*slime jiggle*",
    "*wet splashing*",
    "*slime gurgle*",
    "*bouncy sounds*"
  ],

  mega_slime_blue: [
    "*MASSIVE SQUELCH*",
    "*GIANT BLOOP*",
    "*ENORMOUS SPLASH*",
    "*HUGE SLIME RUMBLE*",
    "*COLOSSAL GLOOP*",
    "*MEGA SLIME ROAR*",
    "*THUNDEROUS JIGGLE*",
    "*EPIC SLIME SOUNDS*",
    "*MASSIVE BUBBLE POP*",
    "*GIANT SLIME GURGLE*"
  ]
};

// Get random monster sound
export function getMonsterSound(monsterType: string): string {
  const sounds = MONSTER_TRANSLATIONS[monsterType as keyof typeof MONSTER_TRANSLATIONS];
  if (!sounds || sounds.length === 0) {
    return "*menacing growl*";
  }
  return sounds[Math.floor(Math.random() * sounds.length)]!;
}