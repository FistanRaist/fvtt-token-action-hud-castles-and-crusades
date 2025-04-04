/**
 * @file module.js
 * @description Custom Token Action HUD integration for the Castles & Crusades system.
 * @author FistanRaist
 * @version 1.0.3
 * @license MIT License - See LICENSE file for details
 * @module fvtt-token-action-hud-castles-and-crusades
 * @requires token-action-hud-core@2.0
 */

console.log("Initializing Castles & Crusades TAH Addon");

// Load custom CSS
Hooks.once("init", async () => {
  const cssPath = "modules/fvtt-token-action-hud-castles-and-crusades/styles/tah-cnc.css";
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = cssPath;
  document.head.appendChild(link);
  console.log(`Attempting to load CSS from: ${link.href}`);
  link.onload = () => console.log(`CSS loaded successfully: ${cssPath}`);
  link.onerror = (e) => console.error(`CSS load failed for ${cssPath} with error:`, e);

  try {
    const response = await fetch(cssPath);
    if (!response.ok) {
      console.error(`Failed to fetch CSS: ${response.status} ${response.statusText}`);
      return;
    }
    const contentType = response.headers.get("content-type");
    console.log(
      "CSS fetch response:",
      response.ok ? "OK" : "Failed",
      "Status:",
      response.status,
      "Content-Type:",
      contentType
    );
    if (contentType && contentType.includes("text/css")) {
      console.log("CSS MIME type is correct");
    } else {
      console.error("CSS MIME type incorrect or file not found, received:", contentType);
    }
    const cssText = await response.text();
    console.log("CSS file contents:", cssText);
  } catch (e) {
    console.error("CSS fetch error:", e);
  }
});

Hooks.once("tokenActionHudCoreApiReady", async (coreModule) => {
  console.log("tokenActionHudCoreApiReady hook fired, TAH Core version:", coreModule.api?.version || "unknown");

  /**
   * @constant {Object} ICONS - Mapping of action types to Font Awesome icons
   * @property {string} melee - Sword icon for melee attacks
   * @property {string} ranged - Bow icon for ranged attacks
   * @property {string} rollable - D20 icon for rollable actions
   * @property {string} shield - Shield icon for armor
   * @property {string} hitDice - D20 icon for hit dice (previously skull, now d20)
   * @property {string} saves - Shield-alt icon for saves
   * @property {string} number - Users icon for number appearing
   */
  const ICONS = {
    melee: '<i class="fas fa-sword"></i>',
    ranged: '<i class="fas fa-bow-arrow"></i>',
    rollable: '<i class="fas fa-dice-d20"></i>',
    shield: '<i class="fas fa-shield"></i>',
    hitDice: '<i class="fas fa-dice-d20"></i>',
    saves: '<i class="fas fa-shield-alt"></i>',
    number: '<i class="fas fa-users"></i>',
  };

  /**
   * @class ActionHandlerCnC
   * @extends coreModule.api.ActionHandler
   * @description Handles the construction of action lists for the Castles & Crusades system in the Token Action HUD.
   */
  class ActionHandlerCnC extends coreModule.api.ActionHandler {
    /**
     * Builds system-specific actions for the HUD based on the actor type.
     * @param {Array} groupIds - Optional array of group IDs to filter actions.
     * @returns {Promise<void>}
     */
    async buildSystemActions(groupIds) {
      this.actors = !this.actor ? this.#getValidActors() : [this.actor];
      this.tokens = !this.token ? this.#getValidTokens() : [this.token];
      this.items = this.actor ? this.actor.items : new Map();

      console.log(
        "Building actions for actor:",
        this.actor?.name,
        "Type:",
        this.actor?.type,
        "Items:",
        this.items.size
      );
      console.log("Selected tokens:", this.tokens.map((t) => t.actor?.name));

      if (!this.actor) {
        console.log("No actor selected, skipping HUD build");
        return;
      }

      const actorType = this.actor.type;
      console.log("Actor type confirmed:", actorType);

      try {
        if (actorType === "character") {
          console.log("Building character HUD");
          await Promise.all([
            this.#buildAttributes(),
            this.#buildCombat(),
            this.#buildSpells(),
            this.#buildInventory(),
            this.#buildFeatures(),
          ]);
        } else if (actorType === "monster") {
          console.log("Building monster HUD");
          await Promise.all([
            this.#buildMonsterCombat(),
            this.#buildMonsterSpells(),
            this.#buildMonsterFeatures(),
            this.#buildMonsterStats(),
          ]);
        } else {
          console.log("Unknown actor type:", actorType);
        }
      } catch (e) {
        console.error("Error building system actions:", e);
      }
    }

    /**
     * Retrieves valid actors from controlled tokens.
     * @returns {Array} Array of valid actors (character or monster).
     */
    #getValidActors() {
      return canvas.tokens.controlled
        .map((t) => t.actor)
        .filter((a) => a && ["character", "monster"].includes(a.type));
    }

    /**
     * Retrieves valid tokens from controlled tokens.
     * @returns {Array} Array of valid tokens with character or monster actors.
     */
    #getValidTokens() {
      return canvas.tokens.controlled.filter(
        (t) => t.actor && ["character", "monster"].includes(t.actor.type)
      );
    }

    // Character-specific methods
    /**
     * Builds attribute actions for character actors.
     * @returns {Promise<void>}
     */
    async #buildAttributes() {
      const abilities = this.actor.system.abilities || {};
      const abilityNames = {
        str: "Strength",
        dex: "Dexterity",
        con: "Constitution",
        int: "Intelligence",
        wis: "Wisdom",
        cha: "Charisma",
      };
      const saveTooltips = {
        str: "Paralysis and Constriction",
        dex: "Breath Weapons and Traps",
        con: "Disease, Energy Drain, and Poison",
        int: "Arcane Magic and Illusion",
        wis:
          "Divine Magic, Gaze Attack, Confusion, Polymorph, and Petrification",
        cha: "Death Attack, Charm, and Fear",
      };
      const actions = Object.entries(abilities).map(([key, ability]) => ({
        id: `attribute-${key}`,
        name: ability.ccprimary ? `(P) ${abilityNames[key]}` : abilityNames[key],
        info1: { text: ability.bonus >= 0 ? `+${ability.bonus}` : ability.bonus },
        tooltip: saveTooltips[key],
        system: { actionType: "attribute", actionId: key },
      }));
      this.addActions(actions, { id: "attributes", name: "Attributes", type: "system" });
      console.log("Attributes added:", actions);
    }

/**
 * Builds combat actions for character actors.
 * @returns {Promise<void>}
 */
async #buildCombat() {
  const actions = [
    { id: "initiative", name: "Initiative", icon1: ICONS.rollable, system: { actionType: "combat", actionId: "initiative" } },
  ];
  const weapons = this.items.filter((item) => item.type === "weapon");
  weapons.forEach((weapon) => {
    const weaponType = this.#determineWeaponType(weapon);
    console.log(`Weapon: ${weapon.name}, Type: ${weaponType}, Damage: ${weapon.system.damage.value}`);
    if (weaponType === "melee") {
      actions.push({
        id: `weapon-${weapon._id}-melee`,
        name: weapon.name,
        icon1: ICONS.melee,
        info1: { text: weapon.system.damage.value || "" },
        system: { actionType: "weapon", actionId: weapon._id, attackType: "melee", weaponType: weaponType },
      });
    } else if (weaponType === "ranged") {
      actions.push({
        id: `weapon-${weapon._id}-ranged`,
        name: weapon.name,
        icon1: ICONS.ranged,
        info1: { text: weapon.system.damage.value || "" },
        system: { actionType: "weapon", actionId: weapon._id, attackType: "ranged", weaponType: weaponType },
      });
    } else if (weaponType === "both") {
      actions.push({
        id: `weapon-${weapon._id}-melee`,
        name: weapon.name,
        icon1: ICONS.melee,
        info1: { text: weapon.system.damage.value || "" },
        system: { actionType: "weapon", actionId: weapon._id, attackType: "melee", weaponType: weaponType },
      });
      actions.push({
        id: `weapon-${weapon._id}-ranged`,
        name: weapon.name,
        icon1: ICONS.ranged,
        info1: { text: weapon.system.damage.value || "" },
        system: { actionType: "weapon", actionId: weapon._id, attackType: "ranged", weaponType: weaponType },
      });
    }
  });
  console.log("Combat actions built:", JSON.stringify(actions, null, 2));
  this.addActions(actions, { id: "combat", name: "Combat", type: "system" });
  console.log("Combat actions added:", actions);
}

    /**
     * Determines the weapon type based on the range field.
     * @param {Object} weapon - The weapon item object
     * @returns {string} "melee", "ranged", or "both"
     */
    #determineWeaponType(weapon) {
      if (!weapon?.system) return "melee";

      // Get the range value and convert to lowercase for consistency
      const range = weapon.system.range?.value?.toLowerCase() || "";
      if (!range) return "melee"; // Default to melee if range is empty

      // Check for "melee" in the range field
      const hasMelee = range.includes("melee");
      // Check for a number in the range field using regex (e.g., "80", "30")
      const hasNumber = /\d+/.test(range);

      if (hasMelee && hasNumber) {
        return "both"; // Both "melee" and a number (e.g., "Melee, 80 ft")
      } else if (hasMelee) {
        return "melee"; // Only "melee" (e.g., "Melee")
      } else if (hasNumber) {
        return "ranged"; // Only a number (e.g., "80 ft")
      }

      return "melee"; // Default to melee if neither condition is met
    }

    /**
     * Builds spell actions for character actors.
     * @returns {Promise<void>}
     */
    async #buildSpells() {
      const spells = this.items.filter(
        (item) => item.type === "spell" && item.system.prepared.value > 0
      );
      const spellMap = new Map();
      spells.forEach((spell) => {
        const level = parseInt(spell.system.spellLevel.value) || 0;
        const groupId = level === 0 ? "cantrips" : `level${level}`;
        if (!spellMap.has(groupId)) spellMap.set(groupId, []);
        spellMap.get(groupId).push({
          id: spell.id,
          name: spell.name,
          info1: {
            text: `${spell.system.prepared.value}/${this.actor.system.spellsPerLevel?.value[level.toString()] || ""}`,
          },
          system: { actionType: "spell", actionId: spell.id },
        });
      });
      for (const [groupId, actions] of spellMap) {
        const level = groupId === "cantrips" ? 0 : parseInt(groupId.replace("level", ""));
        this.addActions(actions, { id: groupId, name: `Level ${level}`, type: "system" });
        console.log(`Spells Level ${level} added:`, actions);
      }
    }

    /**
     * Builds inventory actions for character actors.
     * @returns {Promise<void>}
     */
    async #buildInventory() {
      const inventory = this.items.filter((item) =>
        ["item", "armor"].includes(item.type)
      );
      const actions = inventory.map((item) => {
        const acValue = item.system.armorClass?.value;
        return {
          id: item.id,
          name: item.name,
          icon1: acValue ? ICONS.shield : undefined,
          info1: { text: acValue ? `+${acValue}` : item.system.quantity?.value || "" },
          system: { actionType: "item", actionId: item.id },
        };
      });
      if (actions.length) {
        this.addActions(actions, { id: "inventory", name: "Inventory", type: "system" });
        console.log("Inventory actions added:", actions);
      }
    }

    /**
     * Builds feature actions for character actors.
     * @returns {Promise<void>}
     */
    async #buildFeatures() {
      const features = this.items.filter((item) => item.type === "feature");
      const actions = features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        icon1: feature.system.formula.value ? ICONS.rollable : undefined,
        system: { actionType: "feature", actionId: feature.id },
      }));
      if (actions.length) {
        this.addActions(actions, { id: "features", name: "Features", type: "system" });
        console.log("Features added:", actions);
      }
    }

    // Monster-specific methods
/**
 * Builds combat actions for monster actors.
 * @returns {Promise<void>}
 */
async #buildMonsterCombat() {
  console.log("Building monster combat actions");
  const actions = [
    {
      id: "initiative",
      name: "Initiative",
      icon1: ICONS.rollable, // D20 icon for initiative rolls
      system: { actionType: "combat", actionId: "initiative" },
    },
    {
      id: "hitDice",
      name: "Hit Dice",
      icon1: ICONS.rollable, // D20 icon for hit dice
      info1: {
        text: `${this.actor.system.hitDice.number}${this.actor.system.hitDice.size}${this.actor.system.hitDice.mod >= 0 ? "+" : ""}${this.actor.system.hitDice.mod}`,
      },
      system: { actionType: "monsterCombat", actionId: "hitDice" },
    },
    {
      id: "monsterSaves",
      name: "Monster Saves",
      icon1: ICONS.saves, // Shield-alt icon for saves
      info1: { text: this.actor.system.msaves.value === "M, P" ? "B" : this.actor.system.msaves.value || "N/A" },
      tooltip: this.actor.system.msaves.value === "M, P" ? "Mental and Physical" : this.actor.system.msaves.value || "N/A",
      system: { actionType: "monsterCombat", actionId: "monsterSaves" },
    },
    {
      id: "ac",
      name: "Armor Class",
      info1: { text: this.actor.system.armorClass.value || "N/A" },
      system: { actionType: "monsterCombat", actionId: "ac" },
    },
    {
      id: "baseToHit",
      name: "Base to Hit",
      info1: { text: this.actor.system.attackBonus.value ? `+${this.actor.system.attackBonus.value}` : "N/A" },
      system: { actionType: "monsterCombat", actionId: "baseToHit" },
    },
  ];

  // Add weapons from the monster's items
  const weapons = this.items.filter((item) => item.type === "weapon");
  weapons.forEach((weapon) => {
    const weaponType = this.#determineWeaponType(weapon);
    console.log(`Monster Weapon: ${weapon.name}, Type: ${weaponType}, Damage: ${weapon.system.damage.value}, ID: ${weapon._id}`);
    if (weaponType === "melee") {
      actions.push({
        id: `weapon-${weapon._id}`,
        name: weapon.name,
        icon1: ICONS.melee,
        info1: { text: weapon.system.damage.value || "" },
        system: { actionType: "weapon", actionId: weapon._id, attackType: "melee", weaponType: weaponType },
      });
    } else if (weaponType === "ranged") {
      actions.push({
        id: `weapon-${weapon._id}`,
        name: weapon.name,
        icon1: ICONS.ranged,
        info1: { text: weapon.system.damage.value || "" },
        system: { actionType: "weapon", actionId: weapon._id, attackType: "ranged", weaponType: weaponType },
      });
    } else if (weaponType === "both") {
      actions.push({
        id: `weapon-${weapon._id}-melee`,
        name: weapon.name,
        icon1: ICONS.melee,
        info1: { text: weapon.system.damage.value || "" },
        system: { actionType: "weapon", actionId: weapon._id, attackType: "melee", weaponType: weaponType },
      });
      actions.push({
        id: `weapon-${weapon._id}-ranged`,
        name: weapon.name,
        icon1: ICONS.ranged,
        info1: { text: weapon.system.damage.value || "" },
        system: { actionType: "weapon", actionId: weapon._id, attackType: "ranged", weaponType: weaponType },
      });
    }
  });

  console.log("Monster combat actions built:", JSON.stringify(actions, null, 2));
  this.addActions(actions, { id: "combat", name: "Combat", type: "system" });
  console.log("Monster combat actions added:", actions);
}

    /**
     * Builds spell actions for monster actors.
     * @returns {Promise<void>}
     */
    async #buildMonsterSpells() {
      console.log("Building monster spells");
      const spells = this.items.filter(
        (item) => item.type === "spell" && item.system.prepared.value > 0
      );
      const spellMap = new Map();
      spells.forEach((spell) => {
        const level = parseInt(spell.system.spellLevel.value) || 0;
        const groupId = level === 0 ? "cantrips" : `level${level}`;
        if (!spellMap.has(groupId)) spellMap.set(groupId, []);
        spellMap.get(groupId).push({
          id: spell.id,
          name: spell.name,
          info1: { text: `${spell.system.prepared.value}` },
          system: { actionType: "spell", actionId: spell.id },
        });
      });
      for (const [groupId, actions] of spellMap) {
        const level = groupId === "cantrips" ? 0 : parseInt(groupId.replace("level", ""));
        this.addActions(actions, { id: groupId, name: `Level ${level}`, type: "system" });
        console.log(`Monster spells Level ${level} added:`, actions);
      }
    }

    /**
     * Builds feature actions for monster actors.
     * @returns {Promise<void>}
     */
    async #buildMonsterFeatures() {
      console.log("Building monster features");
      const features = this.items.filter((item) => item.type === "feature");
      const actions = features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        icon1: feature.system.formula.value ? ICONS.rollable : undefined,
        system: { actionType: "feature", actionId: feature.id },
      }));
      if (actions.length) {
        this.addActions(actions, { id: "features", name: "Features", type: "system" });
        console.log("Monster features added:", actions);
      }
    }

    /**
     * Builds stat actions for monster actors.
     * @returns {Promise<void>}
     */
    async #buildMonsterStats() {
      console.log("Building monster stats");
      // Mapping of full alignments to abbreviations
      const alignmentMap = {
        "Lawful Good": "LG",
        "Lawful Neutral": "LN",
        "Lawful Evil": "LE",
        "Neutral Good": "NG",
        "True Neutral": "TN",
        "Neutral Evil": "NE",
        "Chaotic Good": "CG",
        "Chaotic Neutral": "CN",
        "Chaotic Evil": "CE",
        "Good Lawful": "GL",
        "Good Neutral": "GN",
        "Good Chaotic": "GC",
        "Neutral Lawful": "NL",
        "Neutral Chaotic": "NC",
        "Evil Lawful": "EL",
        "Evil Neutral": "EN",
        "Evil Chaotic": "EC",
      };

      // Mapping of abbreviations back to full alignments
      const reverseAlignmentMap = {
        "LG": "Lawful Good",
        "LN": "Lawful Neutral",
        "LE": "Lawful Evil",
        "NG": "Neutral Good",
        "TN": "True Neutral",
        "NE": "Neutral Evil",
        "CG": "Chaotic Good",
        "CN": "Chaotic Neutral",
        "CE": "Chaotic Evil",
        "GL": "Good Lawful",
        "GN": "Good Neutral",
        "GC": "Good Chaotic",
        "NL": "Neutral Lawful",
        "NC": "Neutral Chaotic",
        "EL": "Evil Lawful",
        "EN": "Evil Neutral",
        "EC": "Evil Chaotic",
      };

      const fullAlignment = this.actor.system.alignment.value || "N/A";
      const abbreviatedAlignment =
        alignmentMap[fullAlignment] ||
        fullAlignment.split(" ").map((word) => word.charAt(0)).join("") ||
        "N/A";

      const actions = [
        {
          id: "xp",
          name: "XP",
          info1: { text: this.actor.system.xp.value || "N/A" }, // Default to "N/A" if undefined
          system: { actionType: "monsterStats", actionId: "xp" },
        },
        {
          id: "treasureType",
          name: "Treasure Type",
          info1: { text: this.actor.system.treasureType.value || "N/A" },
          system: { actionType: "monsterStats", actionId: "treasureType" },
        },
        {
          id: "alignment",
          name: "Alignment",
          info1: { text: abbreviatedAlignment },
          tooltip: reverseAlignmentMap[abbreviatedAlignment] || fullAlignment,
          system: { actionType: "monsterStats", actionId: "alignment" },
        },
        {
          id: "size",
          name: "Size",
          info1: { text: this.actor.system.size.value || "N/A" },
          system: { actionType: "monsterStats", actionId: "size" },
        },
        {
          id: "type",
          name: "Type",
          info1: { text: this.actor.system.type.value || "N/A" },
          system: { actionType: "monsterStats", actionId: "type" },
        },
        {
          id: "intelligence",
          name: "Intelligence",
          info1: { text: this.actor.system.monsterINT.value || "N/A" },
          system: { actionType: "monsterStats", actionId: "intelligence" },
        },
        {
          id: "moveSpeed",
          name: "Move Speed",
          info1: { text: this.actor.system.move.value || "N/A" },
          system: { actionType: "monsterStats", actionId: "moveSpeed" },
        },
      ];
      console.log("Monster stats built:", JSON.stringify(actions, null, 2));
      this.addActions(actions, { id: "monsterStats", name: "Stats", type: "system" });
      console.log("Monster stats added:", actions);
    }
  }

  /**
   * @class RollHandlerCnC
   * @extends coreModule.api.RollHandler
   * @description Handles the execution of actions when clicked in the Token Action HUD.
   */
  class RollHandlerCnC extends coreModule.api.RollHandler {
    /**
     * Handles the click event on an action button.
     * @param {Event} event - The click event
     * @returns {Promise<void>}
     */
    async handleActionClick(event) {
      const { actionType, actionId, attackType } = this.action.system;
      console.log("Handling action click:", { actionType, actionId, attackType });
      if (!this.actor) {
        for (const token of canvas.tokens.controlled) {
          await this.handleAction(event, actionType, token.actor, token, actionId, attackType);
        }
      } else {
        await this.handleAction(event, actionType, this.actor, this.token, actionId, attackType);
      }
    }

    /**
     * Executes the specific action based on its type.
     * @param {Event} event - The click event
     * @param {string} actionType - Type of action
     * @param {Object} actor - The actor object
     * @param {Object} token - The token object
     * @param {string} actionId - ID of the action
     * @param {string} attackType - Type of attack (if applicable)
     * @returns {Promise<void>}
     */
    async handleAction(event, actionType, actor, token, actionId, attackType) {
      if (!actor) return ui.notifications.warn("No actor selected.");
      const rollMode = game.settings.get("core", "rollMode");

      console.log("Handling action:", { actionType, actionId, attackType, actor: actor.name, type: actor.type });

      switch (actionType) {
        case "attribute":
          await this.#rollAttribute(actor, actionId, rollMode);
          break;
        case "combat":
          if (actionId === "initiative") {
            const roll = new Roll("1d10");
            await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Initiative", rollMode });
          }
          break;
        case "weapon":
          await this.#rollWeapon(actor, actionId, rollMode, attackType);
          break;
        case "spell":
          await this.#rollSpell(actor, actionId, rollMode);
          break;
        case "item":
          await this.#rollItem(actor, actionId, rollMode);
          break;
        case "feature":
          await this.#rollFeature(actor, actionId, rollMode);
          break;
        case "monsterCombat":
          await this.#rollMonsterCombat(actor, actionId, rollMode);
          break;
        case "monsterStats":
          await this.#rollMonsterStats(actor, actionId, rollMode);
          break;
        default:
          console.warn("Unhandled action type:", actionType);
      }
    }

    /**
     * Rolls an attribute check for the actor.
     * @param {Object} actor - The actor object
     * @param {string} actionId - The ability key (e.g., "str")
     * @param {string} rollMode - The roll mode
     * @returns {Promise<void>}
     */
    async #rollAttribute(actor, actionId, rollMode) {
      const ability = actor.system.abilities[actionId];
      const bonus = ability.bonus || 0;
      const level = actor.system.level?.value || 0;
      const target = ability.ccprimary ? 12 : 18;
      const abilityName = {
        str: "Strength",
        dex: "Dexterity",
        con: "Constitution",
        int: "Intelligence",
        wis: "Wisdom",
        cha: "Charisma",
      }[actionId];
      const roll = new Roll(`1d20 + ${bonus} + ${level}`);
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `${ability.ccprimary ? "(P) " : ""}${abilityName} (Base: ${target})`,
        rollMode,
      });
    }

/**
 * Rolls a weapon attack for the actor.
 * @param {Object} actor - The actor object
 * @param {string} actionId - The weapon ID
 * @param {string} rollMode - The roll mode
 * @param {string} attackType - The attack type (melee or ranged)
 * @returns {Promise<void>}
 */
async #rollWeapon(actor, actionId, rollMode, attackType) {
  console.log("Rolling weapon:", { actionId, attackType });
  const weapon = actor.items.get(actionId);
  if (!weapon) {
    console.error(`Weapon with ID ${actionId} not found in actor ${actor.name}`);
    ui.notifications.warn(`Weapon with ID ${actionId} not found.`);
    return;
  }
  const system = actor.system;
  const isMelee = attackType === "melee";
  let attackParts = ["1d20"];
  let rollData = {};
  const attackBonus = parseInt(String(system.attackBonus?.value || 0));
  if (attackBonus) {
    attackParts.push(`${attackBonus}`);
    rollData.attackBonus = attackBonus;
  }
  let abilityMod = 0;
  let abilityUsed = "";
  if (actor.type === "character") {
    if (isMelee) {
      if (["dagger", "rapier", "short sword"].some((w) => weapon.name.toLowerCase().includes(w))) {
        const strMod = system.abilities.str?.bonus || 0;
        const dexMod = system.abilities.dex?.bonus || 0;
        abilityMod = Math.max(strMod, dexMod);
        abilityUsed = abilityMod === strMod ? "STR" : "DEX";
      } else {
        abilityMod = system.abilities.str?.bonus || 0;
        abilityUsed = "STR";
      }
    } else {
      abilityMod = system.abilities.dex?.bonus || 0;
      abilityUsed = "DEX";
    }
    if (abilityMod !== 0) {
      attackParts.push(`${abilityMod}`);
      rollData.abilityMod = abilityMod;
    }
  }
  const weaponBonus = parseInt(String(weapon.system.bonusAb?.value || 0));
  if (weaponBonus) {
    attackParts.push(`${weaponBonus}`);
    rollData.weaponBonus = weaponBonus;
  }
  const attackFormula = attackParts.join(" + ");
  console.log(`Attack roll formula: ${attackFormula}`);
  const attackRoll = new Roll(attackFormula, rollData);
  let attackFlavor = `Roll: <b>${isMelee ? "Melee Attack" : "Ranged Attack"} → ${weapon.name}</b>`;
  if (game.settings.get("castles-and-crusades", "showDetailedFormulas")) {
    const detailedParts = ["1d20"];
    if (attackBonus) detailedParts.push("@attackBonus");
    if (abilityMod) detailedParts.push(`@abilities.${abilityUsed.toLowerCase()}.bonus`);
    if (weaponBonus) detailedParts.push(`${weaponBonus}`);
    attackFlavor += `<br><em>(${detailedParts.join(" + ")})</em>`;
  }
  await attackRoll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: attackFlavor, rollMode });
  if (weapon.system.damage.value) {
    let damageFormula = weapon.system.damage.value;
    const strMod = actor.type === "character" ? (system.abilities.str?.bonus || 0) : 0;
    console.log(`Weapon type: ${this.action.system.weaponType}, isMelee: ${isMelee}, strMod: ${strMod}, abilityUsed: ${abilityUsed}, abilityMod: ${abilityMod}`);
    if ((isMelee && actor.type === "character" && abilityUsed === "STR" && abilityMod !== 0) || (this.action.system.weaponType === "both" && actor.type === "character" && strMod !== 0)) {
      damageFormula = `${damageFormula} + ${this.action.system.weaponType === "both" ? strMod : abilityMod}`;
    }
    const damageRoll = new Roll(damageFormula, actor.getRollData());
    let damageFlavor = `${weapon.name} Damage`;
    if (game.settings.get("castles-and-crusades", "showDetailedFormulas")) {
      const detailedDamageParts = [weapon.system.damage.value];
      if ((isMelee && actor.type === "character" && abilityUsed === "STR" && abilityMod !== 0) || (this.action.system.weaponType === "both" && actor.type === "character" && strMod !== 0)) {
        detailedDamageParts.push(this.action.system.weaponType === "both" ? "@abilities.str.bonus" : `@abilities.${abilityUsed.toLowerCase()}.bonus`);
      }
      damageFlavor += `<br><em>(${detailedDamageParts.join(" + ")})</em>`;
    }
    await damageRoll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: damageFlavor, rollMode });
  }
}

    /**
     * Rolls a spell effect for the actor.
     * @param {Object} actor - The actor object
     * @param {string} actionId - The spell ID
     * @param {string} rollMode - The roll mode
     * @returns {Promise<void>}
     */
    async #rollSpell(actor, actionId, rollMode) {
      const spell = actor.items.get(actionId);
      if (!spell) return;
      if (spell.system.prepared.value <= 0) {
        ui.notifications.warn(`${spell.name} is not prepared.`);
        return;
      }
      if (spell.system.spelldmg.value) {
        const roll = new Roll(spell.system.spelldmg.value);
        await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${spell.name} Effect`, rollMode });
      } else {
        await spell.roll({ rollMode });
      }
      await spell.update({ "system.prepared.value": spell.system.prepared.value - 1 });
    }

    /**
     * Displays item information for the actor.
     * @param {Object} actor - The actor object
     * @param {string} actionId - The item ID
     * @param {string} rollMode - The roll mode
     * @returns {Promise<void>}
     */
    async #rollItem(actor, actionId, rollMode) {
      const item = actor.items.get(actionId);
      if (!item) return;
      if (item.type === "armor") {
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `${actor.name} is wearing ${item.name} (+${item.system.armorClass.value})`,
          rollMode,
        });
      } else {
        ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: item.name, rollMode });
      }
    }

    /**
     * Rolls or displays a feature effect for the actor.
     * @param {Object} actor - The actor object
     * @param {string} actionId - The feature ID
     * @param {string} rollMode - The roll mode
     * @returns {Promise<void>}
     */
    async #rollFeature(actor, actionId, rollMode) {
      const feature = actor.items.get(actionId);
      if (!feature) return;
      if (feature.system.formula.value) {
        const roll = new Roll(feature.system.formula.value, actor.getRollData());
        const hoverText = feature.system.feature?.value || "";
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: `${feature.name}${hoverText ? "<br>" + hoverText : ""}`,
          rollMode,
        });
      } else {
        const description = feature.system.description || "";
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `${feature.name}${description ? "<br>" + description : ""}`,
          rollMode,
        });
      }
    }

    /**
     * Rolls a monster combat action (e.g., Hit Dice or Monster Saves).
     * @param {Object} actor - The actor object
     * @param {string} actionId - The action ID
     * @param {string} rollMode - The roll mode
     * @returns {Promise<void>}
     */
    async #rollMonsterCombat(actor, actionId, rollMode) {
      if (actionId === "hitDice") {
        const formula = `${actor.system.hitDice.number}${actor.system.hitDice.size}${actor.system.hitDice.mod >= 0 ? "+" : ""}${actor.system.hitDice.mod}`;
        const roll = new Roll(formula);
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: `Hit Dice (${formula})`,
          rollMode,
        });
      } else if (actionId === "monsterSaves") {
        const roll = new Roll(`1d20 + ${actor.system.hitDice.number}`);
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: `Monster Saves (${actor.system.msaves.value})`,
          rollMode,
        });
      }
    }

    /**
 * Rolls or displays a monster stat action (e.g., Number Appearing).
 * @param {Object} actor - The actor object
 * @param {string} actionId - The action ID
 * @param {string} rollMode - The roll mode
 * @returns {Promise<void>}
 */
async #rollMonsterStats(actor, actionId, rollMode) {
  if (actionId === "numberAppearing") {
    const range = this.actor.system.numberAppearing.value;
    let roll;
    if (range.includes("-")) {
      const [min, max] = range.split("-").map(Number);
      roll = new Roll(`1d${max - min + 1} + ${min - 1}`);
    } else {
      roll = new Roll("1d1");
    }
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Number Appearing (${range})`,
      rollMode,
    });
  } else {
    const statMap = {
      xp: "XP",
      treasureType: "Treasure Type",
      alignment: "Alignment",
      size: "Size",
      type: "Type",
      intelligence: "Intelligence",
    };
    const statValue = actor.system[actionId === "intelligence" ? "monsterINT" : actionId].value;
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `${statMap[actionId]}: ${statValue}`,
      rollMode,
    });
  }
}
  }

  /**
   * @class CnCSystemManager
   * @extends coreModule.api.SystemManager
   * @description Manages the system integration with Token Action HUD.
   */
  class CnCSystemManager extends coreModule.api.SystemManager {
    /**
     * Returns the custom action handler for Castles & Crusades.
     * @returns {ActionHandlerCnC} The action handler instance
     */
    getActionHandler() {
      return new ActionHandlerCnC();
    }

    /**
     * Returns available roll handlers for the system.
     * @returns {Object} Mapping of handler IDs to names
     */
    getAvailableRollHandlers() {
      return { core: "Core Castles & Crusades" };
    }

    /**
     * Returns the roll handler instance for the given ID.
     * @param {string} handlerId - The handler ID
     * @returns {RollHandlerCnC} The roll handler instance
     */
    getRollHandler(handlerId) {
      return new RollHandlerCnC();
    }

    /**
     * Registers default layout and group settings for the HUD.
     * @returns {Object} Default configuration for HUD layout and groups
     */
    async registerDefaults() {
      const GROUP = {
        attributes: { id: "attributes", name: "Attributes", type: "system", settings: { collapse: false } },
        combat: { id: "combat", name: "Combat", type: "system", settings: { collapse: false } },
        inventory: { id: "inventory", name: "Inventory", type: "system", settings: { collapse: false } },
        features: { id: "features", name: "Features", type: "system", settings: { collapse: false } },
        monsterStats: { id: "monsterStats", name: "Stats", type: "system", settings: { collapse: false } },
      };

      const spellGroups = [];
      for (let level = 0; level <= 9; level++) {
        const groupId = level === 0 ? "cantrips" : `level${level}`;
        GROUP[groupId] = { id: groupId, name: `Level ${level}`, type: "system", settings: { collapse: false } };
        spellGroups.push({ ...GROUP[groupId], nestId: `spells_${groupId}` });
      }

      const defaults = {
        layout: [
          { nestId: "attributes", id: "attributes", name: "Attributes", groups: [{ ...GROUP.attributes, nestId: "attributes_attributes" }], settings: { collapse: false } },
          { nestId: "combat", id: "combat", name: "Combat", groups: [{ ...GROUP.combat, nestId: "combat_combat" }], settings: { collapse: false } },
          { nestId: "spells", id: "spells", name: "Spells", groups: spellGroups, settings: { collapse: false } },
          { nestId: "inventory", id: "inventory", name: "Inventory", groups: [{ ...GROUP.inventory, nestId: "inventory_inventory" }], settings: { collapse: false } },
          { nestId: "features", id: "features", name: "Features", groups: [{ ...GROUP.features, nestId: "features_features" }], settings: { collapse: false } },
          { nestId: "monsterStats", id: "monsterStats", name: "Stats", groups: [{ ...GROUP.monsterStats, nestId: "monsterStats_monsterStats" }], settings: { collapse: false } },
        ],
        groups: Object.values(GROUP),
      };

      console.log("Registering defaults:", defaults);
      return defaults;
    }
  }

  // Register the module with Foundry VTT
  const module = game.modules.get("fvtt-token-action-hud-castles-and-crusades");
  module.api = { requiredCoreModuleVersion: "2.0", SystemManager: CnCSystemManager };
  Hooks.call("tokenActionHudSystemReady", module);
  console.log("C&C TAH system registered");
});