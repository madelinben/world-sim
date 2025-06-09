export interface VillageScore {
  villageId: string;
  villageName: string;
  score: number;
  maxScore: number;
}

export interface RPGComment {
  text: string;
  minScore: number;
  maxScore: number;
  game: string;
}

export class PlayerScoreSystem {
  private villageScores = new Map<string, VillageScore>();
  private readonly maxScorePerVillage = 100;

  // RPG NPC Comments organized by score ranges with multiple options per range
  private readonly rpgComments: RPGComment[] = [
    // Hostile/Negative (-50 to -21)
    { text: "We don't like your kind around here!", minScore: -50, maxScore: -21, game: "Skyrim" },
    { text: "I don't know you, and I don't care to know you.", minScore: -50, maxScore: -21, game: "Oblivion" },
    { text: "Move along, outsider.", minScore: -50, maxScore: -21, game: "Skyrim" },
    { text: "You're not welcome here, stranger.", minScore: -50, maxScore: -21, game: "Fallout" },
    { text: "Stay away from me, criminal scum!", minScore: -50, maxScore: -21, game: "Oblivion" },

    // Cold/Unfriendly (-20 to -1)
    { text: "I've heard about you. Bad news travels fast.", minScore: -20, maxScore: -1, game: "Skyrim" },
    { text: "Not now, not later, not ever.", minScore: -20, maxScore: -1, game: "Oblivion" },
    { text: "I got nothing to say to you.", minScore: -20, maxScore: -1, game: "Fallout" },
    { text: "I don't have time for this.", minScore: -20, maxScore: -1, game: "Skyrim" },
    { text: "Keep walking, troublemaker.", minScore: -20, maxScore: -1, game: "Oblivion" },

    // Neutral (0 to 19)
    { text: "What do you want?", minScore: 0, maxScore: 19, game: "Skyrim" },
    { text: "I'm busy right now.", minScore: 0, maxScore: 19, game: "Oblivion" },
    { text: "Good day to you.", minScore: 0, maxScore: 19, game: "Skyrim" },
    { text: "Hello there, traveler.", minScore: 0, maxScore: 19, game: "Zelda" },
    { text: "Can I help you with something?", minScore: 0, maxScore: 19, game: "Fallout" },
    { text: "Not much happening around here.", minScore: 0, maxScore: 19, game: "Skyrim" },

    // Friendly (20 to 49)
    { text: "It's a pleasure to meet you!", minScore: 20, maxScore: 49, game: "Skyrim" },
    { text: "Well hello there! What can I do for you?", minScore: 20, maxScore: 49, game: "Oblivion" },
    { text: "You seem like good people.", minScore: 20, maxScore: 49, game: "Fallout" },
    { text: "Hey! Listen! You look like you could use some help.", minScore: 20, maxScore: 49, game: "Zelda" },
    { text: "What brings you here, friend?", minScore: 20, maxScore: 49, game: "Mario" },
    { text: "You're quite the traveler, aren't you?", minScore: 20, maxScore: 49, game: "Skyrim" },
    { text: "Always nice to see a friendly face!", minScore: 20, maxScore: 49, game: "Oblivion" },

    // Respected (50 to 79)
    { text: "Ah, a friend of the village! Welcome!", minScore: 50, maxScore: 79, game: "Skyrim" },
    { text: "You've done good work around here.", minScore: 50, maxScore: 79, game: "Fallout" },
    { text: "The whole village speaks well of you.", minScore: 50, maxScore: 79, game: "Skyrim" },
    { text: "You're the one who's been helping everyone!", minScore: 50, maxScore: 79, game: "Oblivion" },
    { text: "Thank you for all you've done for us.", minScore: 50, maxScore: 79, game: "Zelda" },
    { text: "You're a true friend to this community.", minScore: 50, maxScore: 79, game: "Skyrim" },
    { text: "The village is lucky to have someone like you.", minScore: 50, maxScore: 79, game: "Fallout" },

    // Hero Status (80 to 100)
    { text: "You are the hero this village needed!", minScore: 80, maxScore: 100, game: "Skyrim" },
    { text: "A true champion of the people!", minScore: 80, maxScore: 100, game: "Oblivion" },
    { text: "Legends will be told of your deeds!", minScore: 80, maxScore: 100, game: "Skyrim" },
    { text: "I'm your biggest fan! You're incredible!", minScore: 80, maxScore: 100, game: "Mario" },
    { text: "You are the stuff of legend, my friend!", minScore: 80, maxScore: 100, game: "Zelda" },
    { text: "The whole realm knows of your heroic deeds!", minScore: 80, maxScore: 100, game: "Oblivion" },
    { text: "You're practically a living legend!", minScore: 80, maxScore: 100, game: "Fallout" }
  ];

  constructor() {
    console.log('🏆 Player Score System initialized');
  }

  public getVillageScore(villageId: string): VillageScore | null {
    return this.villageScores.get(villageId) ?? null;
  }

  public initializeVillage(villageId: string, villageName: string): void {
    if (!this.villageScores.has(villageId)) {
      this.villageScores.set(villageId, {
        villageId,
        villageName,
        score: 0,
        maxScore: this.maxScorePerVillage
      });
      console.log(`🏘️ Initialized score tracking for village: ${villageName} (${villageId})`);
    }
  }

  public addScore(villageId: string, points: number, reason: string): void {
    const villageScore = this.villageScores.get(villageId);
    if (!villageScore) {
      console.warn(`Cannot add score to unknown village: ${villageId}`);
      return;
    }

    const oldScore = villageScore.score;
    villageScore.score = Math.max(-50, Math.min(villageScore.maxScore, villageScore.score + points));

    console.log(`🏆 Score ${points > 0 ? '+' : ''}${points} for ${villageScore.villageName}: ${oldScore} → ${villageScore.score} (${reason})`);
  }

  public getTraderComment(villageId: string): string {
    const villageScore = this.villageScores.get(villageId);
    if (!villageScore) {
      return "I don't know you, stranger.";
    }

    // Find all comments that match the current score range
    const matchingComments = this.rpgComments.filter(comment =>
      villageScore.score >= comment.minScore && villageScore.score <= comment.maxScore
    );

    // If no matching comments found, use a fallback
    if (matchingComments.length === 0) {
      return "I don't know you, stranger.";
    }

    // Randomly select one comment from the matching range
    const randomIndex = Math.floor(Math.random() * matchingComments.length);
    return matchingComments[randomIndex]!.text;
  }

  public getScoreSummary(): VillageScore[] {
    return Array.from(this.villageScores.values());
  }

  public findNearestVillage(playerPosition: { x: number; y: number }): string | null {
    // Convert world coordinates to village grid coordinates
    const tileX = Math.floor(playerPosition.x / 16);
    const tileY = Math.floor(playerPosition.y / 16);
    const villageGridX = Math.floor(tileX / 50);
    const villageGridY = Math.floor(tileY / 50);

    // Check if player is within village area (50x50 tiles)
    const villageId = `village_${villageGridX}_${villageGridY}`;

    if (this.villageScores.has(villageId)) {
      return villageId;
    }

    return null;
  }

  public isInVillageArea(playerPosition: { x: number; y: number }, villageId: string): boolean {
    // Extract grid coordinates from village ID
    const matches = /village_(-?\d+)_(-?\d+)/.exec(villageId);
    if (!matches) return false;

    const villageGridX = parseInt(matches[1]!);
    const villageGridY = parseInt(matches[2]!);

    // Convert player position to tile coordinates
    const tileX = Math.floor(playerPosition.x / 16);
    const tileY = Math.floor(playerPosition.y / 16);

    // Check if player is within the 50x50 tile village area
    const villageStartX = villageGridX * 50;
    const villageStartY = villageGridY * 50;
    const villageEndX = villageStartX + 50;
    const villageEndY = villageStartY + 50;

    return tileX >= villageStartX && tileX < villageEndX &&
           tileY >= villageStartY && tileY < villageEndY;
  }

  // Track various player actions
  public onTaskCompleted(villageId: string): void {
    this.addScore(villageId, 5, "Task completed");
  }

  public onMonsterKilled(villageId: string): void {
    this.addScore(villageId, 1, "Monster defeated");
  }

  public onAnimalAttacked(villageId: string): void {
    this.addScore(villageId, -3, "Attacked village animal");
  }

  public onTraderAttacked(villageId: string): void {
    this.addScore(villageId, -5, "Attacked village trader");
  }

  public onVillageDefended(villageId: string): void {
    this.addScore(villageId, 2, "Defended village");
  }
}